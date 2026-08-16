/**
 * 把 URL（/profile、/invite/:code、/workspace/...）同步到 Workspace Shell 状态。
 * navigateTo() 会 dispatch popstate，因此侧栏点击与浏览器前进/后退走同一条路径。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { appJotaiStore, currentCanvasIdAtom, useSetAtom } from "../app-jotai";
import {
  appModeAtom,
  dashboardViewAtom,
  activeCollectionIdAtom,
  currentWorkspaceSlugAtom,
  currentSceneIdAtom,
  currentSceneTitleAtom,
  currentSceneCanEditAtom,
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
  isAutoCollabSceneAtom,
  openWorkspaceSidebarAtom,
  type DashboardView,
} from "../components/Settings/settingsState";
import { parseUrl } from "../router";

export function useShellRouteSync({
  beforeLeaveScene,
}: {
  beforeLeaveScene?: () => Promise<boolean>;
} = {}) {
  const setAppMode = useSetAtom(appModeAtom);
  const setDashboardView = useSetAtom(dashboardViewAtom);
  const setActiveCollectionId = useSetAtom(activeCollectionIdAtom);
  const setWorkspaceSlug = useSetAtom(currentWorkspaceSlugAtom);
  const setCurrentSceneId = useSetAtom(currentSceneIdAtom);
  const setCurrentSceneTitle = useSetAtom(currentSceneTitleAtom);
  const setCurrentSceneCanEdit = useSetAtom(currentSceneCanEditAtom);
  const setSceneCollabEnabled = useSetAtom(sceneCollabEnabledAtom);
  const setSceneEditLock = useSetAtom(sceneEditLockAtom);
  const setIsAutoCollabScene = useSetAtom(isAutoCollabSceneAtom);
  const openSidebar = useSetAtom(openWorkspaceSidebarAtom);
  const routeSequenceRef = useRef(0);
  // 路由订阅必须稳定；通过 ref 读取最新离开回调，避免同一 URL 重放 fail-close。
  const beforeLeaveSceneRef = useRef(beforeLeaveScene);
  beforeLeaveSceneRef.current = beforeLeaveScene;
  const appliedSceneRouteRef = useRef<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(() => {
    const route = parseUrl();
    return route.type === "invite" ? route.code : null;
  });

  const applyRoute = useCallback(async () => {
    const routeSequence = ++routeSequenceRef.current;
    const route = parseUrl();

    const beforeLeave = beforeLeaveSceneRef.current;
    if (route.type !== "scene" && beforeLeave) {
      const canLeave = await beforeLeave();
      if (!canLeave || routeSequence !== routeSequenceRef.current) {
        return;
      }
    }

    // 路由离开 Workspace Scene 时，不能保留旧场景的评论、锁或协作状态。
    const clearActiveScene = () => {
      appliedSceneRouteRef.current = null;
      setCurrentSceneId(null);
      setCurrentSceneTitle("Untitled");
      setCurrentSceneCanEdit(null);
      setSceneCollabEnabled(false);
      setSceneEditLock(null);
      setIsAutoCollabScene(false);
    };

    const goDashboard = (view: DashboardView, slug?: string) => {
      clearActiveScene();
      setInviteCode(null);
      setAppMode("dashboard");
      setDashboardView(view);
      openSidebar();
      if (slug) {
        setWorkspaceSlug(slug);
      }
    };

    switch (route.type) {
      case "invite":
        clearActiveScene();
        setInviteCode(route.code);
        return;
      case "profile":
        goDashboard("profile");
        return;
      case "preferences":
        goDashboard("preferences");
        return;
      case "dashboard":
        goDashboard("home", route.workspaceSlug);
        return;
      case "collection":
        setActiveCollectionId(route.collectionId);
        goDashboard("collection", route.workspaceSlug);
        return;
      case "private":
        // 已取消 Private 集合类型，旧 URL 落到工作台
        goDashboard("home", route.workspaceSlug);
        return;
      case "members":
        goDashboard("members", route.workspaceSlug);
        return;
      case "settings":
        goDashboard("workspace", route.workspaceSlug);
        return;
      case "teams":
        goDashboard("members", route.workspaceSlug);
        return;
      case "notifications":
        goDashboard("notifications", route.workspaceSlug);
        return;
      case "scene":
        setInviteCode(null);
        setWorkspaceSlug(route.workspaceSlug);
        const routeSceneIdentity = `${route.workspaceSlug}:${route.sceneId}`;
        const isRepeatedSceneRoute =
          appliedSceneRouteRef.current === routeSceneIdentity;
        appliedSceneRouteRef.current = routeSceneIdentity;
        // 切到另一张 Scene 时，已加载画布仍需保留权限和独占锁，直到切换链路
        // 冻结编辑并完成最后一次保存。目标 URL 的权限由 handleCanvasSelect 在
        // 保存完成后 fail closed。首次直达或同 Scene 换 slug 仍必须立即只读；
        // 同一 Scene 身份的重复路由事件不能再次清空已经恢复的 ACL 和锁。
        const loadedCanvasId = appJotaiStore.get(currentCanvasIdAtom);
        if (
          !isRepeatedSceneRoute &&
          (!loadedCanvasId || loadedCanvasId === route.sceneId)
        ) {
          setCurrentSceneCanEdit(false);
          setSceneCollabEnabled(false);
          setSceneEditLock(null);
        }
        setIsAutoCollabScene(false);
        setCurrentSceneId(route.sceneId);
        setAppMode("canvas");
        return;
      default:
        clearActiveScene();
        setInviteCode(null);
    }
  }, [
    setAppMode,
    setDashboardView,
    setActiveCollectionId,
    setWorkspaceSlug,
    setCurrentSceneId,
    setCurrentSceneTitle,
    setCurrentSceneCanEdit,
    setSceneCollabEnabled,
    setSceneEditLock,
    setIsAutoCollabScene,
    openSidebar,
  ]);

  useEffect(() => {
    applyRoute();
    window.addEventListener("popstate", applyRoute);
    return () => window.removeEventListener("popstate", applyRoute);
  }, [applyRoute]);

  return {
    inviteCode,
    clearInvite: () => setInviteCode(null),
  };
}
