import {
  buildDashboardUrl,
  getWorkspaceSlug,
  type RouteType,
} from "../../router";

export const canCommitWorkspaceMutation = ({
  mutationWorkspaceId,
  mutationWorkspaceSlug,
  currentWorkspaceId,
  currentRoute,
}: {
  mutationWorkspaceId: string;
  mutationWorkspaceSlug: string;
  currentWorkspaceId: string | null;
  currentRoute: RouteType;
}): boolean => {
  const routeWorkspaceSlug = getWorkspaceSlug(currentRoute);
  return (
    currentWorkspaceId === mutationWorkspaceId &&
    (routeWorkspaceSlug === null ||
      routeWorkspaceSlug === mutationWorkspaceSlug)
  );
};

export const canCommitWorkspaceRouteMutation = ({
  workspaceIdAtStart,
  currentWorkspaceId,
  urlAtStart,
  currentUrl,
}: {
  workspaceIdAtStart: string | null;
  currentWorkspaceId: string | null;
  urlAtStart: string;
  currentUrl: string;
}): boolean =>
  workspaceIdAtStart !== null &&
  currentWorkspaceId === workspaceIdAtStart &&
  currentUrl === urlAtStart;

export const getWorkspaceDeleteRedirect = ({
  deletedWorkspaceSlug,
  currentRoute,
  fallbackWorkspaceSlug,
}: {
  deletedWorkspaceSlug: string;
  currentRoute: RouteType;
  fallbackWorkspaceSlug: string | null;
}): string | null => {
  if (getWorkspaceSlug(currentRoute) !== deletedWorkspaceSlug) {
    return null;
  }
  return fallbackWorkspaceSlug ? buildDashboardUrl(fallbackWorkspaceSlug) : "/";
};
