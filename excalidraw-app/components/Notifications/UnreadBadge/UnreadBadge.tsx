import React from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import styles from "./UnreadBadge.module.scss";

/**
 * Pulsing "Unread" badge for notification timeline items.
 * Shows a pulsing dot animation to indicate unread status.
 */
export const UnreadBadge: React.FC = () => {
  return (
    <span className={styles.badge}>
      <span className={styles.pulsingDot}>
        <span className={styles.ping} />
        <span className={styles.dot} />
      </span>
      {t("notifications.unread")}
    </span>
  );
};

export default UnreadBadge;
