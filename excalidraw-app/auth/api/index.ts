/**
 * API Module — 仅导出本仓已实现的模块（无 Teams/Talktracks）
 */
export {
  getApiBaseUrl,
  ApiError,
  apiRequest,
  apiRequestRaw,
  jsonBody,
  binaryBody,
} from "./client";

export type {
  CommentThread,
  Comment,
  CreateThreadDto,
  CreateCommentDto,
  UpdateThreadDto,
  UpdateCommentDto,
  ThreadFilters,
  CommentEvent,
  WorkspaceRole,
  WorkspaceType,
  Workspace,
  WorkspaceMember,
  Team,
  Collection,
  CollectionAccessLevel,
  CollectionTeamAccess,
  InviteLink,
  WorkspaceScene,
  SceneEditor,
  CreateSceneDto,
  UpdateSceneDto,
  UserProfile,
  UpdateProfileDto,
  UserSummary,
  Notification,
  NotificationType,
  NotificationsResponse,
  GlobalSearchCollectionResult,
  GlobalSearchSceneResult,
  GlobalSearchResponse,
} from "./types";

export { globalSearch } from "./search";

export {
  listScenes,
  getScene,
  getSceneData,
  createScene,
  updateScene,
  updateSceneData,
  uploadSceneThumbnail,
  deleteScene,
  startCollaboration,
  acquireSceneLock,
  releaseSceneLock,
  enableSceneCollab,
  disableSceneCollab,
  duplicateScene,
  listWorkspaceScenes,
  moveScene,
} from "./scenes";

export {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  uploadWorkspaceAvatar,
  deleteWorkspace,
} from "./workspaces";

export {
  listWorkspaceMembers,
  inviteToWorkspace,
  updateMemberRole,
  removeMember,
} from "./members";

export {
  listInviteLinks,
  createInviteLink,
  deleteInviteLink,
  joinViaInviteLink,
} from "./invites";

export {
  listThreads,
  getThread,
  createThread,
  updateThread,
  deleteThread,
  resolveThread,
  reopenThread,
  addComment,
  updateComment,
  deleteComment,
} from "./comments";

export {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./notifications";

export {
  listCollections,
  createCollection,
  getCollection,
  updateCollection,
  deleteCollection,
  copyCollectionToWorkspace,
  moveCollectionToWorkspace,
  listCollectionTeams,
  setCollectionTeamAccess,
  removeCollectionTeamAccess,
} from "./collections";
