/**
 * Shared TypeScript types for the API layer
 */

// ============================================================================
// Workspace Types
// ============================================================================

export type WorkspaceRole = "ADMIN" | "MEMBER" | "VIEWER";
export type WorkspaceType = "PERSONAL" | "SHARED";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  type?: WorkspaceType;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMember {
  id: string;
  role: WorkspaceRole;
  userId: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
  };
  createdAt: string;
}

// ============================================================================
// Team Types
// ============================================================================

export interface Team {
  id: string;
  name: string;
  color: string;
  workspaceId: string;
  memberCount: number;
  collectionCount: number;
  members: {
    id: string;
    userId: string;
    user: {
      id: string;
      email: string;
      name: string | null;
      avatarUrl: string | null;
    };
  }[];
  collections: {
    id: string;
    name: string;
    icon: string | null;
    canWrite: boolean;
  }[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Collection Types
// ============================================================================

export interface Collection {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  isPrivate: boolean;
  userId: string;
  workspaceId: string;
  sceneCount: number;
  canWrite: boolean;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
  // Team access info (populated separately)
  teams?: Array<{
    teamId: string;
    teamName: string;
    teamColor: string;
  }>;
}

export type CollectionAccessLevel = "VIEW" | "EDIT";

export interface CollectionTeamAccess {
  teamId: string;
  teamName: string;
  teamColor: string;
  accessLevel: CollectionAccessLevel;
}

// ============================================================================
// Invite Link Types
// ============================================================================

export interface InviteLink {
  id: string;
  code: string;
  role: WorkspaceRole;
  workspaceId: string;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  createdAt: string;
}

// ============================================================================
// Scene Types
// ============================================================================

export interface WorkspaceScene {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  storageKey: string;
  roomId: string | null;
  collectionId: string | null;
  isPublic: boolean;
  lastOpenedAt: string | null;
  createdAt: string;
  updatedAt: string;
  canEdit?: boolean;
  collabEnabled?: boolean;
  editor?: SceneEditor | null;
}

export interface SceneEditor {
  userId: string;
  name: string;
  isSelf: boolean;
}

export interface CreateSceneDto {
  title?: string;
  thumbnail?: string;
  data?: string; // Base64 encoded scene data
  collectionId?: string; // Collection to add the scene to
}

export interface UpdateSceneDto {
  title?: string;
  thumbnail?: string;
  data?: string;
}

// ============================================================================
// Talktrack Types
// ============================================================================

export interface TalktrackRecording {
  id: string;
  title: string;
  kinescopeVideoId: string;
  duration: number;
  processingStatus: "uploading" | "processing" | "ready" | "error";
  sceneId: string;
  userId: string;
  isOwner: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTalktrackDto {
  title: string;
  kinescopeVideoId: string;
  duration: number;
  processingStatus?: string;
}

export interface UpdateTalktrackDto {
  title?: string;
  processingStatus?: string;
}

// ============================================================================
// User Profile Types
// ============================================================================

export interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isSuperAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileDto {
  name?: string;
  avatarUrl?: string | null;
}

// ============================================================================
// Comment System Types
// ============================================================================

/**
 * Minimal user info for display in comments
 */
export interface UserSummary {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

/**
 * A comment thread anchored to a specific canvas position
 */
export interface CommentThread {
  id: string;
  sceneId: string;
  x: number;
  y: number;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: UserSummary;
  createdBy: UserSummary;
  comments: Comment[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * An individual comment within a thread
 */
export interface Comment {
  id: string;
  threadId: string;
  content: string;
  mentions: string[];
  createdBy: UserSummary;
  editedAt?: string;
  createdAt: string;
}

/**
 * DTO for creating a new thread with its first comment
 */
export interface CreateThreadDto {
  x: number;
  y: number;
  content: string;
  mentions?: string[];
}

/**
 * DTO for adding a reply to an existing thread
 */
export interface CreateCommentDto {
  content: string;
  mentions?: string[];
}

/**
 * DTO for updating thread position
 */
export interface UpdateThreadDto {
  x?: number;
  y?: number;
}

/**
 * DTO for editing a comment
 */
export interface UpdateCommentDto {
  content: string;
}

/**
 * Filter and sort options for thread listing
 */
export interface ThreadFilters {
  resolved?: boolean;
  sort: "date" | "unread";
  search: string;
}

// ============================================================================
// Comment System WebSocket Events (for real-time sync)
// ============================================================================

/**
 * WebSocket event types for comment real-time sync.
 * These events are broadcast to all collaborators in a room when
 * comment threads or comments are created, modified, or deleted.
 */
export type CommentEvent =
  | { type: "thread-created"; thread: CommentThread }
  | {
      type: "thread-resolved";
      threadId: string;
      resolved: boolean;
      resolvedAt?: string;
      resolvedBy?: UserSummary;
    }
  | { type: "thread-deleted"; threadId: string }
  | { type: "thread-moved"; threadId: string; x: number; y: number }
  | { type: "comment-added"; threadId: string; comment: Comment }
  | {
      type: "comment-updated";
      commentId: string;
      threadId: string;
      content: string;
      editedAt: string;
    }
  | { type: "comment-deleted"; threadId: string; commentId: string };

// ============================================================================
// Notification System Types
// ============================================================================

/**
 * Types of notifications
 */
export type NotificationType = "COMMENT" | "MENTION";

/**
 * A notification for the current user
 */
export interface Notification {
  id: string;
  type: NotificationType;
  /** User who triggered the notification */
  actor: UserSummary;
  /** Reference to comment thread (if applicable) */
  thread?: { id: string };
  /** Reference to specific comment (if applicable) */
  comment?: { id: string };
  /** Scene where the notification occurred */
  scene: {
    id: string;
    name: string;
  };
  /** Whether the notification has been read */
  read: boolean;
  /** When the notification was read */
  readAt?: string;
  /** When the notification was created */
  createdAt: string;
}

/**
 * Paginated response for notifications list
 */
export interface NotificationsResponse {
  notifications: Notification[];
  /** Cursor for next page (undefined if no more) */
  nextCursor?: string;
  /** Whether there are more notifications */
  hasMore: boolean;
}

// ============================================================================
// Global Search Types
// ============================================================================

/**
 * Collection result from global search
 */
export interface GlobalSearchCollectionResult {
  id: string;
  name: string;
  icon: string | null;
  isPrivate: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  updatedAt: string;
}

/**
 * Scene result from global search
 */
export interface GlobalSearchSceneResult {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  collectionId: string | null;
  collectionName: string | null;
  isPrivate: boolean;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  updatedAt: string;
}

/**
 * Response from global search endpoint
 */
export interface GlobalSearchResponse {
  collections: GlobalSearchCollectionResult[];
  scenes: GlobalSearchSceneResult[];
}
