/**
 * Notifications API - CRUD operations for user notifications
 */

import { apiRequest } from "./client";

import type { NotificationsResponse } from "./types";

// ============================================================================
// List Notifications
// ============================================================================

export interface ListNotificationsOptions {
  /** Cursor for pagination (last notification ID) */
  cursor?: string;
  /** Number of items per page (default 20) */
  limit?: number;
  /** Filter to unread only */
  unread?: boolean;
}

/**
 * List notifications for the current user with cursor pagination
 */
export async function listNotifications(
  options?: ListNotificationsOptions,
): Promise<NotificationsResponse> {
  const params = new URLSearchParams();

  if (options?.cursor) {
    params.append("cursor", options.cursor);
  }
  if (options?.limit) {
    params.append("limit", String(options.limit));
  }
  if (options?.unread) {
    params.append("unread", "true");
  }

  const queryString = params.toString();
  const url = `/notifications${queryString ? `?${queryString}` : ""}`;

  return apiRequest(url, {
    errorMessage: "Failed to list notifications",
  });
}

// ============================================================================
// Unread Count
// ============================================================================

/**
 * Get the count of unread notifications for the badge
 */
export async function getUnreadCount(): Promise<{ count: number }> {
  return apiRequest("/notifications/unread-count", {
    errorMessage: "Failed to get unread count",
  });
}

// ============================================================================
// Mark as Read
// ============================================================================

/**
 * Mark a single notification as read
 */
export async function markAsRead(
  notificationId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/notifications/${notificationId}/read`, {
    method: "POST",
    errorMessage: "Failed to mark notification as read",
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{ success: boolean }> {
  return apiRequest("/notifications/read-all", {
    method: "POST",
    errorMessage: "Failed to mark all notifications as read",
  });
}
