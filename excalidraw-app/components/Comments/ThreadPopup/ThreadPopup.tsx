/**
 * ThreadPopup - Displays a comment thread with replies
 *
 * Shows when a thread marker is clicked. Positioned near the marker.
 * Contains header with actions, scrollable comments list, and reply input.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { t, type TranslationKeys } from "@excalidraw/excalidraw/i18n";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../../../app-jotai";
import {
  selectedThreadIdAtom,
  clearCommentSelectionAtom,
  selectThreadAtom,
} from "../commentsState";
import { currentSceneCanEditAtom } from "../../Settings/settingsState";
import {
  useCommentThreads,
  useCommentMutations,
} from "../../../hooks/useCommentThreads";
import { ThreadPopupHeader } from "../ThreadPopupHeader";
import { CommentItem } from "../CommentItem";
import { CommentInput } from "../CommentInput";

import styles from "./ThreadPopup.module.scss";

import type { CommentThread, CreateCommentDto } from "../../../auth/api/types";

export interface ThreadPopupProps {
  /** Scene ID for the thread */
  sceneId: string;
  /** Workspace ID for @mentions */
  workspaceId: string | undefined;
  /** Excalidraw API for getting app state */
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

/**
 * Calculates popup position based on thread position
 * Positions popup to the right of the marker
 *
 * Note: We subtract offsetLeft/offsetTop to position relative to the canvas
 * container rather than the viewport. This fixes popup position when the
 * left workspace sidebar is open (which changes the canvas container offset).
 */
function getPopupPosition(
  thread: CommentThread,
  appState: AppState,
): { x: number; y: number } {
  const markerPos = sceneCoordsToViewportCoords(
    { sceneX: thread.x, sceneY: thread.y },
    appState,
  );
  // Position popup to the right and slightly above the marker
  // Subtract offsets to position relative to canvas container
  return {
    x: markerPos.x - appState.offsetLeft + 20,
    y: markerPos.y - appState.offsetTop - 16,
  };
}

export function ThreadPopup({
  sceneId,
  workspaceId,
  excalidrawAPI,
}: ThreadPopupProps) {
  const selectedThreadId = useAtomValue(selectedThreadIdAtom);
  const clearSelection = useSetAtom(clearCommentSelectionAtom);
  const selectThread = useSetAtom(selectThreadAtom);
  const canEditScene = useAtomValue(currentSceneCanEditAtom);

  const commentsRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Local state for appState - updated on scroll/zoom changes
  const [appState, setAppState] = useState<AppState | null>(null);

  // Subscribe to scroll/zoom changes for real-time popup position updates
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    // Get initial state
    setAppState(excalidrawAPI.getAppState());

    // Subscribe to scroll/zoom changes
    const unsubscribe = excalidrawAPI.onScrollChange(() => {
      setAppState(excalidrawAPI.getAppState());
    });

    return unsubscribe;
  }, [excalidrawAPI]);

  // Fetch all threads to enable navigation
  const { threads } = useCommentThreads({ sceneId, enabled: !!sceneId });
  const { toggleResolved, addComment, deleteThread, isAddingComment } =
    useCommentMutations(sceneId);

  // Find the selected thread
  const thread = threads.find((t) => t.id === selectedThreadId);

  // Get visible (non-resolved) threads for navigation
  const visibleThreads = threads.filter((t) => !t.resolved);
  const currentIndex = visibleThreads.findIndex(
    (t) => t.id === selectedThreadId,
  );

  // Handle click outside to close
  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking on a marker or inside the popup
      if (
        popupRef.current?.contains(target) ||
        target.closest("[data-comment-marker]")
      ) {
        return;
      }
      clearSelection();
    };

    // Add listener with a small delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [selectedThreadId, clearSelection]);

  // Handle ESC to close
  useEffect(() => {
    if (!selectedThreadId) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        clearSelection();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [selectedThreadId, clearSelection]);

  // Scroll to bottom when new comments are added
  const commentCount = thread?.comments.length ?? 0;
  useEffect(() => {
    if (commentsRef.current && commentCount > 0) {
      commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
    }
  }, [commentCount]);

  // Navigation handlers
  const handleNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (visibleThreads.length <= 1) {
        return;
      }

      const newIndex =
        direction === "prev"
          ? (currentIndex - 1 + visibleThreads.length) % visibleThreads.length
          : (currentIndex + 1) % visibleThreads.length;

      selectThread(visibleThreads[newIndex].id);
    },
    [visibleThreads, currentIndex, selectThread],
  );

  // Resolve/reopen handler
  const handleToggleResolved = useCallback(async () => {
    if (!thread) {
      return;
    }
    await toggleResolved({ threadId: thread.id, resolved: thread.resolved });
  }, [thread, toggleResolved]);

  // Delete handler
  const handleDelete = useCallback(async () => {
    if (!thread) {
      return;
    }
    // TODO: Add confirmation dialog
    await deleteThread(thread.id);
    clearSelection();
  }, [thread, deleteThread, clearSelection]);

  // Reply handler
  const handleReply = useCallback(
    async (content: string, mentions: string[]) => {
      if (!thread) {
        return;
      }

      const dto: CreateCommentDto = { content, mentions };
      await addComment({ threadId: thread.id, dto });

      // Scroll to bottom after adding
      setTimeout(() => {
        if (commentsRef.current) {
          commentsRef.current.scrollTop = commentsRef.current.scrollHeight;
        }
      }, 100);
    },
    [thread, addComment],
  );

  // Don't render if no thread selected or no appState
  if (!selectedThreadId || !thread || !appState) {
    return null;
  }

  const position = getPopupPosition(thread, appState);

  return (
    <div
      ref={popupRef}
      className={styles.popup}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <ThreadPopupHeader
        thread={thread}
        canNavigate={visibleThreads.length > 1}
        onNavigate={handleNavigate}
        onResolve={handleToggleResolved}
        onDelete={handleDelete}
        onClose={clearSelection}
        sceneId={sceneId}
      />

      <div className={styles.comments} ref={commentsRef}>
        {thread.comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            threadId={thread.id}
            sceneId={sceneId}
          />
        ))}
      </div>

      {/* Only show input if thread is not resolved */}
      {!thread.resolved && canEditScene !== false && (
        <CommentInput
          onSubmit={handleReply}
          isSubmitting={isAddingComment}
          workspaceId={workspaceId}
          placeholder="Reply, @mention someone..."
        />
      )}

      {thread.resolved && (
        <div className={styles.resolvedBanner}>
          <span className={styles.checkIcon}>✓</span>
          {t("comments.threadResolved" as unknown as TranslationKeys)}
        </div>
      )}
    </div>
  );
}
