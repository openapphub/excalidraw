import { QueryClient } from "@tanstack/react-query";

/**
 * Query client with default options for AstraDraw.
 *
 * Default settings:
 * - staleTime: 5 minutes - data is considered fresh for 5 min
 * - gcTime: 30 minutes - unused cache entries are garbage collected after 30 min
 * - retry: 2 - retry failed requests twice
 * - refetchOnWindowFocus: true - refetch when user returns to tab
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 30 * 60 * 1000, // 30 minutes (was cacheTime in v4)
      retry: 2,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Query key factory for type-safe, consistent query keys.
 *
 * Usage:
 * ```ts
 * queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all });
 * queryClient.invalidateQueries({ queryKey: queryKeys.scenes.list(workspaceId) });
 * ```
 */
export const queryKeys = {
  // Scenes
  scenes: {
    all: ["scenes"] as const,
    list: (workspaceId: string, collectionId?: string | null) =>
      ["scenes", workspaceId, collectionId ?? "all"] as const,
  },

  // Workspaces
  workspaces: {
    all: ["workspaces"] as const,
    list: () => ["workspaces"] as const,
    detail: (workspaceId: string) => ["workspaces", workspaceId] as const,
  },

  // Collections
  collections: {
    all: ["collections"] as const,
    list: (workspaceId: string) => ["collections", workspaceId] as const,
  },

  // User
  user: {
    profile: () => ["user", "profile"] as const,
  },

  // Members
  members: {
    list: (workspaceId: string) => ["members", workspaceId] as const,
  },

  // Teams
  teams: {
    list: (workspaceId: string) => ["teams", workspaceId] as const,
  },

  // Talktracks
  talktracks: {
    list: (sceneId: string) => ["talktracks", sceneId] as const,
  },

  // Comment Threads
  commentThreads: {
    all: ["commentThreads"] as const,
    list: (sceneId: string) => ["commentThreads", sceneId] as const,
    detail: (threadId: string) =>
      ["commentThreads", "detail", threadId] as const,
  },

  // Notifications
  notifications: {
    all: ["notifications"] as const,
    list: () => ["notifications", "list"] as const,
    unreadCount: ["notifications", "unreadCount"] as const,
  },

  // Mutations (for useMutation hooks)
  mutations: {
    deleteScene: ["deleteScene"] as const,
    renameScene: ["renameScene"] as const,
    duplicateScene: ["duplicateScene"] as const,
    markNotificationRead: ["markNotificationRead"] as const,
    markAllNotificationsRead: ["markAllNotificationsRead"] as const,
  },
} as const;
