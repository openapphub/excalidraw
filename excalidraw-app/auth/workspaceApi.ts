/**
 * workspaceApi 兼容层：重导出 api 模块（AstraDraw import 路径）。
 */
export * from "./api/types";
export {
  listWorkspaces,
  getWorkspace,
  createWorkspace,
  updateWorkspace,
  uploadWorkspaceAvatar,
  deleteWorkspace,
} from "./api/workspaces";
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
} from "./api/collections";
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
} from "./api/scenes";
export {
  listWorkspaceMembers,
  inviteToWorkspace,
  updateMemberRole,
  removeMember,
} from "./api/members";
export {
  listInviteLinks,
  createInviteLink,
  deleteInviteLink,
  joinViaInviteLink,
} from "./api/invites";

export { globalSearch } from "./api/search";

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
} from "./api/comments";

export {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./api/notifications";

export {
  getUserProfile,
  updateUserProfile,
  uploadAvatar,
  deleteAvatar,
} from "./api/users";

// 2A：不做 Teams — stub 避免 UI 编译失败
export async function listTeams(_workspaceId: string): Promise<never[]> {
  return [];
}
export async function createTeam(..._args: unknown[]): Promise<never> {
  throw new Error("Teams not supported in personal/small-team build");
}
export async function getTeam(..._args: unknown[]): Promise<never> {
  throw new Error("Teams not supported");
}
export async function updateTeam(..._args: unknown[]): Promise<never> {
  throw new Error("Teams not supported");
}
export async function deleteTeam(..._args: unknown[]): Promise<never> {
  throw new Error("Teams not supported");
}
