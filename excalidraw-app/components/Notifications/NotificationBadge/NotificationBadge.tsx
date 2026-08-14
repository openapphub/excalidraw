import React from "react";

import styles from "./NotificationBadge.module.scss";

interface NotificationBadgeProps {
  /** Number of unread notifications */
  count: number;
}

/**
 * Red badge showing unread notification count.
 *
 * Displays "5+" when count exceeds 5.
 * Hidden when count is 0.
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
}) => {
  if (count === 0) {
    return null;
  }

  const displayCount = count > 5 ? "5+" : String(count);

  return <span className={styles.badge}>{displayCount}</span>;
};

export default NotificationBadge;
