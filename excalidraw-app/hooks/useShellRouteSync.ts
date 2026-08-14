/**
 * 把 URL（/profile、/invite/:code、/workspace/...）同步到 Workspace Shell 状态。
 * navigateTo() 会 dispatch popstate，因此侧栏点击与浏览器前进/后退走同一条路径。
 */
import { useCallback, useEffect, useState } from "react";

import { useSetAtom } from "../app-jotai";
import {
  appModeAtom,
  dashboardViewAtom,
  activeCollectionIdAtom,
  currentWorkspaceSlugAtom,
  currentSceneIdAtom,
  openWorkspaceSidebarAtom,
  type DashboardView,
} from "../components/Settings/settingsState";
import { parseUrl } from "../router";

export function useShellRouteSync() {
  const setAppMode = useSetAtom(appModeAtom);
  const setDashboardView = useSetAtom(dashboardViewAtom);
  const setActiveCollectionId = useSetAtom(activeCollectionIdAtom);
  const setWorkspaceSlug = useSetAtom(currentWorkspaceSlugAtom);
  const setCurrentSceneId = useSetAtom(currentSceneIdAtom);
  const openSidebar = useSetAtom(openWorkspaceSidebarAtom);
  const [inviteCode, setInviteCode] = useState<string | null>(() => {
    const route = parseUrl();
    return route.type === "invite" ? route.code : null;
  });

  const applyRoute = useCallback(() => {
    const route = parseUrl();

    const goDashboard = (view: DashboardView, slug?: string) => {
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
        setCurrentSceneId(route.sceneId);
        setAppMode("canvas");
        return;
      default:
        setInviteCode(null);
        return;
    }
  }, [
    setAppMode,
    setDashboardView,
    setActiveCollectionId,
    setWorkspaceSlug,
    setCurrentSceneId,
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
