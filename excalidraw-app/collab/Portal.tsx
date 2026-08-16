import { UserIdleState } from "@excalidraw/common";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { trackEvent } from "@excalidraw/excalidraw/analytics";
import { encryptData } from "@excalidraw/excalidraw/data/encryption";
import { newElementWith } from "@excalidraw/element";
import throttle from "lodash.throttle";

import type { OrderedExcalidrawElement } from "@excalidraw/element/types";
import type {
  OnUserFollowedPayload,
  SocketId,
} from "@excalidraw/excalidraw/types";

import { WS_EVENTS, FILE_UPLOAD_TIMEOUT, WS_SUBTYPES } from "../app_constants";
import { isSyncableElement } from "../data";
import { randomUUID } from "../data/random";

import type {
  SocketUpdateData,
  SocketUpdateDataSource,
  SyncableExcalidrawElement,
} from "../data";
import type { TCollabClass } from "./Collab";
import type { Socket } from "socket.io-client";

const COLLAB_CLIENT_ID_STORAGE_KEY = "excalidraw-collab-client-id";

type RealtimeConnectionState =
  | "closed"
  | "connecting"
  | "joining"
  | "live"
  | "reconnecting";

type RoomJoinedPayload = {
  roomId: string;
  socketId: SocketId;
  clients: SocketId[];
};

const getCollabClientId = () => {
  try {
    const existing = window.sessionStorage.getItem(
      COLLAB_CLIENT_ID_STORAGE_KEY,
    );
    if (existing) {
      return existing;
    }
    const clientId = randomUUID();
    window.sessionStorage.setItem(COLLAB_CLIENT_ID_STORAGE_KEY, clientId);
    return clientId;
  } catch {
    return randomUUID();
  }
};

class Portal {
  collab: TCollabClass;
  socket: Socket | null = null;
  /** 快照恢复状态只影响持久化，不再控制实时传输。 */
  snapshotInitialized: boolean = false;
  realtimeState: RealtimeConnectionState = "closed";
  roomId: string | null = null;
  roomKey: string | null = null;
  clientId: string = getCollabClientId();
  broadcastedElementVersions: Map<string, number> = new Map();

  constructor(collab: TCollabClass) {
    this.collab = collab;
  }

  open(socket: Socket, id: string, key: string) {
    this.socket = socket;
    this.roomId = id;
    this.roomKey = key;
    this.snapshotInitialized = false;
    this.realtimeState = socket.connected ? "joining" : "connecting";

    // Initialize socket listeners
    let joinedSocketId: string | null = null;
    let hasConfirmedRoom = false;
    const joinCurrentSocketRoom = () => {
      if (
        this.socket !== socket ||
        !socket.connected ||
        !socket.id ||
        !this.roomId ||
        joinedSocketId === socket.id
      ) {
        return;
      }
      joinedSocketId = socket.id;
      this.realtimeState = "joining";
      socket.emit("join-room", this.roomId, this.clientId);
      trackEvent("share", "room joined");
    };
    // 服务端 init-room 保留兼容；客户端 connect 保证自动重连即使错过
    // init-room，也会用新的 socketId 重新加入原房间。
    this.socket.on("connect", joinCurrentSocketRoom);
    this.socket.on("init-room", joinCurrentSocketRoom);
    this.socket.on("connect_error", () => {
      if (this.socket === socket) {
        this.realtimeState = "reconnecting";
      }
    });
    this.socket.on(WS_EVENTS.ROOM_JOINED, (payload: RoomJoinedPayload) => {
      if (
        this.socket !== socket ||
        payload.roomId !== this.roomId ||
        payload.socketId !== socket.id
      ) {
        return;
      }
      const isReconnect = hasConfirmedRoom;
      hasConfirmedRoom = true;
      this.realtimeState = "live";
      this.collab.setCollaborators(payload.clients);
      if (isReconnect && payload.clients.length > 1) {
        // 断线期间的本地变更用一次全量 UPDATE 补齐。首次加入已有房间
        // 由旧成员的 INIT 初始化，避免双方全量场景交叉覆盖。
        void this.broadcastScene(
          WS_SUBTYPES.UPDATE,
          this.collab.getSceneElementsIncludingDeleted(),
          true,
        ).then((didBroadcast) => {
          if (didBroadcast) {
            void this.collab.saveCollaboration();
          }
        });
      }
    });
    this.socket.on("new-user", async (_socketId: string) => {
      if (this.socket !== socket) {
        return;
      }
      this.broadcastScene(
        WS_SUBTYPES.INIT,
        this.collab.getSceneElementsIncludingDeleted(),
        /* syncAll */ true,
      );
    });
    this.socket.on("room-user-change", (clients: SocketId[]) => {
      if (this.socket !== socket) {
        return;
      }
      this.collab.setCollaborators(clients);
      // room-user-change 只有 socket id。立即广播一次当前用户名和在线状态，
      // 否则新成员要等对方移动鼠标或触发空闲状态后才能显示头像。
      void this.broadcastIdleChange(UserIdleState.ACTIVE);
    });
    this.socket.on("disconnect", () => {
      if (this.socket !== socket) {
        return;
      }
      joinedSocketId = null;
      this.realtimeState = "reconnecting";
      this.collab.setCollaborators([]);
    });

    return socket;
  }

  close() {
    if (!this.socket) {
      return;
    }
    this.queueFileUpload.flush();
    this.socket.close();
    this.socket = null;
    this.roomId = null;
    this.roomKey = null;
    this.snapshotInitialized = false;
    this.realtimeState = "closed";
    this.broadcastedElementVersions = new Map();
  }

  isOpen() {
    return !!(
      this.socket &&
      this.socket.connected &&
      this.roomId &&
      this.roomKey &&
      this.realtimeState === "live"
    );
  }

  async _broadcastSocketData(
    data: SocketUpdateData,
    volatile: boolean = false,
    roomId?: string,
  ) {
    const socket = this.socket;
    const currentRoomId = this.roomId;
    const roomKey = this.roomKey;
    const targetRoomId = roomId ?? currentRoomId;
    if (
      !this.isOpen() ||
      !socket ||
      !currentRoomId ||
      !roomKey ||
      !targetRoomId
    ) {
      return false;
    }
    const json = JSON.stringify(data);
    const encoded = new TextEncoder().encode(json);
    const { encryptedBuffer, iv } = await encryptData(roomKey, encoded);

    if (
      this.socket !== socket ||
      this.roomId !== currentRoomId ||
      this.roomKey !== roomKey ||
      !this.isOpen()
    ) {
      return false;
    }

    socket.emit(
      volatile ? WS_EVENTS.SERVER_VOLATILE : WS_EVENTS.SERVER,
      targetRoomId,
      encryptedBuffer,
      iv,
    );
    return true;
  }

  queueFileUpload = throttle(async () => {
    const socket = this.socket;
    const roomId = this.roomId;
    const roomKey = this.roomKey;
    if (!this.isOpen() || !socket || !roomId || !roomKey) {
      return;
    }
    try {
      await this.collab.fileManager.saveFiles({
        elements: this.collab.excalidrawAPI.getSceneElementsIncludingDeleted(),
        files: this.collab.excalidrawAPI.getFiles(),
      });
    } catch (error: any) {
      if (error.name !== "AbortError") {
        this.collab.excalidrawAPI.updateScene({
          appState: {
            errorMessage: error.message,
          },
        });
      }
    }

    if (
      this.socket !== socket ||
      this.roomId !== roomId ||
      this.roomKey !== roomKey ||
      !this.isOpen()
    ) {
      return;
    }

    let isChanged = false;
    const newElements = this.collab.excalidrawAPI
      .getSceneElementsIncludingDeleted()
      .map((element) => {
        if (this.collab.fileManager.shouldUpdateImageElementStatus(element)) {
          isChanged = true;
          // this will signal collaborators to pull image data from server
          // (using mutation instead of newElementWith otherwise it'd break
          // in-progress dragging)
          return newElementWith(element, { status: "saved" });
        }
        return element;
      });

    if (isChanged) {
      this.collab.excalidrawAPI.updateScene({
        elements: newElements,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    }
  }, FILE_UPLOAD_TIMEOUT);

  broadcastScene = async (
    updateType: WS_SUBTYPES.INIT | WS_SUBTYPES.UPDATE,
    elements: readonly OrderedExcalidrawElement[],
    syncAll: boolean,
    opts?: { replace?: boolean },
  ) => {
    if (updateType === WS_SUBTYPES.INIT && !syncAll) {
      throw new Error("syncAll must be true when sending SCENE.INIT");
    }
    if (!this.isOpen()) {
      return false;
    }

    // sync out only the elements we think we need to to save bandwidth.
    // periodically we'll resync the whole thing to make sure no one diverges
    // due to a dropped message (server goes down etc).
    const syncableElements = elements.reduce((acc, element) => {
      if (
        (syncAll ||
          !this.broadcastedElementVersions.has(element.id) ||
          element.version > this.broadcastedElementVersions.get(element.id)!) &&
        isSyncableElement(element)
      ) {
        acc.push(element);
      }
      return acc;
    }, [] as SyncableExcalidrawElement[]);

    const data: SocketUpdateDataSource[typeof updateType] = {
      type: updateType,
      payload: {
        elements: syncableElements,
        ...(updateType === WS_SUBTYPES.INIT && opts?.replace
          ? { replace: true }
          : {}),
      },
    };

    const didBroadcast = await this._broadcastSocketData(
      data as SocketUpdateData,
    );
    if (!didBroadcast) {
      return false;
    }

    for (const syncableElement of syncableElements) {
      this.broadcastedElementVersions.set(
        syncableElement.id,
        syncableElement.version,
      );
    }
    this.queueFileUpload();
    return true;
  };

  broadcastIdleChange = (
    userState: UserIdleState,
    username = this.collab.state.username,
  ) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["IDLE_STATUS"] = {
        type: WS_SUBTYPES.IDLE_STATUS,
        payload: {
          socketId: this.socket.id as SocketId,
          userState,
          username,
        },
      };
      return this._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
      );
    }
  };

  broadcastMouseLocation = (payload: {
    pointer: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["pointer"];
    button: SocketUpdateDataSource["MOUSE_LOCATION"]["payload"]["button"];
  }) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["MOUSE_LOCATION"] = {
        type: WS_SUBTYPES.MOUSE_LOCATION,
        payload: {
          socketId: this.socket.id as SocketId,
          pointer: payload.pointer,
          button: payload.button || "up",
          selectedElementIds:
            this.collab.excalidrawAPI.getAppState().selectedElementIds,
          username: this.collab.state.username,
        },
      };

      return this._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
      );
    }
  };

  broadcastVisibleSceneBounds = (
    payload: {
      sceneBounds: SocketUpdateDataSource["USER_VISIBLE_SCENE_BOUNDS"]["payload"]["sceneBounds"];
    },
    roomId: string,
  ) => {
    if (this.socket?.id) {
      const data: SocketUpdateDataSource["USER_VISIBLE_SCENE_BOUNDS"] = {
        type: WS_SUBTYPES.USER_VISIBLE_SCENE_BOUNDS,
        payload: {
          socketId: this.socket.id as SocketId,
          username: this.collab.state.username,
          sceneBounds: payload.sceneBounds,
        },
      };

      return this._broadcastSocketData(
        data as SocketUpdateData,
        true, // volatile
        roomId,
      );
    }
  };

  broadcastUserFollowed = (payload: OnUserFollowedPayload) => {
    if (this.socket?.id) {
      this.socket.emit(WS_EVENTS.USER_FOLLOW_CHANGE, payload);
    }
  };
}

export default Portal;
