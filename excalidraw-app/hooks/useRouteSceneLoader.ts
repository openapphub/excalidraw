import { useEffect, useRef, useState } from "react";

import { parseUrl } from "../router";

export function useRouteSceneLoader({
  ready,
  currentSceneId,
  currentCanvasId,
  currentWorkspaceSlug,
  isCanvasLoaded,
  handleCanvasSelect,
}: {
  ready: boolean;
  currentSceneId: string | null;
  currentCanvasId: string | null;
  currentWorkspaceSlug: string | null;
  isCanvasLoaded: (id: string, workspaceSlug: string | null) => boolean;
  handleCanvasSelect: (
    id: string,
    options?: { forceSceneReload?: boolean },
  ) => Promise<void>;
}) {
  const [routeRevision, setRouteRevision] = useState(0);
  const handleCanvasSelectRef = useRef(handleCanvasSelect);
  handleCanvasSelectRef.current = handleCanvasSelect;
  const isCanvasLoadedRef = useRef(isCanvasLoaded);
  isCanvasLoadedRef.current = isCanvasLoaded;
  const attemptedRouteRef = useRef<{
    identity: string;
    revision: number;
  } | null>(null);

  useEffect(() => {
    const handleRouteNavigation = () => {
      setRouteRevision((revision) => revision + 1);
    };
    window.addEventListener("popstate", handleRouteNavigation);
    return () => window.removeEventListener("popstate", handleRouteNavigation);
  }, []);

  useEffect(() => {
    if (!ready || !currentSceneId) {
      attemptedRouteRef.current = null;
      return;
    }

    const route = parseUrl();
    if (
      route.type !== "scene" ||
      route.sceneId !== currentSceneId ||
      route.workspaceSlug !== currentWorkspaceSlug
    ) {
      return;
    }

    const routeSceneIdentity = `${
      currentWorkspaceSlug || ""
    }:${currentSceneId}`;
    if (
      currentSceneId === currentCanvasId &&
      isCanvasLoadedRef.current(currentSceneId, currentWorkspaceSlug)
    ) {
      return;
    }
    if (
      attemptedRouteRef.current?.identity === routeSceneIdentity &&
      attemptedRouteRef.current.revision === routeRevision
    ) {
      return;
    }

    attemptedRouteRef.current = {
      identity: routeSceneIdentity,
      revision: routeRevision,
    };
    void handleCanvasSelectRef.current(currentSceneId, {
      forceSceneReload: currentSceneId === currentCanvasId,
    });
  }, [
    ready,
    currentSceneId,
    currentCanvasId,
    currentWorkspaceSlug,
    routeRevision,
  ]);
}
