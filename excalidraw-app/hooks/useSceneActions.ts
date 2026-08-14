import { useCallback } from "react";
import { t } from "@excalidraw/excalidraw/i18n";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { showError, showSuccess } from "../utils/toast";
import { queryKeys } from "../lib/queryClient";
import {
  deleteScene as deleteSceneApi,
  updateScene as updateSceneApi,
  duplicateScene as duplicateSceneApi,
  type WorkspaceScene,
} from "../auth/workspaceApi";

interface UseSceneActionsOptions {
  /**
   * Workspace ID for cache key targeting.
   * Required for optimistic updates to work correctly.
   */
  workspaceId: string | undefined;

  /**
   * Collection ID for cache key targeting.
   * Can be null for "all scenes" view.
   */
  collectionId?: string | null;

  /**
   * Optional callback when a scene is successfully renamed.
   * Useful for updating the current scene title in the header.
   */
  onSceneRenamed?: (sceneId: string, newTitle: string) => void;
}

interface UseSceneActionsResult {
  /**
   * Delete a scene after confirmation.
   * Uses optimistic update - UI updates immediately, rolls back on error.
   * @returns true if deleted, false if cancelled or failed
   */
  deleteScene: (sceneId: string) => Promise<boolean>;

  /**
   * Rename a scene.
   * Uses optimistic update - UI updates immediately, rolls back on error.
   * @returns true if renamed successfully, false if failed
   */
  renameScene: (sceneId: string, newTitle: string) => Promise<boolean>;

  /**
   * Duplicate a scene.
   * No optimistic update (we don't know the new scene's ID/data until API responds).
   * @returns the new scene if successful, null if failed
   */
  duplicateScene: (sceneId: string) => Promise<WorkspaceScene | null>;

  /** True if a delete operation is in progress */
  isDeleting: boolean;

  /** True if a rename operation is in progress */
  isRenaming: boolean;

  /** True if a duplicate operation is in progress */
  isDuplicating: boolean;
}

/**
 * Hook for scene CRUD operations with optimistic updates.
 *
 * Uses React Query's useMutation with optimistic updates:
 * - UI updates immediately when user performs action
 * - If API fails, UI rolls back to previous state
 * - Toast notification shown on error
 *
 * Centralizes delete/rename/duplicate logic that was previously duplicated in:
 * - WorkspaceSidebar.tsx
 * - DashboardView.tsx
 * - CollectionView.tsx
 * - SearchResultsView.tsx
 *
 * @example
 * ```typescript
 * const { deleteScene, renameScene, duplicateScene, isDeleting } = useSceneActions({
 *   workspaceId: workspace?.id,
 *   collectionId: activeCollectionId,
 * });
 *
 * // Delete with confirmation (optimistic)
 * await deleteScene(scene.id);
 *
 * // Rename (optimistic)
 * await renameScene(scene.id, "New Title");
 *
 * // Duplicate and get new scene
 * const newScene = await duplicateScene(scene.id);
 * ```
 */
export function useSceneActions({
  workspaceId,
  collectionId,
  onSceneRenamed,
}: UseSceneActionsOptions): UseSceneActionsResult {
  const queryClient = useQueryClient();

  // Helper to get the query key for the current view
  const getQueryKey = useCallback(() => {
    if (!workspaceId) {
      return null;
    }
    return queryKeys.scenes.list(workspaceId, collectionId);
  }, [workspaceId, collectionId]);

  // ============================================
  // DELETE SCENE MUTATION (with optimistic update)
  // ============================================
  const deleteMutation = useMutation({
    mutationKey: queryKeys.mutations.deleteScene,
    mutationFn: async (sceneId: string) => {
      await deleteSceneApi(sceneId);
      return sceneId;
    },
    onMutate: async (sceneId: string) => {
      const queryKey = getQueryKey();
      if (!queryKey) {
        return { previousScenes: undefined };
      }

      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousScenes =
        queryClient.getQueryData<WorkspaceScene[]>(queryKey);

      // Optimistically remove the scene
      queryClient.setQueryData<WorkspaceScene[]>(queryKey, (old) =>
        old ? old.filter((s) => s.id !== sceneId) : [],
      );

      return { previousScenes };
    },
    onError: (_err, _sceneId, context) => {
      // Rollback to the previous value on error
      const queryKey = getQueryKey();
      if (queryKey && context?.previousScenes) {
        queryClient.setQueryData(queryKey, context.previousScenes);
      }
      console.error("Failed to delete scene:", _err);
      showError(t("workspace.deleteSceneError") || "Failed to delete scene");
    },
    onSettled: () => {
      // Always invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
    },
  });

  // ============================================
  // RENAME SCENE MUTATION (with optimistic update)
  // ============================================
  const renameMutation = useMutation({
    mutationKey: queryKeys.mutations.renameScene,
    mutationFn: async ({
      sceneId,
      newTitle,
    }: {
      sceneId: string;
      newTitle: string;
    }) => {
      const updatedScene = await updateSceneApi(sceneId, { title: newTitle });
      return updatedScene;
    },
    onMutate: async ({ sceneId, newTitle }) => {
      const queryKey = getQueryKey();
      if (!queryKey) {
        return { previousScenes: undefined };
      }

      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousScenes =
        queryClient.getQueryData<WorkspaceScene[]>(queryKey);

      // Optimistically update the scene title
      queryClient.setQueryData<WorkspaceScene[]>(queryKey, (old) =>
        old
          ? old.map((s) => (s.id === sceneId ? { ...s, title: newTitle } : s))
          : [],
      );

      return { previousScenes };
    },
    onSuccess: (updatedScene, { sceneId, newTitle }) => {
      // Call the callback if provided
      onSceneRenamed?.(sceneId, newTitle);

      // Update cache with the actual server response (has correct updatedAt, etc.)
      const queryKey = getQueryKey();
      if (queryKey) {
        queryClient.setQueryData<WorkspaceScene[]>(queryKey, (old) =>
          old
            ? old.map((s) => (s.id === updatedScene.id ? updatedScene : s))
            : [],
        );
      }
    },
    onError: (_err, _variables, context) => {
      // Rollback to the previous value on error
      const queryKey = getQueryKey();
      if (queryKey && context?.previousScenes) {
        queryClient.setQueryData(queryKey, context.previousScenes);
      }
      console.error("Failed to rename scene:", _err);
      showError(t("workspace.renameSceneError") || "Failed to rename scene");
    },
    onSettled: () => {
      // Always invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
    },
  });

  // ============================================
  // DUPLICATE SCENE MUTATION (no optimistic update)
  // ============================================
  const duplicateMutation = useMutation({
    mutationKey: queryKeys.mutations.duplicateScene,
    mutationFn: async (sceneId: string) => {
      const newScene = await duplicateSceneApi(sceneId);
      return newScene;
    },
    onSuccess: (newScene) => {
      // Add the new scene to the cache
      const queryKey = getQueryKey();
      if (queryKey) {
        queryClient.setQueryData<WorkspaceScene[]>(queryKey, (old) =>
          old ? [newScene, ...old] : [newScene],
        );
      }
      showSuccess(t("workspace.sceneDuplicated") || "Scene duplicated");
    },
    onError: (_err) => {
      console.error("Failed to duplicate scene:", _err);
      showError(
        t("workspace.duplicateSceneError") || "Failed to duplicate scene",
      );
    },
    onSettled: () => {
      // Always invalidate to ensure fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
    },
  });

  // ============================================
  // WRAPPER FUNCTIONS
  // ============================================

  const deleteScene = useCallback(
    async (sceneId: string): Promise<boolean> => {
      // Show confirmation dialog
      if (!confirm(t("workspace.confirmDeleteScene"))) {
        return false;
      }

      try {
        await deleteMutation.mutateAsync(sceneId);
        return true;
      } catch {
        // Error already handled in onError
        return false;
      }
    },
    [deleteMutation],
  );

  const renameScene = useCallback(
    async (sceneId: string, newTitle: string): Promise<boolean> => {
      try {
        await renameMutation.mutateAsync({ sceneId, newTitle });
        return true;
      } catch {
        // Error already handled in onError
        return false;
      }
    },
    [renameMutation],
  );

  const duplicateScene = useCallback(
    async (sceneId: string): Promise<WorkspaceScene | null> => {
      try {
        return await duplicateMutation.mutateAsync(sceneId);
      } catch {
        // Error already handled in onError
        return null;
      }
    },
    [duplicateMutation],
  );

  return {
    deleteScene,
    renameScene,
    duplicateScene,
    isDeleting: deleteMutation.isPending,
    isRenaming: renameMutation.isPending,
    isDuplicating: duplicateMutation.isPending,
  };
}
