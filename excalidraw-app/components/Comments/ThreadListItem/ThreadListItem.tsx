import React, { useState, useEffect, useCallback, useMemo } from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import { useCommentMutations } from "../../../hooks/useCommentThreads";

import styles from "./ThreadListItem.module.scss";

import type { CommentThread, UserSummary } from "../../../auth/api/types";

// ============================================================================
// Types
// ============================================================================

export interface ThreadListItemProps {
  thread: CommentThread;
  searchQuery: string;
  sceneId: string;
  onClick: () => void;
  onResolveToggle: () => void;
}

// ============================================================================
// Icons
// ============================================================================

const CheckIcon: React.FC<{ filled?: boolean }> = ({ filled }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {filled ? (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="9 12 11 14 15 10" stroke="white" />
      </>
    ) : (
      <polyline points="20 6 9 17 4 12" />
    )}
  </svg>
);

const MoreIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="5" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="12" cy="19" r="2" />
  </svg>
);

const LinkIcon: React.FC = () => (
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
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const TrashIcon: React.FC = () => (
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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Format relative time (e.g., "5 minutes ago", "2 days ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return t("time.justNow");
  }
  if (diffMin < 60) {
    return t("time.minutesAgo", { count: diffMin });
  }
  if (diffHour < 24) {
    return t("time.hoursAgo", { count: diffHour });
  }
  if (diffDay < 30) {
    return t("time.daysAgo", { count: diffDay });
  }
  return date.toLocaleDateString();
}

/**
 * Get user initials from name or email
 */
function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  // Fallback to email if name is not set
  return email[0].toUpperCase();
}

/**
 * Highlight search query matches in text
 */
function highlightText(
  text: string,
  query: string,
): React.ReactNode[] | string {
  if (!query) {
    return text;
  }

  try {
    const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className={styles.highlight}>
          {part}
        </mark>
      ) : (
        part
      ),
    );
  } catch {
    return text;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export const ThreadListItem: React.FC<ThreadListItemProps> = ({
  thread,
  searchQuery,
  sceneId,
  onClick,
  onResolveToggle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { toggleResolved, deleteThread } = useCommentMutations(sceneId);

  // Get first comment for preview
  const firstComment = thread.comments[0];
  const replyCount = thread.commentCount - 1;

  // Get unique participants (thread creator + all comment authors)
  const participants = useMemo(() => {
    const uniqueUsers = new Map<string, UserSummary>();

    // Add thread creator
    uniqueUsers.set(thread.createdBy.id, thread.createdBy);

    // Add all comment authors
    thread.comments.forEach((comment) => {
      if (!uniqueUsers.has(comment.createdBy.id)) {
        uniqueUsers.set(comment.createdBy.id, comment.createdBy);
      }
    });

    return Array.from(uniqueUsers.values());
  }, [thread.createdBy, thread.comments]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handleClickOutside = () => setIsMenuOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isMenuOpen]);

  // Handle resolve toggle
  const handleResolve = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMenuOpen(false);
      await toggleResolved({ threadId: thread.id, resolved: thread.resolved });
      onResolveToggle();
    },
    [thread.id, thread.resolved, toggleResolved, onResolveToggle],
  );

  // Handle copy link
  const handleCopyLink = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMenuOpen(false);

      const url = new URL(window.location.href);
      url.searchParams.set("thread", thread.id);
      navigator.clipboard.writeText(url.toString());

      // TODO: Show toast notification
    },
    [thread.id],
  );

  // Handle delete
  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsMenuOpen(false);

      // Simple confirmation
      if (window.confirm(t("comments.deleteConfirmMessage"))) {
        await deleteThread(thread.id);
      }
    },
    [thread.id, deleteThread],
  );

  // Handle menu toggle
  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen((prev) => !prev);
  }, []);

  // Memoize highlighted content
  const highlightedContent = useMemo(
    () => highlightText(firstComment?.content || "", searchQuery),
    [firstComment?.content, searchQuery],
  );

  const highlightedAuthor = useMemo(
    () => highlightText(thread.createdBy.name, searchQuery),
    [thread.createdBy.name, searchQuery],
  );

  return (
    <div
      className={`${styles.item} ${thread.resolved ? styles.itemResolved : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Top row: Participant avatars */}
      <div className={styles.participants}>
        {participants.slice(0, 5).map((user) => (
          <div key={user.id} className={styles.participantAvatar}>
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className={styles.avatar}
              />
            ) : (
              <div className={styles.avatarFallback}>
                {getInitials(user.name, user.email)}
              </div>
            )}
          </div>
        ))}
        {participants.length > 5 && (
          <div className={styles.moreParticipants}>
            +{participants.length - 5}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Header row with actions */}
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <span className={styles.author}>{highlightedAuthor}</span>
            <span className={styles.dot}>•</span>
            <span className={styles.time}>
              {formatRelativeTime(thread.updatedAt)}
            </span>
          </div>

          {/* Hover actions */}
          <div className={styles.actions}>
            <div className={styles.menuContainer}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={handleMenuClick}
                title={t("comments.moreOptions")}
              >
                <MoreIcon />
              </button>

              {isMenuOpen && (
                <div className={styles.menu}>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleResolve}
                  >
                    <CheckIcon />
                    <span>
                      {thread.resolved
                        ? t("comments.reopen")
                        : t("comments.resolve")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={styles.menuItem}
                    onClick={handleCopyLink}
                  >
                    <LinkIcon />
                    <span>{t("comments.copyLink")}</span>
                  </button>
                  <button
                    type="button"
                    className={`${styles.menuItem} ${styles.menuItemDanger}`}
                    onClick={handleDelete}
                  >
                    <TrashIcon />
                    <span>{t("comments.deleteThread")}</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              className={`${styles.actionButton} ${
                thread.resolved ? styles.actionButtonActive : ""
              }`}
              onClick={handleResolve}
              title={
                thread.resolved ? t("comments.reopen") : t("comments.resolve")
              }
            >
              <CheckIcon filled={thread.resolved} />
            </button>
          </div>
        </div>

        {/* Preview text */}
        <div className={styles.preview}>{highlightedContent}</div>

        {/* Reply count */}
        {replyCount > 0 && (
          <div className={styles.replyCount}>
            {t("comments.reply", { count: replyCount })}
          </div>
        )}
      </div>
    </div>
  );
};
