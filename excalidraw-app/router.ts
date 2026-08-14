/**
 * URL Router for AstraDraw
 *
 * Handles URL-based navigation, parsing URLs to determine the current view,
 * and building URLs for navigation actions.
 */

// ============================================================================
// Types
// ============================================================================

export type RouteType =
  | { type: "dashboard"; workspaceSlug: string }
  | { type: "collection"; workspaceSlug: string; collectionId: string }
  | { type: "private"; workspaceSlug: string }
  | {
      type: "scene";
      workspaceSlug: string;
      sceneId: string;
      threadId?: string;
      commentId?: string;
    }
  | { type: "settings"; workspaceSlug: string }
  | { type: "members"; workspaceSlug: string }
  | { type: "teams"; workspaceSlug: string }
  | { type: "notifications"; workspaceSlug: string }
  | { type: "profile" }
  | { type: "preferences" }
  | { type: "invite"; code: string }
  | { type: "anonymous" }
  | { type: "legacy-collab"; roomId: string; roomKey: string }
  | { type: "home" };

// ============================================================================
// URL Patterns (Regular Expressions)
// ============================================================================

// Workspace routes: /workspace/{slug}/...
const WORKSPACE_DASHBOARD_PATTERN = /^\/workspace\/([^/]+)\/dashboard\/?$/;
const WORKSPACE_PRIVATE_PATTERN = /^\/workspace\/([^/]+)\/private\/?$/;
const WORKSPACE_COLLECTION_PATTERN =
  /^\/workspace\/([^/]+)\/collection\/([^/]+)\/?$/;
const WORKSPACE_SCENE_PATTERN = /^\/workspace\/([^/]+)\/scene\/([^/#]+)/;
const WORKSPACE_SETTINGS_PATTERN = /^\/workspace\/([^/]+)\/settings\/?$/;
const WORKSPACE_MEMBERS_PATTERN = /^\/workspace\/([^/]+)\/members\/?$/;
const WORKSPACE_TEAMS_PATTERN = /^\/workspace\/([^/]+)\/teams\/?$/;
const WORKSPACE_NOTIFICATIONS_PATTERN =
  /^\/workspace\/([^/]+)\/notifications\/?$/;

// Other routes
const PROFILE_PATTERN = /^\/profile\/?$/;
const PREFERENCES_PATTERN = /^\/preferences\/?$/;
const INVITE_PATTERN = /^\/invite\/([a-zA-Z0-9_-]+)\/?$/;

// Legacy collaboration pattern (hash-based)
const LEGACY_ROOM_PATTERN = /^#room=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/;

// ============================================================================
// URL Parsing
// ============================================================================

/**
 * Parse the current URL and return the route type
 */
export function parseUrl(url: string = window.location.href): RouteType {
  const urlObj = new URL(url, window.location.origin);
  const pathname = urlObj.pathname;
  const search = urlObj.search;
  const hash = urlObj.hash;

  // Check for anonymous mode
  const params = new URLSearchParams(search);
  if (params.get("mode") === "anonymous") {
    return { type: "anonymous" };
  }

  // Check for legacy collaboration link (hash-based)
  const legacyRoomMatch = hash.match(LEGACY_ROOM_PATTERN);
  if (legacyRoomMatch) {
    return {
      type: "legacy-collab",
      roomId: legacyRoomMatch[1],
      roomKey: legacyRoomMatch[2],
    };
  }

  // Profile route
  const profileMatch = pathname.match(PROFILE_PATTERN);
  if (profileMatch) {
    return { type: "profile" };
  }

  // Preferences route
  const preferencesMatch = pathname.match(PREFERENCES_PATTERN);
  if (preferencesMatch) {
    return { type: "preferences" };
  }

  // Invite route
  const inviteMatch = pathname.match(INVITE_PATTERN);
  if (inviteMatch) {
    return { type: "invite", code: inviteMatch[1] };
  }

  // Workspace dashboard
  const dashboardMatch = pathname.match(WORKSPACE_DASHBOARD_PATTERN);
  if (dashboardMatch) {
    return { type: "dashboard", workspaceSlug: dashboardMatch[1] };
  }

  // Workspace private collection
  const privateMatch = pathname.match(WORKSPACE_PRIVATE_PATTERN);
  if (privateMatch) {
    return { type: "private", workspaceSlug: privateMatch[1] };
  }

  // Workspace collection
  const collectionMatch = pathname.match(WORKSPACE_COLLECTION_PATTERN);
  if (collectionMatch) {
    return {
      type: "collection",
      workspaceSlug: collectionMatch[1],
      collectionId: collectionMatch[2],
    };
  }

  // Workspace scene
  const sceneMatch = pathname.match(WORKSPACE_SCENE_PATTERN);
  if (sceneMatch) {
    // Extract thread and comment from query params (for deep links)
    const threadId = params.get("thread") || undefined;
    const commentId = params.get("comment") || undefined;

    return {
      type: "scene",
      workspaceSlug: sceneMatch[1],
      sceneId: sceneMatch[2],
      threadId,
      commentId,
    };
  }

  // Workspace settings
  const settingsMatch = pathname.match(WORKSPACE_SETTINGS_PATTERN);
  if (settingsMatch) {
    return { type: "settings", workspaceSlug: settingsMatch[1] };
  }

  // Workspace members
  const membersMatch = pathname.match(WORKSPACE_MEMBERS_PATTERN);
  if (membersMatch) {
    return { type: "members", workspaceSlug: membersMatch[1] };
  }

  // Workspace teams
  const teamsMatch = pathname.match(WORKSPACE_TEAMS_PATTERN);
  if (teamsMatch) {
    return { type: "teams", workspaceSlug: teamsMatch[1] };
  }

  // Workspace notifications
  const notificationsMatch = pathname.match(WORKSPACE_NOTIFICATIONS_PATTERN);
  if (notificationsMatch) {
    return { type: "notifications", workspaceSlug: notificationsMatch[1] };
  }

  // Default: home/root
  return { type: "home" };
}

// ============================================================================
// URL Building
// ============================================================================

/**
 * Build URL for workspace dashboard
 */
export function buildDashboardUrl(workspaceSlug: string): string {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/dashboard`;
}

/**
 * Build URL for private collection
 */
export function buildPrivateUrl(workspaceSlug: string): string {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/private`;
}

/**
 * Build URL for a named collection
 */
export function buildCollectionUrl(
  workspaceSlug: string,
  collectionId: string,
): string {
  return `/workspace/${encodeURIComponent(
    workspaceSlug,
  )}/collection/${encodeURIComponent(collectionId)}`;
}

/**
 * Build URL for a scene
 */
export function buildSceneUrl(
  workspaceSlug: string,
  sceneId: string,
  roomKey?: string,
): string {
  const base = `/workspace/${encodeURIComponent(
    workspaceSlug,
  )}/scene/${encodeURIComponent(sceneId)}`;
  if (roomKey) {
    return `${base}#key=${roomKey}`;
  }
  return base;
}

/**
 * Build URL for workspace settings
 */
export function buildSettingsUrl(workspaceSlug: string): string {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/settings`;
}

/**
 * Build URL for workspace members
 */
export function buildMembersUrl(workspaceSlug: string): string {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/members`;
}

/**
 * Build URL for teams & collections page
 */
export function buildTeamsUrl(workspaceSlug: string): string {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/teams`;
}

/**
 * Build URL for notifications page
 */
export function buildNotificationsUrl(workspaceSlug: string): string {
  return `/workspace/${encodeURIComponent(workspaceSlug)}/notifications`;
}

/**
 * Build URL for user profile
 */
export function buildProfileUrl(): string {
  return "/profile";
}

/**
 * Build URL for preferences
 */
export function buildPreferencesUrl(): string {
  return "/preferences";
}

/**
 * Build URL for invite acceptance
 */
export function buildInviteUrl(code: string): string {
  return `/invite/${encodeURIComponent(code)}`;
}

/**
 * Build URL for anonymous mode
 */
export function buildAnonymousUrl(): string {
  return "/?mode=anonymous";
}

/**
 * Build URL for a scene with a specific comment thread (deep link)
 *
 * @example
 * buildSceneUrlWithThread("my-workspace", "scene123", "thread456")
 * // => "/workspace/my-workspace/scene/scene123?thread=thread456"
 *
 * buildSceneUrlWithThread("my-workspace", "scene123", "thread456", "comment789")
 * // => "/workspace/my-workspace/scene/scene123?thread=thread456&comment=comment789"
 */
export function buildSceneUrlWithThread(
  workspaceSlug: string,
  sceneId: string,
  threadId: string,
  commentId?: string,
): string {
  const base = `/workspace/${encodeURIComponent(
    workspaceSlug,
  )}/scene/${encodeURIComponent(sceneId)}`;

  const params = new URLSearchParams();
  params.set("thread", threadId);
  if (commentId) {
    params.set("comment", commentId);
  }

  return `${base}?${params.toString()}`;
}

// ============================================================================
// Navigation Helpers
// ============================================================================

/**
 * Navigate to a URL using pushState (adds to browser history)
 */
export function navigateTo(url: string, state?: object): void {
  window.history.pushState(state || {}, "", url);
  // Dispatch a custom event so components can react to URL changes
  window.dispatchEvent(new PopStateEvent("popstate", { state: state || {} }));
}

/**
 * Replace current URL without adding to history
 */
export function replaceUrl(url: string, state?: object): void {
  window.history.replaceState(state || {}, "", url);
}

/**
 * Check if the current URL is a workspace route
 */
export function isWorkspaceRoute(route: RouteType): boolean {
  return (
    route.type === "dashboard" ||
    route.type === "collection" ||
    route.type === "private" ||
    route.type === "scene" ||
    route.type === "settings" ||
    route.type === "members" ||
    route.type === "teams" ||
    route.type === "notifications"
  );
}

/**
 * Get workspace slug from a route (if applicable)
 */
export function getWorkspaceSlug(route: RouteType): string | null {
  if (
    route.type === "dashboard" ||
    route.type === "collection" ||
    route.type === "private" ||
    route.type === "scene" ||
    route.type === "settings" ||
    route.type === "members" ||
    route.type === "teams" ||
    route.type === "notifications"
  ) {
    return route.workspaceSlug;
  }
  return null;
}

/**
 * Check if the route is a dashboard/collection view (not canvas)
 */
export function isDashboardRoute(route: RouteType): boolean {
  return (
    route.type === "dashboard" ||
    route.type === "collection" ||
    route.type === "private" ||
    route.type === "settings" ||
    route.type === "members" ||
    route.type === "teams" ||
    route.type === "notifications" ||
    route.type === "profile"
  );
}

/**
 * Check if the route is a canvas/scene view
 */
export function isCanvasRoute(route: RouteType): boolean {
  return (
    route.type === "scene" ||
    route.type === "anonymous" ||
    route.type === "legacy-collab" ||
    route.type === "home"
  );
}
