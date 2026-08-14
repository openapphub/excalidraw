import { useCallback } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { queryKeys } from "../lib/queryClient";
import {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../auth/api/notifications";

import type { Notification, NotificationsResponse } from "../auth/api/types";

// ============================================================================
// useNotifications - Infinite scroll list of notifications
// ============================================================================

interface UseNotificationsOptions {
  /** Filter to unread only */
  unread?: boolean;
  /** Whether to enable the query */
  enabled?: boolean;
}

interface UseNotificationsResult {
  /** Flat array of all loaded notifications */
  notifications: Notification[];
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether fetching next page */
  isFetchingNextPage: boolean;
  /** Whether there are more pages */
  hasNextPage: boolean;
  /** Error if any */
  error: Error | null;
  /** Fetch the next page */
  fetchNextPage: () => void;
  /** Refetch all pages */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching notifications with infinite scroll pagination.
 *
 * @example
 * ```ts
 * const { notifications, isLoading, fetchNextPage, hasNextPage } = useNotifications();
 *
 * // In scroll handler
 * if (inView && hasNextPage) {
 *   fetchNextPage();
 * }
 * ```
 */
export function useNotifications(
  options?: UseNotificationsOptions,
): UseNotificationsResult {
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    error,
    fetchNextPage: fetchNext,
    refetch: queryRefetch,
  } = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: ({ pageParam }) =>
      listNotifications({
        cursor: pageParam,
        unread: options?.unread,
      }),
    getNextPageParam: (lastPage: NotificationsResponse) =>
      lastPage.hasMore ? lastPage.nextCursor : undefined,
    initialPageParam: undefined as string | undefined,
    enabled: options?.enabled ?? true,
  });

  // Flatten all pages into a single array
  const notifications = data?.pages.flatMap((page) => page.notifications) ?? [];

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    notifications,
    isLoading,
    isFetchingNextPage,
    hasNextPage: hasNextPage ?? false,
    error: error as Error | null,
    fetchNextPage: fetchNext,
    refetch,
  };
}

// ============================================================================
// useUnreadCount - Badge count with polling
// ============================================================================

interface UseUnreadCountOptions {
  /** Whether to enable the query (default: true) */
  enabled?: boolean;
  /** Polling interval in ms (default: 60000 = 1 minute) */
  refetchInterval?: number;
}

interface UseUnreadCountResult {
  /** Number of unread notifications */
  count: number;
  /** Whether loading */
  isLoading: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually refetch */
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching unread notification count with automatic polling.
 *
 * Polls every 60 seconds by default to keep the badge up-to-date.
 *
 * @example
 * ```ts
 * const { count } = useUnreadCount({ enabled: isAuthenticated });
 *
 * return count > 0 && <Badge count={count} />;
 * ```
 */
export function useUnreadCount(
  options?: UseUnreadCountOptions,
): UseUnreadCountResult {
  const {
    data,
    isLoading,
    error,
    refetch: queryRefetch,
  } = useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: getUnreadCount,
    enabled: options?.enabled ?? true,
    // Poll every 60 seconds to keep badge updated
    refetchInterval: options?.refetchInterval ?? 60 * 1000,
    // Consider data stale after 30 seconds
    staleTime: 30 * 1000,
  });

  const refetch = useCallback(async () => {
    await queryRefetch();
  }, [queryRefetch]);

  return {
    count: data?.count ?? 0,
    isLoading,
    error: error as Error | null,
    refetch,
  };
}

// ============================================================================
// useNotificationMutations - Mark as read operations
// ============================================================================

interface UseNotificationMutationsResult {
  /** Mark a single notification as read */
  markAsRead: (notificationId: string) => Promise<void>;
  /** Mark all notifications as read */
  markAllAsRead: () => Promise<void>;
  /** Whether marking single as read */
  isMarkingRead: boolean;
  /** Whether marking all as read */
  isMarkingAllRead: boolean;
}

/**
 * Hook for notification mutations (mark as read).
 *
 * Automatically invalidates queries and updates cache.
 *
 * @example
 * ```ts
 * const { markAsRead, markAllAsRead } = useNotificationMutations();
 *
 * // Mark single
 * await markAsRead(notificationId);
 *
 * // Mark all
 * await markAllAsRead();
 * ```
 */
export function useNotificationMutations(): UseNotificationMutationsResult {
  const queryClient = useQueryClient();

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationKey: queryKeys.mutations.markNotificationRead,
    mutationFn: markAsRead,
    onSuccess: (_data, notificationId) => {
      // Update the notification in cache
      queryClient.setQueryData(
        queryKeys.notifications.list(),
        (
          oldData:
            | { pages: NotificationsResponse[]; pageParams: unknown[] }
            | undefined,
        ) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) =>
                n.id === notificationId
                  ? { ...n, read: true, readAt: new Date().toISOString() }
                  : n,
              ),
            })),
          };
        },
      );

      // Decrement unread count
      queryClient.setQueryData(
        queryKeys.notifications.unreadCount,
        (oldData: { count: number } | undefined) => {
          if (!oldData) {
            return oldData;
          }
          return { count: Math.max(0, oldData.count - 1) };
        },
      );
    },
  });

  // Mark all notifications as read
  const markAllReadMutation = useMutation({
    mutationKey: queryKeys.mutations.markAllNotificationsRead,
    mutationFn: markAllAsRead,
    onSuccess: () => {
      // Mark all notifications in cache as read
      queryClient.setQueryData(
        queryKeys.notifications.list(),
        (
          oldData:
            | { pages: NotificationsResponse[]; pageParams: unknown[] }
            | undefined,
        ) => {
          if (!oldData) {
            return oldData;
          }
          return {
            ...oldData,
            pages: oldData.pages.map((page) => ({
              ...page,
              notifications: page.notifications.map((n) => ({
                ...n,
                read: true,
                readAt: n.readAt ?? new Date().toISOString(),
              })),
            })),
          };
        },
      );

      // Set unread count to 0
      queryClient.setQueryData(queryKeys.notifications.unreadCount, {
        count: 0,
      });
    },
  });

  return {
    markAsRead: async (notificationId: string) => {
      await markReadMutation.mutateAsync(notificationId);
    },
    markAllAsRead: async () => {
      await markAllReadMutation.mutateAsync();
    },
    isMarkingRead: markReadMutation.isPending,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
}

// ============================================================================
// useInvalidateNotifications - Manual cache invalidation
// ============================================================================

/**
 * Hook to invalidate notifications cache.
 *
 * Use this after external changes that affect notifications.
 *
 * @example
 * ```ts
 * const invalidateNotifications = useInvalidateNotifications();
 * invalidateNotifications();
 * ```
 */
export function useInvalidateNotifications() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all,
    });
  }, [queryClient]);
}
