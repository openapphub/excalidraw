import { useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { t } from "@excalidraw/excalidraw/i18n";

import { useAtom, useAtomValue, useSetAtom } from "../app-jotai";
import {
  activeCollectionIdAtom,
  triggerCollectionsRefreshAtom,
  collectionsAtom,
  privateCollectionAtom,
  activeCollectionAtom,
  type CollectionData,
} from "../components/Settings/settingsState";
import { showError } from "../utils/toast";
import { queryKeys } from "../lib/queryClient";
import {
  listCollections,
  createCollection as createCollectionApi,
  updateCollection as updateCollectionApi,
  deleteCollection as deleteCollectionApi,
  type Collection,
} from "../auth/workspaceApi";
import { parseUrl } from "../router";

/**
 * Fields needed for collection list views (sidebar, nav, etc.)
 * Using field filtering reduces payload size by ~40%
 */
const COLLECTION_LIST_FIELDS = [
  "id",
  "name",
  "icon",
  "isPrivate",
  "sceneCount",
  "canWrite",
  "isOwner",
];

interface CreateCollectionData {
  name: string;
  icon?: string;
}

interface UpdateCollectionData {
  name?: string;
  icon?: string;
}

interface UseCollectionsOptions {
  workspaceId: string | null;
}

interface UseCollectionsResult {
  collections: Collection[];
  isLoading: boolean;
  activeCollectionId: string | null;
  setActiveCollectionId: (id: string | null) => void;
  privateCollection: Collection | undefined;
  activeCollection: Collection | null;
  loadCollections: () => Promise<void>;
  createCollection: (data: CreateCollectionData) => Promise<Collection | null>;
  updateCollection: (
    id: string,
    data: UpdateCollectionData,
  ) => Promise<Collection | null>;
  deleteCollection: (id: string) => Promise<boolean>;
}

/**
 * Hook for collection CRUD operations.
 *
 * Uses React Query for data fetching and Jotai atoms for selection state:
 * - React Query: Fetches and caches collections list
 * - collectionsAtom: Synced from React Query data (for components that need it)
 * - activeCollectionIdAtom: Currently selected collection ID (client state)
 * - privateCollectionAtom: Derived atom for private collection
 * - activeCollectionAtom: Derived atom for active collection object
 */
export function useCollections({
  workspaceId,
}: UseCollectionsOptions): UseCollectionsResult {
  const queryClient = useQueryClient();

  // Jotai atoms for client state
  const [collections, setCollections] = useAtom(collectionsAtom);
  const [activeCollectionId, setActiveCollectionId] = useAtom(
    activeCollectionIdAtom,
  );
  const privateCollection = useAtomValue(privateCollectionAtom);
  const activeCollection = useAtomValue(activeCollectionAtom);
  const triggerCollectionsRefresh = useSetAtom(triggerCollectionsRefreshAtom);

  // Track if we've set the default collection to prevent infinite loops
  const hasSetDefaultCollectionRef = useRef(false);

  // React Query for fetching collections
  const {
    data: fetchedCollections = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.collections.list(workspaceId || ""),
    queryFn: () =>
      // Request only the fields needed for list views to reduce payload size
      listCollections(workspaceId!, { fields: COLLECTION_LIST_FIELDS }),
    enabled: !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Sync React Query data to Jotai atom
  useEffect(() => {
    if (fetchedCollections.length > 0) {
      setCollections(fetchedCollections as CollectionData[]);
    }
  }, [fetchedCollections, setCollections]);

  // Set default active collection to Private when collections are loaded
  // Skip if we're on a scene URL - let scene loading handle the collection selection
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.log("[useCollections] Default collection effect:", {
      collectionsLength: collections.length,
      activeCollectionId,
      hasSetDefault: hasSetDefaultCollectionRef.current,
    });

    if (
      collections.length > 0 &&
      !activeCollectionId &&
      !hasSetDefaultCollectionRef.current
    ) {
      // Don't set default collection if we're loading a scene from URL
      // The scene loader will set the correct collection from the scene data
      const route = parseUrl();
      // eslint-disable-next-line no-console
      console.log("[useCollections] Parsed route:", route.type);

      if (route.type === "scene") {
        // eslint-disable-next-line no-console
        console.log("[useCollections] Skipping default - scene URL detected");
        return;
      }

      const first = collections[0];
      if (first) {
        hasSetDefaultCollectionRef.current = true;
        setActiveCollectionId(first.id);
      }
    }
  }, [collections, activeCollectionId, setActiveCollectionId]);

  // Reset the default collection flag when workspace changes
  useEffect(() => {
    hasSetDefaultCollectionRef.current = false;
  }, [workspaceId]);

  // Load collections (triggers refetch)
  const loadCollections = useCallback(async () => {
    if (!workspaceId) {
      return;
    }
    await refetch();
  }, [workspaceId, refetch]);

  // Create collection
  const createCollection = useCallback(
    async (data: CreateCollectionData): Promise<Collection | null> => {
      if (!workspaceId || !data.name.trim()) {
        return null;
      }

      try {
        const collection = await createCollectionApi(workspaceId, {
          name: data.name.trim(),
          icon: data.icon,
        });

        // Update local state optimistically
        setCollections((prev) => [...prev, collection as CollectionData]);

        // Invalidate and refetch
        await queryClient.invalidateQueries({
          queryKey: queryKeys.collections.list(workspaceId),
        });

        triggerCollectionsRefresh();
        return collection;
      } catch (err) {
        console.error("Failed to create collection:", err);
        showError(
          t("workspace.createCollectionError") || "Failed to create collection",
        );
        return null;
      }
    },
    [workspaceId, setCollections, queryClient, triggerCollectionsRefresh],
  );

  // Update collection
  const updateCollection = useCallback(
    async (
      id: string,
      data: UpdateCollectionData,
    ): Promise<Collection | null> => {
      try {
        const updated = await updateCollectionApi(id, {
          name: data.name?.trim(),
          icon: data.icon || undefined,
        });

        // Update local state optimistically
        setCollections((prev) =>
          prev.map((c) =>
            c.id === updated.id ? (updated as CollectionData) : c,
          ),
        );

        // Invalidate cache
        if (workspaceId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.collections.list(workspaceId),
          });
        }

        triggerCollectionsRefresh();
        return updated;
      } catch (err) {
        console.error("Failed to update collection:", err);
        showError(
          t("workspace.updateCollectionError") || "Failed to update collection",
        );
        return null;
      }
    },
    [workspaceId, setCollections, queryClient, triggerCollectionsRefresh],
  );

  // Delete collection
  const deleteCollection = useCallback(
    async (collectionId: string): Promise<boolean> => {
      if (!confirm(t("workspace.confirmDeleteCollection"))) {
        return false;
      }

      try {
        await deleteCollectionApi(collectionId);

        // Update local state
        setCollections((prev) => prev.filter((c) => c.id !== collectionId));

        // If deleted collection was active, switch to private
        if (activeCollectionId === collectionId) {
          setActiveCollectionId(privateCollection?.id || null);
        }

        // Invalidate cache
        if (workspaceId) {
          await queryClient.invalidateQueries({
            queryKey: queryKeys.collections.list(workspaceId),
          });
        }

        triggerCollectionsRefresh();
        return true;
      } catch (err) {
        console.error("Failed to delete collection:", err);
        showError(
          t("workspace.deleteCollectionError") || "Failed to delete collection",
        );
        return false;
      }
    },
    [
      workspaceId,
      activeCollectionId,
      privateCollection,
      setActiveCollectionId,
      setCollections,
      queryClient,
      triggerCollectionsRefresh,
    ],
  );

  return {
    collections: collections as Collection[],
    isLoading,
    activeCollectionId,
    setActiveCollectionId,
    privateCollection: privateCollection as Collection | undefined,
    activeCollection: activeCollection as Collection | null,
    loadCollections,
    createCollection,
    updateCollection,
    deleteCollection,
  };
}
