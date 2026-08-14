/**
 * ThreadPopupHeader - Header bar for the thread popup
 *
 * Contains navigation buttons (< >), resolve, copy link, delete, and close buttons.
 */

import { useCallback, useState } from "react";
import { t } from "@excalidraw/excalidraw/i18n";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";

import { useAtomValue } from "../../../app-jotai";
import { currentWorkspaceAtom } from "../../Settings/settingsState";
import { buildSceneUrlWithThread } from "../../../router";

import styles from "./ThreadPopupHeader.module.scss";

import type { CommentThread } from "../../../auth/api/types";

export interface ThreadPopupHeaderProps {
  /** The thread being displayed */
  thread: CommentThread;
  /** Whether navigation is available (more than one thread) */
  canNavigate: boolean;
  /** Navigate to prev/next thread */
  onNavigate: (direction: "prev" | "next") => void;
  /** Toggle resolved state */
  onResolve: () => void;
  /** Delete the thread */
  onDelete: () => void;
  /** Close the popup */
  onClose: () => void;
  /** Scene ID for building URLs */
  sceneId: string;
}

export function ThreadPopupHeader({
  thread,
  canNavigate,
  onNavigate,
  onResolve,
  onDelete,
  onClose,
  sceneId,
}: ThreadPopupHeaderProps) {
  const workspace = useAtomValue(currentWorkspaceAtom);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Copy link to clipboard
  const handleCopyLink = useCallback(async () => {
    if (!workspace?.slug) {
      return;
    }

    const url =
      window.location.origin +
      buildSceneUrlWithThread(workspace.slug, sceneId, thread.id);

    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  }, [workspace?.slug, sceneId, thread.id]);

  // Delete with confirmation
  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    setShowDeleteConfirm(false);
    onDelete();
  }, [onDelete]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <div className={styles.header}>
      {/* Left side: Navigation */}
      <div className={styles.leftActions}>
        <Tooltip label={t("comments.previousThread")}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate("prev")}
            disabled={!canNavigate}
            aria-label={t("comments.previousThread")}
          >
            <ChevronLeftIcon />
          </button>
        </Tooltip>
        <Tooltip label={t("comments.nextThread")}>
          <button
            type="button"
            className={styles.navButton}
            onClick={() => onNavigate("next")}
            disabled={!canNavigate}
            aria-label={t("comments.nextThread")}
          >
            <ChevronRightIcon />
          </button>
        </Tooltip>
      </div>

      {/* Right side: Actions */}
      <div className={styles.rightActions}>
        {/* Link copied feedback message */}
        {linkCopied && (
          <span className={styles.linkCopiedText}>
            {t("comments.linkCopied")}
          </span>
        )}

        <Tooltip
          label={thread.resolved ? t("comments.reopen") : t("comments.resolve")}
        >
          <button
            type="button"
            className={`${styles.actionButton} ${styles.resolveButton} ${
              thread.resolved ? styles.active : ""
            }`}
            onClick={onResolve}
            aria-label={
              thread.resolved ? t("comments.reopen") : t("comments.resolve")
            }
          >
            <CheckIcon />
          </button>
        </Tooltip>

        <Tooltip
          label={linkCopied ? t("comments.linkCopied") : t("comments.copyLink")}
        >
          <button
            type="button"
            className={styles.actionButton}
            onClick={handleCopyLink}
            aria-label={t("comments.copyLink")}
          >
            <LinkIcon />
          </button>
        </Tooltip>

        <Tooltip label={t("comments.deleteThread")}>
          <button
            type="button"
            className={`${styles.actionButton} ${styles.deleteButton}`}
            onClick={handleDeleteClick}
            aria-label={t("comments.deleteThread")}
          >
            <TrashIcon />
          </button>
        </Tooltip>

        <Tooltip label={t("comments.close")}>
          <button
            type="button"
            className={styles.actionButton}
            onClick={onClose}
            aria-label={t("comments.close")}
          >
            <CloseIcon />
          </button>
        </Tooltip>
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmDialog}>
            <p className={styles.confirmTitle}>
              {t("comments.deleteConfirmTitle")}
            </p>
            <p className={styles.confirmMessage}>
              {t("comments.deleteConfirmMessage")}
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleDeleteCancel}
              >
                {t("buttons.cancel")}
              </button>
              <button
                type="button"
                className={styles.confirmDeleteButton}
                onClick={handleDeleteConfirm}
              >
                {t("buttons.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

function ChevronLeftIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
