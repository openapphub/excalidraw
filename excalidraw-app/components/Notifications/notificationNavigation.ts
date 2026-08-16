import { getScene, getWorkspace } from "../../auth/workspaceApi";
import { buildSceneUrl, buildSceneUrlWithThread } from "../../router";

export interface NotificationNavigationTarget {
  sceneId: string;
  threadId?: string;
  commentId?: string;
}

/** 使用服务端 ACL 元数据解析通知目标，不能沿用当前页面的 Workspace。 */
export async function resolveNotificationUrl({
  sceneId,
  threadId,
  commentId,
}: NotificationNavigationTarget): Promise<string> {
  const scene = await getScene(sceneId);
  const workspace = await getWorkspace(scene.workspaceId);

  return threadId
    ? buildSceneUrlWithThread(workspace.slug, sceneId, threadId, commentId)
    : buildSceneUrl(workspace.slug, sceneId);
}
