/**
 * Notifications Module
 *
 * Components for displaying user notifications (bell icon, popup, page, etc.)
 */

// Main components
export { NotificationBell } from "./NotificationBell";
export { NotificationBadge } from "./NotificationBadge";
export { NotificationPopup, NotificationPopupItem } from "./NotificationPopup";

// Page components
export {
  NotificationsPage,
  NotificationTimelineItem,
} from "./NotificationsPage";
export { UnreadBadge } from "./UnreadBadge";

// Skeletons
export {
  NotificationItemSkeleton,
  NotificationSkeletonList,
} from "./Skeletons";

// State
export {
  isNotificationPopupOpenAtom,
  toggleNotificationPopupAtom,
  closeNotificationPopupAtom,
  openNotificationPopupAtom,
} from "./notificationsState";
