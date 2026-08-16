import {
  CaptureUpdateAction,
  getSceneVersion,
  restoreElements,
  zoomToFitBounds,
  reconcileElements,
} from "@excalidraw/excalidraw";
import { ErrorDialog } from "@excalidraw/excalidraw/components/ErrorDialog";
import { APP_NAME, cloneJSON, EVENT, toBrandedType } from "@excalidraw/common";
import {
  IDLE_THRESHOLD,
  ACTIVE_THRESHOLD,
  UserIdleState,
  assertNever,
  isDevEnv,
  isTestEnv,
  preventUnload,
  resolvablePromise,
  throttleRAF,
} from "@excalidraw/common";
import { decryptData } from "@excalidraw/excalidraw/data/encryption";
import { getVisibleSceneBounds } from "@excalidraw/element";
import { newElementWith } from "@excalidraw/element";
import { isImageElement, isInitializedImageElement } from "@excalidraw/element";
import { AbortError } from "@excalidraw/excalidraw/errors";
import { t } from "@excalidraw/excalidraw/i18n";
import { withBatchedUpdates } from "@excalidraw/excalidraw/reactUtils";

import throttle from "lodash.throttle";
import { PureComponent } from "react";

import type {
  ReconciledExcalidrawElement,
  RemoteExcalidrawElement,
} from "@excalidraw/excalidraw/data/reconcile";
import type { ImportedDataState } from "@excalidraw/excalidraw/data/types";
import type {
  ExcalidrawElement,
  FileId,
  InitializedExcalidrawImageElement,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";
import type {
  AppState,
  BinaryFiles,
  BinaryFileData,
  ExcalidrawImperativeAPI,
  SocketId,
  Collaborator,
  Gesture,
  UserToFollow,
} from "@excalidraw/excalidraw/types";
import type { Mutable, ValueOf } from "@excalidraw/common/utility-types";

import { appJotaiStore, atom } from "../app-jotai";
import {
  COLLAB_SNAPSHOT_SAVE_INTERVAL_MS,
  CURSOR_SYNC_TIMEOUT,
  FILE_UPLOAD_MAX_BYTES,
  FIREBASE_STORAGE_PREFIXES,
  INITIAL_SCENE_UPDATE_TIMEOUT,
  LOAD_IMAGES_TIMEOUT,
  WS_SUBTYPES,
  SYNC_FULL_SCENE_INTERVAL_MS,
  WS_EVENTS,
} from "../app_constants";
import {
  generateCollaborationLinkData,
  getCollaborationLink,
  getCollaborationLinkData,
  getSyncableElements,
} from "../data";
import {
  encodeFilesForUpload,
  FileManager,
  updateStaleImageStatuses,
} from "../data/FileManager";
import { FileStatusStore } from "../data/fileStatusStore";
import { LocalData } from "../data/LocalData";
import {
  isSavedToFirebase,
  loadFilesFromFirebase,
  loadFromFirebase,
  saveFilesToFirebase,
  saveToFirebase,
} from "../data/firebase";
import {
  importUsernameFromLocalStorage,
  saveUsernameToLocalStorage,
} from "../data/localStorage";
import { resetBrowserStateVersions } from "../data/tabSync";

import { collabErrorIndicatorAtom } from "./CollabError";
import Portal from "./Portal";

import type { Socket } from "socket.io-client";

import type {
  SocketUpdateDataSource,
  SyncableExcalidrawElement,
} from "../data";

export const collabAPIAtom = atom<CollabAPI | null>(null);
export const isCollaboratingAtom = atom(false);
export const isOfflineAtom = atom(false);
/** 协作 socket 就绪后写入，评论实时同步从这里取，避免 getSocket() 时组件不重渲染。 */
export const collabSocketAtom = atom<Socket | null>(null);

interface CollabState {
  errorMessage: string | null;
  /** errors related to saving */
  dialogNotifiedErrors: Record<string, boolean>;
  username: string;
  activeRoomLink: string | null;
}

export const activeRoomLinkAtom = atom<string | null>(null);
export const userToFollowAtom = atom<UserToFollow | null>(null);

type CollabInstance = InstanceType<typeof Collab>;

export interface CollabAPI {
  /** function so that we can access the latest value from stale callbacks */
  isCollaborating: () => boolean;
  getRoomId: () => string | null;
  /** 协作中只让房间内 socket id 最小的一侧写 SQLite，避免全员 5 秒整份 PUT。 */
  shouldPersistCanvas: () => boolean;
  onPointerUpdate: CollabInstance["onPointerUpdate"];
  startCollaboration: CollabInstance["startCollaboration"];
  stopCollaboration: CollabInstance["stopCollaboration"];
  saveCollaboration: CollabInstance["saveCollaboration"];
  replaceScene: CollabInstance["replaceScene"];
  syncElements: CollabInstance["syncElements"];
  fetchImageFilesFromFirebase: CollabInstance["fetchImageFilesFromFirebase"];
  setUsername: CollabInstance["setUsername"];
  getUsername: CollabInstance["getUsername"];
  getActiveRoomLink: CollabInstance["getActiveRoomLink"];
  setCollabError: CollabInstance["setErrorDialog"];
  setUserToFollow: CollabInstance["setUserToFollow"];
}

interface CollabProps {
  excalidrawAPI: ExcalidrawImperativeAPI;
}

type CollabInitialScene =
  | (ImportedDataState & { elements: readonly OrderedExcalidrawElement[] })
  | null;

type CollabSessionIdentity = {
  socket: Socket;
  roomId: string;
  roomKey: string;
  isAutoCollab: boolean;
  generation: number;
};

class Collab extends PureComponent<CollabProps, CollabState> {
  portal: Portal;
  fileManager: FileManager;
  excalidrawAPI: CollabProps["excalidrawAPI"];
  activeIntervalId: number | null;
  idleTimeoutId: number | null;

  private socketInitializationTimer?: number;
  private lastBroadcastedOrReceivedSceneVersion: number = -1;
  private isReplacingScene = false;
  /** 工作区 scene 自动协作：进房时保留当前画布，空房间用 SQLite 内容播种。 */
  private isAutoCollabJoin = false;
  /** 防止自动进房 effect / StrictMode 对同一房间并行 startCollaboration。 */
  private startCollabLock: Promise<void> | null = null;
  private collaborationGeneration = 0;
  /** 同一客户端串行保存快照，避免并发 CAS 写入互相制造冲突。 */
  private snapshotSaveChain: Promise<void> = Promise.resolve();
  private cancelPendingSceneInitialization: (() => void) | null = null;
  private collaborators = new Map<SocketId, Collaborator>();
  /** the socket ids of the users following the current user */
  private followedBy = new Set<SocketId>();

  constructor(props: CollabProps) {
    super(props);
    this.state = {
      errorMessage: null,
      dialogNotifiedErrors: {},
      username: importUsernameFromLocalStorage() || "",
      activeRoomLink: null,
    };
    this.portal = new Portal(this);
    this.fileManager = new FileManager({
      onFileStatusChange: FileStatusStore.updateStatuses.bind(FileStatusStore),
      getFiles: async (fileIds) => {
        const { roomId, roomKey } = this.portal;
        if (!roomId || !roomKey) {
          throw new AbortError();
        }

        return loadFilesFromFirebase(`files/rooms/${roomId}`, roomKey, fileIds);
      },
      saveFiles: async ({ addedFiles }) => {
        const { roomId, roomKey } = this.portal;
        if (!roomId || !roomKey) {
          throw new AbortError();
        }

        const { savedFiles, erroredFiles } = await saveFilesToFirebase({
          prefix: `${FIREBASE_STORAGE_PREFIXES.collabFiles}/${roomId}`,
          files: await encodeFilesForUpload({
            files: addedFiles,
            encryptionKey: roomKey,
            maxBytes: FILE_UPLOAD_MAX_BYTES,
          }),
        });

        return {
          savedFiles: savedFiles.reduce(
            (acc: Map<FileId, BinaryFileData>, id) => {
              const fileData = addedFiles.get(id);
              if (fileData) {
                acc.set(id, fileData);
              }
              return acc;
            },
            new Map(),
          ),
          erroredFiles: erroredFiles.reduce(
            (acc: Map<FileId, BinaryFileData>, id) => {
              const fileData = addedFiles.get(id);
              if (fileData) {
                acc.set(id, fileData);
              }
              return acc;
            },
            new Map(),
          ),
        };
      },
    });
    this.excalidrawAPI = props.excalidrawAPI;
    this.activeIntervalId = null;
    this.idleTimeoutId = null;
  }

  private onUmmount: (() => void) | null = null;

  componentDidMount() {
    window.addEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.addEventListener("online", this.onOfflineStatusToggle);
    window.addEventListener("offline", this.onOfflineStatusToggle);
    window.addEventListener(EVENT.UNLOAD, this.onUnload);

    const unsubOnUserFollow = this.excalidrawAPI.onUserFollow((payload) => {
      this.setUserToFollow(
        payload.action === "FOLLOW" ? payload.userToFollow : null,
      );
    });
    const throttledRelayUserViewportBounds = throttleRAF(
      this.relayVisibleSceneBounds,
    );
    const unsubOnScrollChange = this.excalidrawAPI.onScrollChange(() =>
      throttledRelayUserViewportBounds(),
    );
    this.onUmmount = () => {
      unsubOnUserFollow();
      unsubOnScrollChange();
    };

    this.onOfflineStatusToggle();

    const collabAPI: CollabAPI = {
      isCollaborating: this.isCollaborating,
      getRoomId: this.getRoomId,
      shouldPersistCanvas: this.shouldPersistCanvas,
      onPointerUpdate: this.onPointerUpdate,
      startCollaboration: this.startCollaboration,
      saveCollaboration: this.saveCollaboration,
      replaceScene: this.replaceScene,
      syncElements: this.syncElements,
      fetchImageFilesFromFirebase: this.fetchImageFilesFromFirebase,
      stopCollaboration: this.stopCollaboration,
      setUsername: this.setUsername,
      getUsername: this.getUsername,
      getActiveRoomLink: this.getActiveRoomLink,
      setCollabError: this.setErrorDialog,
      setUserToFollow: this.setUserToFollow,
    };

    appJotaiStore.set(collabAPIAtom, collabAPI);

    if (isTestEnv() || isDevEnv()) {
      window.collab = window.collab || ({} as Window["collab"]);
      Object.defineProperties(window, {
        collab: {
          configurable: true,
          value: this,
        },
      });
    }
  }

  onOfflineStatusToggle = () => {
    appJotaiStore.set(isOfflineAtom, !window.navigator.onLine);
  };

  componentWillUnmount() {
    window.removeEventListener("online", this.onOfflineStatusToggle);
    window.removeEventListener("offline", this.onOfflineStatusToggle);
    window.removeEventListener(EVENT.BEFORE_UNLOAD, this.beforeUnload);
    window.removeEventListener(EVENT.UNLOAD, this.onUnload);
    window.removeEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    window.removeEventListener(
      EVENT.VISIBILITY_CHANGE,
      this.onVisibilityChange,
    );
    if (this.activeIntervalId) {
      window.clearInterval(this.activeIntervalId);
      this.activeIntervalId = null;
    }
    if (this.idleTimeoutId) {
      window.clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }
    if (this.socketInitializationTimer) {
      window.clearTimeout(this.socketInitializationTimer);
      this.socketInitializationTimer = undefined;
    }
    this.queueBroadcastAllElements.cancel();
    this.queueSaveToFirebase.cancel();
    this.loadImageFiles.cancel();
    this.destroySocketClient();
    this.onUmmount?.();
  }

  isCollaborating = () => appJotaiStore.get(isCollaboratingAtom)!;

  getRoomId = () => this.portal.roomId;

  private setIsCollaborating = (isCollaborating: boolean) => {
    appJotaiStore.set(isCollaboratingAtom, isCollaborating);
  };

  private captureCollabSession = (): CollabSessionIdentity | null => {
    const { socket, roomId, roomKey } = this.portal;
    if (!socket || !roomId || !roomKey) {
      return null;
    }
    return {
      socket,
      roomId,
      roomKey,
      isAutoCollab: this.isAutoCollabJoin,
      generation: this.collaborationGeneration,
    };
  };

  private isCollabSessionCurrent = (session: CollabSessionIdentity) => {
    if (
      session.generation !== this.collaborationGeneration ||
      this.portal.socket !== session.socket ||
      this.portal.roomId !== session.roomId ||
      this.portal.roomKey !== session.roomKey
    ) {
      return false;
    }
    if (session.isAutoCollab) {
      return true;
    }
    const currentLink = getCollaborationLinkData(window.location.href);
    return (
      currentLink?.roomId === session.roomId &&
      currentLink.roomKey === session.roomKey
    );
  };

  private onUnload = () => {
    this.destroySocketClient({ isUnload: true });
  };

  private beforeUnload = withBatchedUpdates((event: BeforeUnloadEvent) => {
    const syncableElements = getSyncableElements(
      this.getSceneElementsIncludingDeleted(),
    );

    if (
      this.isCollaborating() &&
      (this.fileManager.shouldPreventUnload(syncableElements) ||
        (!this.isAutoCollabJoin &&
          !isSavedToFirebase(this.portal, syncableElements)))
    ) {
      // this won't run in time if user decides to leave the site, but
      //  the purpose is to run in immediately after user decides to stay
      this.saveCollabRoomToFirebase(syncableElements);

      if (import.meta.env.VITE_APP_DISABLE_PREVENT_UNLOAD !== "true") {
        preventUnload(event);
      } else {
        console.warn(
          "preventing unload disabled (VITE_APP_DISABLE_PREVENT_UNLOAD)",
        );
      }
    }
  });

  saveCollabRoomToFirebase = (
    syncableElements: readonly SyncableExcalidrawElement[],
    opts?: { replace?: boolean },
  ) => {
    const session = this.captureCollabSession();
    if (!session) {
      return Promise.resolve();
    }
    // Workspace Scene 的唯一持久化事实源是带 ACL/锁校验的 SQLite API。
    // Firebase 兼容层只保留给官方匿名随机房间，避免确定性 roomKey 变成旁路。
    if (session.isAutoCollab) {
      return Promise.resolve();
    }
    const elementsSnapshot = cloneJSON(syncableElements);
    const appStateSnapshot = this.excalidrawAPI.getAppState();
    const persistSnapshot = async () => {
      if (!this.isCollabSessionCurrent(session)) {
        return;
      }
      try {
        // 持久化只写加密快照。CAS 合并结果不能反向更新实时画布，
        // 实时状态只能来自 Socket 消息或首次快照恢复。
        await saveToFirebase(
          this.portal,
          elementsSnapshot,
          appStateSnapshot,
          opts,
        );

        if (this.isCollabSessionCurrent(session)) {
          this.resetErrorIndicator();
        }
      } catch (error: any) {
        if (!this.isCollabSessionCurrent(session)) {
          return;
        }
        const errorMessage = /is longer than.*?bytes/.test(error.message)
          ? t("errors.collabSaveFailed_sizeExceeded")
          : t("errors.collabSaveFailed");

        if (
          !this.state.dialogNotifiedErrors[errorMessage] ||
          !this.isCollaborating()
        ) {
          this.setErrorDialog(errorMessage);
          this.setState({
            dialogNotifiedErrors: {
              ...this.state.dialogNotifiedErrors,
              [errorMessage]: true,
            },
          });
        }

        if (this.isCollaborating()) {
          this.setErrorIndicator(errorMessage);
        }

        console.error(error);
      }
    };

    const save = this.snapshotSaveChain.then(persistSnapshot);
    this.snapshotSaveChain = save;
    return save;
  };

  saveCollaboration = async () => {
    await this.saveCollabRoomToFirebase(
      getSyncableElements(
        this.excalidrawAPI.getSceneElementsIncludingDeleted(),
      ),
    );
  };

  replaceScene = async ({
    elements,
    appState,
    files,
  }: {
    elements: NonNullable<ImportedDataState["elements"]>;
    appState: Omit<AppState, "width" | "height" | "offsetTop" | "offsetLeft">;
    files: BinaryFiles;
  }) => {
    const session = this.captureCollabSession();
    this.queueBroadcastAllElements.cancel();
    this.queueSaveToFirebase.cancel();
    this.loadImageFiles.cancel();
    this.portal.queueFileUpload.cancel();
    this.fileManager.reset();

    this.isReplacingScene = true;
    try {
      this.excalidrawAPI.resetScene();
      this.excalidrawAPI.addFiles(Object.values(files));
      this.excalidrawAPI.updateScene({
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    } finally {
      this.isReplacingScene = false;
    }

    const replacementElements =
      this.excalidrawAPI.getSceneElementsIncludingDeleted();
    this.portal.broadcastedElementVersions = new Map();
    this.setLastBroadcastedOrReceivedSceneVersion(
      getSceneVersion(replacementElements),
    );

    const syncableReplacementElements =
      getSyncableElements(replacementElements);
    const didBroadcast = await this.portal.broadcastScene(
      WS_SUBTYPES.INIT,
      syncableReplacementElements,
      true,
      { replace: true },
    );
    if (!session || !didBroadcast || !this.isCollabSessionCurrent(session)) {
      return;
    }
    await this.saveCollabRoomToFirebase(syncableReplacementElements, {
      replace: true,
    });
  };

  stopCollaboration = (keepRemoteState = true) => {
    this.queueBroadcastAllElements.cancel();
    this.queueSaveToFirebase.cancel();
    this.loadImageFiles.cancel();
    this.resetErrorIndicator(true);

    this.saveCollabRoomToFirebase(
      getSyncableElements(
        this.excalidrawAPI.getSceneElementsIncludingDeleted(),
      ),
    );

    if (this.portal.socket && this.fallbackInitializationHandler) {
      this.portal.socket.off(
        "connect_error",
        this.fallbackInitializationHandler,
      );
    }

    if (!keepRemoteState) {
      LocalData.fileStorage.reset();
      this.destroySocketClient();
    } else if (window.confirm(t("alerts.collabStopOverridePrompt"))) {
      // hack to ensure that we prefer we disregard any new browser state
      // that could have been saved in other tabs while we were collaborating
      resetBrowserStateVersions();

      window.history.pushState({}, APP_NAME, window.location.origin);
      this.destroySocketClient();

      LocalData.fileStorage.reset();

      const elements = this.excalidrawAPI
        .getSceneElementsIncludingDeleted()
        .map((element) => {
          if (isImageElement(element) && element.status === "saved") {
            return newElementWith(element, { status: "pending" });
          }
          return element;
        });

      this.excalidrawAPI.updateScene({
        elements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  };

  private destroySocketClient = (opts?: { isUnload: boolean }) => {
    this.collaborationGeneration++;
    this.cancelPendingSceneInitialization?.();
    this.cancelPendingSceneInitialization = null;
    if (this.socketInitializationTimer) {
      window.clearTimeout(this.socketInitializationTimer);
      this.socketInitializationTimer = undefined;
    }
    if (this.portal.socket && this.fallbackInitializationHandler) {
      this.portal.socket.off(
        "connect_error",
        this.fallbackInitializationHandler,
      );
    }
    this.fallbackInitializationHandler = null;
    this.lastBroadcastedOrReceivedSceneVersion = -1;
    appJotaiStore.set(collabSocketAtom, null);
    this.portal.close();
    this.isAutoCollabJoin = false;
    this.fileManager.reset();
    this.followedBy = new Set();
    if (!opts?.isUnload) {
      this.setIsCollaborating(false);
      this.setActiveRoomLink(null);
      appJotaiStore.set(userToFollowAtom, null);
      this.collaborators = new Map();
      this.excalidrawAPI.updateScene({
        collaborators: this.collaborators,
      });
      LocalData.resumeSave("collaboration");
    }
  };

  private fetchImageFilesFromFirebase = async (opts: {
    elements: readonly ExcalidrawElement[];
    /**
     * Indicates whether to fetch files that are errored or pending and older
     * than 10 seconds.
     *
     * Use this as a mechanism to fetch files which may be ok but for some
     * reason their status was not updated correctly.
     */
    forceFetchFiles?: boolean;
  }) => {
    const unfetchedImages = opts.elements
      .filter((element) => {
        return (
          isInitializedImageElement(element) &&
          !this.fileManager.isFileTracked(element.fileId) &&
          !element.isDeleted &&
          (opts.forceFetchFiles
            ? element.status !== "pending" ||
              Date.now() - element.updated > 10000
            : element.status === "saved")
        );
      })
      .map((element) => (element as InitializedExcalidrawImageElement).fileId);

    return await this.fileManager.getFiles(unfetchedImages);
  };

  private decryptPayload = async (
    iv: Uint8Array<ArrayBuffer>,
    encryptedData: ArrayBuffer,
    decryptionKey: string,
  ): Promise<ValueOf<SocketUpdateDataSource>> => {
    try {
      const decrypted = await decryptData(iv, encryptedData, decryptionKey);

      const decodedData = new TextDecoder("utf-8").decode(
        new Uint8Array(decrypted),
      );
      return JSON.parse(decodedData);
    } catch (error) {
      window.alert(t("alerts.decryptFailed"));
      console.error(error);
      return {
        type: WS_SUBTYPES.INVALID_RESPONSE,
      };
    }
  };

  private fallbackInitializationHandler: null | (() => any) = null;

  startCollaboration = async (
    existingRoomLinkData: null | {
      roomId: string;
      roomKey: string;
      isAutoCollab?: boolean;
    },
  ) => {
    if (!this.state.username) {
      import("@excalidraw/random-username").then(({ getRandomUsername }) => {
        const username = getRandomUsername();
        this.setUsername(username);
      });
    }

    if (
      this.portal.socket &&
      existingRoomLinkData &&
      this.portal.roomId === existingRoomLinkData.roomId
    ) {
      return null;
    }

    if (this.startCollabLock) {
      if (
        existingRoomLinkData &&
        this.portal.roomId &&
        this.portal.roomId !== existingRoomLinkData.roomId
      ) {
        this.destroySocketClient();
      }
      await this.startCollabLock;
      if (
        this.portal.socket &&
        existingRoomLinkData &&
        this.portal.roomId === existingRoomLinkData.roomId
      ) {
        return null;
      }
    }

    let releaseStartLock = () => {};
    this.startCollabLock = new Promise<void>((resolve) => {
      releaseStartLock = resolve;
    });

    try {
      if (this.portal.socket) {
        this.queueBroadcastAllElements.cancel();
        this.queueSaveToFirebase.cancel();
        this.loadImageFiles.cancel();
        this.destroySocketClient();
      }
      const isAutoCollab = Boolean(existingRoomLinkData?.isAutoCollab);
      this.isAutoCollabJoin = isAutoCollab;
      const generation = ++this.collaborationGeneration;
      return await this.openCollaborationSocket(
        existingRoomLinkData,
        isAutoCollab,
        generation,
      );
    } finally {
      releaseStartLock();
      this.startCollabLock = null;
    }
  };

  private openCollaborationSocket = async (
    existingRoomLinkData: null | {
      roomId: string;
      roomKey: string;
      isAutoCollab?: boolean;
    },
    isAutoCollab: boolean,
    generation: number,
  ) => {
    let roomId;
    let roomKey;

    if (existingRoomLinkData) {
      ({ roomId, roomKey } = existingRoomLinkData);
    } else {
      ({ roomId, roomKey } = await generateCollaborationLinkData());
      if (generation !== this.collaborationGeneration) {
        return null;
      }
      window.history.pushState(
        {},
        APP_NAME,
        getCollaborationLink({ roomId, roomKey }),
      );
    }

    // TODO: `ImportedDataState` type here seems abused
    const scenePromise = resolvablePromise<CollabInitialScene>();
    const resolveScene = (scene: CollabInitialScene) => {
      scenePromise.resolve(scene);
      if (
        this.cancelPendingSceneInitialization ===
        cancelPendingSceneInitialization
      ) {
        this.cancelPendingSceneInitialization = null;
      }
    };
    const cancelPendingSceneInitialization = () => resolveScene(null);
    this.cancelPendingSceneInitialization = cancelPendingSceneInitialization;

    this.setIsCollaborating(true);
    LocalData.pauseSave("collaboration");

    const { default: socketIOClient } = await import(
      /* webpackChunkName: "socketIoClient" */ "socket.io-client"
    );

    if (generation !== this.collaborationGeneration) {
      resolveScene(null);
      return scenePromise;
    }

    let session: CollabSessionIdentity | null = null;
    const fallbackInitializationHandler = () => {
      if (!session || !this.isCollabSessionCurrent(session)) {
        resolveScene(null);
        return;
      }
      this.initializeRoom({
        roomLinkData: existingRoomLinkData,
        fetchScene: true,
        session,
      }).then((scene) => {
        resolveScene(scene);
      });
    };
    this.fallbackInitializationHandler = fallbackInitializationHandler;

    try {
      const collabSocket = socketIOClient(
        import.meta.env.VITE_APP_WS_SERVER_URL,
        {
          transports: ["websocket", "polling"],
          autoConnect: false,
          auth: {
            token: localStorage.getItem("token") || undefined,
          },
          // 与 Go setupSocketIO 的 5MB 对齐；线框图至代码 HTML 进 customData 后
          // 单帧可能超过客户端默认。socket.io-client 4.7 类型未暴露该字段。
          maxHttpBufferSize: 5_000_000,
        } as Parameters<typeof socketIOClient>[1],
      );
      this.portal.socket = this.portal.open(collabSocket, roomId, roomKey);
      session = {
        socket: collabSocket,
        roomId,
        roomKey,
        isAutoCollab,
        generation,
      };
      appJotaiStore.set(collabSocketAtom, this.portal.socket);
      this.portal.socket.once("connect_error", fallbackInitializationHandler);
      this.portal.socket.once("room-error", (message: string) => {
        if (!session || !this.isCollabSessionCurrent(session)) {
          return;
        }
        this.setErrorDialog(message || t("errors.collabSaveFailed"));
        resolveScene(null);
        this.destroySocketClient();
      });
    } catch (error: any) {
      resolveScene(null);
      if (generation !== this.collaborationGeneration) {
        return scenePromise;
      }
      console.error(error);
      this.setErrorDialog(error.message);
      return null;
    }

    if (existingRoomLinkData) {
      // 官方 #room= 进房会清空当前画布再拉 Firebase。
      // 工作区 scene 自动协作必须保留已从 SQLite 载入的内容，空房间再用它播种。
      if (!isAutoCollab) {
        this.excalidrawAPI.resetScene();
      }
    } else {
      const elements = this.excalidrawAPI.getSceneElements().map((element) => {
        if (isImageElement(element) && element.status === "saved") {
          return newElementWith(element, { status: "pending" });
        }
        return element;
      });
      // remove deleted elements from elements array to ensure we don't
      // expose potentially sensitive user data in case user manually deletes
      // existing elements (or clears scene), which would otherwise be persisted
      // to database even if deleted before creating the room.
      this.excalidrawAPI.updateScene({
        elements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      this.saveCollabRoomToFirebase(getSyncableElements(elements));
    }

    // fallback in case you're not alone in the room but still don't receive
    // initial SCENE_INIT message
    this.socketInitializationTimer = window.setTimeout(
      fallbackInitializationHandler,
      INITIAL_SCENE_UPDATE_TIMEOUT,
    );

    // All socket listeners are moving to Portal
    this.portal.socket.on(
      "client-broadcast",
      async (encryptedData: ArrayBuffer, iv: Uint8Array<ArrayBuffer>) => {
        if (!session || !this.isCollabSessionCurrent(session)) {
          return;
        }

        const decryptedData = await this.decryptPayload(
          iv,
          encryptedData,
          session.roomKey,
        );

        if (!this.isCollabSessionCurrent(session)) {
          return;
        }

        switch (decryptedData.type) {
          case WS_SUBTYPES.INVALID_RESPONSE:
            return;
          case WS_SUBTYPES.INIT: {
            const remoteElements = toBrandedType<
              readonly RemoteExcalidrawElement[]
            >(decryptedData.payload.elements);

            if (!this.portal.snapshotInitialized) {
              this.initializeRoom({ fetchScene: false, session });
              const reconciledElements =
                this._reconcileElements(remoteElements);
              this.handleRemoteSceneUpdate(reconciledElements);
              // noop if already resolved via init from firebase
              resolveScene({
                elements: reconciledElements,
                scrollToContent: true,
              });
            } else if (decryptedData.payload.replace) {
              this.handleRemoteSceneReplace(remoteElements);
            }
            break;
          }
          case WS_SUBTYPES.UPDATE:
            this.handleRemoteSceneUpdate(
              this._reconcileElements(
                toBrandedType<readonly RemoteExcalidrawElement[]>(
                  decryptedData.payload.elements,
                ),
              ),
            );
            break;
          case WS_SUBTYPES.MOUSE_LOCATION: {
            const { pointer, button, username, selectedElementIds } =
              decryptedData.payload;

            const socketId: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["socketId"] =
              decryptedData.payload.socketId ||
              // @ts-ignore legacy, see #2094 (#2097)
              decryptedData.payload.socketID;

            this.updateCollaborator(socketId, {
              pointer,
              button,
              selectedElementIds,
              username,
            });

            break;
          }

          case WS_SUBTYPES.USER_VISIBLE_SCENE_BOUNDS: {
            const { sceneBounds, socketId } = decryptedData.payload;

            const userToFollow = appJotaiStore.get(userToFollowAtom);

            // we're not following the user
            // (shouldn't happen, but could be late message or bug upstream)
            if (userToFollow?.socketId !== socketId) {
              console.warn(
                `receiving remote client's (from ${socketId}) viewport bounds even though we're not subscribed to it!`,
              );
              return;
            }

            // cross-follow case, ignore updates in this case
            if (this.followedBy.has(userToFollow.socketId)) {
              return;
            }

            const appState = this.excalidrawAPI.getAppState();

            this.excalidrawAPI.updateScene({
              appState: zoomToFitBounds({
                appState,
                bounds: sceneBounds,
                fit: "contain",
              }).appState,
            });

            break;
          }

          case WS_SUBTYPES.IDLE_STATUS: {
            const { userState, socketId, username } = decryptedData.payload;
            this.updateCollaborator(socketId, {
              userState,
              username,
            });
            break;
          }

          default: {
            assertNever(decryptedData, null);
          }
        }
      },
    );

    this.portal.socket.on("first-in-room", async () => {
      if (!session || !this.isCollabSessionCurrent(session)) {
        resolveScene(null);
        return;
      }
      if (this.portal.socket) {
        this.portal.socket.off("first-in-room");
      }
      const sceneData = await this.initializeRoom({
        fetchScene: true,
        roomLinkData: existingRoomLinkData,
        session,
      });
      resolveScene(sceneData);
    });

    this.portal.socket.on(
      WS_EVENTS.USER_FOLLOW_ROOM_CHANGE,
      (followedBy: SocketId[]) => {
        this.followedBy = new Set(followedBy);

        this.relayVisibleSceneBounds({ force: true });
      },
    );

    this.initializeIdleDetector();

    if (session && this.isCollabSessionCurrent(session)) {
      this.setActiveRoomLink(window.location.href);
    }

    if (!session || !this.isCollabSessionCurrent(session)) {
      resolveScene(null);
      return scenePromise;
    }

    try {
      // 必须在 client-broadcast、first-in-room 等初始化监听器全部注册后连接。
      // 本地服务连接很快，提前 connect 会丢失旧成员立即返回的 INIT，随后
      // 超时回退到旧快照并把过期内容重新广播给在线成员。
      session.socket.connect();
    } catch (error: any) {
      resolveScene(null);
      if (generation !== this.collaborationGeneration) {
        return scenePromise;
      }
      console.error(error);
      this.setErrorDialog(error.message);
      return null;
    }

    return scenePromise;
  };

  private initializeRoom = async ({
    fetchScene,
    roomLinkData,
    session,
  }:
    | {
        fetchScene: true;
        roomLinkData: { roomId: string; roomKey: string } | null;
        session: CollabSessionIdentity;
      }
    | {
        fetchScene: false;
        roomLinkData?: null;
        session: CollabSessionIdentity;
      }) => {
    if (!this.isCollabSessionCurrent(session)) {
      return null;
    }
    clearTimeout(this.socketInitializationTimer!);
    if (this.portal.socket && this.fallbackInitializationHandler) {
      this.portal.socket.off(
        "connect_error",
        this.fallbackInitializationHandler,
      );
    }
    if (fetchScene && roomLinkData) {
      const keepScene = session.isAutoCollab;
      if (keepScene) {
        // 工作区自动协作：画布已从 SQLite 载入。立刻允许 WS 广播，
        // 不要等 Firebase getDoc/transaction（失败或挂起时对方只能刷新才能看到）。
        this.portal.snapshotInitialized = true;
        void this.portal.broadcastScene(
          WS_SUBTYPES.UPDATE,
          this.excalidrawAPI.getSceneElementsIncludingDeleted(),
          true,
        );
        return null;
      }
      this.excalidrawAPI.resetScene();

      try {
        const elements = await loadFromFirebase(
          roomLinkData.roomId,
          roomLinkData.roomKey,
          session.socket,
        );
        if (!this.isCollabSessionCurrent(session)) {
          return null;
        }
        if (elements && elements.length > 0) {
          this.setLastBroadcastedOrReceivedSceneVersion(
            getSceneVersion(elements),
          );

          return {
            elements,
            scrollToContent: true,
          };
        }
      } catch (error: any) {
        if (!this.isCollabSessionCurrent(session)) {
          return null;
        }
        // log the error and move on. other peers will sync us the scene.
        console.error(error);
      } finally {
        if (this.isCollabSessionCurrent(session)) {
          this.portal.snapshotInitialized = true;
        }
      }
    } else if (this.isCollabSessionCurrent(session)) {
      this.portal.snapshotInitialized = true;
    }
    return null;
  };

  private _reconcileElements = (
    remoteElements: readonly RemoteExcalidrawElement[],
  ): ReconciledExcalidrawElement[] => {
    const appState = this.excalidrawAPI.getAppState();

    const existingElements = this.getSceneElementsIncludingDeleted();

    // NOTE ideally we restore _after_ reconciliation but we can't do that
    // as we'd regenerate even elements such as appState.newElement which would
    // break the state
    remoteElements = restoreElements(remoteElements, existingElements);

    const reconciledElements = reconcileElements(
      existingElements,
      remoteElements,
      appState,
    );

    // Avoid broadcasting to the rest of the collaborators the scene
    // we just received!
    // Note: this needs to be set before updating the scene as it
    // synchronously calls render.
    this.setLastBroadcastedOrReceivedSceneVersion(
      getSceneVersion(reconciledElements),
    );

    return reconciledElements;
  };

  private loadImageFiles = throttle(async () => {
    const session = this.captureCollabSession();
    if (!session) {
      return;
    }
    const { loadedFiles, erroredFiles } =
      await this.fetchImageFilesFromFirebase({
        elements: this.excalidrawAPI.getSceneElementsIncludingDeleted(),
      });

    if (!this.isCollabSessionCurrent(session)) {
      return;
    }

    this.excalidrawAPI.addFiles(loadedFiles);

    updateStaleImageStatuses({
      excalidrawAPI: this.excalidrawAPI,
      erroredFiles,
      elements: this.excalidrawAPI.getSceneElementsIncludingDeleted(),
    });
  }, LOAD_IMAGES_TIMEOUT);

  private handleRemoteSceneUpdate = (
    elements: ReconciledExcalidrawElement[],
  ) => {
    this.excalidrawAPI.updateScene({
      elements,
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    this.loadImageFiles();
  };

  private handleRemoteSceneReplace = (
    remoteElements: readonly RemoteExcalidrawElement[],
  ) => {
    const elements = restoreElements(remoteElements, null, {
      repairBindings: true,
    });

    this.queueBroadcastAllElements.cancel();
    this.queueSaveToFirebase.cancel();
    this.loadImageFiles.cancel();
    this.portal.queueFileUpload.cancel();
    this.portal.broadcastedElementVersions = new Map();
    this.fileManager.reset();
    this.setLastBroadcastedOrReceivedSceneVersion(getSceneVersion(elements));

    this.isReplacingScene = true;
    try {
      this.excalidrawAPI.resetScene();
      this.excalidrawAPI.updateScene({
        elements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    } finally {
      this.isReplacingScene = false;
    }

    this.loadImageFiles();
  };

  private onPointerMove = () => {
    if (this.idleTimeoutId) {
      window.clearTimeout(this.idleTimeoutId);
      this.idleTimeoutId = null;
    }

    this.idleTimeoutId = window.setTimeout(this.reportIdle, IDLE_THRESHOLD);

    if (!this.activeIntervalId) {
      this.activeIntervalId = window.setInterval(
        this.reportActive,
        ACTIVE_THRESHOLD,
      );
    }
  };

  private onVisibilityChange = () => {
    if (document.hidden) {
      // 浏览器进入后台前提交最近一次尾随保存，减少刷新或休眠造成的数据窗口。
      this.queueSaveToFirebase.flush();
      if (this.idleTimeoutId) {
        window.clearTimeout(this.idleTimeoutId);
        this.idleTimeoutId = null;
      }
      if (this.activeIntervalId) {
        window.clearInterval(this.activeIntervalId);
        this.activeIntervalId = null;
      }
      this.onIdleStateChange(UserIdleState.AWAY);
    } else {
      this.idleTimeoutId = window.setTimeout(this.reportIdle, IDLE_THRESHOLD);
      this.activeIntervalId = window.setInterval(
        this.reportActive,
        ACTIVE_THRESHOLD,
      );
      this.onIdleStateChange(UserIdleState.ACTIVE);
    }
  };

  private reportIdle = () => {
    this.onIdleStateChange(UserIdleState.IDLE);
    if (this.activeIntervalId) {
      window.clearInterval(this.activeIntervalId);
      this.activeIntervalId = null;
    }
  };

  private reportActive = () => {
    this.onIdleStateChange(UserIdleState.ACTIVE);
  };

  private initializeIdleDetector = () => {
    document.addEventListener(EVENT.POINTER_MOVE, this.onPointerMove);
    document.addEventListener(EVENT.VISIBILITY_CHANGE, this.onVisibilityChange);
  };

  setCollaborators(sockets: SocketId[]) {
    const collaborators: InstanceType<typeof Collab>["collaborators"] =
      new Map();
    for (const socketId of sockets) {
      const isCurrentUser = socketId === this.portal.socket?.id;
      collaborators.set(
        socketId,
        Object.assign(
          // we never receive our own broadcasts, so we need to seed
          // our own collaborator entry with the local username
          isCurrentUser ? { username: this.state.username } : {},
          this.collaborators.get(socketId),
          { isCurrentUser },
        ),
      );
    }
    this.collaborators = collaborators;
    this.excalidrawAPI.updateScene({ collaborators });

    // unfollow if the followed user left the room
    const userToFollow = appJotaiStore.get(userToFollowAtom);
    if (userToFollow && !collaborators.has(userToFollow.socketId)) {
      this.setUserToFollow(null);
    }
  }

  updateCollaborator = (socketId: SocketId, updates: Partial<Collaborator>) => {
    const isCurrentUser = socketId === this.portal.socket?.id;
    const collaborators = new Map(this.collaborators);
    const user: Mutable<Collaborator> = Object.assign(
      // we never receive our own broadcasts, so we need to seed
      // our own collaborator entry with the local username
      isCurrentUser ? { username: this.state.username } : {},
      collaborators.get(socketId),
      updates,
      { isCurrentUser },
    );
    collaborators.set(socketId, user);
    this.collaborators = collaborators;

    this.excalidrawAPI.updateScene({
      collaborators,
    });
  };

  public setLastBroadcastedOrReceivedSceneVersion = (version: number) => {
    this.lastBroadcastedOrReceivedSceneVersion = version;
  };

  public getLastBroadcastedOrReceivedSceneVersion = () => {
    return this.lastBroadcastedOrReceivedSceneVersion;
  };

  public getSceneElementsIncludingDeleted = () => {
    return this.excalidrawAPI.getSceneElementsIncludingDeleted();
  };

  onPointerUpdate = throttle(
    (payload: {
      pointer: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointer"];
      button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
      pointersMap: Gesture["pointers"];
    }) => {
      payload.pointersMap.size < 2 &&
        this.portal.socket &&
        this.portal.broadcastMouseLocation(payload);
    },
    CURSOR_SYNC_TIMEOUT,
  );

  relayVisibleSceneBounds = (props?: { force: boolean }) => {
    if (this.portal.socket && (this.followedBy.size > 0 || props?.force)) {
      this.portal.broadcastVisibleSceneBounds(
        {
          sceneBounds: getVisibleSceneBounds(this.excalidrawAPI.getAppState()),
        },
        `follow@${this.portal.socket.id}`,
      );
    }
  };

  onIdleStateChange = (userState: UserIdleState) => {
    this.portal.broadcastIdleChange(userState);
  };

  shouldPersistCanvas = () => {
    if (!this.isCollaborating()) {
      return true;
    }
    // 自动协作刚连上时，socket 已存在但房间成员列表尚未到达。此时每个客户端
    // 都把自己误判为唯一持久化者，会并发排队整份 SQLite PUT。
    if (!this.portal.snapshotInitialized || !this.portal.socket?.id) {
      return false;
    }
    const ids = Array.from(this.collaborators.keys()).sort();
    const mine = this.portal.socket?.id;
    if (!mine || !ids.includes(mine as SocketId)) {
      return false;
    }
    return ids[0] === mine;
  };

  private hasRemoteCollaborators = () => {
    for (const collaborator of this.collaborators.values()) {
      if (!collaborator.isCurrentUser) {
        return true;
      }
    }
    return false;
  };

  broadcastElements = (elements: readonly OrderedExcalidrawElement[]) => {
    if (!this.hasRemoteCollaborators()) {
      const version = getSceneVersion(elements);
      if (version > this.getLastBroadcastedOrReceivedSceneVersion()) {
        this.lastBroadcastedOrReceivedSceneVersion = version;
      }
      return;
    }

    if (!this.portal.isOpen()) {
      return;
    }

    if (
      getSceneVersion(elements) >
      this.getLastBroadcastedOrReceivedSceneVersion()
    ) {
      this.portal.broadcastScene(WS_SUBTYPES.UPDATE, elements, false);
      this.lastBroadcastedOrReceivedSceneVersion = getSceneVersion(elements);
    }

    // 增量可能丢包；节流全量补发。这里不能 cancel，否则连续拖拽会让
    // 每一帧都同时发送增量和完整场景，接收端会因解密与重绘积压而延迟。
    this.queueBroadcastAllElements();
  };

  syncElements = (elements: readonly OrderedExcalidrawElement[]) => {
    if (this.isReplacingScene) {
      return;
    }
    this.broadcastElements(elements);
    this.queueSaveToFirebase();
  };

  queueBroadcastAllElements = throttle(() => {
    if (!this.hasRemoteCollaborators()) {
      return;
    }
    this.portal.broadcastScene(
      WS_SUBTYPES.UPDATE,
      this.excalidrawAPI.getSceneElementsIncludingDeleted(),
      true,
    );
    const currentVersion = this.getLastBroadcastedOrReceivedSceneVersion();
    const newVersion = Math.max(
      currentVersion,
      getSceneVersion(this.getSceneElementsIncludingDeleted()),
    );
    this.setLastBroadcastedOrReceivedSceneVersion(newVersion);
  }, SYNC_FULL_SCENE_INTERVAL_MS);

  queueSaveToFirebase = throttle(
    () => {
      if (this.portal.snapshotInitialized) {
        this.saveCollabRoomToFirebase(
          getSyncableElements(
            this.excalidrawAPI.getSceneElementsIncludingDeleted(),
          ),
        );
      }
    },
    COLLAB_SNAPSHOT_SAVE_INTERVAL_MS,
    { leading: false },
  );

  setUserToFollow = (userToFollow: UserToFollow | null) => {
    const prev = appJotaiStore.get(userToFollowAtom) ?? null;

    if (prev?.socketId !== userToFollow?.socketId && this.portal.socket) {
      // leave the previous user's follow room before joining the next one
      if (prev) {
        this.portal.broadcastUserFollowed({
          userToFollow: prev,
          action: "UNFOLLOW",
        });
      }
      if (userToFollow) {
        this.portal.broadcastUserFollowed({
          userToFollow,
          action: "FOLLOW",
        });
      }
    }

    appJotaiStore.set(userToFollowAtom, userToFollow);
  };

  setUsername = (username: string) => {
    this.setState({ username });
    saveUsernameToLocalStorage(username);

    // keep our own collaborator entry in sync
    const socketId = this.portal.socket?.id as SocketId | undefined;
    if (socketId && this.collaborators.has(socketId)) {
      this.updateCollaborator(socketId, { username });
    }
    // 随机用户名可能在入房后才生成，立即通知远端，避免成员一直显示为匿名空项。
    void this.portal.broadcastIdleChange(UserIdleState.ACTIVE, username);
  };

  getUsername = () => this.state.username;

  setActiveRoomLink = (activeRoomLink: string | null) => {
    this.setState({ activeRoomLink });
    appJotaiStore.set(activeRoomLinkAtom, activeRoomLink);
  };

  getActiveRoomLink = () => this.state.activeRoomLink;

  setErrorIndicator = (errorMessage: string | null) => {
    appJotaiStore.set(collabErrorIndicatorAtom, {
      message: errorMessage,
      nonce: Date.now(),
    });
  };

  resetErrorIndicator = (resetDialogNotifiedErrors = false) => {
    appJotaiStore.set(collabErrorIndicatorAtom, { message: null, nonce: 0 });
    if (resetDialogNotifiedErrors) {
      this.setState({
        dialogNotifiedErrors: {},
      });
    }
  };

  setErrorDialog = (errorMessage: string | null) => {
    this.setState({
      errorMessage,
    });
  };

  render() {
    const { errorMessage } = this.state;

    return (
      <>
        {errorMessage != null && (
          <ErrorDialog onClose={() => this.setErrorDialog(null)}>
            {errorMessage}
          </ErrorDialog>
        )}
      </>
    );
  }
}

declare global {
  interface Window {
    collab: InstanceType<typeof Collab>;
  }
}

if (isTestEnv() || isDevEnv()) {
  window.collab = window.collab || ({} as Window["collab"]);
}

export default Collab;

export type TCollabClass = Collab;
