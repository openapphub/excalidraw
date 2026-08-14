/**
 * ThreadMarker - A single comment thread marker (pin with avatar)
 *
 * Displays as a pin shape with the thread creator's avatar.
 * Hover shows tooltip with preview, click opens thread popup.
 * Supports drag-to-move functionality.
 */

import { useState, useCallback, useRef } from "react";

import { ThreadMarkerTooltip } from "../ThreadMarkerTooltip/ThreadMarkerTooltip";

import styles from "./ThreadMarker.module.scss";

import type { CommentThread } from "../../../auth/api/types";

export interface ThreadMarkerProps {
  /** Thread data */
  thread: CommentThread;
  /** Viewport X position */
  x: number;
  /** Viewport Y position */
  y: number;
  /** Whether this marker is currently selected */
  isSelected: boolean;
  /** Click handler to select this thread */
  onClick: () => void;
  /** Position change handler for drag-to-move */
  onPositionChange?: (viewportX: number, viewportY: number) => Promise<void>;
}

export function ThreadMarker({
  thread,
  x,
  y,
  isSelected,
  onClick,
  onPositionChange,
}: ThreadMarkerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Track drag start position to detect actual drags vs clicks
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(
    null,
  );
  const DRAG_THRESHOLD = 5; // pixels
  const CLICK_THRESHOLD = 200; // ms

  const handleMouseEnter = useCallback(() => {
    if (!isDragging) {
      setIsHovered(true);
    }
  }, [isDragging]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Capture pointer for drag outside element
      (e.target as HTMLElement).setPointerCapture(e.pointerId);

      // Record drag start
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
      };

      // Initialize drag position at current marker position
      setDragPosition({ x, y });
    },
    [x, y],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) {
        return;
      }

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Start dragging if moved beyond threshold
      if (distance > DRAG_THRESHOLD && !isDragging) {
        setIsDragging(true);
        setIsHovered(false);
      }

      if (isDragging || distance > DRAG_THRESHOLD) {
        // Update visual position during drag
        setDragPosition({
          x: x + deltaX,
          y: y + deltaY,
        });
      }
    },
    [isDragging, x, y],
  );

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent) => {
      if (!dragStartRef.current) {
        return;
      }

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const elapsed = Date.now() - dragStartRef.current.time;

      // Release pointer capture
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);

      // If it was a drag (moved beyond threshold), update position
      if (distance > DRAG_THRESHOLD && onPositionChange && dragPosition) {
        try {
          await onPositionChange(dragPosition.x, dragPosition.y);
        } catch (err) {
          console.error("Failed to update marker position:", err);
        }
      } else if (elapsed < CLICK_THRESHOLD) {
        // It was a click (short duration, minimal movement)
        onClick();
      }

      // Reset drag state
      dragStartRef.current = null;
      setIsDragging(false);
      setDragPosition(null);
    },
    [onClick, onPositionChange, dragPosition],
  );

  // Get first letter of name for fallback avatar
  const avatarFallback = thread.createdBy.name?.charAt(0).toUpperCase() || "?";
  const hasAvatar = !!thread.createdBy.avatar;

  // Use drag position during drag, otherwise use prop position
  const displayX = dragPosition?.x ?? x;
  const displayY = dragPosition?.y ?? y;

  return (
    <div
      className={`${styles.marker} ${isSelected ? styles.selected : ""} ${
        isHovered ? styles.hovered : ""
      } ${isDragging ? styles.dragging : ""}`}
      style={{
        transform: `translate(${displayX}px, ${displayY}px)`,
      }}
      data-comment-marker
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div className={styles.pin}>
        {hasAvatar ? (
          <img
            src={thread.createdBy.avatar}
            alt={thread.createdBy.name || "User"}
            className={styles.avatar}
          />
        ) : (
          <div className={styles.avatarFallback}>{avatarFallback}</div>
        )}
      </div>

      {/* Tooltip on hover (not during drag) */}
      {isHovered && !isSelected && !isDragging && (
        <ThreadMarkerTooltip thread={thread} />
      )}
    </div>
  );
}
