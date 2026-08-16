import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { Provider, appJotaiStore, currentCanvasIdAtom } from "../app-jotai";
import {
  currentSceneCanEditAtom,
  currentSceneIdAtom,
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
} from "../components/Settings/settingsState";

import { useCanvasManagement } from "./useCanvasManagement";

import type { PropsWithChildren } from "react";
import type { CollabAPI } from "../collab/Collab";
import type { IStorageAdapter } from "../data/storage";

const workspaceApiMocks = vi.hoisted(() => ({
  getScene: vi.fn(),
  getWorkspace: vi.fn(),
}));

vi.mock("../auth/workspaceApi", () => workspaceApiMocks);

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

const createExcalidrawAPI = () => {
  let appState = { viewModeEnabled: false, openSidebar: null };
  const elements: readonly unknown[] = [{ id: "local-change" }];
  const files = {};

  return {
    api: {
      getAppState: vi.fn(() => appState),
      getSceneElements: vi.fn(() => elements),
      getFiles: vi.fn(() => files),
      updateScene: vi.fn((update: { appState?: Record<string, unknown> }) => {
        if (update.appState) {
          appState = { ...appState, ...update.appState } as typeof appState;
        }
      }),
      resetScene: vi.fn(),
      addFiles: vi.fn(),
    } as unknown as ExcalidrawImperativeAPI,
  };
};

const createStorageAdapter = () =>
  ({
    listCanvases: vi.fn().mockResolvedValue([]),
    loadCanvas: vi.fn().mockResolvedValue({
      elements: [],
      appState: {},
      files: {},
    }),
    saveCanvas: vi.fn().mockResolvedValue(undefined),
    deleteCanvas: vi.fn(),
    createCanvas: vi.fn(),
    renameCanvas: vi.fn(),
    listWorkspaces: vi.fn(),
    createWorkspace: vi.fn(),
    updateWorkspace: vi.fn(),
    deleteWorkspace: vi.fn(),
    moveCanvasToWorkspace: vi.fn(),
  } as unknown as IStorageAdapter);

describe("useCanvasManagement", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    appJotaiStore.set(currentCanvasIdAtom, null);
    appJotaiStore.set(currentSceneIdAtom, "scene-a");
    appJotaiStore.set(currentSceneCanEditAtom, false);
    appJotaiStore.set(sceneCollabEnabledAtom, false);
    appJotaiStore.set(sceneEditLockAtom, null);
    workspaceApiMocks.getScene.mockReset();
    workspaceApiMocks.getWorkspace.mockReset();
    workspaceApiMocks.getScene.mockImplementation(async (id: string) => ({
      id,
      workspaceId: id === "scene-b" ? "workspace-b" : "workspace-a",
      collectionId: "collection-a",
      canEdit: true,
      collabEnabled: false,
    }));
    workspaceApiMocks.getWorkspace.mockImplementation(async (id: string) => ({
      id,
      slug: id === "workspace-b" ? "target" : "source",
    }));
  });

  const loadSceneA = async (collabAPI: CollabAPI | null = null) => {
    const excalidraw = createExcalidrawAPI();
    const storageAdapter = createStorageAdapter();
    const setErrorMessage = vi.fn();
    const hook = renderHook(
      () =>
        useCanvasManagement({
          storageAdapter,
          excalidrawAPI: excalidraw.api,
          collabAPI,
          setErrorMessage,
          resetSaveStatus: vi.fn(),
        }),
      { wrapper },
    );

    await act(async () => {
      await hook.result.current.handleCanvasSelect("scene-a", {
        forceSceneReload: true,
      });
    });
    act(() => {
      appJotaiStore.set(sceneEditLockAtom, {
        locked: false,
        editorName: null,
        isOtherTab: false,
      });
    });
    await waitFor(() => {
      expect(appJotaiStore.get(sceneEditLockAtom)?.locked).toBe(false);
    });
    return { excalidraw, hook, setErrorMessage, storageAdapter };
  };

  it("Scene A 保存完成后才加载 Scene B", async () => {
    const { hook, storageAdapter } = await loadSceneA();
    const adapter = storageAdapter as unknown as {
      loadCanvas: ReturnType<typeof vi.fn>;
      saveCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.loadCanvas.mockClear();
    adapter.saveCanvas.mockClear();
    const saveGate = deferred<void>();
    adapter.saveCanvas.mockReturnValueOnce(saveGate.promise);
    window.history.replaceState({}, "", "/workspace/target/scene/scene-b");

    let switchPromise!: Promise<void>;
    act(() => {
      switchPromise = hook.result.current.handleCanvasSelect("scene-b");
    });

    await waitFor(() => {
      expect(adapter.saveCanvas).toHaveBeenCalledWith(
        "scene-a",
        expect.objectContaining({ elements: expect.any(Array) }),
      );
    });
    expect(adapter.loadCanvas).not.toHaveBeenCalled();

    await act(async () => {
      saveGate.resolve();
      await switchPromise;
    });

    expect(adapter.loadCanvas).toHaveBeenCalledWith("scene-b");
    expect(appJotaiStore.get(currentCanvasIdAtom)).toBe("scene-b");
  });

  it("同 Scene 跨 Workspace 重载时不在锁切换窗口重复保存", async () => {
    const { hook, storageAdapter } = await loadSceneA();
    const adapter = storageAdapter as unknown as {
      loadCanvas: ReturnType<typeof vi.fn>;
      saveCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.loadCanvas.mockClear();
    adapter.saveCanvas.mockClear();
    workspaceApiMocks.getScene.mockResolvedValueOnce({
      id: "scene-a",
      workspaceId: "workspace-b",
      collectionId: "collection-a",
      canEdit: true,
      collabEnabled: false,
    });
    window.history.replaceState({}, "", "/workspace/target/scene/scene-a");

    await act(async () => {
      await hook.result.current.handleCanvasSelect("scene-a", {
        forceSceneReload: true,
      });
    });

    expect(adapter.saveCanvas).not.toHaveBeenCalled();
    expect(adapter.loadCanvas).toHaveBeenCalledWith("scene-a");
    expect(appJotaiStore.get(currentCanvasIdAtom)).toBe("scene-a");
  });

  it("协作非主节点切换 Scene 时不争抢 SQLite 写者租约", async () => {
    const collabAPI = {
      isCollaborating: vi.fn(() => true),
      shouldPersistCanvas: vi.fn(() => false),
      saveCollaboration: vi.fn(),
      stopCollaboration: vi.fn(),
    } as unknown as CollabAPI;
    const { hook, storageAdapter } = await loadSceneA(collabAPI);
    const adapter = storageAdapter as unknown as {
      loadCanvas: ReturnType<typeof vi.fn>;
      saveCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.loadCanvas.mockClear();
    adapter.saveCanvas.mockClear();
    window.history.replaceState({}, "", "/workspace/target/scene/scene-b");

    await act(async () => {
      await hook.result.current.handleCanvasSelect("scene-b");
    });

    expect(adapter.saveCanvas).not.toHaveBeenCalled();
    expect(collabAPI.saveCollaboration).not.toHaveBeenCalled();
    expect(collabAPI.stopCollaboration).toHaveBeenCalledWith(false);
    expect(adapter.loadCanvas).toHaveBeenCalledWith("scene-b");
  });

  it("目标 Scene 已删除时回滚到原 Scene", async () => {
    const { excalidraw, hook, setErrorMessage, storageAdapter } =
      await loadSceneA();
    const adapter = storageAdapter as unknown as {
      loadCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.loadCanvas.mockResolvedValueOnce(null);
    window.history.replaceState({}, "", "/workspace/target/scene/scene-b");

    await act(async () => {
      await hook.result.current.handleCanvasSelect("scene-b");
    });

    expect(window.location.pathname).toBe("/workspace/source/scene/scene-a");
    expect(appJotaiStore.get(currentCanvasIdAtom)).toBe("scene-a");
    expect(excalidraw.api.getAppState().viewModeEnabled).toBe(false);
    expect(setErrorMessage).toHaveBeenCalledWith(
      "无法打开此画布。画布可能已删除，或你已失去工作区访问权限。",
    );
  });

  it("当前 Scene 删除成功后不再保存或回滚到已删除 Scene", async () => {
    const { excalidraw, hook, storageAdapter } = await loadSceneA();
    const adapter = storageAdapter as unknown as {
      loadCanvas: ReturnType<typeof vi.fn>;
      saveCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.loadCanvas.mockClear();
    adapter.saveCanvas.mockClear();
    const resetScene = excalidraw.api.resetScene as ReturnType<typeof vi.fn>;
    resetScene.mockClear();

    // 保留删除前的切换闭包，模拟删除成功后同一事件循环立即导航。
    const staleHandleCanvasSelect = hook.result.current.handleCanvasSelect;
    act(() => {
      hook.result.current.handleSceneDeleted("scene-a");
    });

    expect(appJotaiStore.get(currentCanvasIdAtom)).toBeNull();
    expect(appJotaiStore.get(currentSceneIdAtom)).toBeNull();
    expect(appJotaiStore.get(currentSceneCanEditAtom)).toBeNull();
    expect(appJotaiStore.get(sceneEditLockAtom)).toBeNull();
    expect(resetScene).toHaveBeenCalledTimes(1);

    window.history.replaceState({}, "", "/workspace/target/scene/scene-b");
    await act(async () => {
      await staleHandleCanvasSelect("scene-b");
    });

    expect(adapter.saveCanvas).not.toHaveBeenCalled();
    expect(adapter.loadCanvas).toHaveBeenCalledWith("scene-b");
    expect(window.location.pathname).toBe("/workspace/target/scene/scene-b");
    expect(appJotaiStore.get(currentCanvasIdAtom)).toBe("scene-b");
    expect(appJotaiStore.get(currentSceneIdAtom)).toBe("scene-b");
  });

  it("首次直达已删除 Scene 时退回 Workspace 仪表盘", async () => {
    const excalidraw = createExcalidrawAPI();
    const storageAdapter = createStorageAdapter();
    const adapter = storageAdapter as unknown as {
      loadCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.loadCanvas.mockResolvedValueOnce(null);
    window.history.replaceState({}, "", "/workspace/source/scene/missing");
    appJotaiStore.set(currentSceneIdAtom, "missing");
    const hook = renderHook(
      () =>
        useCanvasManagement({
          storageAdapter,
          excalidrawAPI: excalidraw.api,
          collabAPI: null,
          setErrorMessage: vi.fn(),
          resetSaveStatus: vi.fn(),
        }),
      { wrapper },
    );

    await act(async () => {
      await hook.result.current.handleCanvasSelect("missing", {
        forceSceneReload: true,
      });
    });

    expect(window.location.pathname).toBe("/workspace/source/dashboard");
    expect(excalidraw.api.getAppState().viewModeEnabled).toBe(true);
  });

  it("离开保存失败时回滚 URL、权限与编辑状态", async () => {
    const { excalidraw, hook, setErrorMessage, storageAdapter } =
      await loadSceneA();
    const adapter = storageAdapter as unknown as {
      saveCanvas: ReturnType<typeof vi.fn>;
    };
    adapter.saveCanvas.mockRejectedValueOnce(new Error("disk full"));
    window.history.replaceState({}, "", "/workspace/source/dashboard");

    let canLeave = true;
    await act(async () => {
      canLeave = await hook.result.current.handleCanvasLeave();
    });

    expect(canLeave).toBe(false);
    expect(window.location.pathname).toBe("/workspace/source/scene/scene-a");
    expect(appJotaiStore.get(currentSceneCanEditAtom)).toBe(true);
    expect(appJotaiStore.get(sceneEditLockAtom)?.locked).toBe(false);
    expect(excalidraw.api.getAppState().viewModeEnabled).toBe(false);
    expect(setErrorMessage).toHaveBeenCalledWith(
      "当前画布保存失败，已取消离开以避免丢失修改。",
    );
  });
});
