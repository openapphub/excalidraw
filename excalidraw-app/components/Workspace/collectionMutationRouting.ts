import {
  buildCollectionUrl,
  buildDashboardUrl,
  buildSceneUrl,
  type RouteType,
} from "../../router";

export const getCollectionDeleteRedirect = ({
  routeAtStart,
  currentRoute,
  collectionId,
  currentSceneBelongsToCollection,
}: {
  routeAtStart: RouteType;
  currentRoute: RouteType;
  collectionId: string;
  currentSceneBelongsToCollection: boolean;
}): string | null => {
  if (
    routeAtStart.type === "collection" &&
    currentRoute.type === "collection" &&
    routeAtStart.collectionId === collectionId &&
    currentRoute.collectionId === routeAtStart.collectionId &&
    currentRoute.workspaceSlug === routeAtStart.workspaceSlug
  ) {
    return buildDashboardUrl(currentRoute.workspaceSlug);
  }
  if (
    routeAtStart.type === "scene" &&
    currentRoute.type === "scene" &&
    currentSceneBelongsToCollection &&
    currentRoute.sceneId === routeAtStart.sceneId &&
    currentRoute.workspaceSlug === routeAtStart.workspaceSlug
  ) {
    return buildDashboardUrl(currentRoute.workspaceSlug);
  }
  return null;
};

export const getCollectionMoveRedirect = ({
  routeAtStart,
  currentRoute,
  collectionId,
  currentSceneBelongsToCollection,
  targetWorkspaceSlug,
}: {
  routeAtStart: RouteType;
  currentRoute: RouteType;
  collectionId: string;
  currentSceneBelongsToCollection: boolean;
  targetWorkspaceSlug: string;
}): string | null => {
  if (
    routeAtStart.type === "collection" &&
    currentRoute.type === "collection" &&
    routeAtStart.collectionId === collectionId &&
    currentRoute.collectionId === routeAtStart.collectionId &&
    currentRoute.workspaceSlug === routeAtStart.workspaceSlug
  ) {
    return buildCollectionUrl(targetWorkspaceSlug, collectionId);
  }
  if (
    routeAtStart.type === "scene" &&
    currentRoute.type === "scene" &&
    currentSceneBelongsToCollection &&
    currentRoute.sceneId === routeAtStart.sceneId &&
    currentRoute.workspaceSlug === routeAtStart.workspaceSlug
  ) {
    return buildSceneUrl(targetWorkspaceSlug, routeAtStart.sceneId);
  }
  return null;
};
