import React, { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { t } from "@excalidraw/excalidraw/i18n";

import {
  useNotifications,
  useNotificationMutations,
} from "../../../hooks/useNotifications";
import { navigateTo } from "../../../router";
import { queryKeys } from "../../../lib/queryClient";
import { showError } from "../../../utils/toast";
import { bellIcon } from "../../Workspace/WorkspaceSidebar/icons";
import { NotificationSkeletonList } from "../Skeletons";
import { resolveNotificationUrl } from "../notificationNavigation";

import { NotificationTimelineItem } from "./NotificationTimelineItem";

import styles from "./NotificationsPage.module.scss";

/**
 * Full notifications page with timeline view and infinite scroll.
 * Shows all notifications for the current user with vertical timeline.
 */
export const NotificationsPage: React.FC = () => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const {
    notifications,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useNotifications();

  const { markAsRead } = useNotificationMutations();

  // Infinite scroll using IntersectionObserver
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage],
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(handleObserver, {
      threshold: 0.1,
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [handleObserver]);

  // Handle notification click - navigate to scene with thread deep link
  const handleNotificationClick = async (notification: {
    id: string;
    scene: { id: string; name: string };
    thread?: { id: string };
    comment?: { id: string };
    read: boolean;
  }) => {
    // Mark as read if not already
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    try {
      navigateTo(
        await resolveNotificationUrl({
          sceneId: notification.scene.id,
          threadId: notification.thread?.id,
          commentId: notification.comment?.id,
        }),
      );
    } catch (error) {
      console.error("Failed to open notification scene:", error);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.all,
      });
      showError(t("notifications.sceneUnavailable"));
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("notifications.title")}</h1>

      <div
        className={`${styles.timeline} ${
          !isLoading && notifications.length === 0 ? styles.timelineEmpty : ""
        }`}
      >
        {isLoading ? (
          <NotificationSkeletonList count={5} />
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>{bellIcon}</div>
            <p>{t("notifications.empty")}</p>
          </div>
        ) : (
          <>
            {notifications.map((notification, index) => (
              <NotificationTimelineItem
                key={notification.id}
                notification={notification}
                onClick={() => handleNotificationClick(notification)}
                isLast={index === notifications.length - 1}
              />
            ))}

            {/* Infinite scroll trigger */}
            <div ref={loadMoreRef} className={styles.loadMore}>
              {isFetchingNextPage ? (
                <NotificationSkeletonList count={2} />
              ) : hasNextPage ? (
                <span className={styles.scrollHint}>
                  {t("notifications.scrollForMore")}
                </span>
              ) : (
                <span className={styles.noMore}>
                  {t("notifications.noMore")}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
