/**
 * CommentCreationOverlay - Click-to-create comment mode overlay
 *
 * When comment mode is active (isCommentModeAtom = true):
 * - Renders a full-screen transparent overlay
 * - Shows comment cursor feedback
 * - Captures clicks and converts viewport coords to scene coords
 * - Sets pendingCommentPositionAtom with the click location
 * - ESC key cancels comment mode
 */

import { useEffect, useCallback, useState } from "react";
import { viewportCoordsToSceneCoords } from "@excalidraw/common";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../../../app-jotai";
import {
  isCommentModeAtom,
  startCommentCreationAtom,
  cancelCommentCreationAtom,
} from "../commentsState";

import styles from "./CommentCreationOverlay.module.scss";

export interface CommentCreationOverlayProps {
  /** Excalidraw API for getting app state */
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export function CommentCreationOverlay({
  excalidrawAPI,
}: CommentCreationOverlayProps) {
  const isCommentMode = useAtomValue(isCommentModeAtom);
  const startCommentCreation = useSetAtom(startCommentCreationAtom);
  const cancelCommentCreation = useSetAtom(cancelCommentCreationAtom);

  // Local state for appState
  const [appState, setAppState] = useState<AppState | null>(null);

  // Get app state when needed
  useEffect(() => {
    if (!excalidrawAPI || !isCommentMode) {
      return;
    }

    setAppState(excalidrawAPI.getAppState());

    // Subscribe to scroll/zoom changes
    const unsubscribe = excalidrawAPI.onScrollChange(() => {
      setAppState(excalidrawAPI.getAppState());
    });

    return unsubscribe;
  }, [excalidrawAPI, isCommentMode]);

  // Handle click to create comment
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!appState) {
        return;
      }

      // Convert viewport coordinates to scene coordinates
      const sceneCoords = viewportCoordsToSceneCoords(
        { clientX: e.clientX, clientY: e.clientY },
        appState,
      );

      startCommentCreation(sceneCoords);
    },
    [appState, startCommentCreation],
  );

  // Handle ESC key to cancel comment mode
  useEffect(() => {
    if (!isCommentMode) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cancelCommentCreation();
      }
    };

    // Use capture phase to intercept before Excalidraw
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isCommentMode, cancelCommentCreation]);

  if (!isCommentMode || !appState) {
    return null;
  }

  return (
    <div className={styles.overlay} onClick={handleClick}>
      <div className={styles.hint}>Click to add a comment</div>
    </div>
  );
}
