import React from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import { formatDistanceToNow } from "../../../utils/dateUtils";
import { UnreadBadge } from "../UnreadBadge";

import styles from "./NotificationsPage.module.scss";

import type { Notification } from "../../../auth/api/types";

interface NotificationTimelineItemProps {
  notification: Notification;
  onClick: () => void;
  isLast?: boolean;
}

/**
 * Single notification item in the timeline view.
 * Shows avatar, type icon, message, timestamp, and unread badge.
 */
export const NotificationTimelineItem: React.FC<
  NotificationTimelineItemProps
> = ({ notification, onClick, isLast = false }) => {
  // Build the notification message based on type
  const getMessage = () => {
    const actorName = notification.actor.name || "Someone";
    const sceneName = notification.scene.name || "a scene";

    if (notification.type === "MENTION") {
      return (
        <>
          <strong>{actorName}</strong> {t("notifications.mentionedYou")}{" "}
          <strong className={styles.sceneName}>{sceneName}</strong>
        </>
      );
    }

    // COMMENT type
    return (
      <>
        <strong>{actorName}</strong> {t("notifications.postedComment")}{" "}
        <strong className={styles.sceneName}>{sceneName}</strong>
      </>
    );
  };

  return (
    <div
      className={`${styles.timelineItem} ${isLast ? styles.isLast : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}
    >
      {/* Avatar with type icon overlay */}
      <div className={styles.avatarContainer}>
        {notification.actor.avatar ? (
          <img
            src={notification.actor.avatar}
            alt={notification.actor.name}
            className={styles.avatar}
          />
        ) : (
          <div className={styles.avatarFallback}>
            {(notification.actor.name || "?")[0].toUpperCase()}
          </div>
        )}
        <span className={styles.typeIcon}>
          {notification.type === "MENTION" ? "@" : "💬"}
        </span>
      </div>

      {/* Content */}
      <div className={styles.itemContent}>
        <div className={styles.message}>{getMessage()}</div>
        <div className={styles.meta}>
          <span className={styles.time}>
            {formatDistanceToNow(notification.createdAt)}
          </span>
          {!notification.read && <UnreadBadge />}
        </div>
      </div>
    </div>
  );
};

export default NotificationTimelineItem;
