import React from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import { useAtom } from "../../../app-jotai";

import { useUnreadCount } from "../../../hooks/useNotifications";
import {
  buildNotificationsUrl,
  buildSceneUrl,
  buildSceneUrlWithThread,
  navigateTo,
} from "../../../router";
import { isNotificationPopupOpenAtom } from "../notificationsState";
import { NotificationBadge } from "../NotificationBadge";
import { NotificationPopup } from "../NotificationPopup";
import { bellIcon } from "../../Workspace/WorkspaceSidebar/icons";

import styles from "./NotificationBell.module.scss";

interface NotificationBellProps {
  /** Current workspace slug for building URLs */
  workspaceSlug?: string;
  /** Whether notifications are enabled (user is authenticated) */
  enabled?: boolean;
  /** Current app mode - determines click behavior */
  appMode?: "canvas" | "dashboard";
  /** Callback when navigating to a notification */
  onNavigate?: (sceneId: string, threadId?: string, commentId?: string) => void;
}

/**
 * Notification bell icon with badge and popup.
 *
 * Features:
 * - Bell icon in sidebar footer
 * - Red badge showing unread count (max "5+")
 * - In canvas mode: Click toggles notification popup
 * - In dashboard mode: Click navigates directly to notifications page
 * - Unread count polls every 60 seconds
 */
export const NotificationBell: React.FC<NotificationBellProps> = ({
  workspaceSlug,
  enabled = true,
  appMode = "canvas",
  onNavigate,
}) => {
  const [isPopupOpen, setIsPopupOpen] = useAtom(isNotificationPopupOpenAtom);
  const { count } = useUnreadCount({ enabled });

  const handleClick = () => {
    if (appMode === "dashboard" && workspaceSlug) {
      // In dashboard mode, navigate directly to notifications page
      navigateTo(buildNotificationsUrl(workspaceSlug));
    } else {
      // In canvas mode, toggle the popup
      setIsPopupOpen(!isPopupOpen);
    }
  };

  // 宿主没传 onNavigate 时的默认跳转：带 thread/comment 参数打开对应画布，
  // CommentsMount 会消费这两个参数并自动选中线程。
  const handleNavigate =
    onNavigate ??
    ((sceneId: string, threadId?: string, commentId?: string) => {
      if (!workspaceSlug) {
        return;
      }
      navigateTo(
        threadId
          ? buildSceneUrlWithThread(workspaceSlug, sceneId, threadId, commentId)
          : buildSceneUrl(workspaceSlug, sceneId),
      );
    });

  return (
    <div className={styles.container}>
      <button
        className={styles.button}
        onClick={handleClick}
        title={t("workspace.notifications")}
        aria-label={t("workspace.notifications")}
        aria-expanded={appMode === "canvas" ? isPopupOpen : undefined}
        aria-haspopup={appMode === "canvas" ? "true" : undefined}
      >
        {bellIcon}
        <NotificationBadge count={count} />
      </button>

      {/* Only show popup in canvas mode */}
      {appMode === "canvas" && isPopupOpen && (
        <NotificationPopup
          workspaceSlug={workspaceSlug}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
};

export default NotificationBell;
