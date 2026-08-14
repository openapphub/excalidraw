import React, { useRef, useEffect } from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import { useSetAtom } from "../../../app-jotai";

import {
  useNotifications,
  useNotificationMutations,
} from "../../../hooks/useNotifications";
import { buildNotificationsUrl, navigateTo } from "../../../router";
import { closeNotificationPopupAtom } from "../notificationsState";

import { NotificationSkeletonList } from "../Skeletons";

import { NotificationPopupItem } from "./NotificationPopupItem";

import styles from "./NotificationPopup.module.scss";

interface NotificationPopupProps {
  /** Current workspace slug for building URLs */
  workspaceSlug?: string;
  /** Callback when navigating to a notification */
  onNavigate?: (sceneId: string, threadId?: string, commentId?: string) => void;
}

/**
 * Notification popup showing recent notifications.
 *
 * Features:
 * - Shows up to 5 recent notifications
 * - "Mark all as read" in header
 * - Hover on item shows mark-as-read button
 * - Click item navigates to scene/thread
 * - Click outside closes popup
 */
export const NotificationPopup: React.FC<NotificationPopupProps> = ({
  workspaceSlug,
  onNavigate,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const closePopup = useSetAtom(closeNotificationPopupAtom);

  const { notifications, isLoading } = useNotifications();
  const { markAsRead, markAllAsRead, isMarkingAllRead } =
    useNotificationMutations();

  // Show only first 5 notifications in popup
  const displayedNotifications = notifications.slice(0, 5);
  const hasUnread = notifications.some((n) => !n.read);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        closePopup();
      }
    };

    // Use mousedown for immediate response
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closePopup]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closePopup();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closePopup]);

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleMarkRead = async (notificationId: string) => {
    await markAsRead(notificationId);
  };

  const handleItemClick = (notification: typeof notifications[0]) => {
    // Mark as read when clicking
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate to scene with thread/comment focused
    if (onNavigate) {
      onNavigate(
        notification.scene.id,
        notification.thread?.id,
        notification.comment?.id,
      );
    }

    closePopup();
  };

  const handleViewAll = () => {
    // Navigate to notifications page
    if (workspaceSlug) {
      navigateTo(buildNotificationsUrl(workspaceSlug));
    }
    closePopup();
  };

  return (
    <div className={styles.popup} ref={popupRef}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>{t("notifications.title")}</h3>
        {hasUnread && (
          <button
            className={styles.markAllRead}
            onClick={handleMarkAllRead}
            disabled={isMarkingAllRead}
          >
            {t("notifications.markAllRead")}
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className={styles.list}>
        {isLoading ? (
          <NotificationSkeletonList count={3} />
        ) : displayedNotifications.length === 0 ? (
          <div className={styles.empty}>{t("notifications.empty")}</div>
        ) : (
          displayedNotifications.map((notification) => (
            <NotificationPopupItem
              key={notification.id}
              notification={notification}
              onMarkRead={handleMarkRead}
              onClick={() => handleItemClick(notification)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <button className={styles.viewAll} onClick={handleViewAll}>
          {t("notifications.viewAll")}
        </button>
      </div>
    </div>
  );
};

export default NotificationPopup;
