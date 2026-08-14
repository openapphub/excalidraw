import React from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import { formatDistanceToNow } from "../../../utils/dateUtils";

import styles from "./NotificationPopup.module.scss";

import type { Notification } from "../../../auth/api/types";

interface NotificationPopupItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onClick: () => void;
}

/**
 * Single notification item in the popup list.
 */
export const NotificationPopupItem: React.FC<NotificationPopupItemProps> = ({
  notification,
  onMarkRead,
  onClick,
}) => {
  const handleMarkRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMarkRead(notification.id);
  };

  // Build the notification message based on type
  const getMessage = () => {
    const actorName = notification.actor.name || "Someone";
    const sceneName = notification.scene.name || "a scene";

    if (notification.type === "MENTION") {
      return (
        <>
          <strong>{actorName}</strong> {t("notifications.mentionedYou")}{" "}
          <strong>{sceneName}</strong>
        </>
      );
    }

    // COMMENT type
    return (
      <>
        <strong>{actorName}</strong> {t("notifications.postedComment")}{" "}
        <strong>{sceneName}</strong>
      </>
    );
  };

  return (
    <div
      className={`${styles.item} ${notification.read ? styles.read : ""}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick();
        }
      }}
    >
      <div className={styles.itemContent}>
        {/* Avatar */}
        <div className={styles.avatar}>
          {notification.actor.avatar ? (
            <img
              src={notification.actor.avatar}
              alt={notification.actor.name}
              className={styles.avatarImage}
            />
          ) : (
            <div className={styles.avatarFallback}>
              {(notification.actor.name || "?")[0].toUpperCase()}
            </div>
          )}
          {/* Type indicator */}
          <span className={styles.typeIcon}>
            {notification.type === "MENTION" ? "@" : "💬"}
          </span>
        </div>

        {/* Message */}
        <div className={styles.message}>
          <div className={styles.text}>{getMessage()}</div>
          <div className={styles.time}>
            {formatDistanceToNow(notification.createdAt)}
          </div>
        </div>
      </div>

      {/* Mark as read button (visible on hover) */}
      {!notification.read && (
        <button
          className={styles.markReadButton}
          onClick={handleMarkRead}
          title={t("notifications.markAsRead")}
          aria-label={t("notifications.markAsRead")}
        >
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
        </button>
      )}
    </div>
  );
};

export default NotificationPopupItem;
