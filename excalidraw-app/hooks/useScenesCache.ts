import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../lib/queryClient";
import { listWorkspaceScenes } from "../auth/workspaceApi";
import { isIndexedDbCanvasId } from "../data/canvasId";

import type { WorkspaceScene } from "../auth/workspaceApi";

/**
 * Fields needed for scene list views (SceneCard, dashboard, etc.)
 * Using field filtering reduces payload size by ~50%
 */
const SCENE_LIST_FIELDS = [
  "id",
  "title",
  "thumbnailUrl",
  "updatedAt",
  "isPublic",
  "canEdit",
  "collectionId", // Needed for filtering/grouping
];

interface UseScenesOptions {
  workspaceId: string | undefined;
  collectionId?: string | null;
  enabled?: boolean;
}

interface UseScenesResult {
  scenes: WorkspaceScene[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  updateScenes: (updater: (prev: WorkspaceScene[]) => WorkspaceScene[]) => void;
}

/**
 * Hook for fetching scenes with React Query caching.
 *
 * Features:
 * - Automatic caching and deduplication
 * - Stale-while-revalidate pattern (shows cached data, refreshes in background)
 * - Request deduplication (multiple components share one request)
 * - Automatic refetch on window focus
 *
 * @example
 * ```ts
 * const { scenes, isLoading, updateScenes } = useScenesCache({
 *   workspaceId: workspace?.id,
 *   collectionId: activeCollectionId,
 *   enabled: !!workspace?.id,
 * });
 * ```
 */
export function useScenesCache({
  workspaceId,
  collectionId,
  enabled = true,
}: UseScenesOptions): UseScenesResult {
  const queryClient = useQueryClient();

  // Build query key
  const queryKey = workspaceId
    ? queryKeys.scenes.list(workspaceId, collectionId)
    : ["scenes", "disabled"];

  const {
    data: scenes = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!workspaceId) {
        return [];
      }
      // Request only the fields needed for list views to reduce payload size
      const listed = await listWorkspaceScenes(
        workspaceId,
        collectionId || undefined,
        {
          fields: SCENE_LIST_FIELDS,
        },
      );
      // Workspace 只展示后端场景；IndexedDB UUID 即使误写入 SQLite 也不出现在列表。
      return listed.filter((scene) => !isIndexedDbCanvasId(scene.id));
    },
    enabled: enabled && !!workspaceId,
    // Show stale data immediately while refetching
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Keep unused data in cache for 30 minutes
    gcTime: 30 * 60 * 1000,
  });

  // Refetch wrapper that matches the old interface
  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  // Update scenes optimistically (for local mutations before server responds)
  // This updates the React Query cache directly
  const updateScenes = useCallback(
    (updater: (prev: WorkspaceScene[]) => WorkspaceScene[]) => {
      if (!workspaceId) {
        return;
      }

      queryClient.setQueryData<WorkspaceScene[]>(
        queryKeys.scenes.list(workspaceId, collectionId),
        (prev) => (prev ? updater(prev) : []),
      );
    },
    [queryClient, workspaceId, collectionId],
  );

  return {
    scenes,
    isLoading,
    error: error as Error | null,
    refetch,
    updateScenes,
  };
}

/**
 * Hook to invalidate scenes cache.
 *
 * Use this after creating, deleting, or moving scenes to ensure
 * all components show fresh data.
 *
 * @example
 * ```ts
 * const invalidateScenes = useInvalidateScenesCache();
 *
 * // After deleting a scene:
 * await deleteScene(sceneId);
 * invalidateScenes(workspaceId); // Invalidate all collections
 * // or
 * invalidateScenes(workspaceId, collectionId); // Invalidate specific collection
 * ```
 */
export function useInvalidateScenesCache() {
  const queryClient = useQueryClient();

  return useCallback(
    (workspaceId: string, collectionId?: string) => {
      if (collectionId) {
        // Invalidate specific collection
        queryClient.invalidateQueries({
          queryKey: queryKeys.scenes.list(workspaceId, collectionId),
        });
      } else {
        // Invalidate all scenes for this workspace
        queryClient.invalidateQueries({
          queryKey: ["scenes", workspaceId],
        });
      }
    },
    [queryClient],
  );
}
