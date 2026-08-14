import React from "react";

import styles from "./NotificationItemSkeleton.module.scss";

/**
 * Loading skeleton for a single notification item.
 */
export const NotificationItemSkeleton: React.FC = () => (
  <div className={styles.skeleton}>
    <div className={styles.avatar} />
    <div className={styles.content}>
      <div className={styles.line} />
      <div className={styles.lineShort} />
    </div>
  </div>
);

interface NotificationSkeletonListProps {
  /** Number of skeleton items to render */
  count?: number;
}

/**
 * List of notification skeletons for loading state.
 */
export const NotificationSkeletonList: React.FC<
  NotificationSkeletonListProps
> = ({ count = 3 }) => (
  <>
    {Array.from({ length: count }).map((_, i) => (
      <NotificationItemSkeleton key={i} />
    ))}
  </>
);

export default NotificationItemSkeleton;
