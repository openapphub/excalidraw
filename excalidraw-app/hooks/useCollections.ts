import { useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { t } from "@excalidraw/excalidraw/i18n";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";

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
  getScene,
  type Collection,
} from "../auth/workspaceApi";
import { navigateTo, parseUrl } from "../router";
import { getCollectionDeleteRedirect } from "../components/Workspace/collectionMutationRouting";

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
const EMPTY_COLLECTIONS: Collection[] = [];

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
  const workspaceIdRef = useRef(workspaceId);
  const activeCollectionIdRef = useRef(activeCollectionId);
  workspaceIdRef.current = workspaceId;
  activeCollectionIdRef.current = activeCollectionId;

  // React Query for fetching collections
  const {
    data: fetchedCollections = EMPTY_COLLECTIONS,
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
    setCollections(fetchedCollections as CollectionData[]);
    if (
      activeCollectionId &&
      !fetchedCollections.some(
        (collection) => collection.id === activeCollectionId,
      )
    ) {
      // Workspace 切换或 Collection 删除后，旧 ID 不能继续参与新 Workspace
      // 的 Scene 查询，否则会把 workspaceId 与旧 collectionId 组合发送到后端。
      setActiveCollectionId(null);
    }
  }, [
    fetchedCollections,
    setCollections,
    activeCollectionId,
    setActiveCollectionId,
    workspaceId,
  ]);

  // Set default active collection to Private when collections are loaded
  // Skip if we're on a scene URL - let scene loading handle the collection selection
  useEffect(() => {
    if (
      collections.length > 0 &&
      !activeCollectionId &&
      !hasSetDefaultCollectionRef.current
    ) {
      // Don't set default collection if we're loading a scene from URL
      // The scene loader will set the correct collection from the scene data
      const route = parseUrl();
      if (route.type === "scene" || route.type === "collection") {
        // Scene/Collection URL 指定了资源身份。资源不存在时保持空状态，不能
        // 悄悄回退到第一个 Collection，让旧 URL 指向另一份内容。
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
      const mutationWorkspaceId = workspaceId;

      try {
        const collection = await createCollectionApi(mutationWorkspaceId, {
          name: data.name.trim(),
          icon: data.icon,
        });

        if (workspaceIdRef.current === mutationWorkspaceId) {
          setCollections((prev) => [...prev, collection as CollectionData]);
        }

        // Invalidate and refetch
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.collections.all,
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
        ]);

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
      if (!workspaceId) {
        return null;
      }
      const mutationWorkspaceId = workspaceId;
      try {
        const updated = await updateCollectionApi(id, {
          name: data.name?.trim(),
          icon: data.icon || undefined,
        });

        if (workspaceIdRef.current === mutationWorkspaceId) {
          setCollections((prev) =>
            prev.map((c) =>
              c.id === updated.id ? (updated as CollectionData) : c,
            ),
          );
        }

        // Invalidate cache
        if (workspaceId) {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeys.collections.all,
            }),
            queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
          ]);
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
      if (!workspaceId) {
        return false;
      }
      const mutationWorkspaceId = workspaceId;
      const confirmed = await openConfirmModal({
        title: t("workspace.delete"),
        description: t("workspace.confirmDeleteCollection"),
        actionLabel: t("workspace.delete"),
        color: "danger",
      });
      if (!confirmed) {
        return false;
      }

      try {
        const routeAtDelete = parseUrl();
        let currentSceneBelongsToCollection = false;
        if (routeAtDelete.type === "scene") {
          try {
            const currentScene = await getScene(routeAtDelete.sceneId);
            currentSceneBelongsToCollection =
              currentScene.collectionId === collectionId;
          } catch (error) {
            throw new Error("无法验证当前 Scene 的 Collection 归属。", {
              cause: error,
            });
          }
        }
        await deleteCollectionApi(collectionId);

        const isCurrentWorkspace =
          workspaceIdRef.current === mutationWorkspaceId;
        if (isCurrentWorkspace) {
          setCollections((prev) => prev.filter((c) => c.id !== collectionId));
        }

        // 删除 Collection 会删除其所属 Scene。所有 Scene 查询（包括
        // Dashboard 的 Recently modified）必须同步剔除，不能让旧卡片在
        // 网络回填前继续打开一个已经不存在的画布。
        queryClient.setQueriesData<
          import("../auth/workspaceApi").WorkspaceScene[]
        >({ queryKey: queryKeys.scenes.all }, (previous) =>
          previous?.filter((scene) => scene.collectionId !== collectionId),
        );

        // If deleted collection was active, switch to private
        if (
          isCurrentWorkspace &&
          activeCollectionIdRef.current === collectionId
        ) {
          setActiveCollectionId(privateCollection?.id || null);
        }
        const redirect = getCollectionDeleteRedirect({
          routeAtStart: routeAtDelete,
          currentRoute: parseUrl(),
          collectionId,
          currentSceneBelongsToCollection,
        });
        if (redirect) {
          navigateTo(redirect);
        }

        // Invalidate cache
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.collections.all,
          }),
          queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.notifications.all,
          }),
        ]);

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
      privateCollection,
      workspaceId,
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
