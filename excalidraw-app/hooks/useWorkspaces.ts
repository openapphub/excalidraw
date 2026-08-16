import { useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { appJotaiStore, useAtom, useSetAtom, useAtomValue } from "../app-jotai";
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
import { navigateTo, parseUrl } from "../router";
import {
  canCommitWorkspaceMutation,
  getWorkspaceDeleteRedirect,
} from "../components/Workspace/workspaceMutationRouting";

interface CreateWorkspaceData {
  name: string;
  slug: string;
  type: WorkspaceType;
}

const EMPTY_WORKSPACES: Workspace[] = [];

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
    data: fetchedWorkspaces = EMPTY_WORKSPACES,
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
    if (!isAuthenticated) {
      setWorkspaces([]);
      if (currentWorkspace) {
        setCurrentWorkspaceAtom(null);
      }
      return;
    }
    setWorkspaces(fetchedWorkspaces as WorkspaceData[]);

    // URL slug 是当前 Workspace 的权威来源；无匹配项时必须清空旧选择，
    // 不能在一个无效/已删除的 URL 下继续展示上一个 Workspace 的缓存。
    if (currentWorkspaceSlugFromAtom) {
      const workspaceFromUrl = fetchedWorkspaces.find(
        (w) => w.slug === currentWorkspaceSlugFromAtom,
      );
      if (workspaceFromUrl) {
        if (workspaceFromUrl.id !== currentWorkspace?.id) {
          setCurrentWorkspaceAtom(workspaceFromUrl as WorkspaceData);
        }
      } else if (currentWorkspace) {
        setCurrentWorkspaceAtom(null);
      }
      return;
    }

    if (fetchedWorkspaces.length === 0) {
      if (currentWorkspace) {
        setCurrentWorkspaceAtom(null);
      }
      return;
    }

    // 没有 URL 指定或首次进入时回退到第一个工作区。
    if (!currentWorkspace) {
      setCurrentWorkspaceAtom(fetchedWorkspaces[0] as WorkspaceData);
      setCurrentWorkspaceSlug(fetchedWorkspaces[0].slug);
    }
  }, [
    isAuthenticated,
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
      setCurrentWorkspaceSlug(workspace?.slug ?? null);
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.collections.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
      ]);

      return workspace;
    },
    [queryClient],
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
      const workspaceAtStart = appJotaiStore.get(currentWorkspaceAtom);
      await deleteWorkspaceApi(workspaceId);
      const updatedWorkspaces = await listWorkspaces();
      const currentWorkspaceAfterDelete =
        appJotaiStore.get(currentWorkspaceAtom);
      const currentRoute = parseUrl();
      const selectedFallback = updatedWorkspaces.find(
        (workspace) => workspace.id === currentWorkspaceAfterDelete?.id,
      );
      const fallbackWorkspace =
        selectedFallback ?? updatedWorkspaces[0] ?? null;

      if (
        workspaceAtStart?.id === workspaceId &&
        canCommitWorkspaceMutation({
          mutationWorkspaceId: workspaceId,
          mutationWorkspaceSlug: workspaceAtStart.slug,
          currentWorkspaceId: currentWorkspaceAfterDelete?.id ?? null,
          currentRoute,
        })
      ) {
        setCurrentWorkspace(fallbackWorkspace);
      }

      if (workspaceAtStart?.id === workspaceId) {
        const redirect = getWorkspaceDeleteRedirect({
          deletedWorkspaceSlug: workspaceAtStart.slug,
          currentRoute,
          fallbackWorkspaceSlug: fallbackWorkspace?.slug ?? null,
        });
        if (redirect) {
          navigateTo(redirect);
        }
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.collections.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.notifications.all,
        }),
      ]);
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
