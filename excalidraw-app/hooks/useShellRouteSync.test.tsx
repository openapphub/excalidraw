import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Provider, appJotaiStore, currentCanvasIdAtom } from "../app-jotai";
import {
  appModeAtom,
  currentSceneCanEditAtom,
  currentSceneIdAtom,
  currentWorkspaceSlugAtom,
  navigateToSceneAtom,
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
} from "../components/Settings/settingsState";

import { useShellRouteSync } from "./useShellRouteSync";

import type { PropsWithChildren } from "react";

const wrapper = ({ children }: PropsWithChildren) => (
  <Provider store={appJotaiStore}>{children}</Provider>
);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe("useShellRouteSync", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    appJotaiStore.set(currentCanvasIdAtom, null);
    appJotaiStore.set(currentSceneIdAtom, null);
    appJotaiStore.set(currentWorkspaceSlugAtom, null);
    appJotaiStore.set(currentSceneCanEditAtom, null);
    appJotaiStore.set(sceneCollabEnabledAtom, false);
    appJotaiStore.set(sceneEditLockAtom, null);
    appJotaiStore.set(appModeAtom, "canvas");
  });

  it("首次直达 Scene 时在 ACL 返回前立即 fail-close", async () => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    appJotaiStore.set(currentSceneCanEditAtom, true);
    appJotaiStore.set(sceneCollabEnabledAtom, true);
    appJotaiStore.set(sceneEditLockAtom, {
      locked: false,
      editorName: null,
      isOtherTab: false,
    });

    renderHook(() => useShellRouteSync(), { wrapper });

    await waitFor(() => {
      expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-a");
    });
    expect(appJotaiStore.get(currentSceneCanEditAtom)).toBe(false);
    expect(appJotaiStore.get(sceneCollabEnabledAtom)).toBe(false);
    expect(appJotaiStore.get(sceneEditLockAtom)).toBeNull();
  });

  it("离开回调换引用时不重复应用当前 Scene 路由", async () => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    const initialBeforeLeave = vi.fn(async () => true);
    const latestBeforeLeave = vi.fn(async () => true);
    const hook = renderHook(
      ({ beforeLeaveScene }) => useShellRouteSync({ beforeLeaveScene }),
      {
        wrapper,
        initialProps: { beforeLeaveScene: initialBeforeLeave },
      },
    );

    await waitFor(() => {
      expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-a");
    });

    appJotaiStore.set(currentCanvasIdAtom, "scene-a");
    appJotaiStore.set(currentSceneCanEditAtom, true);
    appJotaiStore.set(sceneCollabEnabledAtom, true);
    appJotaiStore.set(sceneEditLockAtom, {
      locked: false,
      editorName: null,
      isOtherTab: false,
    });

    hook.rerender({ beforeLeaveScene: latestBeforeLeave });

    expect(appJotaiStore.get(currentSceneCanEditAtom)).toBe(true);
    expect(appJotaiStore.get(sceneCollabEnabledAtom)).toBe(true);
    expect(appJotaiStore.get(sceneEditLockAtom)?.locked).toBe(false);

    act(() => {
      window.history.pushState({}, "", "/workspace/source/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(latestBeforeLeave).toHaveBeenCalledTimes(1));
    expect(initialBeforeLeave).not.toHaveBeenCalled();
    hook.unmount();
  });

  it("同一 Scene 的重复导航不清空已经恢复的 ACL 和锁", async () => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    const hook = renderHook(() => useShellRouteSync(), { wrapper });
    await waitFor(() => {
      expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-a");
    });

    appJotaiStore.set(currentCanvasIdAtom, "scene-a");
    appJotaiStore.set(currentSceneCanEditAtom, true);
    appJotaiStore.set(sceneCollabEnabledAtom, true);
    appJotaiStore.set(sceneEditLockAtom, {
      locked: false,
      editorName: null,
      isOtherTab: false,
    });

    act(() => {
      appJotaiStore.set(navigateToSceneAtom, {
        sceneId: "scene-a",
        workspaceSlug: "source",
      });
    });

    expect(appJotaiStore.get(currentSceneCanEditAtom)).toBe(true);
    expect(appJotaiStore.get(sceneCollabEnabledAtom)).toBe(true);
    expect(appJotaiStore.get(sceneEditLockAtom)?.locked).toBe(false);
    hook.unmount();
  });

  it("切到另一 Scene 时保留旧 Scene 的 ACL 和锁直到保存完成", async () => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    const hook = renderHook(() => useShellRouteSync(), { wrapper });
    await waitFor(() => {
      expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-a");
    });

    appJotaiStore.set(currentCanvasIdAtom, "scene-a");
    appJotaiStore.set(currentSceneCanEditAtom, true);
    appJotaiStore.set(sceneCollabEnabledAtom, false);
    appJotaiStore.set(sceneEditLockAtom, {
      locked: false,
      editorName: null,
      isOtherTab: false,
    });

    act(() => {
      appJotaiStore.set(navigateToSceneAtom, {
        sceneId: "scene-b",
        workspaceSlug: "source",
      });
    });

    expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-b");
    expect(appJotaiStore.get(currentSceneCanEditAtom)).toBe(true);
    expect(appJotaiStore.get(sceneEditLockAtom)?.locked).toBe(false);
    hook.unmount();
  });

  it("离开保存完成前不应用 Dashboard 路由", async () => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    const gate = deferred<boolean>();
    const beforeLeaveScene = vi.fn(() => gate.promise);
    const hook = renderHook(() => useShellRouteSync({ beforeLeaveScene }), {
      wrapper,
    });
    await waitFor(() => {
      expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-a");
    });

    appJotaiStore.set(currentCanvasIdAtom, "scene-a");
    appJotaiStore.set(currentSceneCanEditAtom, true);
    appJotaiStore.set(sceneEditLockAtom, {
      locked: false,
      editorName: null,
      isOtherTab: false,
    });

    act(() => {
      window.history.pushState({}, "", "/workspace/source/dashboard");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    await waitFor(() => expect(beforeLeaveScene).toHaveBeenCalledTimes(1));
    expect(appJotaiStore.get(appModeAtom)).toBe("canvas");
    expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-a");

    await act(async () => {
      gate.resolve(true);
      await gate.promise;
    });

    await waitFor(() => {
      expect(appJotaiStore.get(appModeAtom)).toBe("dashboard");
    });
    expect(appJotaiStore.get(currentSceneIdAtom)).toBeNull();
    hook.unmount();
  });
});
