import React from "react";

import styles from "./Skeleton.module.scss";

/**
 * CollectionItemSkeleton
 *
 * A skeleton placeholder that matches the FullModeNav collection item dimensions.
 * Used in WorkspaceSidebar while loading collections.
 *
 * Dimensions (from FullModeNav.scss):
 * - Container: padding 10px 12px, border-radius 8px
 * - Icon: 20x20px
 * - Text: font-size 13px
 */
export const CollectionItemSkeleton: React.FC = () => {
  return (
    <div className={styles.collectionItemSkeleton}>
      <div className={styles.collectionItemIcon} />
      <div className={styles.collectionItemText} />
    </div>
  );
};

interface CollectionItemSkeletonListProps {
  count?: number;
}

/**
 * CollectionItemSkeletonList
 *
 * Renders multiple CollectionItemSkeleton components in a vertical list.
 * Matches the FullModeNav collections list layout.
 */
export const CollectionItemSkeletonList: React.FC<
  CollectionItemSkeletonListProps
> = ({ count = 4 }) => {
  return (
    <div
      className={styles.skeletonContainer}
      style={{ display: "flex", flexDirection: "column", gap: "2px" }}
    >
      {Array.from({ length: count }).map((_, index) => (
        <CollectionItemSkeleton key={index} />
      ))}
    </div>
  );
};

export default CollectionItemSkeleton;
