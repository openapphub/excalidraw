import { useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../lib/queryClient";
import {
  listThreads,
  createThread,
  deleteThread,
  resolveThread,
  reopenThread,
  addComment,
  updateComment,
  deleteComment,
  updateThread,
} from "../auth/api/comments";
import { useCommentSyncContext } from "../components/Comments/CommentSyncContext";

import type {
  CommentThread,
  Comment,
  CreateThreadDto,
  CreateCommentDto,
  UpdateCommentDto,
} from "../auth/api/types";

// ============================================================================
// useCommentThreads - Fetch threads for a scene
// ============================================================================

interface UseCommentThreadsOptions {
  sceneId: string | undefined;
  enabled?: boolean;
  /** 侧栏打开时才轮询；图钉层关闭轮询，避免空转拖慢协作 */
  poll?: boolean;
}

interface UseCommentThreadsResult {
  threads: CommentThread[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching comment threads with React Query caching.
 *
 * Features:
 * - Automatic caching and deduplication
 * - Short stale time + 30s polling since comments change frequently
 * - Automatic refetch on window focus
 *
 * @example
 * ```ts
 * const { threads, isLoading } = useCommentThreads({
 *   sceneId: currentSceneId,
 *   enabled: !!currentSceneId,
 * });
 * ```
 */
export function useCommentThreads({
  sceneId,
  enabled = true,
  poll = false,
}: UseCommentThreadsOptions): UseCommentThreadsResult {
  const {
    data: threads = [],
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: sceneId
      ? queryKeys.commentThreads.list(sceneId)
      : ["commentThreads", "disabled"],
    queryFn: () => listThreads(sceneId!),
    enabled: enabled && !!sceneId,
    // 协作房间内走 WebSocket comment:event；未协作时靠短 staleTime + 轮询。
    staleTime: 15 * 1000,
    refetchInterval: poll ? 30 * 1000 : false,
    gcTime: 30 * 60 * 1000, // 30 minutes
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    threads,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// useCommentMutations - Create/delete/resolve threads and comments
// ============================================================================

interface UseCommentMutationsResult {
  // Thread operations
  createThread: (dto: CreateThreadDto) => Promise<CommentThread>;
  deleteThread: (threadId: string) => Promise<void>;
  toggleResolved: (params: {
    threadId: string;
    resolved: boolean;
  }) => Promise<CommentThread>;
  updateThreadPosition: (params: {
    threadId: string;
    x: number;
    y: number;
  }) => Promise<CommentThread>;

  // Comment operations
  addComment: (params: {
    threadId: string;
    dto: CreateCommentDto;
  }) => Promise<Comment>;
  updateComment: (params: {
    commentId: string;
    dto: UpdateCommentDto;
  }) => Promise<Comment>;
  deleteComment: (params: {
    threadId: string;
    commentId: string;
  }) => Promise<void>;

  // Loading states
  isCreatingThread: boolean;
  isDeletingThread: boolean;
  isAddingComment: boolean;
  isUpdatingPosition: boolean;
}

/**
 * Hook for comment thread mutations with optimistic updates.
 *
 * Automatically broadcasts changes to collaborators via WebSocket when
 * wrapped in a CommentSyncProvider during collaboration sessions.
 *
 * @param sceneId - Current scene ID
 *
 * @example
 * ```ts
 * const { createThread, toggleResolved, addComment } = useCommentMutations(sceneId);
 *
 * // Create a new thread (automatically syncs to collaborators)
 * await createThread({ x: 100, y: 200, content: "Review this" });
 *
 * // Toggle resolved state
 * await toggleResolved({ threadId: "abc", resolved: false }); // resolves it
 *
 * // Add a reply
 * await addComment({ threadId: "abc", dto: { content: "Done!" } });
 * ```
 */
export function useCommentMutations(
  sceneId: string | undefined,
): UseCommentMutationsResult {
  // Get emitEvent from context (provided by CommentSyncProvider during collaboration)
  const { emitEvent } = useCommentSyncContext();
  const queryClient = useQueryClient();
  const queryKey = sceneId
    ? queryKeys.commentThreads.list(sceneId)
    : ["commentThreads", "disabled"];

  // -------------------------------------------------------------------------
  // Create Thread
  // -------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (dto: CreateThreadDto) => createThread(sceneId!, dto),
    onSuccess: (newThread) => {
      // Add the new thread to the cache
      queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
        prev ? [...prev, newThread] : [newThread],
      );

      // Broadcast to collaborators
      emitEvent?.({ type: "thread-created", thread: newThread });
    },
  });

  // -------------------------------------------------------------------------
  // Delete Thread (optimistic)
  // -------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: deleteThread,
    onMutate: async (threadId) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<CommentThread[]>(queryKey);

      // Optimistically remove the thread
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) => prev?.filter((t) => t.id !== threadId) ?? [],
      );

      return { previous };
    },
    onError: (_err, _threadId, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (_data, threadId) => {
      // Broadcast to collaborators
      emitEvent?.({ type: "thread-deleted", threadId });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.commentThreads.all });
    },
  });

  // -------------------------------------------------------------------------
  // Resolve/Reopen Thread
  // -------------------------------------------------------------------------
  const resolveMutation = useMutation({
    mutationFn: ({
      threadId,
      resolved,
    }: {
      threadId: string;
      resolved: boolean;
    }) => (resolved ? reopenThread(threadId) : resolveThread(threadId)),
    onMutate: async ({ threadId, resolved }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<CommentThread[]>(queryKey);

      // Optimistically update the resolved status
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) =>
          prev?.map((t) =>
            t.id === threadId ? { ...t, resolved: !resolved } : t,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (updatedThread) => {
      // Update with server response to ensure consistency
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) =>
          prev?.map((t) => (t.id === updatedThread.id ? updatedThread : t)) ??
          [],
      );

      // Broadcast to collaborators
      emitEvent?.({
        type: "thread-resolved",
        threadId: updatedThread.id,
        resolved: updatedThread.resolved,
        resolvedAt: updatedThread.resolvedAt,
        resolvedBy: updatedThread.resolvedBy,
      });
    },
    onSettled: () => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.commentThreads.all });
    },
  });

  // -------------------------------------------------------------------------
  // Update Thread Position (for drag-to-move)
  // -------------------------------------------------------------------------
  const updatePositionMutation = useMutation({
    mutationFn: ({
      threadId,
      x,
      y,
    }: {
      threadId: string;
      x: number;
      y: number;
    }) => updateThread(threadId, { x, y }),
    onMutate: async ({ threadId, x, y }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previous = queryClient.getQueryData<CommentThread[]>(queryKey);

      // Optimistically update the thread position
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) =>
          prev?.map((t) => (t.id === threadId ? { ...t, x, y } : t)) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (_data, { threadId, x, y }) => {
      // Broadcast to collaborators
      emitEvent?.({ type: "thread-moved", threadId, x, y });
    },
  });

  // -------------------------------------------------------------------------
  // Add Comment
  // -------------------------------------------------------------------------
  const addCommentMutation = useMutation({
    mutationFn: ({
      threadId,
      dto,
    }: {
      threadId: string;
      dto: CreateCommentDto;
    }) => addComment(threadId, dto),
    onSuccess: (newComment, { threadId }) => {
      // Add the comment to the thread in cache
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) =>
          prev?.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  comments: [...t.comments, newComment],
                  commentCount: t.commentCount + 1,
                  updatedAt: new Date().toISOString(),
                }
              : t,
          ) ?? [],
      );

      // Broadcast to collaborators
      emitEvent?.({ type: "comment-added", threadId, comment: newComment });
    },
  });

  // -------------------------------------------------------------------------
  // Update Comment
  // -------------------------------------------------------------------------
  const updateCommentMutation = useMutation({
    mutationFn: ({
      commentId,
      dto,
    }: {
      commentId: string;
      dto: UpdateCommentDto;
    }) => updateComment(commentId, dto),
    onSuccess: (updatedComment) => {
      // Update the comment in the thread
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) =>
          prev?.map((t) =>
            t.id === updatedComment.threadId
              ? {
                  ...t,
                  comments: t.comments.map((c) =>
                    c.id === updatedComment.id ? updatedComment : c,
                  ),
                }
              : t,
          ) ?? [],
      );

      // Broadcast to collaborators
      emitEvent?.({
        type: "comment-updated",
        commentId: updatedComment.id,
        threadId: updatedComment.threadId,
        content: updatedComment.content,
        editedAt: updatedComment.editedAt || new Date().toISOString(),
      });
    },
  });

  // -------------------------------------------------------------------------
  // Delete Comment (optimistic)
  // -------------------------------------------------------------------------
  const deleteCommentMutation = useMutation({
    mutationFn: ({ commentId }: { threadId: string; commentId: string }) =>
      deleteComment(commentId),
    onMutate: async ({ threadId, commentId }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<CommentThread[]>(queryKey);

      // Optimistically remove the comment
      queryClient.setQueryData<CommentThread[]>(
        queryKey,
        (prev) =>
          prev?.map((t) =>
            t.id === threadId
              ? {
                  ...t,
                  comments: t.comments.filter((c) => c.id !== commentId),
                  commentCount: Math.max(0, t.commentCount - 1),
                }
              : t,
          ) ?? [],
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (_data, { threadId, commentId }) => {
      // Broadcast to collaborators
      emitEvent?.({ type: "comment-deleted", threadId, commentId });
    },
  });

  // -------------------------------------------------------------------------
  // Return interface
  // -------------------------------------------------------------------------
  return {
    createThread: createMutation.mutateAsync,
    deleteThread: async (threadId: string) => {
      await deleteMutation.mutateAsync(threadId);
    },
    toggleResolved: resolveMutation.mutateAsync,
    updateThreadPosition: updatePositionMutation.mutateAsync,
    addComment: addCommentMutation.mutateAsync,
    updateComment: updateCommentMutation.mutateAsync,
    deleteComment: async (params: { threadId: string; commentId: string }) => {
      await deleteCommentMutation.mutateAsync(params);
    },
    isCreatingThread: createMutation.isPending,
    isDeletingThread: deleteMutation.isPending,
    isAddingComment: addCommentMutation.isPending,
    isUpdatingPosition: updatePositionMutation.isPending,
  };
}

// ============================================================================
// useInvalidateCommentThreads - Manual cache invalidation
// ============================================================================

/**
 * Hook to invalidate comment threads cache.
 *
 * Use this after external changes that affect comments.
 *
 * @example
 * ```ts
 * const invalidateThreads = useInvalidateCommentThreads();
 * invalidateThreads(sceneId);
 * ```
 */
export function useInvalidateCommentThreads() {
  const queryClient = useQueryClient();

  return useCallback(
    (sceneId: string) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.commentThreads.list(sceneId),
      });
    },
    [queryClient],
  );
}
