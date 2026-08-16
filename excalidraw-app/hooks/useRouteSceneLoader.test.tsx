import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRouteSceneLoader } from "./useRouteSceneLoader";

describe("useRouteSceneLoader", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
  });

  it("加载失败后不自动循环，但同 URL 再次导航可以重试", async () => {
    const handleCanvasSelect = vi.fn(async () => {});
    let loaded = false;
    const isCanvasLoaded = vi.fn(() => loaded);
    const hook = renderHook(
      ({ currentCanvasId }) =>
        useRouteSceneLoader({
          ready: true,
          currentSceneId: "scene-a",
          currentCanvasId,
          currentWorkspaceSlug: "source",
          isCanvasLoaded,
          handleCanvasSelect,
        }),
      { initialProps: { currentCanvasId: null as string | null } },
    );

    await waitFor(() => expect(handleCanvasSelect).toHaveBeenCalledTimes(1));

    hook.rerender({ currentCanvasId: "scene-a" });
    expect(handleCanvasSelect).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(handleCanvasSelect).toHaveBeenCalledTimes(2));
    expect(handleCanvasSelect).toHaveBeenLastCalledWith("scene-a", {
      forceSceneReload: true,
    });

    act(() => {
      window.history.pushState({}, "", "/workspace/source/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await act(async () => {});
    expect(handleCanvasSelect).toHaveBeenCalledTimes(2);

    loaded = true;
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    hook.rerender({ currentCanvasId: "scene-a" });
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await act(async () => {});
    expect(handleCanvasSelect).toHaveBeenCalledTimes(2);
  });
});
