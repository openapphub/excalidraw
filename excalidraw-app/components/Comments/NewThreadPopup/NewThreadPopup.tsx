/**
 * NewThreadPopup - Popup for creating a new comment thread
 *
 * Appears when user clicks on canvas in comment mode.
 * Shows an input for the first comment, then creates the thread.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";
import { t } from "@excalidraw/excalidraw/i18n";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../../../app-jotai";
import {
  pendingCommentPositionAtom,
  cancelCommentCreationAtom,
} from "../commentsState";
import { useCommentMutations } from "../../../hooks/useCommentThreads";
import { CommentInput } from "../CommentInput";

import styles from "./NewThreadPopup.module.scss";

export interface NewThreadPopupProps {
  /** Scene ID for the new thread */
  sceneId: string;
  /** Workspace ID for @mentions */
  workspaceId: string | undefined;
  /** Excalidraw API for getting app state */
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export function NewThreadPopup({
  sceneId,
  workspaceId,
  excalidrawAPI,
}: NewThreadPopupProps) {
  const pendingPosition = useAtomValue(pendingCommentPositionAtom);
  const cancelCreation = useSetAtom(cancelCommentCreationAtom);
  const popupRef = useRef<HTMLDivElement>(null);

  const { createThread, isCreatingThread } = useCommentMutations(sceneId);

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

  // Also subscribe to onChange to catch offsetLeft/offsetTop changes
  // (sidebar open/close changes canvas offset but doesn't trigger onScrollChange)
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    let lastOffsetLeft = excalidrawAPI.getAppState().offsetLeft;
    let lastOffsetTop = excalidrawAPI.getAppState().offsetTop;

    const unsubscribe = excalidrawAPI.onChange(() => {
      const currentState = excalidrawAPI.getAppState();
      // Only update if offset changed (to avoid unnecessary re-renders)
      if (
        currentState.offsetLeft !== lastOffsetLeft ||
        currentState.offsetTop !== lastOffsetTop
      ) {
        lastOffsetLeft = currentState.offsetLeft;
        lastOffsetTop = currentState.offsetTop;
        setAppState(currentState);
      }
    });

    return unsubscribe;
  }, [excalidrawAPI]);

  // Handle click outside to close
  useEffect(() => {
    if (!pendingPosition) {
      return;
    }

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popupRef.current?.contains(target)) {
        return;
      }
      cancelCreation();
    };

    // Add listener with a small delay to avoid immediate close from the creation click
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pendingPosition, cancelCreation]);

  // Handle ESC to close
  useEffect(() => {
    if (!pendingPosition) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelCreation();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [pendingPosition, cancelCreation]);

  // Handle submit - create thread with first comment
  const handleSubmit = useCallback(
    async (content: string, mentions: string[]) => {
      if (!pendingPosition) {
        return;
      }

      await createThread({
        x: pendingPosition.x,
        y: pendingPosition.y,
        content,
        mentions,
      });

      // Close popup on success
      cancelCreation();
    },
    [pendingPosition, createThread, cancelCreation],
  );

  // Don't render if no pending position or no appState
  if (!pendingPosition || !appState) {
    return null;
  }

  // Convert scene coords to viewport coords for positioning
  const viewportPos = sceneCoordsToViewportCoords(
    { sceneX: pendingPosition.x, sceneY: pendingPosition.y },
    appState,
  );

  // Subtract offsetLeft/offsetTop to position relative to canvas container
  // This fixes popup position when left workspace sidebar is open
  return (
    <div
      ref={popupRef}
      className={styles.popup}
      style={{
        left: viewportPos.x - appState.offsetLeft + 20,
        top: viewportPos.y - appState.offsetTop - 16,
      }}
    >
      <div className={styles.body}>
        <CommentInput
          onSubmit={handleSubmit}
          isSubmitting={isCreatingThread}
          workspaceId={workspaceId}
          placeholder={t("comments.writeComment")}
          autoFocus
        />
      </div>
    </div>
  );
}
