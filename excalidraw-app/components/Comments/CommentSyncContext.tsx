import React, { createContext, useContext, useMemo } from "react";

import { useEmitCommentEvent } from "../../hooks/useCommentSync";

import type { Socket } from "socket.io-client";
import type { CommentEvent } from "../../auth/api/types";

// ============================================================================
// Context Definition
// ============================================================================

interface CommentSyncContextValue {
  /**
   * Emit a comment event to collaborators via WebSocket.
   * No-op if not collaborating or socket unavailable.
   */
  emitEvent: (event: CommentEvent) => void;

  /**
   * Whether real-time sync is currently active.
   */
  isEnabled: boolean;
}

const CommentSyncContext = createContext<CommentSyncContextValue>({
  emitEvent: () => {},
  isEnabled: false,
});

// ============================================================================
// Provider Component
// ============================================================================

interface CommentSyncProviderProps {
  children: React.ReactNode;
  socket: Socket | null;
  roomId: string | null;
  isCollaborating: boolean;
}

/**
 * Provider for comment real-time sync functionality.
 *
 * Wrap comment components with this provider to enable WebSocket-based
 * sync during collaboration sessions.
 *
 * @example
 * ```tsx
 * <CommentSyncProvider
 *   socket={portal.socket}
 *   roomId={portal.roomId}
 *   isCollaborating={isCollaborating}
 * >
 *   <ThreadMarkersLayer ... />
 *   <CommentsSidebar ... />
 * </CommentSyncProvider>
 * ```
 */
export function CommentSyncProvider({
  children,
  socket,
  roomId,
  isCollaborating,
}: CommentSyncProviderProps) {
  const emitEvent = useEmitCommentEvent(socket, roomId);

  const value = useMemo<CommentSyncContextValue>(
    () => ({
      emitEvent: isCollaborating ? emitEvent : () => {},
      isEnabled: isCollaborating && !!socket && !!roomId,
    }),
    [emitEvent, isCollaborating, socket, roomId],
  );

  return (
    <CommentSyncContext.Provider value={value}>
      {children}
    </CommentSyncContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to access comment sync functionality.
 *
 * Returns an emitEvent function that broadcasts comment changes
 * to collaborators when in a collaboration session.
 *
 * @example
 * ```ts
 * const { emitEvent, isEnabled } = useCommentSyncContext();
 *
 * // After creating a thread
 * emitEvent({ type: "thread-created", thread: newThread });
 * ```
 */
export function useCommentSyncContext(): CommentSyncContextValue {
  return useContext(CommentSyncContext);
}
