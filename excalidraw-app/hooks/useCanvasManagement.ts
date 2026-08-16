import { useState, useCallback, useEffect, useRef } from "react";

import { CaptureUpdateAction } from "@excalidraw/element";
import { restoreAppState } from "@excalidraw/excalidraw/data/restore";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { AuthError } from "../data/storageAdapters/BackendStorageAdapter";
import { isBackendPersistableCanvasId } from "../data/canvasId";
import { getScene, getWorkspace } from "../auth/workspaceApi";
import {
  currentSceneCanEditAtom,
  currentSceneIdAtom,
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
} from "../components/Settings/settingsState";
import {
  buildDashboardUrl,
  buildSceneUrl,
  navigateTo,
  parseUrl,
} from "../router";

import {
  useAtom,
  useAtomValue,
  currentCanvasIdAtom,
  useSetAtom,
} from "../app-jotai";

import { CREATIONS_SIDEBAR_NAME } from "../app_constants";

import type { CollabAPI } from "../collab/Collab";
import type {
  IStorageAdapter,
  CanvasMetadata,
  CanvasData,
} from "../data/storage";

export const useCanvasManagement = ({
  storageAdapter,
  excalidrawAPI,
  collabAPI,
  setErrorMessage,
  resetSaveStatus,
}: {
  storageAdapter: IStorageAdapter;
  excalidrawAPI: ExcalidrawImperativeAPI | null | undefined;
  collabAPI: CollabAPI | null;
  setErrorMessage: (msg: string) => void;
  resetSaveStatus: () => void;
}) => {
  const [canvases, setCanvases] = useState<CanvasMetadata[]>([]);
  const [currentCanvasId, setCurrentCanvasId] = useAtom(currentCanvasIdAtom);
  const currentSceneCanEdit = useAtomValue(currentSceneCanEditAtom);
  const currentSceneLock = useAtomValue(sceneEditLockAtom);
  const sceneCollabEnabled = useAtomValue(sceneCollabEnabledAtom);
  const setCurrentSceneId = useSetAtom(currentSceneIdAtom);
  const setCurrentSceneCanEdit = useSetAtom(currentSceneCanEditAtom);
  const setSceneCollabEnabled = useSetAtom(sceneCollabEnabledAtom);
  const setSceneEditLock = useSetAtom(sceneEditLockAtom);
  const selectionSequenceRef = useRef(0);
  const deletedSceneRef = useRef<string | null>(null);
  const loadedSceneRef = useRef<{
    id: string;
    workspaceSlug: string;
    canEdit: boolean;
    collabEnabled: boolean;
    lock: typeof currentSceneLock;
  } | null>(null);
  const rollbackSceneRef = useRef<{
    scene: NonNullable<typeof loadedSceneRef.current>;
    viewModeEnabled: boolean;
  } | null>(null);

  useEffect(() => {
    if (loadedSceneRef.current?.id !== currentCanvasId) {
      return;
    }
    loadedSceneRef.current = {
      ...loadedSceneRef.current,
      canEdit: currentSceneCanEdit === true,
      collabEnabled: sceneCollabEnabled,
      lock: currentSceneLock,
    };
  }, [
    currentCanvasId,
    currentSceneCanEdit,
    sceneCollabEnabled,
    currentSceneLock,
  ]);

  const refreshCanvases = useCallback(async () => {
    try {
      const canvases = await storageAdapter.listCanvases();
      setCanvases(canvases);
    } catch (error) {
      console.error(error);
      setErrorMessage("Could not list your creations.");
    }
  }, [storageAdapter, setErrorMessage]);

  useEffect(() => {
    refreshCanvases();
  }, [refreshCanvases]);

  const openSidebar = excalidrawAPI?.getAppState().openSidebar;
  useEffect(() => {
    if (
      openSidebar?.name === "default" &&
      openSidebar?.tab === CREATIONS_SIDEBAR_NAME
    ) {
      refreshCanvases();
    }
  }, [openSidebar, refreshCanvases]);

  const handleSceneDeleted = useCallback(
    (sceneId: string) => {
      if (
        currentCanvasId !== sceneId &&
        loadedSceneRef.current?.id !== sceneId
      ) {
        return;
      }

      // 删除已由服务端确认，旧 Scene 从此不能再参与保存、回滚或异步加载。
      // 该 ref 必须同步写入，以防同一事件循环里的路由切换仍调用到旧闭包。
      deletedSceneRef.current = sceneId;
      selectionSequenceRef.current += 1;
      loadedSceneRef.current = null;
      rollbackSceneRef.current = null;

      if (collabAPI?.isCollaborating()) {
        collabAPI.stopCollaboration(false);
      }

      setCurrentCanvasId(null);
      setCurrentSceneId(null);
      setCurrentSceneCanEdit(null);
      setSceneCollabEnabled(false);
      setSceneEditLock(null);
      excalidrawAPI?.resetScene();
      excalidrawAPI?.updateScene({
        appState: { viewModeEnabled: true },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      resetSaveStatus();
    },
    [
      collabAPI,
      currentCanvasId,
      excalidrawAPI,
      resetSaveStatus,
      setCurrentCanvasId,
      setCurrentSceneCanEdit,
      setCurrentSceneId,
      setSceneCollabEnabled,
      setSceneEditLock,
    ],
  );

  const handleCanvasSelect = useCallback(
    async (id: string, options?: { forceSceneReload?: boolean }) => {
      if (!excalidrawAPI) {
        return;
      }

      const rollback = rollbackSceneRef.current;
      if (rollback?.scene.id === id && currentCanvasId === id) {
        rollbackSceneRef.current = null;
        setCurrentSceneCanEdit(rollback.scene.canEdit);
        setSceneCollabEnabled(rollback.scene.collabEnabled);
        setSceneEditLock(rollback.scene.lock);
        excalidrawAPI.updateScene({
          appState: { viewModeEnabled: rollback.viewModeEnabled },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        return;
      }

      const selectionSequence = ++selectionSequenceRef.current;
      const isSameCanvasReload =
        id === currentCanvasId && options?.forceSceneReload === true;
      const isLatestSelection = () => {
        const route = parseUrl();
        return (
          selectionSequence === selectionSequenceRef.current &&
          route.type === "scene" &&
          route.sceneId === id
        );
      };
      const clearFailedSelection = (message: string) => {
        if (!isLatestSelection()) {
          return;
        }
        setCurrentCanvasId(id);
        setCurrentSceneId(id);
        setCurrentSceneCanEdit(false);
        setSceneCollabEnabled(false);
        setSceneEditLock(null);
        loadedSceneRef.current = null;
        excalidrawAPI.resetScene();
        excalidrawAPI.updateScene({
          appState: {
            openSidebar: null,
            viewModeEnabled: true,
          },
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        setErrorMessage(message);
      };
      try {
        if (id === currentCanvasId && !options?.forceSceneReload) {
          excalidrawAPI.updateScene({ appState: { openSidebar: null } });
          return;
        }

        const sourceSceneWasDeleted =
          deletedSceneRef.current !== null &&
          deletedSceneRef.current === currentCanvasId;
        const previousLoadedScene =
          !sourceSceneWasDeleted &&
          loadedSceneRef.current?.id === currentCanvasId
            ? { ...loadedSceneRef.current }
            : null;
        const previousViewModeEnabled =
          excalidrawAPI.getAppState().viewModeEnabled;
        const isCollaborating = collabAPI?.isCollaborating() ?? false;
        const canPersistCurrentCanvas =
          !sourceSceneWasDeleted &&
          (previousLoadedScene?.canEdit ?? currentSceneCanEdit === true) &&
          !(previousLoadedScene?.lock ?? currentSceneLock)?.locked &&
          (!isCollaborating || collabAPI?.shouldPersistCanvas() === true);

        // URL 已指向目标 Scene，但编辑器仍是旧画布。先冻结旧画布，保留其
        // canEdit/锁状态完成最后一次保存；不能先释放锁再丢弃 5 秒防抖窗口内的修改。
        excalidrawAPI.updateScene({
          appState: { viewModeEnabled: true },
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        const rollbackFailedSwitch = (message: string) => {
          if (!isLatestSelection()) {
            return;
          }
          if (
            previousLoadedScene &&
            currentCanvasId === previousLoadedScene.id
          ) {
            rollbackSceneRef.current = {
              scene: previousLoadedScene,
              viewModeEnabled: previousViewModeEnabled,
            };
            navigateTo(
              buildSceneUrl(
                previousLoadedScene.workspaceSlug,
                previousLoadedScene.id,
              ),
            );
            // navigateTo() 会同步触发路由 fail-close；恢复调用必须排在它之后，
            // 保证同一批 React 更新最终保留旧 Scene 的权限与锁状态。
            setCurrentSceneCanEdit(previousLoadedScene.canEdit);
            setSceneCollabEnabled(previousLoadedScene.collabEnabled);
            setSceneEditLock(previousLoadedScene.lock);
            excalidrawAPI.updateScene({
              appState: { viewModeEnabled: previousViewModeEnabled },
              captureUpdate: CaptureUpdateAction.NEVER,
            });
            setErrorMessage(message);
            return;
          }
          clearFailedSelection(message);
        };

        if (!isSameCanvasReload && isCollaborating && collabAPI) {
          if (canPersistCurrentCanvas) {
            try {
              await collabAPI.saveCollaboration();
              if (!isLatestSelection()) {
                return;
              }
            } catch (error) {
              console.error(
                "Failed to save collaboration before switching canvas",
                error,
              );
              rollbackFailedSwitch(
                "当前画布保存失败，已取消切换以避免丢失修改。",
              );
              return;
            }
            if (!isLatestSelection()) {
              return;
            }
          }
        }

        // 必须用切换前捕获的画布 ID 保存，避免异步回调把旧场景写入目标画布。
        // IndexedDB UUID 不能写进后端，否则会污染 SQLite / Workspace 列表。
        if (
          !isSameCanvasReload &&
          isBackendPersistableCanvasId(currentCanvasId) &&
          canPersistCurrentCanvas
        ) {
          try {
            await storageAdapter.saveCanvas(currentCanvasId, {
              elements: excalidrawAPI.getSceneElements(),
              appState: excalidrawAPI.getAppState(),
              files: excalidrawAPI.getFiles(),
            });
            if (!isLatestSelection()) {
              return;
            }
          } catch (error) {
            console.error("Failed to save canvas before switching", error);
            rollbackFailedSwitch(
              "当前画布保存失败，已取消切换以避免丢失修改。",
            );
            return;
          }
          if (!isLatestSelection()) {
            return;
          }
        }

        if (isCollaborating && collabAPI) {
          // 保存成功后再退房，避免锁/协作主节点先释放导致最后一次写入失败。
          collabAPI.stopCollaboration(false);
          if (!isLatestSelection()) {
            return;
          }
        }

        // 旧 Scene 已安全保存并停止协作；现在才撤销权限状态，目标 Scene 在
        // 服务端 ACL 元数据返回前保持只读。
        setCurrentSceneCanEdit(false);
        setSceneCollabEnabled(false);
        setSceneEditLock(null);

        const canvasData = await storageAdapter.loadCanvas(id);
        if (!isLatestSelection()) {
          return;
        }
        if (!canvasData) {
          const message =
            "无法打开此画布。画布可能已删除，或你已失去工作区访问权限。";
          if (
            previousLoadedScene &&
            currentCanvasId === previousLoadedScene.id
          ) {
            rollbackFailedSwitch(message);
          } else {
            clearFailedSelection(message);
            const failedRoute = parseUrl();
            if (failedRoute.type === "scene" && failedRoute.sceneId === id) {
              navigateTo(buildDashboardUrl(failedRoute.workspaceSlug));
            }
          }
          return;
        }
        let canEdit = false;
        let collabEnabled = false;
        try {
          const scene = await getScene(id);
          if (!isLatestSelection()) {
            return;
          }
          canEdit = scene.canEdit !== false;
          collabEnabled = Boolean(scene.collabEnabled);
          const route = parseUrl();
          if (route.type !== "scene" || route.sceneId !== id) {
            return;
          }
          const sceneWorkspace = await getWorkspace(scene.workspaceId);
          if (!isLatestSelection()) {
            return;
          }
          const authoritativeRoute = parseUrl();
          if (
            authoritativeRoute.type !== "scene" ||
            authoritativeRoute.sceneId !== id ||
            sceneWorkspace.slug !== authoritativeRoute.workspaceSlug
          ) {
            clearFailedSelection("Scene 不属于当前 URL 指定的工作区。");
            return;
          }
          loadedSceneRef.current = {
            id,
            workspaceSlug: sceneWorkspace.slug,
            canEdit,
            collabEnabled,
            lock:
              canEdit && !collabEnabled
                ? { locked: true, editorName: null, isOtherTab: false }
                : null,
          };
        } catch (error) {
          console.error("Failed to load scene permissions", error);
          clearFailedSelection("无法验证此画布的访问权限。");
          return;
        }
        if (!isLatestSelection()) {
          return;
        }
        setCurrentSceneCanEdit(canEdit);
        setSceneCollabEnabled(collabEnabled);
        setSceneEditLock(
          canEdit && !collabEnabled
            ? { locked: true, editorName: null, isOtherTab: false }
            : null,
        );

        const currentAppState = excalidrawAPI.getAppState();
        const nextAppState = {
          ...restoreAppState(canvasData.appState, currentAppState),
          collaborators: currentAppState.collaborators,
          openSidebar: null,
          viewModeEnabled: !canEdit,
        };

        setCurrentCanvasId(id);
        if (isBackendPersistableCanvasId(id)) {
          setCurrentSceneId(id);
        }
        deletedSceneRef.current = null;

        excalidrawAPI.resetScene();
        excalidrawAPI.addFiles(Object.values(canvasData.files ?? {}));
        excalidrawAPI.updateScene({
          elements: canvasData.elements ?? [],
          appState: nextAppState,
          captureUpdate: CaptureUpdateAction.NEVER,
        });

        resetSaveStatus();
      } catch (error) {
        // 较早的切换失败不能在用户已成功切到另一张 Scene 后弹出错误。
        if (!isLatestSelection()) {
          return;
        }
        if (error instanceof AuthError) {
          clearFailedSelection("您需要登录才能加载此画布。");
          return;
        }
        console.error("Failed to load canvas", error);
        clearFailedSelection("Could not load the canvas.");
      }
    },
    [
      storageAdapter,
      excalidrawAPI,
      collabAPI,
      setErrorMessage,
      setCurrentCanvasId,
      setCurrentSceneId,
      setCurrentSceneCanEdit,
      setSceneCollabEnabled,
      setSceneEditLock,
      currentCanvasId,
      currentSceneCanEdit,
      currentSceneLock,
      resetSaveStatus,
    ],
  );

  const handleCanvasLeave = useCallback(async (): Promise<boolean> => {
    if (!excalidrawAPI) {
      return true;
    }

    const previousLoadedScene =
      loadedSceneRef.current?.id === currentCanvasId
        ? { ...loadedSceneRef.current }
        : null;
    if (!previousLoadedScene) {
      return true;
    }

    const leaveSequence = ++selectionSequenceRef.current;
    const isStillLeaving = () =>
      leaveSequence === selectionSequenceRef.current &&
      parseUrl().type !== "scene";
    const previousViewModeEnabled = excalidrawAPI.getAppState().viewModeEnabled;
    const isCollaborating = collabAPI?.isCollaborating() ?? false;
    const canPersistCurrentCanvas =
      previousLoadedScene.canEdit &&
      !previousLoadedScene.lock?.locked &&
      (!isCollaborating || collabAPI?.shouldPersistCanvas() === true);

    // 路由已经变化，但在保存完成前保留旧 Scene 的 ACL 与锁，并先冻结编辑器。
    // 这样最后一个防抖窗口内的修改不会在锁释放后才尝试写入。
    excalidrawAPI.updateScene({
      appState: { viewModeEnabled: true },
      captureUpdate: CaptureUpdateAction.NEVER,
    });
    const snapshot = {
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    };

    const rollbackFailedLeave = (message: string) => {
      if (!isStillLeaving()) {
        return;
      }
      navigateTo(
        buildSceneUrl(
          previousLoadedScene.workspaceSlug,
          previousLoadedScene.id,
        ),
      );
      setCurrentSceneCanEdit(previousLoadedScene.canEdit);
      setSceneCollabEnabled(previousLoadedScene.collabEnabled);
      setSceneEditLock(previousLoadedScene.lock);
      excalidrawAPI.updateScene({
        appState: { viewModeEnabled: previousViewModeEnabled },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      setErrorMessage(message);
    };

    try {
      if (canPersistCurrentCanvas) {
        if (isCollaborating && collabAPI) {
          await collabAPI.saveCollaboration();
          if (!isStillLeaving()) {
            return false;
          }
        }
        await storageAdapter.saveCanvas(previousLoadedScene.id, snapshot);
        if (!isStillLeaving()) {
          return false;
        }
      }

      if (isCollaborating && collabAPI) {
        // SQLite 已落盘后再退出房间，避免协作主写者租约提前释放。
        collabAPI.stopCollaboration(false);
      }
      loadedSceneRef.current = null;
      return true;
    } catch (error) {
      console.error("Failed to save canvas before leaving", error);
      rollbackFailedLeave("当前画布保存失败，已取消离开以避免丢失修改。");
      return false;
    }
  }, [
    collabAPI,
    currentCanvasId,
    excalidrawAPI,
    setCurrentSceneCanEdit,
    setErrorMessage,
    setSceneCollabEnabled,
    setSceneEditLock,
    storageAdapter,
  ]);

  const handleCanvasDelete = useCallback(
    async (id: string) => {
      if (window.confirm("Are you sure you want to delete this canvas?")) {
        try {
          await storageAdapter.deleteCanvas(id);
          if (currentCanvasId === id) {
            setCurrentCanvasId(null);
            excalidrawAPI?.resetScene();
            resetSaveStatus();
          }
          await refreshCanvases();
        } catch (error: any) {
          if (error instanceof AuthError) {
            setErrorMessage("您需要登录才能删除此画布。");
          } else {
            setErrorMessage("Could not delete the canvas.");
          }
        }
      }
    },
    [
      storageAdapter,
      refreshCanvases,
      setErrorMessage,
      currentCanvasId,
      setCurrentCanvasId,
      excalidrawAPI,
      resetSaveStatus,
    ],
  );

  const handleCanvasCreate = useCallback(
    async (newName: string, workspaceId?: string) => {
      if (!excalidrawAPI) {
        return;
      }
      try {
        const appState = {
          ...excalidrawAPI.getAppState(),
          name: newName,
          // 新画布归属指定分组（缺省 default 由后端兜底）。
          ...(workspaceId ? { workspaceId } : {}),
        };
        const newCanvasData = {
          elements: [],
          appState,
          files: {},
        };
        const createdCanvas = await storageAdapter.createCanvas(
          newCanvasData as CanvasData,
        );
        await refreshCanvases();
        excalidrawAPI.resetScene();
        excalidrawAPI.updateScene({ appState: { name: newName } });
        setCurrentCanvasId(createdCanvas.id);
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能创建新画布。");
        } else {
          setErrorMessage("Could not create new canvas.");
        }
      }
    },
    [
      excalidrawAPI,
      storageAdapter,
      refreshCanvases,
      setErrorMessage,
      setCurrentCanvasId,
    ],
  );

  const handleCanvasRename = useCallback(
    async (id: string, newName: string) => {
      try {
        await storageAdapter.renameCanvas(id, newName);
        await refreshCanvases();
        if (excalidrawAPI && currentCanvasId === id) {
          excalidrawAPI.updateScene({ appState: { name: newName } });
        }
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能重命名此画布。");
        } else {
          setErrorMessage("Could not rename the canvas.");
        }
      }
    },
    [
      storageAdapter,
      refreshCanvases,
      setErrorMessage,
      excalidrawAPI,
      currentCanvasId,
    ],
  );

  const handleCanvasSaveAs = useCallback(
    async (newName: string) => {
      if (!excalidrawAPI) {
        return;
      }
      try {
        const appState = { ...excalidrawAPI.getAppState(), name: newName };
        const elements = excalidrawAPI.getSceneElements();
        const files = excalidrawAPI.getFiles();

        const newCanvasData = {
          elements,
          appState,
          files,
        };
        const createdCanvas = await storageAdapter.createCanvas(
          newCanvasData as CanvasData,
        );
        await refreshCanvases();
        // After saving as, we should switch to the new canvas
        setCurrentCanvasId(createdCanvas.id);
      } catch (error: any) {
        if (error instanceof AuthError) {
          setErrorMessage("您需要登录才能另存为新画布。");
        } else {
          setErrorMessage("Could not save as new canvas.");
        }
      }
    },
    [
      excalidrawAPI,
      storageAdapter,
      refreshCanvases,
      setErrorMessage,
      setCurrentCanvasId,
    ],
  );

  const isCanvasLoaded = useCallback(
    (id: string, workspaceSlug: string | null) =>
      loadedSceneRef.current?.id === id &&
      loadedSceneRef.current.workspaceSlug === workspaceSlug,
    [],
  );

  return {
    canvases,
    isCanvasLoaded,
    handleSceneDeleted,
    handleCanvasSelect,
    handleCanvasLeave,
    handleCanvasDelete,
    handleCanvasCreate,
    handleCanvasRename,
    handleCanvasSaveAs,
    refreshCanvases,
  };
};
