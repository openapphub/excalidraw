import { useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAtom, useSetAtom, useAtomValue } from "../app-jotai";
import {
  currentWorkspaceSlugAtom,
  workspacesAtom,
  currentWorkspaceAtom,
  type WorkspaceData,
} from "../components/Settings/settingsState";
import { queryKeys } from "../lib/queryClient";
import {
  listWorkspaces,
  createWorkspace as createWorkspaceApi,
  deleteWorkspace as deleteWorkspaceApi,
  type Workspace,
  type WorkspaceType,
} from "../auth/workspaceApi";

interface CreateWorkspaceData {
  name: string;
  slug: string;
  type: WorkspaceType;
}

interface UseWorkspacesOptions {
  isAuthenticated: boolean;
  /** External workspace passed from parent (e.g., when updated in settings) */
  externalWorkspace?: Workspace | null;
  /** Callback when workspace changes */
  onWorkspaceChange?: (
    workspace: Workspace,
    privateCollectionId: string | null,
  ) => void;
}

interface UseWorkspacesResult {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  isLoading: boolean;
  loadWorkspaces: () => Promise<void>;
  switchWorkspace: (workspace: Workspace) => void;
  createWorkspace: (data: CreateWorkspaceData) => Promise<Workspace>;
  deleteWorkspace: (workspaceId: string) => Promise<void>;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  generateSlug: (name: string) => string;
}

/**
 * Hook for workspace management - loading, switching, and creating workspaces.
 *
 * Uses React Query for data fetching and Jotai atoms for selection state:
 * - React Query: Fetches and caches workspaces list
 * - workspacesAtom: Synced from React Query data (for components that need it)
 * - currentWorkspaceAtom: Currently active workspace (client state)
 * - currentWorkspaceSlugAtom: Slug for URL routing (client state)
 */
export function useWorkspaces({
  isAuthenticated,
  externalWorkspace,
  onWorkspaceChange,
}: UseWorkspacesOptions): UseWorkspacesResult {
  const queryClient = useQueryClient();

  // Jotai atoms for client state (selection, not data)
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [currentWorkspace, setCurrentWorkspaceAtom] =
    useAtom(currentWorkspaceAtom);
  const setCurrentWorkspaceSlug = useSetAtom(currentWorkspaceSlugAtom);

  // Track last notified workspace to prevent duplicate onWorkspaceChange calls
  const lastNotifiedWorkspaceRef = useRef<string | null>(null);

  // React Query for fetching workspaces
  const {
    data: fetchedWorkspaces = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: listWorkspaces,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Get current workspace slug from atom (may be set from URL before workspaces load)
  const currentWorkspaceSlugFromAtom = useAtomValue(currentWorkspaceSlugAtom);

  // Sync React Query data to Jotai atom (for components that read from atom)
  useEffect(() => {
    if (fetchedWorkspaces.length > 0) {
      setWorkspaces(fetchedWorkspaces as WorkspaceData[]);

      // Auto-select workspace based on URL slug or default to first
      if (!currentWorkspace) {
        // Check if we have a workspace slug from URL (set before workspaces loaded)
        if (currentWorkspaceSlugFromAtom) {
          const workspaceFromUrl = fetchedWorkspaces.find(
            (w) => w.slug === currentWorkspaceSlugFromAtom,
          );
          if (workspaceFromUrl) {
            setCurrentWorkspaceAtom(workspaceFromUrl as WorkspaceData);
            return;
          }
        }
        // Fallback to first workspace
        setCurrentWorkspaceAtom(fetchedWorkspaces[0] as WorkspaceData);
        setCurrentWorkspaceSlug(fetchedWorkspaces[0].slug);
      }
    }
  }, [
    fetchedWorkspaces,
    currentWorkspace,
    currentWorkspaceSlugFromAtom,
    setWorkspaces,
    setCurrentWorkspaceAtom,
    setCurrentWorkspaceSlug,
  ]);

  // Helper to set current workspace (updates both atom and slug)
  const setCurrentWorkspace = useCallback(
    (workspace: Workspace | WorkspaceData | null) => {
      setCurrentWorkspaceAtom(workspace as WorkspaceData | null);
      if (workspace) {
        setCurrentWorkspaceSlug(workspace.slug);
      }
    },
    [setCurrentWorkspaceAtom, setCurrentWorkspaceSlug],
  );

  // Load workspaces (triggers refetch)
  const loadWorkspaces = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    await refetch();
  }, [isAuthenticated, refetch]);

  // Switch workspace
  const switchWorkspace = useCallback(
    (workspace: Workspace) => {
      setCurrentWorkspace(workspace);
    },
    [setCurrentWorkspace],
  );

  // Create workspace
  const createWorkspace = useCallback(
    async (data: CreateWorkspaceData): Promise<Workspace> => {
      const workspace = await createWorkspaceApi({
        name: data.name.trim(),
        slug: data.slug.trim(),
        type: data.type,
      });

      // Invalidate and refetch workspaces list
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.all,
      });

      // Switch to new workspace
      setCurrentWorkspace(workspace);

      return workspace;
    },
    [queryClient, setCurrentWorkspace],
  );

  // Generate slug from workspace name
  const generateSlug = useCallback((name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);
  }, []);

  // Delete workspace
  const deleteWorkspace = useCallback(
    async (workspaceId: string): Promise<void> => {
      await deleteWorkspaceApi(workspaceId);

      // Invalidate and refetch workspaces list
      await queryClient.invalidateQueries({
        queryKey: queryKeys.workspaces.all,
      });

      // Get updated workspaces and switch to first remaining one
      const updatedWorkspaces = await queryClient.fetchQuery({
        queryKey: queryKeys.workspaces.list(),
        queryFn: listWorkspaces,
      });

      if (updatedWorkspaces.length > 0) {
        setCurrentWorkspace(updatedWorkspaces[0]);
      } else {
        setCurrentWorkspace(null);
      }
    },
    [queryClient, setCurrentWorkspace],
  );

  // Sync with external workspace updates (e.g., when avatar/name is changed in settings)
  useEffect(() => {
    if (externalWorkspace && currentWorkspace) {
      if (
        externalWorkspace.id === currentWorkspace.id &&
        (externalWorkspace.avatarUrl !== currentWorkspace.avatarUrl ||
          externalWorkspace.name !== currentWorkspace.name)
      ) {
        setCurrentWorkspace(externalWorkspace);
        setWorkspaces((prev) =>
          prev.map((ws) =>
            ws.id === externalWorkspace.id
              ? (externalWorkspace as WorkspaceData)
              : ws,
          ),
        );
      }
    }
  }, [externalWorkspace, currentWorkspace, setCurrentWorkspace, setWorkspaces]);

  // Notify parent when workspace changes (only once per workspace)
  useEffect(() => {
    if (
      currentWorkspace &&
      onWorkspaceChange &&
      lastNotifiedWorkspaceRef.current !== currentWorkspace.id
    ) {
      lastNotifiedWorkspaceRef.current = currentWorkspace.id;
      // Note: privateCollectionId will be passed by the component using collections hook
      onWorkspaceChange(currentWorkspace as Workspace, null);
    }
  }, [currentWorkspace, onWorkspaceChange]);

  return {
    workspaces: workspaces as Workspace[],
    currentWorkspace: currentWorkspace as Workspace | null,
    isLoading,
    loadWorkspaces,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    setCurrentWorkspace,
    generateSlug,
  };
}
