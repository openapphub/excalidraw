import { useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { queryKeys } from "../lib/queryClient";
import { WS_EVENTS } from "../app_constants";

import type { Socket } from "socket.io-client";
import type { CommentThread, CommentEvent } from "../auth/api/types";

/**
 * Hook for real-time comment synchronization via WebSocket.
 *
 * Listens for comment events from the room-service and updates
 * the React Query cache accordingly. This enables instant comment
 * sync across all collaborators in a room.
 *
 * @param sceneId - Current scene ID (required for cache key)
 * @param socket - Socket.io client instance from collaboration
 * @param roomId - Room ID for emitting events
 * @param enabled - Whether sync is active (typically when collaborating)
 *
 * @example
 * ```ts
 * // In a component with collaboration active
 * useCommentSync(sceneId, portal.socket, portal.roomId, isCollaborating);
 * ```
 */
export function useCommentSync(
  sceneId: string | null | undefined,
  socket: Socket | null,
  roomId: string | null,
  enabled: boolean = true,
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !sceneId || !enabled) {
      return;
    }

    const handleCommentEvent = (event: CommentEvent) => {
      const queryKey = queryKeys.commentThreads.list(sceneId);

      switch (event.type) {
        case "thread-created": {
          // Add new thread to cache
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) => {
            if (!prev) {
              return [event.thread];
            }
            // Avoid duplicates (in case of race conditions)
            if (prev.some((t) => t.id === event.thread.id)) {
              return prev;
            }
            return [...prev, event.thread];
          });
          break;
        }

        case "thread-resolved": {
          // Update resolved status
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
            prev?.map((t) =>
              t.id === event.threadId
                ? {
                    ...t,
                    resolved: event.resolved,
                    resolvedAt: event.resolvedAt,
                    resolvedBy: event.resolvedBy,
                  }
                : t,
            ),
          );
          break;
        }

        case "thread-deleted": {
          // Remove thread from cache
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
            prev?.filter((t) => t.id !== event.threadId),
          );
          break;
        }

        case "thread-moved": {
          // Update thread position
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
            prev?.map((t) =>
              t.id === event.threadId ? { ...t, x: event.x, y: event.y } : t,
            ),
          );
          break;
        }

        case "comment-added": {
          // Add comment to thread
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
            prev?.map((t) =>
              t.id === event.threadId
                ? {
                    ...t,
                    comments: [...t.comments, event.comment],
                    commentCount: t.commentCount + 1,
                    updatedAt: new Date().toISOString(),
                  }
                : t,
            ),
          );
          break;
        }

        case "comment-updated": {
          // Update comment content
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
            prev?.map((t) =>
              t.id === event.threadId
                ? {
                    ...t,
                    comments: t.comments.map((c) =>
                      c.id === event.commentId
                        ? {
                            ...c,
                            content: event.content,
                            editedAt: event.editedAt,
                          }
                        : c,
                    ),
                  }
                : t,
            ),
          );
          break;
        }

        case "comment-deleted": {
          // Remove comment from thread
          queryClient.setQueryData<CommentThread[]>(queryKey, (prev) =>
            prev?.map((t) =>
              t.id === event.threadId
                ? {
                    ...t,
                    comments: t.comments.filter(
                      (c) => c.id !== event.commentId,
                    ),
                    commentCount: Math.max(0, t.commentCount - 1),
                  }
                : t,
            ),
          );
          break;
        }
      }
    };

    socket.on(WS_EVENTS.COMMENT_EVENT, handleCommentEvent);

    return () => {
      socket.off(WS_EVENTS.COMMENT_EVENT, handleCommentEvent);
    };
  }, [socket, sceneId, enabled, queryClient]);

  // Return nothing - this hook is side-effect only
}

/**
 * Helper to emit a comment event to collaborators.
 *
 * @param socket - Socket.io client instance
 * @param roomId - Room ID to broadcast to
 * @param event - Comment event to broadcast
 */
export function emitCommentEvent(
  socket: Socket | null,
  roomId: string | null,
  event: CommentEvent,
): void {
  if (socket && roomId) {
    socket.emit(WS_EVENTS.COMMENT_EVENT, roomId, event);
  }
}

/**
 * Hook that returns a stable callback for emitting comment events.
 *
 * @param socket - Socket.io client instance
 * @param roomId - Room ID to broadcast to
 */
export function useEmitCommentEvent(
  socket: Socket | null,
  roomId: string | null,
): (event: CommentEvent) => void {
  return useCallback(
    (event: CommentEvent) => {
      emitCommentEvent(socket, roomId, event);
    },
    [socket, roomId],
  );
}
