/**
 * ThreadMarkerTooltip - Hover preview for comment thread markers
 *
 * Shows author name, time ago, first comment preview, and total comment count.
 */

import { t } from "@excalidraw/excalidraw/i18n";

import styles from "./ThreadMarkerTooltip.module.scss";

import type { CommentThread } from "../../../auth/api/types";

export interface ThreadMarkerTooltipProps {
  /** Thread data */
  thread: CommentThread;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength).trim()}…`;
}

/**
 * Format time ago (e.g., "2 minutes ago")
 */
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) {
    return t("workspace.justNow");
  } else if (diffMins < 60) {
    return diffMins === 1
      ? t("workspace.minuteAgo", { count: diffMins })
      : t("workspace.minutesAgo", { count: diffMins });
  } else if (diffHours < 24) {
    return diffHours === 1
      ? t("workspace.hourAgo", { count: diffHours })
      : t("workspace.hoursAgo", { count: diffHours });
  } else if (diffDays === 1) {
    return t("workspace.yesterday");
  } else if (diffDays < 7) {
    return t("workspace.daysAgo", { count: diffDays });
  }
  return date.toLocaleDateString();
}

export function ThreadMarkerTooltip({ thread }: ThreadMarkerTooltipProps) {
  const firstComment = thread.comments[0];
  const totalComments = thread.commentCount;
  const timeAgo = formatTimeAgo(thread.createdAt);

  return (
    <div className={styles.tooltip}>
      <div className={styles.header}>
        <span className={styles.author}>{thread.createdBy.name || "User"}</span>
        <span className={styles.time}>{timeAgo}</span>
      </div>
      {firstComment && (
        <p className={styles.preview}>
          {truncateText(firstComment.content, 100)}
        </p>
      )}
      <div className={styles.footer}>
        <span className={styles.commentCount}>
          {totalComments} {totalComments === 1 ? "comment" : "comments"}
        </span>
      </div>
    </div>
  );
}
