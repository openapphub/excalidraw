import {
  Excalidraw,
  LiveCollaborationTrigger,
  TTDDialogTrigger,
  CaptureUpdateAction,
  reconcileElements,
  getSceneVersion,
} from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { getDefaultAppState } from "@excalidraw/excalidraw/appState";
import {
  CommandPalette,
  DEFAULT_CATEGORIES,
} from "@excalidraw/excalidraw/components/CommandPalette/CommandPalette";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { OverwriteConfirmDialog } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirm";
import { openConfirmModal } from "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState";
import { ShareableLinkDialog } from "@excalidraw/excalidraw/components/ShareableLinkDialog";
import Trans from "@excalidraw/excalidraw/components/Trans";
import {
  APP_NAME,
  EVENT,
  TITLE_TIMEOUT,
  VERSION_TIMEOUT,
  debounce,
  getVersion,
  getFrame,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  isRunningInIframe,
  isDevEnv,
} from "@excalidraw/common";
import polyfill from "@excalidraw/excalidraw/polyfill";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Toaster } from "react-hot-toast";
import { loadFromBlob } from "@excalidraw/excalidraw/data/blob";
import { useCallbackRefState } from "@excalidraw/excalidraw/hooks/useCallbackRefState";
import { t } from "@excalidraw/excalidraw/i18n";

import {
  GithubIcon,
  XBrandIcon,
  DiscordIcon,
  ExcalLogo,
  usersIcon,
  exportToPlus,
  share,
  youtubeIcon,
} from "@excalidraw/excalidraw/components/icons";
import { isElementLink } from "@excalidraw/element";
import {
  restoreAppState,
  restoreElements,
} from "@excalidraw/excalidraw/data/restore";
import { newElementWith } from "@excalidraw/element";
import { isInitializedImageElement } from "@excalidraw/element";
import clsx from "clsx";
import {
  parseLibraryTokensFromUrl,
  useHandleLibrary,
} from "@excalidraw/excalidraw/data/library";

import { actionSaveToActiveFile } from "@excalidraw/excalidraw/actions";

import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import type { RestoredDataState } from "@excalidraw/excalidraw/data/restore";
import type {
  FileId,
  NonDeletedExcalidrawElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  ExcalidrawImperativeAPI,
  BinaryFiles,
  ExcalidrawInitialDataState,
  UIAppState,
} from "@excalidraw/excalidraw/types";
import type { ResolutionType } from "@excalidraw/common/utility-types";
import type { ResolvablePromise } from "@excalidraw/common/utils";

import type { Action, ActionName } from "@excalidraw/excalidraw/actions/types";

import CustomStats from "./CustomStats";
import {
  Provider,
  useAtom,
  useSetAtom,
  userAtom,
  useAtomValue,
  useAtomWithInitialValue,
  appJotaiStore,
  storageConfigAtom,
  currentCanvasIdAtom,
  renameCanvasDialogAtom,
  saveAsDialogAtom,
} from "./app-jotai";
import {
  FIREBASE_STORAGE_PREFIXES,
  isExcalidrawPlusSignedUser,
  STORAGE_KEYS,
  SYNC_BROWSER_TABS_TIMEOUT,
} from "./app_constants";
import Collab, {
  collabAPIAtom,
  isCollaboratingAtom,
  isOfflineAtom,
} from "./collab/Collab";
import { AppFooter } from "./components/AppFooter";
import { AppMainMenu } from "./components/AppMainMenu";
import { AppWelcomeScreen } from "./components/AppWelcomeScreen";
import {
  ExportToExcalidrawPlus,
  exportToExcalidrawPlus,
} from "./components/ExportToExcalidrawPlus";
import { TopErrorBoundary } from "./components/TopErrorBoundary";

import { useAuth } from "./hooks/useAuth";
import { useCanvasManagement } from "./hooks/useCanvasManagement";
import { useSceneEditLock } from "./hooks/useSceneEditLock";
import { useAiCanvasSync } from "./hooks/useAiCanvasSync";
import { useMagicSettings } from "./hooks/useMagicSettings";
import { useShellRouteSync } from "./hooks/useShellRouteSync";
import { useRouteSceneLoader } from "./hooks/useRouteSceneLoader";
import {
  exportToBackend,
  getCollaborationLinkData,
  isCollaborationLink,
  loadScene,
} from "./data";
import {
  dehydrateCanvasData,
  type CanvasData,
  type IStorageAdapter,
} from "./data/storage";

import { MagicSettings } from "./components/MagicSettings";
import { RenameCanvasDialog } from "./components/RenameCanvasDialog";
import { SaveAsDialog } from "./components/SaveAsDialog";

import { updateStaleImageStatuses } from "./data/FileManager";
import {
  importFromLocalStorage,
  importUsernameFromLocalStorage,
} from "./data/localStorage";

import { loadFilesFromFirebase } from "./data/firebase";
import {
  LibraryIndexedDBAdapter,
  LibraryLocalStorageMigrationAdapter,
  LocalData,
} from "./data/LocalData";
import { isBrowserStorageStateNewer } from "./data/tabSync";
import { ShareDialog, shareDialogStateAtom } from "./share/ShareDialog";
import CollabError, { collabErrorIndicatorAtom } from "./collab/CollabError";
import { useHandleAppTheme } from "./useHandleAppTheme";
import { getPreferredLanguage } from "./app-language/language-detector";
import { useAppLangCode } from "./app-language/language-state";
import DebugCanvas, {
  debugRenderer,
  isVisualDebuggerEnabled,
  loadSavedDebugState,
} from "./components/DebugCanvas";
import { AIComponents } from "./components/AI";
import { ExcalidrawPlusIframeExport } from "./ExcalidrawPlusIframeExport";

import "./index.scss";

import { BackendStorageAdapter } from "./data/storageAdapters/BackendStorageAdapter";
import { AuthError } from "./data/storageAdapters/BackendStorageAdapter";

import { IndexedDBStorageAdapter } from "./data/storageAdapters/IndexedDBStorageAdapter";
import {
  isBackendPersistableCanvasId,
  isIndexedDbCanvasId,
} from "./data/canvasId";

import {
  WorkspaceSidebar,
  WorkspaceSidebarTrigger,
  WorkspaceMainContent,
  QuickSearchModal,
  InviteAcceptPage,
} from "./components/Workspace";
import {
  appModeAtom,
  workspaceSidebarOpenAtom,
  openWorkspaceSidebarAtom,
  navigateToDashboardAtom,
  activeCollectionIdAtom,
  currentWorkspaceSlugAtom,
  currentSceneIdAtom,
  currentSceneTitleAtom,
  currentSceneCanEditAtom,
  currentWorkspaceAtom,
  isAutoCollabSceneAtom,
  sceneCollabEnabledAtom,
  sceneEditLockAtom,
  type WorkspaceData,
} from "./components/Settings/settingsState";
import { CommentsMount } from "./components/Comments";
import { SceneEditLockBanner } from "./components/SceneEditLockBanner/SceneEditLockBanner";
import { AuthProvider, useAuth as useAuthSession } from "./auth";
import {
  createScene,
  startCollaboration as startSceneCollabRoom,
  updateWorkspace as updateWorkspaceApi,
  uploadWorkspaceAvatar,
  deleteWorkspace as deleteWorkspaceApi,
  listWorkspaces,
  type Workspace,
  type WorkspaceScene,
} from "./auth/workspaceApi";
import { queryClient, queryKeys } from "./lib/queryClient";
import { sceneClientHeaders } from "./auth/sceneClient";
import {
  buildSceneUrl,
  navigateTo,
  parseUrl,
  replaceUrl,
  replaceWorkspaceSlugInUrl,
} from "./router";
import {
  canCommitWorkspaceRouteMutation,
  canCommitWorkspaceMutation,
  getWorkspaceDeleteRedirect,
} from "./components/Workspace/workspaceMutationRouting";
import {
  drawingDefaultsToAppState,
  loadDrawingDefaults,
  type DrawingDefaults,
} from "./drawingDefaults";

import { PresentationMode } from "./components/Presentation/PresentationMode";
import { PresentationTalktrackMount } from "./components/Talktrack/PresentationTalktrackMount";

import type { CollabAPI } from "./collab/Collab";

polyfill();

window.EXCALIDRAW_THROTTLE_RENDER = true;

declare global {
  interface BeforeInstallPromptEventChoiceResult {
    outcome: "accepted" | "dismissed";
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<BeforeInstallPromptEventChoiceResult>;
  }

  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

let pwaEvent: BeforeInstallPromptEvent | null = null;

const invalidateSceneMutationCaches = () =>
  Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.scenes.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.collections.all }),
  ]);

const migrateIndexedDbCanvasToSqlite = async ({
  canvasData,
  collectionId,
}: {
  canvasData: CanvasData;
  collectionId?: string | null;
}): Promise<string | null> => {
  const elements = canvasData.elements ?? [];
  if (elements.length === 0) {
    return null;
  }
  const title =
    canvasData.appState?.name || `Untitled ${new Date().toLocaleTimeString()}`;
  const scene = await createScene({
    title,
    collectionId: collectionId || undefined,
    data: JSON.stringify(
      dehydrateCanvasData({
        ...canvasData,
        appState: { ...canvasData.appState, name: title },
      }),
    ),
  });
  return scene.id;
};

// Adding a listener outside of the component as it may (?) need to be
// subscribed early to catch the event.
//
// Also note that it will fire only if certain heuristics are met (user has
// used the app for some time, etc.)
window.addEventListener(
  "beforeinstallprompt",
  (event: BeforeInstallPromptEvent) => {
    // prevent Chrome <= 67 from automatically showing the prompt
    event.preventDefault();
    // cache for later use
    pwaEvent = event;
  },
);

let isSelfEmbedding = false;

if (window.self !== window.top) {
  try {
    const parentUrl = new URL(document.referrer);
    const currentUrl = new URL(window.location.href);
    if (parentUrl.origin === currentUrl.origin) {
      isSelfEmbedding = true;
    }
  } catch (error) {
    // ignore
  }
}

const shareableLinkConfirmDialog = {
  title: t("overwriteConfirm.modal.shareableLink.title"),
  description: (
    <Trans
      i18nKey="overwriteConfirm.modal.shareableLink.description"
      bold={(text) => <strong>{text}</strong>}
      br={() => <br />}
    />
  ),
  actionLabel: t("overwriteConfirm.modal.shareableLink.button"),
  color: "danger",
} as const;

const initializeScene = async (opts: {
  collabAPI: CollabAPI | null;
  excalidrawAPI: ExcalidrawImperativeAPI;
}): Promise<
  { scene: ExcalidrawInitialDataState | null } & (
    | { isExternalScene: true; id: string; key: string }
    | { isExternalScene: false; id?: null; key?: null }
  )
> => {
  const searchParams = new URLSearchParams(window.location.search);
  const id = searchParams.get("id");
  const jsonBackendMatch = window.location.hash.match(
    /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
  );
  const externalUrlMatch = window.location.hash.match(/^#url=(.*)$/);

  const localDataState = importFromLocalStorage();

  let scene: RestoredDataState & {
    scrollToContent?: boolean;
  } = await loadScene(null, null, localDataState);

  let roomLinkData = getCollaborationLinkData(window.location.href);
  const isExternalScene = !!(id || jsonBackendMatch || roomLinkData);
  if (isExternalScene) {
    if (
      // don't prompt if scene is empty
      !scene.elements.length ||
      // don't prompt for collab scenes because we don't override local storage
      roomLinkData ||
      // otherwise, prompt whether user wants to override current scene
      (await openConfirmModal(shareableLinkConfirmDialog))
    ) {
      if (jsonBackendMatch) {
        scene = await loadScene(
          jsonBackendMatch[1],
          jsonBackendMatch[2],
          localDataState,
        );
      }
      scene.scrollToContent = true;
      if (!roomLinkData) {
        window.history.replaceState({}, APP_NAME, window.location.origin);
      }
    } else {
      // https://github.com/excalidraw/excalidraw/issues/1919
      if (document.hidden) {
        return new Promise((resolve, reject) => {
          window.addEventListener(
            "focus",
            () => initializeScene(opts).then(resolve).catch(reject),
            {
              once: true,
            },
          );
        });
      }

      roomLinkData = null;
      window.history.replaceState({}, APP_NAME, window.location.origin);
    }
  } else if (externalUrlMatch) {
    window.history.replaceState({}, APP_NAME, window.location.origin);

    const url = externalUrlMatch[1];
    try {
      const request = await fetch(window.decodeURIComponent(url));
      const data = await loadFromBlob(await request.blob(), null, null);
      if (
        !scene.elements.length ||
        (await openConfirmModal(shareableLinkConfirmDialog))
      ) {
        return { scene: data, isExternalScene };
      }
    } catch (error: any) {
      return {
        scene: {
          appState: {
            errorMessage: t("alerts.invalidSceneUrl"),
          },
        },
        isExternalScene,
      };
    }
  }

  if (roomLinkData && opts.collabAPI) {
    const { excalidrawAPI } = opts;

    const scene = await opts.collabAPI.startCollaboration(roomLinkData);

    return {
      // when collaborating, the state may have already been updated at this
      // point (we may have received updates from other clients), so reconcile
      // elements and appState with existing state
      scene: {
        ...scene,
        appState: {
          ...restoreAppState(
            {
              ...scene?.appState,
              theme: localDataState?.appState?.theme || scene?.appState?.theme,
            },
            excalidrawAPI.getAppState(),
          ),
          // necessary if we're invoking from a hashchange handler which doesn't
          // go through App.initializeScene() that resets this flag
          isLoading: false,
        },
        elements: reconcileElements(
          scene?.elements || [],
          excalidrawAPI.getSceneElementsIncludingDeleted() as RemoteExcalidrawElement[],
          excalidrawAPI.getAppState(),
        ),
      },
      isExternalScene: true,
      id: roomLinkData.roomId,
      key: roomLinkData.roomKey,
    };
  } else if (scene) {
    return isExternalScene && jsonBackendMatch
      ? {
          scene,
          isExternalScene,
          id: jsonBackendMatch[1],
          key: jsonBackendMatch[2],
        }
      : { scene, isExternalScene: false };
  }
  return { scene: null, isExternalScene: false };
};

const ExcalidrawWrapper = () => {
  const [errorMessage, setErrorMessage] = useState("");
  const isCollabDisabled = isRunningInIframe();

  const setUser = useSetAtom(userAtom);
  useAuth(setUser);
  const { isLoading: authLoading } = useAuthSession();
  const user = useAtomValue(userAtom);
  const storageConfig = useAtomValue(storageConfigAtom);
  const setStorageConfig = useSetAtom(storageConfigAtom);
  const [currentCanvasId, setCurrentCanvasId] = useAtom(currentCanvasIdAtom);
  const [renameCanvasDialogState] = useAtom(renameCanvasDialogAtom);
  const [saveAsDialogState] = useAtom(saveAsDialogAtom);

  const [saveStatus, setSaveStatus] = useState<
    "saved" | "saving" | "unsaved" | "login-required"
  >("saved");
  const [, setLastSaveTime] = useState<Date | null>(null);

  const resetSaveStatus = useCallback(() => {
    setSaveStatus("saved");
    setLastSaveTime(null);
  }, []);

  const storageAdapter: IStorageAdapter = useMemo(() => {
    // 认证是持久化边界：登录后只走本实例 SQLite，未登录只使用浏览器
    // IndexedDB。不能让旧的 KV/S3 偏好绕过 Workspace Scene 的身份模型。
    if (user) {
      return new BackendStorageAdapter();
    }
    return new IndexedDBStorageAdapter();
  }, [user]);

  const { editorTheme, appTheme, setAppTheme } = useHandleAppTheme();

  const [excalidrawAPI, excalidrawRefCallback] =
    useCallbackRefState<ExcalidrawImperativeAPI>();
  const [collabAPI] = useAtom(collabAPIAtom);
  const [isCollaborating] = useAtomWithInitialValue(isCollaboratingAtom, () => {
    return isCollaborationLink(window.location.href);
  });

  const applyDrawingDefaults = useCallback(
    (defaults?: DrawingDefaults) => {
      if (!excalidrawAPI) {
        return;
      }
      excalidrawAPI.updateScene({
        appState: drawingDefaultsToAppState(defaults ?? loadDrawingDefaults()),
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [excalidrawAPI],
  );

  useEffect(() => {
    applyDrawingDefaults();
  }, [applyDrawingDefaults]);

  // Live-sync the AI canvas (ai-canvas) over WebSocket when it is open.
  useAiCanvasSync(excalidrawAPI, currentCanvasId);

  const magicSettings = useMagicSettings(excalidrawAPI);

  const {
    handleSceneDeleted,
    handleCanvasSelect,
    handleCanvasLeave,
    handleCanvasRename,
    handleCanvasSaveAs,
    isCanvasLoaded,
    refreshCanvases,
  } = useCanvasManagement({
    storageAdapter,
    excalidrawAPI,
    collabAPI,
    setErrorMessage,
    resetSaveStatus,
  });

  // AstraDraw Workspace shell 状态
  // ---------------------------------------------------------------------------
  const [appMode, setAppMode] = useAtom(appModeAtom);
  const workspaceSidebarOpen = useAtomValue(workspaceSidebarOpenAtom);
  const openWorkspaceSidebar = useSetAtom(openWorkspaceSidebarAtom);
  const navigateToDashboard = useSetAtom(navigateToDashboardAtom);
  const [currentWorkspace, setCurrentWorkspace] = useAtom(currentWorkspaceAtom);
  const [currentWorkspaceSlug, setCurrentWorkspaceSlug] = useAtom(
    currentWorkspaceSlugAtom,
  );
  const [currentSceneId, setCurrentSceneId] = useAtom(currentSceneIdAtom);
  const setCurrentSceneTitle = useSetAtom(currentSceneTitleAtom);
  const currentSceneCanEdit = useAtomValue(currentSceneCanEditAtom);
  const setCurrentSceneCanEdit = useSetAtom(currentSceneCanEditAtom);
  const sceneCollabEnabled = useAtomValue(sceneCollabEnabledAtom);
  const sceneEditLock = useAtomValue(sceneEditLockAtom);
  const setActiveCollectionId = useSetAtom(activeCollectionIdAtom);
  const [isAutoCollabScene, setIsAutoCollabScene] = useAtom(
    isAutoCollabSceneAtom,
  );
  const autoCollabInFlightRef = useRef<string | null>(null);
  const [privateCollectionId, setPrivateCollectionId] = useState<string | null>(
    null,
  );
  const { inviteCode, clearInvite } = useShellRouteSync({
    beforeLeaveScene: handleCanvasLeave,
  });

  useRouteSceneLoader({
    ready: Boolean(excalidrawAPI),
    currentSceneId,
    currentCanvasId,
    currentWorkspaceSlug,
    isCanvasLoaded,
    handleCanvasSelect,
  });

  useSceneEditLock({
    // 路由可先指向目标 Scene；独占锁必须继续跟随编辑器中实际已加载的画布，
    // 直到切换链路保存旧内容并把 currentCanvasId 更新为目标 Scene。
    sceneId: currentCanvasId,
    canEdit: currentSceneCanEdit,
    excalidrawAPI,
  });

  const saveCanvas = useCallback(async () => {
    if (!excalidrawAPI) {
      return;
    }
    if (sceneEditLock?.locked) {
      return;
    }
    const {
      storageAdapter,
      currentCanvasId,
      currentSceneCanEdit,
      currentSceneId,
      refreshCanvases,
    } = onChangeRef.current;
    if (
      currentCanvasId &&
      isBackendPersistableCanvasId(currentCanvasId) &&
      currentSceneId === currentCanvasId &&
      currentSceneCanEdit === true
    ) {
      setSaveStatus("saving");
      try {
        await storageAdapter.saveCanvas(currentCanvasId, {
          elements: excalidrawAPI.getSceneElements(),
          appState: excalidrawAPI.getAppState(),
          files: excalidrawAPI.getFiles(),
        });
        if (currentCanvasId !== onChangeRef.current.currentCanvasId) {
          return;
        }
        setSaveStatus("saved");
        setLastSaveTime(new Date());
        await invalidateSceneMutationCaches();
        await refreshCanvases();
      } catch (e: any) {
        if (currentCanvasId !== onChangeRef.current.currentCanvasId) {
          return;
        }
        if (e instanceof AuthError) {
          setSaveStatus("login-required");
        } else {
          setSaveStatus("unsaved");
        }
        console.error(e);
      }
    }
  }, [excalidrawAPI, sceneEditLock?.locked]);

  const [langCode, setLangCode] = useAppLangCode();

  // initial state
  // ---------------------------------------------------------------------------

  const initialStatePromiseRef = useRef<{
    promise: ResolvablePromise<ExcalidrawInitialDataState | null>;
  }>({ promise: null! });
  if (!initialStatePromiseRef.current.promise) {
    initialStatePromiseRef.current.promise =
      resolvablePromise<ExcalidrawInitialDataState | null>();
  }

  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const initialCanvasLoadedRef = useRef(false);
  const migratedLoginRef = useRef<string | null>(null);

  useEffect(() => {
    trackEvent("load", "frame", getFrame());
    // Delayed so that the app has a time to load the latest SW
    setTimeout(() => {
      trackEvent("load", "version", getVersion());
    }, VERSION_TIMEOUT);
  }, []);

  const [, setShareDialogState] = useAtom(shareDialogStateAtom);
  const collabError = useAtomValue(collabErrorIndicatorAtom);

  useHandleLibrary({
    excalidrawAPI,
    adapter: LibraryIndexedDBAdapter,
    // TODO maybe remove this in several months (shipped: 24-03-11)
    migrationAdapter: LibraryLocalStorageMigrationAdapter,
  });

  const [, forceRefresh] = useState(false);

  useEffect(() => {
    if (isDevEnv()) {
      const debugState = loadSavedDebugState();

      if (debugState.enabled && !window.visualDebug) {
        window.visualDebug = {
          data: [],
        };
      } else {
        delete window.visualDebug;
      }
      forceRefresh((prev) => !prev);
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI || (!isCollabDisabled && !collabAPI)) {
      return;
    }
    if (authLoading) {
      return;
    }

    const loadImages = (
      data: ResolutionType<typeof initializeScene>,
      isInitialLoad = false,
    ) => {
      if (!data.scene) {
        return;
      }
      if (collabAPI?.isCollaborating()) {
        if (data.scene.elements) {
          collabAPI
            .fetchImageFilesFromFirebase({
              elements: data.scene.elements,
              forceFetchFiles: true,
            })
            .then(({ loadedFiles, erroredFiles }) => {
              excalidrawAPI.addFiles(loadedFiles);
              updateStaleImageStatuses({
                excalidrawAPI,
                erroredFiles,
                elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
              });
            });
        }
      } else {
        const fileIds =
          data.scene.elements?.reduce((acc, element) => {
            if (isInitializedImageElement(element)) {
              return acc.concat(element.fileId);
            }
            return acc;
          }, [] as FileId[]) || [];

        if (data.isExternalScene) {
          loadFilesFromFirebase(
            `${FIREBASE_STORAGE_PREFIXES.shareLinkFiles}/${data.id}`,
            data.key,
            fileIds,
          ).then(({ loadedFiles, erroredFiles }) => {
            excalidrawAPI.addFiles(loadedFiles);
            updateStaleImageStatuses({
              excalidrawAPI,
              erroredFiles,
              elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
            });
          });
        } else if (isInitialLoad) {
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
          // on fresh load, clear unused files from IDB (from previous
          // session)
          LocalData.fileStorage.clearObsoleteFiles({ currentFileIds: fileIds });
        }
      }
    };

    const loadCanvas = async () => {
      const jsonMatch = window.location.hash.match(
        /^#json=([a-zA-Z0-9_-]+),([a-zA-Z0-9_-]+)$/,
      );
      const urlMatch = window.location.hash.match(/^#url=(.*)$/);
      const isCollab =
        isCollaborationLink(window.location.href) ||
        isCollaborationLink(document.referrer);

      if (isCollab || jsonMatch || urlMatch) {
        initializeScene({ collabAPI, excalidrawAPI }).then(async (data) => {
          loadImages(data, true);
          initialStatePromiseRef.current.promise.resolve(data.scene);
        });
      } else {
        let data: ResolutionType<typeof initializeScene> | null = null;

        // Correctly get and set Jotai atom value outside of a React component
        const currentCanvasId = appJotaiStore.get(currentCanvasIdAtom);
        const setCurrentCanvasId = (id: string | null) => {
          appJotaiStore.set(currentCanvasIdAtom, id);
        };

        if (!currentCanvasId) {
          if (user) {
            // 已登录：不要用 kv createCanvas 造 nanoid 脏行，交给 localStorage / Workspace。
            data = null;
          } else {
            try {
              const newCanvas = await storageAdapter.createCanvas({
                elements: [],
                appState: excalidrawAPI.getAppState(),
                files: {},
              });
              setCurrentCanvasId(newCanvas.id);
              data = {
                scene: {
                  elements: [],
                  appState: excalidrawAPI.getAppState(),
                },
                isExternalScene: false,
              } as ResolutionType<typeof initializeScene>;
            } catch (e) {
              console.error(e);
              setErrorMessage(
                e instanceof Error
                  ? e.message
                  : "Failed to create a new canvas.",
              );
              return;
            }
          }
        } else {
          try {
            let canvasData = await storageAdapter.loadCanvas(currentCanvasId);
            if (!canvasData && isIndexedDbCanvasId(currentCanvasId)) {
              canvasData = await new IndexedDBStorageAdapter().loadCanvas(
                currentCanvasId,
              );
            }
            if (canvasData) {
              if (user && isIndexedDbCanvasId(currentCanvasId)) {
                const migratedId = await migrateIndexedDbCanvasToSqlite({
                  canvasData,
                  collectionId: privateCollectionId,
                });
                if (migratedId) {
                  setCurrentCanvasId(migratedId);
                  appJotaiStore.set(currentSceneIdAtom, migratedId);
                } else {
                  setCurrentCanvasId(null);
                }
              } else if (
                user &&
                isBackendPersistableCanvasId(currentCanvasId)
              ) {
                appJotaiStore.set(currentSceneIdAtom, currentCanvasId);
              }
              data = {
                scene: {
                  elements: canvasData.elements,
                  appState: restoreAppState(
                    canvasData.appState,
                    excalidrawAPI.getAppState(),
                  ),
                  files: canvasData.files,
                },
                isExternalScene: false,
              } as ResolutionType<typeof initializeScene>;
            } else if (user) {
              setCurrentCanvasId(null);
              data = null;
            } else {
              // 登出后 localStorage 可能还保留 Workspace Scene ID。该 ID
              // 不应继续访问 SQLite，也不能让初始场景 promise 悬置；清掉后
              // 正常初始化未登录的本地空白画布。
              setCurrentCanvasId(null);
              data = null;
            }
          } catch (e) {
            console.error("Failed to load canvas data.", e);
            const resetConfirmed = await openConfirmModal({
              title: t("canvasError.loadingFailed"),
              description: t("canvasError.loadingFailedDescription"),
              actionLabel: t("canvasError.resetCanvas"),
              color: "danger",
            });

            if (resetConfirmed) {
              setCurrentCanvasId(null);
              return;
            }
            const errorMessage = t("canvasError.cannotLoadCanvas");
            setErrorMessage(errorMessage);
            initialStatePromiseRef.current.promise.resolve({
              appState: { errorMessage },
            });
            return;
          }
        }
        if (data) {
          loadImages(data, true);
          initialStatePromiseRef.current.promise.resolve(data.scene);
        } else {
          initializeScene({ collabAPI, excalidrawAPI }).then(
            async (initData) => {
              loadImages(initData, true);
              initialStatePromiseRef.current.promise.resolve(initData.scene);
              const localElements = initData.scene?.elements;
              if (user && localElements && localElements.length > 0) {
                try {
                  const migratedId = await migrateIndexedDbCanvasToSqlite({
                    canvasData: {
                      elements: localElements as CanvasData["elements"],
                      appState: (initData.scene?.appState ||
                        excalidrawAPI.getAppState()) as CanvasData["appState"],
                      files: {},
                    },
                    collectionId: privateCollectionId,
                  });
                  if (migratedId) {
                    setCurrentCanvasId(migratedId);
                    appJotaiStore.set(currentSceneIdAtom, migratedId);
                  }
                } catch (error) {
                  console.error(
                    "Failed to migrate localStorage canvas to sqlite:",
                    error,
                  );
                }
              }
            },
          );
        }
      }
    };

    if (!initialCanvasLoadedRef.current) {
      initialCanvasLoadedRef.current = true;
      loadCanvas();
    }
    refreshCanvases();

    const onHashChange = async (event: HashChangeEvent) => {
      event.preventDefault();
      const libraryUrlTokens = parseLibraryTokensFromUrl();
      if (!libraryUrlTokens) {
        if (
          collabAPI?.isCollaborating() &&
          !isCollaborationLink(window.location.href)
        ) {
          collabAPI.stopCollaboration(false);
        }
        excalidrawAPI.updateScene({ appState: { isLoading: true } });

        initializeScene({ collabAPI, excalidrawAPI }).then((data) => {
          loadImages(data);
          if (data.scene) {
            excalidrawAPI.updateScene({
              elements: restoreElements(data.scene.elements, null, {
                repairBindings: true,
              }),
              appState: restoreAppState(data.scene.appState, null),
              captureUpdate: CaptureUpdateAction.IMMEDIATELY,
            });
          }
        });
      }
    };

    const titleTimeout = setTimeout(
      () => (document.title = APP_NAME),
      TITLE_TIMEOUT,
    );

    const syncData = debounce(() => {
      if (isTestEnv()) {
        return;
      }
      if (
        !document.hidden &&
        ((collabAPI && !collabAPI.isCollaborating()) || isCollabDisabled)
      ) {
        // don't sync if local state is newer or identical to browser state
        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_DATA_STATE)) {
          const localDataState = importFromLocalStorage();
          const username = importUsernameFromLocalStorage();
          setLangCode(getPreferredLanguage());
          excalidrawAPI.updateScene({
            ...localDataState,
            captureUpdate: CaptureUpdateAction.NEVER,
          });
          LibraryIndexedDBAdapter.load().then((data) => {
            if (data) {
              excalidrawAPI.updateLibrary({
                libraryItems: data.libraryItems,
              });
            }
          });
          collabAPI?.setUsername(username || "");
        }

        if (isBrowserStorageStateNewer(STORAGE_KEYS.VERSION_FILES)) {
          const elements = excalidrawAPI.getSceneElementsIncludingDeleted();
          const currFiles = excalidrawAPI.getFiles();
          const fileIds =
            elements?.reduce((acc, element) => {
              if (
                isInitializedImageElement(element) &&
                // only load and update images that aren't already loaded
                !currFiles[element.fileId]
              ) {
                return acc.concat(element.fileId);
              }
              return acc;
            }, [] as FileId[]) || [];
          if (fileIds.length) {
            LocalData.fileStorage
              .getFiles(fileIds)
              .then(({ loadedFiles, erroredFiles }) => {
                if (loadedFiles.length) {
                  excalidrawAPI.addFiles(loadedFiles);
                }
                updateStaleImageStatuses({
                  excalidrawAPI,
                  erroredFiles,
                  elements: excalidrawAPI.getSceneElementsIncludingDeleted(),
                });
              });
          }
        }
      }
    }, SYNC_BROWSER_TABS_TIMEOUT);

    const onUnload = () => {
      LocalData.flushSave();
    };

    const visibilityChange = (event: FocusEvent | Event) => {
      if (event.type === EVENT.BLUR || document.hidden) {
        LocalData.flushSave();
      }
      if (
        event.type === EVENT.VISIBILITY_CHANGE ||
        event.type === EVENT.FOCUS
      ) {
        syncData();
      }
    };

    window.addEventListener(EVENT.HASHCHANGE, onHashChange, false);
    window.addEventListener(EVENT.UNLOAD, onUnload, false);
    window.addEventListener(EVENT.BLUR, visibilityChange, false);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, visibilityChange, false);
    window.addEventListener(EVENT.FOCUS, visibilityChange, false);
    return () => {
      window.removeEventListener(EVENT.HASHCHANGE, onHashChange, false);
      window.removeEventListener(EVENT.UNLOAD, onUnload, false);
      window.removeEventListener(EVENT.BLUR, visibilityChange, false);
      window.removeEventListener(EVENT.FOCUS, visibilityChange, false);
      document.removeEventListener(
        EVENT.VISIBILITY_CHANGE,
        visibilityChange,
        false,
      );
      clearTimeout(titleTimeout);
    };
  }, [
    isCollabDisabled,
    collabAPI,
    excalidrawAPI,
    setLangCode,
    storageAdapter,
    refreshCanvases,
    authLoading,
    user,
    privateCollectionId,
  ]);

  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }
    const newSaveAction = {
      name: "saveToActiveFile" as ActionName,
      label: "Save",
      trackEvent: { category: "canvas" },
      perform: async () => {
        await saveCanvas();
        return {
          captureUpdate: CaptureUpdateAction.NEVER,
        };
      },
      keyTest: (event: KeyboardEvent) =>
        !event.altKey &&
        !event.shiftKey &&
        event.key.toLowerCase() === "s" &&
        (event.ctrlKey || event.metaKey),
    } as Action;
    excalidrawAPI.registerAction(newSaveAction);
    return () => {
      excalidrawAPI.registerAction(actionSaveToActiveFile);
    };
  }, [excalidrawAPI, saveCanvas]);

  useEffect(() => {
    const unloadHandler = (event: BeforeUnloadEvent) => {
      LocalData.flushSave();

      if (
        excalidrawAPI &&
        LocalData.fileStorage.shouldPreventUnload(
          excalidrawAPI.getSceneElements(),
        )
      ) {
        if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
          preventUnload(event);
        } else {
          console.warn(
            "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
          );
        }
      }
    };
    window.addEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    return () => {
      window.removeEventListener(EVENT.BEFORE_UNLOAD, unloadHandler);
    };
  }, [excalidrawAPI]);

  const onChangeRef = useRef({
    storageAdapter,
    currentCanvasId,
    currentSceneCanEdit,
    currentSceneId,
    refreshCanvases,
    collabAPI,
  });
  onChangeRef.current = {
    storageAdapter,
    currentCanvasId,
    currentSceneCanEdit,
    currentSceneId,
    refreshCanvases,
    collabAPI,
  };

  const previousElementsRef = useRef<
    readonly OrderedExcalidrawElement[] | null
  >(null);
  const previousSceneVersionRef = useRef(-1);
  const previousFilesRef = useRef<BinaryFiles | null>(null);

  const persistCanvas = useCallback(
    async (
      canvasId: string,
      elements: readonly NonDeletedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles,
    ) => {
      const {
        storageAdapter,
        currentCanvasId,
        currentSceneCanEdit,
        currentSceneId,
        collabAPI,
      } = onChangeRef.current;
      // 防抖回调属于触发它的画布。切走后绝不能把旧 Scene 的快照写进新 Scene。
      if (
        canvasId !== currentCanvasId ||
        !isBackendPersistableCanvasId(canvasId)
      ) {
        return;
      }
      if (currentSceneId !== canvasId || currentSceneCanEdit !== true) {
        return;
      }
      if (collabAPI?.isCollaborating() && !collabAPI.shouldPersistCanvas()) {
        return;
      }
      setSaveStatus("saving");
      try {
        await storageAdapter.saveCanvas(canvasId, {
          elements,
          appState,
          files,
        });
        // Two-way sync: push user edits on AI canvases back to the mcp
        // server so the CLI sees them and other viewers stay in sync.
        // The canvasId query param is REQUIRED — the server rejects syncs
        // without it, so an open canvas can never overwrite a different
        // canvas that the AI is currently working on.
        if (canvasId.startsWith("ai-")) {
          const payload = {
            elements: elements.map((el) => ({ ...el })),
          };
          const response = await fetch(
            `/api/elements/sync?canvasId=${encodeURIComponent(canvasId)}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
                ...sceneClientHeaders(),
              },
              body: JSON.stringify(payload),
            },
          );
          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
              `AI canvas sync failed (${response.status}): ${errorBody}`,
            );
          }
        }
        // 保存请求可能在切换完成后才返回；不能用旧画布的结果更新新画布 UI。
        if (canvasId !== onChangeRef.current.currentCanvasId) {
          return;
        }
        setSaveStatus("saved");
        setLastSaveTime(new Date());
        await invalidateSceneMutationCaches();
        if (!collabAPI?.isCollaborating()) {
          await onChangeRef.current.refreshCanvases();
        }
      } catch (e: any) {
        if (canvasId !== onChangeRef.current.currentCanvasId) {
          return;
        }
        if (e instanceof AuthError) {
          setSaveStatus("login-required");
        } else {
          setSaveStatus("unsaved");
        }
        console.error(e);
      }
    },
    [],
  );

  const debouncedSave = useMemo(
    () => debounce(persistCanvas, 5000),
    [persistCanvas],
  );
  const collabDebouncedSave = useMemo(
    () => debounce(persistCanvas, 15000),
    [persistCanvas],
  );

  const onChange = (
    elements: readonly OrderedExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    const {
      currentCanvasId: activeCanvasId,
      currentSceneCanEdit: canEditActiveScene,
      currentSceneId: activeSceneId,
    } = onChangeRef.current;
    // 临时 #room 协作不属于 Workspace Scene。即使浏览器里残留了一个
    // Workspace currentCanvasId，场景增量也必须先广播；下面的 ACL/路由守卫
    // 只负责阻止 SQLite 持久化，不能截断端到端加密的房间同步。
    if (collabAPI?.isCollaborating()) {
      collabAPI.syncElements(elements);
    }

    if (
      isBackendPersistableCanvasId(activeCanvasId) &&
      (activeSceneId !== activeCanvasId || canEditActiveScene !== true)
    ) {
      previousElementsRef.current = elements;
      previousSceneVersionRef.current = getSceneVersion(elements);
      previousFilesRef.current = files;
      return;
    }

    const sceneVersion = getSceneVersion(elements);
    const didElementsChange =
      previousElementsRef.current !== elements &&
      sceneVersion !== previousSceneVersionRef.current;

    const didFilesChange = previousFilesRef.current !== files;

    if (
      currentCanvasId &&
      (didElementsChange || didFilesChange) &&
      !sceneEditLock?.locked &&
      (!collabAPI?.isCollaborating() || currentSceneId === currentCanvasId) &&
      (!collabAPI?.isCollaborating() || collabAPI.shouldPersistCanvas())
    ) {
      setSaveStatus("unsaved");
      const save = collabAPI?.isCollaborating()
        ? collabDebouncedSave
        : debouncedSave;
      save(
        currentCanvasId,
        elements as readonly NonDeletedExcalidrawElement[],
        appState,
        files,
      );
    }

    previousElementsRef.current = elements;
    previousSceneVersionRef.current = sceneVersion;
    previousFilesRef.current = files;

    // this check is redundant, but since this is a hot path, it's best
    // not to evaludate the nested expression every time
    if (!LocalData.isSavePaused()) {
      LocalData.save(elements, appState, files, () => {
        if (excalidrawAPI) {
          let didChange = false;

          const elements = excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .map((element) => {
              if (
                LocalData.fileStorage.shouldUpdateImageElementStatus(element)
              ) {
                const newElement = newElementWith(element, { status: "saved" });
                if (newElement !== element) {
                  didChange = true;
                }
                return newElement;
              }
              return element;
            });

          if (didChange) {
            excalidrawAPI.updateScene({
              elements,
              captureUpdate: CaptureUpdateAction.NEVER,
            });
          }
        }
      });
    }

    // Render the debug scene if the debug canvas is available
    if (debugCanvasRef.current && excalidrawAPI) {
      debugRenderer(
        debugCanvasRef.current,
        appState,
        elements,
        window.devicePixelRatio,
      );
    }
  };

  const [latestShareableLink, setLatestShareableLink] = useState<string | null>(
    null,
  );

  const onExportToBackend = async (
    exportedElements: readonly NonDeletedExcalidrawElement[],
    appState: Partial<AppState>,
    files: BinaryFiles,
  ) => {
    if (exportedElements.length === 0) {
      throw new Error(t("alerts.cannotExportEmptyCanvas"));
    }
    try {
      const { url, errorMessage } = await exportToBackend(
        exportedElements,
        {
          ...appState,
          viewBackgroundColor: appState.exportBackground
            ? appState.viewBackgroundColor
            : getDefaultAppState().viewBackgroundColor,
        },
        files,
      );

      if (errorMessage) {
        throw new Error(errorMessage);
      }

      if (url) {
        setLatestShareableLink(url);
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        const { width, height } = appState;
        console.error(error, {
          width,
          height,
          devicePixelRatio: window.devicePixelRatio,
        });
        throw new Error(error.message);
      }
    }
  };

  const renderCustomStats = (
    elements: readonly NonDeletedExcalidrawElement[],
    appState: UIAppState,
  ) => {
    return (
      <CustomStats
        setToast={(message) => excalidrawAPI!.setToast({ message })}
        appState={appState}
        elements={elements}
      />
    );
  };

  const isOffline = useAtomValue(isOfflineAtom);

  const onCollabDialogOpen = useCallback(
    () => setShareDialogState({ isOpen: true, type: "collaborationOnly" }),
    [setShareDialogState],
  );

  // Workspace shell 桥接
  // ---------------------------------------------------------------------------
  // scene id 与 canvas id 同源，因此新建场景后先写一份空白画布，
  // 之后所有读写都复用既有的 storageAdapter 路径（含 AI 同步、协作）。
  const handleNewScene = useCallback(
    async (
      collectionId?: string,
      options?: { skipCurrentSceneSave?: boolean },
    ) => {
      const urlAtStart = window.location.href;
      const workspaceAtStart = currentWorkspace;
      try {
        // 创建 API 和缓存刷新发生在路由切换之前。先显式保存源 Scene，避免
        // 创建请求期间的最后一段防抖修改尚未落盘。
        if (
          !options?.skipCurrentSceneSave &&
          excalidrawAPI &&
          currentCanvasId &&
          currentCanvasId === currentSceneId &&
          currentSceneCanEdit === true &&
          !sceneEditLock?.locked &&
          isBackendPersistableCanvasId(currentCanvasId)
        ) {
          await storageAdapter.saveCanvas(currentCanvasId, {
            elements: excalidrawAPI.getSceneElements(),
            appState: excalidrawAPI.getAppState(),
            files: excalidrawAPI.getFiles(),
          });
        }

        if (
          !canCommitWorkspaceRouteMutation({
            workspaceIdAtStart: workspaceAtStart?.id ?? null,
            currentWorkspaceId:
              appJotaiStore.get(currentWorkspaceAtom)?.id ?? null,
            urlAtStart,
            currentUrl: window.location.href,
          })
        ) {
          return;
        }

        const title = `Untitled ${new Date().toLocaleTimeString()}`;
        const targetCollectionId =
          collectionId || privateCollectionId || undefined;
        const slug = workspaceAtStart?.slug || currentWorkspaceSlug;

        if (!workspaceAtStart?.id || !slug) {
          throw new Error("Workspace is not ready.");
        }

        const scene = await createScene({
          title,
          collectionId: targetCollectionId,
        });

        // Workspace Sidebar 读取 React Query scene cache，而不是旧的
        // useCanvasManagement 列表。先写入目标 Collection 的 cache，列表会立即
        // 出现新场景；随后失效查询，以服务端结果校正缩略图和时间戳。
        const queryKey = queryKeys.scenes.list(
          workspaceAtStart.id,
          targetCollectionId ?? null,
        );
        queryClient.setQueryData<WorkspaceScene[]>(queryKey, (previous) => [
          scene,
          ...(previous ?? []).filter(({ id }) => id !== scene.id),
        ]);
        await invalidateSceneMutationCaches();

        if (
          !canCommitWorkspaceRouteMutation({
            workspaceIdAtStart: workspaceAtStart.id,
            currentWorkspaceId:
              appJotaiStore.get(currentWorkspaceAtom)?.id ?? null,
            urlAtStart,
            currentUrl: window.location.href,
          })
        ) {
          return;
        }

        if (targetCollectionId) {
          setActiveCollectionId(targetCollectionId);
        }
        openWorkspaceSidebar();
        resetSaveStatus();
        // 只能经 navigateTo() 变更 URL。它会派发 popstate，让路由同步、
        // 权限检查和 handleCanvasSelect 按统一场景切换事务执行。
        navigateTo(buildSceneUrl(slug, scene.id), { sceneId: scene.id });
      } catch (error) {
        console.error("Failed to create new scene:", error);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to create a new scene.",
        );
      }
    },
    [
      excalidrawAPI,
      storageAdapter,
      privateCollectionId,
      currentWorkspace,
      currentWorkspaceSlug,
      currentCanvasId,
      currentSceneId,
      currentSceneCanEdit,
      sceneEditLock?.locked,
      setActiveCollectionId,
      openWorkspaceSidebar,
      resetSaveStatus,
    ],
  );

  // 登录后持久化为后端 SQLite，并把当前 IndexedDB 画布（有内容时）迁入 Workspace scene。
  useEffect(() => {
    if (!user || authLoading) {
      if (!user) {
        migratedLoginRef.current = null;
      }
      return;
    }
    if (storageConfig.type !== "default") {
      setStorageConfig({ type: "default" });
    }
  }, [user, authLoading, storageConfig, setStorageConfig]);

  useEffect(() => {
    if (!user || authLoading || !excalidrawAPI) {
      return;
    }
    if (migratedLoginRef.current === user.id) {
      return;
    }
    // 首次进入由 loadCanvas 负责；这里只处理「已经在画」时登录。
    if (!initialCanvasLoadedRef.current) {
      return;
    }

    const run = async () => {
      const migrationCanvasId = currentCanvasId;
      const migrationUrl = window.location.href;
      if (currentSceneId && !isIndexedDbCanvasId(currentSceneId)) {
        if (isIndexedDbCanvasId(currentCanvasId)) {
          setCurrentCanvasId(null);
        }
        migratedLoginRef.current = user.id;
        return;
      }
      if (isBackendPersistableCanvasId(currentCanvasId)) {
        migratedLoginRef.current = user.id;
        return;
      }

      const elements = excalidrawAPI.getSceneElements();
      if (elements.length === 0) {
        if (isIndexedDbCanvasId(currentCanvasId)) {
          setCurrentCanvasId(null);
        }
        migratedLoginRef.current = user.id;
        return;
      }

      try {
        const migratedId = await migrateIndexedDbCanvasToSqlite({
          canvasData: {
            elements,
            appState: excalidrawAPI.getAppState(),
            files: excalidrawAPI.getFiles(),
          },
          collectionId: privateCollectionId,
        });
        migratedLoginRef.current = user.id;
        if (!migratedId) {
          if (isIndexedDbCanvasId(currentCanvasId)) {
            setCurrentCanvasId(null);
          }
          return;
        }
        if (
          appJotaiStore.get(currentCanvasIdAtom) !== migrationCanvasId ||
          window.location.href !== migrationUrl
        ) {
          // 迁移结果已经安全写入后端，但用户已切换画布或路由；只刷新列表，
          // 不能让旧异步响应覆盖当前 URL/Scene 身份。
          await invalidateSceneMutationCaches();
          await refreshCanvases();
          return;
        }
        setCurrentCanvasId(migratedId);
        setCurrentSceneId(migratedId);
        setCurrentSceneTitle(excalidrawAPI.getAppState().name || "Untitled");
        setAppMode("canvas");
        const slug = currentWorkspace?.slug || currentWorkspaceSlug;
        if (slug) {
          navigateTo(buildSceneUrl(slug, migratedId), { sceneId: migratedId });
        }
        await refreshCanvases();
      } catch (error) {
        console.error("Failed to migrate local canvas to sqlite:", error);
        // IndexedDB 原件仍在，不能把失败标记为已迁移；后续依赖变化或重载时重试。
      }
    };

    void run();
  }, [
    user,
    authLoading,
    excalidrawAPI,
    storageConfig.type,
    currentSceneId,
    currentCanvasId,
    storageAdapter,
    privateCollectionId,
    currentWorkspace?.slug,
    currentWorkspaceSlug,
    setCurrentCanvasId,
    setCurrentSceneId,
    setCurrentSceneTitle,
    setAppMode,
    refreshCanvases,
  ]);

  // 仅当该 Scene 已主动「允许一起编辑」时才进 WS 房间。
  useEffect(() => {
    if (
      !excalidrawAPI ||
      !collabAPI ||
      isCollabDisabled ||
      !currentCanvasId ||
      !isBackendPersistableCanvasId(currentCanvasId) ||
      !sceneCollabEnabled
    ) {
      return;
    }
    if (isCollaborationLink(window.location.href)) {
      return;
    }
    // 正在把 URL 上的 scene 载入画布，等 currentCanvasId 对齐后再进房。
    if (currentSceneId && currentSceneId !== currentCanvasId) {
      return;
    }

    const sceneId = currentCanvasId;
    if (collabAPI.isCollaborating() && collabAPI.getRoomId() === sceneId) {
      setIsAutoCollabScene(true);
      return;
    }
    if (autoCollabInFlightRef.current === sceneId) {
      return;
    }

    let cancelled = false;
    autoCollabInFlightRef.current = sceneId;
    (async () => {
      try {
        const { roomId, roomKey } = await startSceneCollabRoom(sceneId);
        if (cancelled) {
          return;
        }
        if (collabAPI.getRoomId() === roomId && collabAPI.isCollaborating()) {
          setIsAutoCollabScene(true);
          return;
        }
        // 只在换房间时停旧房；禁止对同一房间 stop+start（会踢掉自己的旧 socket）。
        if (
          collabAPI.isCollaborating() &&
          collabAPI.getRoomId() &&
          collabAPI.getRoomId() !== roomId
        ) {
          collabAPI.stopCollaboration(false);
        }
        await collabAPI.startCollaboration({
          roomId,
          roomKey,
          isAutoCollab: true,
        });
        if (!cancelled) {
          setIsAutoCollabScene(true);
        }
      } catch (error) {
        console.error("Failed to start workspace scene collaboration:", error);
      } finally {
        if (autoCollabInFlightRef.current === sceneId) {
          autoCollabInFlightRef.current = null;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    excalidrawAPI,
    collabAPI,
    isCollabDisabled,
    currentSceneId,
    currentCanvasId,
    sceneCollabEnabled,
    setIsAutoCollabScene,
  ]);

  useEffect(() => {
    if (!collabAPI || !isAutoCollabScene) {
      return;
    }
    if (currentSceneId && sceneCollabEnabled) {
      return;
    }
    if (collabAPI.isCollaborating()) {
      collabAPI.stopCollaboration(false);
    }
    setIsAutoCollabScene(false);
    if (!currentSceneId) {
      setCurrentSceneCanEdit(null);
    }
  }, [
    currentSceneId,
    sceneCollabEnabled,
    isAutoCollabScene,
    collabAPI,
    setIsAutoCollabScene,
    setCurrentSceneCanEdit,
  ]);

  const handleUpdateWorkspace = useCallback(
    async (data: { name?: string }) => {
      if (!currentWorkspace) {
        throw new Error("No workspace selected");
      }
      const workspaceAtStart = currentWorkspace;
      const updated = await updateWorkspaceApi(workspaceAtStart.id, data);
      if (
        canCommitWorkspaceMutation({
          mutationWorkspaceId: workspaceAtStart.id,
          mutationWorkspaceSlug: workspaceAtStart.slug,
          currentWorkspaceId:
            appJotaiStore.get(currentWorkspaceAtom)?.id ?? null,
          currentRoute: parseUrl(),
        })
      ) {
        setCurrentWorkspace(updated as WorkspaceData);
        if (updated.slug !== workspaceAtStart.slug) {
          setCurrentWorkspaceSlug(updated.slug);
          const nextUrl = replaceWorkspaceSlugInUrl(
            window.location.href,
            workspaceAtStart.slug,
            updated.slug,
          );
          if (nextUrl) {
            replaceUrl(nextUrl);
          }
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
        invalidateSceneMutationCaches(),
      ]);
    },
    [currentWorkspace, setCurrentWorkspace, setCurrentWorkspaceSlug],
  );

  const handleUploadWorkspaceAvatar = useCallback(
    async (file: File) => {
      if (!currentWorkspace) {
        throw new Error("No workspace selected");
      }
      const workspaceAtStart = currentWorkspace;
      const updated = await uploadWorkspaceAvatar(workspaceAtStart.id, file);
      if (
        canCommitWorkspaceMutation({
          mutationWorkspaceId: workspaceAtStart.id,
          mutationWorkspaceSlug: workspaceAtStart.slug,
          currentWorkspaceId:
            appJotaiStore.get(currentWorkspaceAtom)?.id ?? null,
          currentRoute: parseUrl(),
        })
      ) {
        setCurrentWorkspace(updated as WorkspaceData);
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
        invalidateSceneMutationCaches(),
      ]);
    },
    [currentWorkspace, setCurrentWorkspace],
  );

  const handleBeforeCollectionMutation = useCallback(async () => {
    if (
      !excalidrawAPI ||
      !currentCanvasId ||
      currentCanvasId !== currentSceneId ||
      currentSceneCanEdit !== true ||
      sceneEditLock?.locked ||
      !isBackendPersistableCanvasId(currentCanvasId)
    ) {
      return;
    }
    if (collabAPI?.isCollaborating() && !collabAPI.shouldPersistCanvas()) {
      throw new Error(
        "当前协作客户端不是持久化主节点，请先结束协作或等待主节点保存。",
      );
    }
    await storageAdapter.saveCanvas(currentCanvasId, {
      elements: excalidrawAPI.getSceneElements(),
      appState: excalidrawAPI.getAppState(),
      files: excalidrawAPI.getFiles(),
    });
  }, [
    collabAPI,
    currentCanvasId,
    currentSceneCanEdit,
    currentSceneId,
    excalidrawAPI,
    sceneEditLock?.locked,
    storageAdapter,
  ]);

  const handleDeleteWorkspace = useCallback(async () => {
    if (!currentWorkspace) {
      throw new Error("No workspace selected");
    }
    const workspaceAtStart = currentWorkspace;
    await deleteWorkspaceApi(workspaceAtStart.id);
    const remaining = await listWorkspaces();
    const currentWorkspaceAfterDelete = appJotaiStore.get(currentWorkspaceAtom);
    const currentRoute = parseUrl();
    const selectedFallback = remaining.find(
      (workspace) => workspace.id === currentWorkspaceAfterDelete?.id,
    );
    const fallbackWorkspace = selectedFallback ?? remaining[0] ?? null;

    if (
      canCommitWorkspaceMutation({
        mutationWorkspaceId: workspaceAtStart.id,
        mutationWorkspaceSlug: workspaceAtStart.slug,
        currentWorkspaceId: currentWorkspaceAfterDelete?.id ?? null,
        currentRoute,
      })
    ) {
      setCurrentWorkspace((fallbackWorkspace as WorkspaceData | null) ?? null);
      setCurrentWorkspaceSlug(fallbackWorkspace?.slug ?? null);
    }

    const redirect = getWorkspaceDeleteRedirect({
      deletedWorkspaceSlug: workspaceAtStart.slug,
      currentRoute,
      fallbackWorkspaceSlug: fallbackWorkspace?.slug ?? null,
    });
    if (redirect) {
      navigateTo(redirect);
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.all }),
      invalidateSceneMutationCaches(),
    ]);
  }, [currentWorkspace, setCurrentWorkspace, setCurrentWorkspaceSlug]);

  // browsers generally prevent infinite self-embedding, there are
  // cases where it still happens, and while we disallow self-embedding
  // by not whitelisting our own origin, this serves as an additional guard
  if (isSelfEmbedding) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          height: "100%",
        }}
      >
        <h1>I'm not a pretzel!</h1>
      </div>
    );
  }

  const ExcalidrawPlusCommand = {
    label: "Excalidraw+",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: ["plus", "cloud", "server"],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_LP
        }/plus?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };
  const ExcalidrawPlusAppCommand = {
    label: "Sign up",
    category: DEFAULT_CATEGORIES.links,
    predicate: true,
    icon: <div style={{ width: 14 }}>{ExcalLogo}</div>,
    keywords: [
      "excalidraw",
      "plus",
      "cloud",
      "server",
      "signin",
      "login",
      "signup",
    ],
    perform: () => {
      window.open(
        `${
          import.meta.env.VITE_APP_PLUS_APP
        }?utm_source=excalidraw&utm_medium=app&utm_content=command_palette`,
        "_blank",
      );
    },
  };

  const isWorkspaceAdmin = currentWorkspace?.role === "ADMIN";

  if (inviteCode) {
    return (
      <InviteAcceptPage
        inviteCode={inviteCode}
        onSuccess={(workspace: Workspace) => {
          clearInvite();
          setCurrentWorkspace(workspace as WorkspaceData);
          setCurrentWorkspaceSlug(workspace.slug);
          navigateToDashboard();
        }}
        onCancel={() => {
          clearInvite();
          window.history.replaceState({}, document.title, "/");
        }}
      />
    );
  }

  return (
    <div
      style={{ height: "100%" }}
      className={clsx("excalidraw-app", {
        "is-collaborating": isCollaborating,
        "workspace-sidebar-open": workspaceSidebarOpen,
      })}
    >
      {/* 左侧滑出侧边栏（AstraDraw WorkspaceSidebar：app 根容器 flex
          子元素，margin-left 负值滑出，非 fixed 定位） */}
      <WorkspaceSidebar
        onNewScene={handleNewScene}
        onCurrentSceneDeleted={handleSceneDeleted}
        onBeforeCollectionMutation={handleBeforeCollectionMutation}
        currentSceneId={currentSceneId}
        workspace={currentWorkspace}
        onWorkspaceChange={(workspace, privateId) => {
          setCurrentWorkspace(workspace as WorkspaceData);
          setCurrentWorkspaceSlug(workspace.slug);
          setPrivateCollectionId(privateId);
        }}
        onCurrentSceneTitleChange={setCurrentSceneTitle}
      />

      {user && <QuickSearchModal />}

      <div
        className="excalidraw-app__main excalidraw-app__dashboard"
        style={{ display: appMode === "dashboard" ? "block" : "none" }}
        aria-hidden={appMode !== "dashboard"}
        inert={appMode !== "dashboard" ? true : undefined}
      >
        <WorkspaceMainContent
          isAdmin={isWorkspaceAdmin}
          onNewScene={handleNewScene}
          onUpdateWorkspace={handleUpdateWorkspace}
          onUploadWorkspaceAvatar={handleUploadWorkspaceAvatar}
          onDeleteWorkspace={handleDeleteWorkspace}
          theme={appTheme}
          setTheme={setAppTheme}
          onDrawingDefaultsChange={applyDrawingDefaults}
        />
      </div>

      <div
        className="excalidraw-app__main excalidraw-app__canvas"
        style={{
          display: appMode === "canvas" ? "block" : "none",
          height: "100%",
        }}
        aria-hidden={appMode !== "canvas"}
        inert={appMode !== "canvas" ? true : undefined}
      >
        <Excalidraw
          onExcalidrawAPI={excalidrawRefCallback}
          onChange={onChange}
          initialData={initialStatePromiseRef.current.promise}
          isCollaborating={isCollaborating}
          viewModeEnabled={
            // 当前 URL 是 Scene 时，权限未确认也必须先只读。
            (!!currentSceneId && currentSceneCanEdit !== true) ||
            sceneEditLock?.locked === true
          }
          onPointerUpdate={collabAPI?.onPointerUpdate}
          UIOptions={{
            canvasActions: {
              toggleTheme: true,
              export: {
                onExportToBackend,
                renderCustomUI: excalidrawAPI
                  ? (elements, appState, files) => {
                      return (
                        <ExportToExcalidrawPlus
                          elements={elements}
                          appState={appState}
                          files={files}
                          name={excalidrawAPI.getName()}
                          onError={(error) => {
                            excalidrawAPI?.updateScene({
                              appState: {
                                errorMessage: error.message,
                              },
                            });
                          }}
                          onSuccess={() => {
                            excalidrawAPI.updateScene({
                              appState: { openDialog: null },
                            });
                          }}
                        />
                      );
                    }
                  : undefined,
              },
            },
          }}
          langCode={langCode}
          renderCustomStats={renderCustomStats}
          detectScroll={false}
          handleKeyboardGlobally={true}
          autoFocus={true}
          theme={editorTheme}
          renderTopLeftUI={(isMobile: boolean) => {
            let statusMessage = "";
            if (saveStatus === "saving") {
              statusMessage = t("canvas.saving");
            } else if (saveStatus === "unsaved") {
              statusMessage = t("canvas.unsavedChanges");
            } else if (saveStatus === "login-required") {
              statusMessage = t("canvas.loginToSave");
            }

            return (
              <div style={{ display: "flex", alignItems: "center" }}>
                <WorkspaceSidebarTrigger />
                {statusMessage && (
                  <div
                    style={{
                      marginLeft: "0.5rem",
                      color: "var(--color-gray-40)",
                      fontSize: "0.8em",
                      fontStyle: "italic",
                    }}
                  >
                    {statusMessage}
                  </div>
                )}
              </div>
            );
          }}
          renderTopRightUI={(isMobile) => {
            if (isMobile || !collabAPI || isCollabDisabled) {
              return null;
            }
            return (
              <div className="top-right-ui">
                {collabError.message && (
                  <CollabError collabError={collabError} />
                )}
                <LiveCollaborationTrigger
                  isCollaborating={isCollaborating}
                  onSelect={() =>
                    setShareDialogState({ isOpen: true, type: "share" })
                  }
                />
              </div>
            );
          }}
          onLinkOpen={(element, event) => {
            if (element.link && isElementLink(element.link)) {
              event.preventDefault();
              excalidrawAPI?.setViewport({
                target: element.link,
                fit: "scale-down",
                animation: true,
              });
            }
          }}
        >
          {/* 评论：侧栏 comments tab + 画布图钉层 + 弹窗 + C 键。
              这里的 DefaultSidebar 是 host 实例，会顶掉 LayerUI 的 fallback。
              不要再额外挂一份 DefaultSidebar __fallback，否则会同时存在两个
              Island，点侧栏会被另一份的 useOutsideClick 当成外部点击而关闭。 */}
          <PresentationTalktrackMount
            excalidrawAPI={excalidrawAPI}
            renderSidebar={(tabs) => (
              <CommentsMount
                excalidrawAPI={excalidrawAPI}
                sidebarExtras={tabs}
              />
            )}
          />
          <PresentationMode excalidrawAPI={excalidrawAPI} />

          <SceneEditLockBanner />
          <AppMainMenu
            onCollabDialogOpen={onCollabDialogOpen}
            isCollaborating={isCollaborating}
            isCollabEnabled={!isCollabDisabled}
            theme={appTheme}
            setTheme={(theme) => setAppTheme(theme)}
            refresh={() => forceRefresh((prev) => !prev)}
          />
          <AppWelcomeScreen
            onCollabDialogOpen={onCollabDialogOpen}
            isCollabEnabled={!isCollabDisabled}
          />
          <OverwriteConfirmDialog>
            <OverwriteConfirmDialog.Actions.ExportToImage />
            <OverwriteConfirmDialog.Actions.SaveToDisk />
            {excalidrawAPI && (
              <OverwriteConfirmDialog.Action
                title={t("overwriteConfirm.action.excalidrawPlus.title")}
                actionLabel={t("overwriteConfirm.action.excalidrawPlus.button")}
                onClick={() => {
                  exportToExcalidrawPlus(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                    excalidrawAPI.getName(),
                  );
                }}
              >
                {t("overwriteConfirm.action.excalidrawPlus.description")}
              </OverwriteConfirmDialog.Action>
            )}
          </OverwriteConfirmDialog>
          <AppFooter
            onChange={() => excalidrawAPI?.refresh()}
            excalidrawAPI={excalidrawAPI}
          />
          {excalidrawAPI && <AIComponents excalidrawAPI={excalidrawAPI} />}

          <TTDDialogTrigger />
          {isCollaborating && isOffline && (
            <div className="collab-offline-warning">
              {t("alerts.collabOfflineWarning")}
            </div>
          )}
          {latestShareableLink && (
            <ShareableLinkDialog
              link={latestShareableLink}
              onCloseRequest={() => setLatestShareableLink(null)}
              setErrorMessage={setErrorMessage}
            />
          )}
          {excalidrawAPI && !isCollabDisabled && (
            <Collab excalidrawAPI={excalidrawAPI} />
          )}

          {renameCanvasDialogState.isOpen && (
            <RenameCanvasDialog onCanvasRename={handleCanvasRename} />
          )}
          {!user && saveAsDialogState.isOpen && (
            <SaveAsDialog onCanvasSaveAs={handleCanvasSaveAs} />
          )}

          <ShareDialog
            collabAPI={collabAPI}
            onExportToBackend={async () => {
              if (excalidrawAPI) {
                try {
                  await onExportToBackend(
                    excalidrawAPI.getSceneElements(),
                    excalidrawAPI.getAppState(),
                    excalidrawAPI.getFiles(),
                  );
                } catch (error: any) {
                  setErrorMessage(error.message);
                }
              }
            }}
          />

          <MagicSettings {...magicSettings} />

          {errorMessage && (
            <ErrorDialog onClose={() => setErrorMessage("")}>
              {errorMessage}
            </ErrorDialog>
          )}

          <CommandPalette
            customCommandPaletteItems={[
              {
                label: t("labels.liveCollaboration"),
                category: DEFAULT_CATEGORIES.app,
                keywords: [
                  "team",
                  "multiplayer",
                  "share",
                  "public",
                  "session",
                  "invite",
                ],
                icon: usersIcon,
                perform: () => {
                  setShareDialogState({
                    isOpen: true,
                    type: "collaborationOnly",
                  });
                },
              },
              {
                label: t("roomDialog.button_stopSession"),
                category: DEFAULT_CATEGORIES.app,
                predicate: () => !!collabAPI?.isCollaborating(),
                keywords: [
                  "stop",
                  "session",
                  "end",
                  "leave",
                  "close",
                  "exit",
                  "collaboration",
                ],
                perform: () => {
                  if (collabAPI) {
                    collabAPI.stopCollaboration();
                    if (!collabAPI.isCollaborating()) {
                      setShareDialogState({ isOpen: false });
                    }
                  }
                },
              },
              {
                label: t("labels.share"),
                category: DEFAULT_CATEGORIES.app,
                predicate: true,
                icon: share,
                keywords: [
                  "link",
                  "shareable",
                  "readonly",
                  "export",
                  "publish",
                  "snapshot",
                  "url",
                  "collaborate",
                  "invite",
                ],
                perform: async () => {
                  setShareDialogState({ isOpen: true, type: "share" });
                },
              },
              {
                label: "GitHub",
                icon: GithubIcon,
                category: DEFAULT_CATEGORIES.links,
                predicate: true,
                keywords: [
                  "issues",
                  "bugs",
                  "requests",
                  "report",
                  "features",
                  "social",
                  "community",
                ],
                perform: () => {
                  window.open(
                    "https://github.com/excalidraw/excalidraw",
                    "_blank",
                    "noopener noreferrer",
                  );
                },
              },
              {
                label: t("labels.followUs"),
                icon: XBrandIcon,
                category: DEFAULT_CATEGORIES.links,
                predicate: true,
                keywords: ["twitter", "contact", "social", "community"],
                perform: () => {
                  window.open(
                    "https://x.com/excalidraw",
                    "_blank",
                    "noopener noreferrer",
                  );
                },
              },
              {
                label: t("labels.discordChat"),
                category: DEFAULT_CATEGORIES.links,
                predicate: true,
                icon: DiscordIcon,
                keywords: [
                  "chat",
                  "talk",
                  "contact",
                  "bugs",
                  "requests",
                  "report",
                  "feedback",
                  "suggestions",
                  "social",
                  "community",
                ],
                perform: () => {
                  window.open(
                    "https://discord.gg/UexuTaE",
                    "_blank",
                    "noopener noreferrer",
                  );
                },
              },
              {
                label: "YouTube",
                icon: youtubeIcon,
                category: DEFAULT_CATEGORIES.links,
                predicate: true,
                keywords: [
                  "features",
                  "tutorials",
                  "howto",
                  "help",
                  "community",
                ],
                perform: () => {
                  window.open(
                    "https://youtube.com/@excalidraw",
                    "_blank",
                    "noopener noreferrer",
                  );
                },
              },
              ...(isExcalidrawPlusSignedUser
                ? [
                    {
                      ...ExcalidrawPlusAppCommand,
                      label: "Sign in / Go to Excalidraw+",
                    },
                  ]
                : [ExcalidrawPlusCommand, ExcalidrawPlusAppCommand]),

              {
                label: t("overwriteConfirm.action.excalidrawPlus.button"),
                category: DEFAULT_CATEGORIES.export,
                icon: exportToPlus,
                predicate: true,
                keywords: ["plus", "export", "save", "backup"],
                perform: () => {
                  if (excalidrawAPI) {
                    exportToExcalidrawPlus(
                      excalidrawAPI.getSceneElements(),
                      excalidrawAPI.getAppState(),
                      excalidrawAPI.getFiles(),
                      excalidrawAPI.getName(),
                    );
                  }
                },
              },
              {
                label: t("labels.installPWA"),
                category: DEFAULT_CATEGORIES.app,
                predicate: () => !!pwaEvent,
                perform: () => {
                  if (pwaEvent) {
                    pwaEvent.prompt();
                    pwaEvent.userChoice.then(() => {
                      // event cannot be reused, but we'll hopefully
                      // grab new one as the event should be fired again
                      pwaEvent = null;
                    });
                  }
                },
              },
            ]}
          />
          {isVisualDebuggerEnabled() && excalidrawAPI && (
            <DebugCanvas
              appState={excalidrawAPI.getAppState()}
              scale={window.devicePixelRatio}
              ref={debugCanvasRef}
            />
          )}
        </Excalidraw>
      </div>
    </div>
  );
};

const ExcalidrawApp = () => {
  const isCloudExportWindow =
    window.location.pathname === "/excalidraw-plus-export";
  if (isCloudExportWindow) {
    return <ExcalidrawPlusIframeExport />;
  }

  return (
    <TopErrorBoundary>
      <Provider store={appJotaiStore}>
        <AuthProvider>
          <ExcalidrawWrapper />
          <Toaster position="bottom-right" />
        </AuthProvider>
      </Provider>
    </TopErrorBoundary>
  );
};

export default ExcalidrawApp;
