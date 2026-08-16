// eslint-disable-next-line no-restricted-imports
import { atom } from "jotai";

import {
  buildDashboardUrl,
  buildCollectionUrl,
  buildPrivateUrl,
  buildSceneUrl,
  buildSettingsUrl,
  buildMembersUrl,
  buildTeamsUrl,
  buildNotificationsUrl,
  buildProfileUrl,
  buildPreferencesUrl,
  navigateTo,
} from "../../router";

/**
 * App mode - determines what the main content area shows
 * - "canvas": Drawing board with Excalidraw
 * - "dashboard": Dashboard views (home, collection, settings pages)
 */
export type AppMode = "canvas" | "dashboard";

/**
 * Sidebar display mode (derived from appMode)
 * - "board": Minimal sidebar for canvas mode
 * - "full": Full navigation for dashboard mode
 */
export type SidebarMode = "board" | "full";

/**
 * Dashboard view - what's shown in the main content area when in dashboard mode
 * - "home": Dashboard home page with recently modified/visited
 * - "collection": Collection view showing scenes from a specific collection
 * - "profile": User profile settings
 * - "preferences": User preferences (theme, etc.)
 * - "workspace": Workspace settings (admin only)
 * - "members": Team members management (admin only)
 * - "teams-collections": Teams & collections management (admin only)
 * - "notifications": User notifications page
 */
export type DashboardView =
  | "home"
  | "collection"
  | "profile"
  | "preferences"
  | "workspace"
  | "members"
  | "teams-collections"
  | "notifications";

/**
 * Current app mode atom
 */
export const appModeAtom = atom<AppMode>("canvas");

/**
 * Active collection ID - persists across mode switches
 * This is the collection currently being viewed/worked in
 */
export const activeCollectionIdAtom = atom<string | null>(null);

/**
 * Dashboard view atom - which view is shown in dashboard mode
 */
export const dashboardViewAtom = atom<DashboardView>("home");

/**
 * Current workspace slug - tracks the active workspace for URL routing
 */
export const currentWorkspaceSlugAtom = atom<string | null>(null);

/**
 * Current scene ID - tracks the active scene being edited
 */
export const currentSceneIdAtom = atom<string | null>(null);

/**
 * Current scene title - for display purposes
 */
export const currentSceneTitleAtom = atom<string>("Untitled");

/**
 * 当前 workspace scene 是否可写。
 * null = 尚未判定（非 workspace scene / 未加载）；false = VIEWER 只读。
 */
export const currentSceneCanEditAtom = atom<boolean | null>(null);

/**
 * 工作区 Scene 是否已主动解锁一起编辑（collabEnabled）。
 */
export const sceneCollabEnabledAtom = atom<boolean>(false);

export type SceneEditLockState = {
  locked: boolean;
  editorName: string | null;
  isOtherTab: boolean;
};

/** 独占锁被他人/其他标签占用时 locked=true。 */
export const sceneEditLockAtom = atom<SceneEditLockState | null>(null);

/**
 * Flag to indicate if current scene is in auto-collaboration mode
 * (shared collection scene where collaboration can't be stopped)
 */
export const isAutoCollabSceneAtom = atom<boolean>(false);

/**
 * Flag to indicate if a collection is private (for URL routing)
 */
export const isPrivateCollectionAtom = atom<boolean>(false);

/**
 * Derived atom to get the current sidebar mode based on app mode
 */
export const sidebarModeAtom = atom<SidebarMode>((get) => {
  const appMode = get(appModeAtom);
  return appMode === "canvas" ? "board" : "full";
});

/**
 * localStorage key for workspace sidebar preference
 */
const WORKSPACE_SIDEBAR_PREF_KEY = "astradraw_workspace_sidebar_open";

/**
 * Workspace sidebar open state
 * Initialized from localStorage, persists across sessions
 */
export const workspaceSidebarOpenAtom = atom<boolean>(
  typeof window !== "undefined"
    ? localStorage.getItem(WORKSPACE_SIDEBAR_PREF_KEY) === "true"
    : false,
);

/**
 * Action atom to toggle workspace sidebar
 */
export const toggleWorkspaceSidebarAtom = atom(null, (get, set) => {
  const newValue = !get(workspaceSidebarOpenAtom);
  set(workspaceSidebarOpenAtom, newValue);
  // Persist to localStorage
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKSPACE_SIDEBAR_PREF_KEY, String(newValue));
  }
});

/**
 * Action atom to open workspace sidebar
 */
export const openWorkspaceSidebarAtom = atom(null, (get, set) => {
  set(workspaceSidebarOpenAtom, true);
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKSPACE_SIDEBAR_PREF_KEY, "true");
  }
});

/**
 * Action atom to close workspace sidebar
 */
export const closeWorkspaceSidebarAtom = atom(null, (get, set) => {
  set(workspaceSidebarOpenAtom, false);
  if (typeof window !== "undefined") {
    localStorage.setItem(WORKSPACE_SIDEBAR_PREF_KEY, "false");
  }
});

/**
 * Atom for navigating to dashboard home
 * Updates URL to /workspace/{slug}/dashboard
 * Auto-opens sidebar when navigating to dashboard
 */
export const navigateToDashboardAtom = atom(null, (get, set) => {
  const workspaceSlug = get(currentWorkspaceSlugAtom);
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "home");
  set(workspaceSidebarOpenAtom, true);

  // Update URL if we have a workspace
  if (workspaceSlug) {
    navigateTo(buildDashboardUrl(workspaceSlug));
  }
});

/**
 * Atom for navigating to a specific collection view
 * Updates URL to /workspace/{slug}/collection/{id} or /workspace/{slug}/private
 * Auto-opens sidebar when navigating to collection
 */
export const navigateToCollectionAtom = atom(
  null,
  (
    get,
    set,
    params: { collectionId: string; isPrivate?: boolean } | string,
  ) => {
    // Support both old string API and new object API
    const collectionId =
      typeof params === "string" ? params : params.collectionId;
    const isPrivate = typeof params === "string" ? false : params.isPrivate;

    const workspaceSlug = get(currentWorkspaceSlugAtom);
    set(activeCollectionIdAtom, collectionId);
    set(isPrivateCollectionAtom, isPrivate || false);
    set(appModeAtom, "dashboard");
    set(dashboardViewAtom, "collection");
    set(workspaceSidebarOpenAtom, true);

    // Update URL if we have a workspace
    if (workspaceSlug) {
      if (isPrivate) {
        navigateTo(buildPrivateUrl(workspaceSlug));
      } else {
        navigateTo(buildCollectionUrl(workspaceSlug, collectionId));
      }
    }
  },
);

/**
 * Atom for navigating back to canvas mode
 * If a scene is currently loaded, navigates to that scene's URL
 * Otherwise navigates to root URL (empty canvas)
 */
export const navigateToCanvasAtom = atom(null, (get, set) => {
  const currentSceneId = get(currentSceneIdAtom);
  const workspaceSlug = get(currentWorkspaceSlugAtom);

  set(appModeAtom, "canvas");

  // If we have a current scene, navigate to its URL
  if (currentSceneId && workspaceSlug) {
    navigateTo(buildSceneUrl(workspaceSlug, currentSceneId));
  } else {
    // Navigate to root URL to show empty canvas
    navigateTo("/");
  }
});

/**
 * Atom for navigating to a specific scene
 * Updates URL to /workspace/{slug}/scene/{id}
 */
export const navigateToSceneAtom = atom(
  null,
  (
    get,
    set,
    params: { sceneId: string; title?: string; workspaceSlug?: string },
  ) => {
    const slug = params.workspaceSlug || get(currentWorkspaceSlugAtom);
    // 旧 Scene 的权限和锁必须保留到切换链路完成最后一次保存。目标 Scene
    // 会在 useCanvasManagement 保存旧内容后统一 fail-close 并重新校验 ACL。
    set(isAutoCollabSceneAtom, false);
    set(currentSceneIdAtom, params.sceneId);
    if (params.title) {
      set(currentSceneTitleAtom, params.title);
    }
    set(appModeAtom, "canvas");

    // Update URL if we have a workspace
    if (slug) {
      navigateTo(buildSceneUrl(slug, params.sceneId));
    }
  },
);

/**
 * Atom for navigating to profile settings
 * Updates URL to /profile
 */
export const navigateToProfileAtom = atom(null, (get, set) => {
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "profile");
  navigateTo(buildProfileUrl());
});

/**
 * Atom for navigating to preferences
 * Updates URL to /preferences
 */
export const navigateToPreferencesAtom = atom(null, (get, set) => {
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "preferences");
  navigateTo(buildPreferencesUrl());
});

/**
 * Atom for navigating to workspace settings
 * Updates URL to /workspace/{slug}/settings
 */
export const navigateToWorkspaceSettingsAtom = atom(null, (get, set) => {
  const workspaceSlug = get(currentWorkspaceSlugAtom);
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "workspace");

  if (workspaceSlug) {
    navigateTo(buildSettingsUrl(workspaceSlug));
  }
});

/**
 * Atom for navigating to members page
 * Updates URL to /workspace/{slug}/members
 */
export const navigateToMembersAtom = atom(null, (get, set) => {
  const workspaceSlug = get(currentWorkspaceSlugAtom);
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "members");

  if (workspaceSlug) {
    navigateTo(buildMembersUrl(workspaceSlug));
  }
});

/**
 * Atom for navigating to teams & collections page
 * Updates URL to /workspace/{slug}/teams
 */
export const navigateToTeamsCollectionsAtom = atom(null, (get, set) => {
  const workspaceSlug = get(currentWorkspaceSlugAtom);
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "teams-collections");

  if (workspaceSlug) {
    navigateTo(buildTeamsUrl(workspaceSlug));
  }
});

/**
 * Atom for navigating to notifications page
 * Updates URL to /workspace/{slug}/notifications
 */
export const navigateToNotificationsAtom = atom(null, (get, set) => {
  const workspaceSlug = get(currentWorkspaceSlugAtom);
  set(appModeAtom, "dashboard");
  set(dashboardViewAtom, "notifications");
  set(workspaceSidebarOpenAtom, true);

  if (workspaceSlug) {
    navigateTo(buildNotificationsUrl(workspaceSlug));
  }
});

// ============================================================================
// Workspace & Collections Data Atoms
// ============================================================================

/**
 * Types imported inline to avoid circular dependencies
 * These match the types in auth/api/types.ts
 */
export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  avatarUrl: string | null;
  role: "ADMIN" | "MEMBER" | "VIEWER";
  type?: "PERSONAL" | "SHARED";
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionData {
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
  teams?: Array<{
    teamId: string;
    teamName: string;
    teamColor: string;
  }>;
}

/**
 * List of all workspaces the user has access to
 */
export const workspacesAtom = atom<WorkspaceData[]>([]);

/**
 * Currently active workspace object
 */
export const currentWorkspaceAtom = atom<WorkspaceData | null>(null);

/**
 * Collections for the current workspace
 */
export const collectionsAtom = atom<CollectionData[]>([]);

/**
 * Derived atom: Get the private collection from collections list
 */
export const privateCollectionAtom = atom<CollectionData | null>((get) => {
  const collections = get(collectionsAtom);
  return collections.find((c) => c.isPrivate) || null;
});

/**
 * Derived atom: Get the active collection object based on activeCollectionIdAtom
 * Falls back to private collection if no active collection is set
 */
export const activeCollectionAtom = atom<CollectionData | null>((get) => {
  const activeId = get(activeCollectionIdAtom);
  const collections = get(collectionsAtom);

  if (!activeId) {
    return collections[0] || null;
  }
  return collections.find((c) => c.id === activeId) || null;
});

/**
 * Logout signal - incremented when user logs out
 * Components that need to react to logout (e.g., reset scene) should subscribe to this
 */
export const logoutSignalAtom = atom(0);

/**
 * Flag to indicate logout is in progress
 * Used to prevent autosave from saving empty canvas data during logout
 * Set to true before clearing workspace data, cleared after canvas is reset
 */
export const isLoggingOutAtom = atom(false);

/**
 * Action atom to clear workspace data and signal logout
 * This clears all workspace state and increments the logout signal
 * Components like App.tsx should subscribe to logoutSignalAtom to reset the canvas
 */
export const clearWorkspaceDataAtom = atom(null, (get, set) => {
  // Set logout flag FIRST to prevent autosave from saving empty canvas
  set(isLoggingOutAtom, true);

  set(workspacesAtom, []);
  set(currentWorkspaceAtom, null);
  set(collectionsAtom, []);
  set(activeCollectionIdAtom, null);
  set(currentWorkspaceSlugAtom, null);
  set(currentSceneIdAtom, null);
  set(currentSceneTitleAtom, "Untitled");
  set(isAutoCollabSceneAtom, false);
  set(sceneCollabEnabledAtom, false);
  set(sceneEditLockAtom, null);
  // Signal logout so App.tsx can reset the canvas
  set(logoutSignalAtom, (prev) => prev + 1);
});

// ============================================================================
// Refresh Trigger Atoms
// ============================================================================

/**
 * Refresh trigger atoms - increment to trigger re-fetch in subscribed components
 * This allows cross-component communication without prop drilling
 */

/**
 * Collections refresh trigger - increment when collections are created/updated/deleted
 * Components that display collections should subscribe to this and re-fetch when it changes
 */
export const collectionsRefreshAtom = atom(0);

/**
 * Action atom to trigger collections refresh
 */
export const triggerCollectionsRefreshAtom = atom(null, (get, set) => {
  set(collectionsRefreshAtom, get(collectionsRefreshAtom) + 1);
});

/**
 * Quick Search modal visibility state
 * Controls whether the Quick Search overlay is shown
 */
export const quickSearchOpenAtom = atom<boolean>(false);

/**
 * Search query for dashboard search
 * When not empty, WorkspaceMainContent shows SearchResultsView instead of normal content
 */
export const searchQueryAtom = atom<string>("");
