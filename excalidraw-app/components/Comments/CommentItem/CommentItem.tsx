/**
 * CommentItem - Displays a single comment within a thread
 *
 * Shows avatar, author name, timestamp, content, and action menu.
 * Supports editing and deleting own comments.
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { t } from "@excalidraw/excalidraw/i18n";

import { useAuth } from "../../../auth/AuthContext";
import { useCommentMutations } from "../../../hooks/useCommentThreads";

import styles from "./CommentItem.module.scss";

import type { Comment } from "../../../auth/api/types";

interface MenuPosition {
  top: number;
  left: number;
}

export interface CommentItemProps {
  /** The comment to display */
  comment: Comment;
  /** Thread ID (for mutations) */
  threadId: string;
  /** Scene ID (for mutations) */
  sceneId: string;
}

/**
 * Format relative time (e.g., "5 minutes ago", "2 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  }
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

/**
 * Parse comment content and highlight @mentions
 */
function parseContent(content: string): React.ReactNode[] {
  // Match @[Name](userId) pattern
  const mentionPattern = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionPattern.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    // Add mention as highlighted span
    const [, name] = match;
    parts.push(
      <span key={match.index} className={styles.mention}>
        @{name}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [content];
}

export function CommentItem({ comment, threadId, sceneId }: CommentItemProps) {
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const { updateComment, deleteComment } = useCommentMutations(sceneId);

  const isOwner = user?.id === comment.createdBy.id;
  const avatarFallback = comment.createdBy.name?.charAt(0).toUpperCase() || "?";
  const hasAvatar = !!comment.createdBy.avatar;
  const relativeTime = useMemo(
    () => formatRelativeTime(comment.createdAt),
    [comment.createdAt],
  );
  const parsedContent = useMemo(
    () => parseContent(comment.content),
    [comment.content],
  );

  // Calculate menu position when showing
  useEffect(() => {
    if (showMenu && menuButtonRef.current) {
      const rect = menuButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 4,
        left: rect.right - 140, // Menu width ~140px, align right edge
      });
    }
  }, [showMenu]);

  // Toggle menu
  const handleMenuToggle = useCallback(() => {
    setShowMenu((prev) => !prev);
  }, []);

  // Close menu when clicking outside
  const handleMenuClose = useCallback(() => {
    setShowMenu(false);
  }, []);

  // Start editing
  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setEditContent(comment.content);
    setShowMenu(false);
  }, [comment.content]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(comment.content);
  }, [comment.content]);

  // Save edit
  const handleSaveEdit = useCallback(async () => {
    if (!editContent.trim()) {
      return;
    }

    try {
      await updateComment({
        commentId: comment.id,
        dto: { content: editContent.trim() },
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update comment:", err);
    }
  }, [comment.id, editContent, updateComment]);

  // Delete comment
  const handleDelete = useCallback(async () => {
    try {
      await deleteComment({ threadId, commentId: comment.id });
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
    setShowMenu(false);
  }, [threadId, comment.id, deleteComment]);

  // Copy link to comment
  const handleCopyLink = useCallback(async () => {
    const url = new URL(window.location.href);
    url.searchParams.set("thread", threadId);
    url.searchParams.set("comment", comment.id);

    try {
      await navigator.clipboard.writeText(url.toString());
      // Could show a toast here
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
    setShowMenu(false);
  }, [threadId, comment.id]);

  // Handle key events in edit mode
  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSaveEdit();
      } else if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit],
  );

  return (
    <div className={styles.comment}>
      {/* Author row */}
      <div className={styles.header}>
        <div className={styles.authorInfo}>
          {hasAvatar ? (
            <img
              src={comment.createdBy.avatar}
              alt={comment.createdBy.name || "User"}
              className={styles.avatar}
            />
          ) : (
            <div className={styles.avatarFallback}>{avatarFallback}</div>
          )}
          <span className={styles.authorName}>{comment.createdBy.name}</span>
          <span className={styles.separator}>•</span>
          <span className={styles.timestamp}>{relativeTime}</span>
          {comment.editedAt && (
            <span className={styles.edited}>{t("comments.edited")}</span>
          )}
        </div>

        {/* Menu button (only for owner) */}
        {isOwner && (
          <div className={styles.menuContainer}>
            <button
              ref={menuButtonRef}
              type="button"
              className={styles.menuButton}
              onClick={handleMenuToggle}
              aria-label={t("comments.moreOptions")}
            >
              <MoreIcon />
            </button>

            {showMenu && menuPosition && (
              <>
                <div
                  className={styles.menuBackdrop}
                  onClick={handleMenuClose}
                />
                <div
                  className={styles.menu}
                  style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                  }}
                >
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleEdit}
                  >
                    <EditIcon />
                    {t("comments.edit")}
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleCopyLink}
                  >
                    <CopyLinkIcon />
                    {t("comments.copyLink")}
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.deleteItem}`}
                    onClick={handleDelete}
                  >
                    <TrashIcon />
                    {t("comments.delete")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {isEditing ? (
        <div className={styles.editContainer}>
          <textarea
            className={styles.editInput}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={handleEditKeyDown}
            onKeyUp={(e) => e.stopPropagation()}
            autoFocus
          />
          <div className={styles.editActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleCancelEdit}
            >
              {t("buttons.cancel")}
            </button>
            <button
              type="button"
              className={styles.saveButton}
              onClick={handleSaveEdit}
              disabled={!editContent.trim()}
            >
              {t("buttons.save")}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.content}>{parsedContent}</div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Icons
// -----------------------------------------------------------------------------

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CopyLinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
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
