import React, { useEffect, useRef, useCallback } from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import { useAtomValue } from "../../../app-jotai";
import {
  useNotifications,
  useNotificationMutations,
} from "../../../hooks/useNotifications";
import { currentWorkspaceSlugAtom } from "../../Settings/settingsState";
import {
  buildSceneUrlWithThread,
  buildSceneUrl,
  navigateTo,
} from "../../../router";
import { NotificationSkeletonList } from "../Skeletons";

import { NotificationTimelineItem } from "./NotificationTimelineItem";

import styles from "./NotificationsPage.module.scss";

/**
 * Full notifications page with timeline view and infinite scroll.
 * Shows all notifications for the current user with vertical timeline.
 */
export const NotificationsPage: React.FC = () => {
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const workspaceSlug = useAtomValue(currentWorkspaceSlugAtom);

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

    // Navigate to the scene (with thread deep link if available)
    if (workspaceSlug) {
      if (notification.thread?.id) {
        // Navigate with thread deep link - URL routing will handle opening comments sidebar
        const url = buildSceneUrlWithThread(
          workspaceSlug,
          notification.scene.id,
          notification.thread.id,
          notification.comment?.id,
        );
        navigateTo(url);
      } else {
        // Navigate to scene without thread
        const url = buildSceneUrl(workspaceSlug, notification.scene.id);
        navigateTo(url);
      }
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>{t("notifications.title")}</h1>

      <div className={styles.timeline}>
        {isLoading ? (
          <NotificationSkeletonList count={5} />
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔔</div>
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
