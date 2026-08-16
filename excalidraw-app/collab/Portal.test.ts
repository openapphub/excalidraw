import { describe, expect, it, vi } from "vitest";

import { UserIdleState } from "@excalidraw/common";

import { WS_SUBTYPES } from "../app_constants";

import Portal from "./Portal";

const createSocket = () => {
  const listeners = new Map<string, (...args: any[]) => void>();
  return {
    id: "self-socket",
    connected: true,
    on: vi.fn((event: string, listener: (...args: any[]) => void) => {
      listeners.set(event, listener);
    }),
    emit: vi.fn(),
    close: vi.fn(),
    listeners,
  };
};

const confirmRoomJoined = (
  socket: ReturnType<typeof createSocket>,
  clients: string[] = [socket.id],
) => {
  socket.listeners.get("room-joined")?.({
    roomId: "0123456789abcdefabcd",
    socketId: socket.id,
    clients,
  });
};

const createCollab = () => {
  const element = {
    id: "element-1",
    version: 1,
    isDeleted: false,
    updated: Date.now(),
    width: 100,
    height: 100,
  } as any;

  return {
    element,
    collab: {
      state: { username: "测试用户" },
      setCollaborators: vi.fn(),
      saveCollaboration: vi.fn(async () => undefined),
      getSceneElementsIncludingDeleted: vi.fn(() => [element]),
      excalidrawAPI: {
        getSceneElementsIncludingDeleted: vi.fn(() => [element]),
        getFiles: vi.fn(() => ({})),
        getAppState: vi.fn(() => ({ selectedElementIds: {} })),
        updateScene: vi.fn(),
      },
      fileManager: {
        saveFiles: vi.fn(async () => undefined),
        shouldUpdateImageElementStatus: vi.fn(() => false),
      },
    } as any,
  };
};

describe("Portal 房间广播门控", () => {
  it("服务端确认加入房间前不发送，也不记录已广播版本", async () => {
    const socket = createSocket();
    const { collab, element } = createCollab();
    const portal = new Portal(collab);
    portal.open(socket as any, "0123456789abcdefabcd", "room-key");
    const broadcast = vi
      .spyOn(portal, "_broadcastSocketData")
      .mockResolvedValue(true);

    expect(portal.isOpen()).toBe(false);
    await expect(
      portal.broadcastScene(WS_SUBTYPES.UPDATE, [element], false),
    ).resolves.toBe(false);
    expect(broadcast).not.toHaveBeenCalled();
    expect(portal.broadcastedElementVersions.size).toBe(0);

    socket.listeners.get("room-user-change")?.(["self-socket"]);
    expect(portal.isOpen()).toBe(false);

    confirmRoomJoined(socket);
    broadcast.mockClear();

    expect(portal.realtimeState).toBe("live");
    expect(portal.isOpen()).toBe(true);
    await expect(
      portal.broadcastScene(WS_SUBTYPES.UPDATE, [element], false),
    ).resolves.toBe(true);
    expect(broadcast).toHaveBeenCalledTimes(1);
    expect(portal.broadcastedElementVersions.get(element.id)).toBe(1);
  });

  it("成员列表变化后立即广播用户名和在线状态", () => {
    const socket = createSocket();
    const { collab } = createCollab();
    const portal = new Portal(collab);
    const broadcastIdleChange = vi
      .spyOn(portal, "broadcastIdleChange")
      .mockResolvedValue(true);
    vi.spyOn(portal, "broadcastScene").mockResolvedValue(false);
    portal.open(socket as any, "0123456789abcdefabcd", "room-key");

    socket.listeners.get("room-user-change")?.(["self-socket", "peer-socket"]);

    expect(broadcastIdleChange).toHaveBeenCalledWith(UserIdleState.ACTIVE);
  });

  it("首次加入已有房间时等待旧成员初始化，不抢先广播本地场景", async () => {
    const socket = createSocket();
    const { collab } = createCollab();
    const portal = new Portal(collab);
    portal.open(socket as any, "0123456789abcdefabcd", "room-key");
    vi.spyOn(portal, "_broadcastSocketData").mockResolvedValue(true);
    const broadcastScene = vi.spyOn(portal, "broadcastScene");

    confirmRoomJoined(socket, ["self-socket", "peer-socket"]);

    expect(broadcastScene).not.toHaveBeenCalled();
    expect(collab.setCollaborators).toHaveBeenCalledWith([
      "self-socket",
      "peer-socket",
    ]);
    expect(collab.saveCollaboration).not.toHaveBeenCalled();

    socket.listeners.get("room-user-change")?.([
      "self-socket",
      "peer-socket",
      "third-socket",
    ]);
    expect(broadcastScene).not.toHaveBeenCalled();
  });

  it("断线后停止广播，重新入房时补发断线期间的完整场景", async () => {
    const socket = createSocket();
    const { collab, element } = createCollab();
    const portal = new Portal(collab);
    portal.open(socket as any, "0123456789abcdefabcd", "room-key");
    vi.spyOn(portal, "_broadcastSocketData").mockResolvedValue(true);
    const broadcastScene = vi.spyOn(portal, "broadcastScene");

    confirmRoomJoined(socket, ["self-socket", "peer-socket"]);
    expect(broadcastScene).not.toHaveBeenCalled();

    socket.connected = false;
    socket.listeners.get("disconnect")?.();
    expect(portal.realtimeState).toBe("reconnecting");
    expect(portal.isOpen()).toBe(false);
    await expect(
      portal.broadcastScene(WS_SUBTYPES.UPDATE, [element], false),
    ).resolves.toBe(false);

    socket.connected = true;
    socket.id = "reconnected-socket";
    socket.listeners.get("connect")?.();
    expect(portal.isOpen()).toBe(false);
    confirmRoomJoined(socket, ["reconnected-socket", "peer-socket"]);
    await vi.waitFor(() => {
      expect(broadcastScene).toHaveBeenCalledWith(
        WS_SUBTYPES.UPDATE,
        [element],
        true,
      );
    });
    await vi.waitFor(() => {
      expect(collab.saveCollaboration).toHaveBeenCalledTimes(1);
    });
  });

  it("自动重连即使错过 init-room 也会重新加入原房间", () => {
    const socket = createSocket();
    const { collab } = createCollab();
    const portal = new Portal(collab);
    portal.open(socket as any, "0123456789abcdefabcd", "room-key");

    socket.listeners.get("connect")?.();
    socket.listeners.get("init-room")?.();
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenLastCalledWith(
      "join-room",
      "0123456789abcdefabcd",
      portal.clientId,
    );

    socket.connected = false;
    socket.listeners.get("disconnect")?.();
    socket.id = "reconnected-socket";
    socket.connected = true;
    socket.listeners.get("connect")?.();

    expect(socket.emit).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenLastCalledWith(
      "join-room",
      "0123456789abcdefabcd",
      portal.clientId,
    );
  });

  it("加密期间切换房间时不会把旧房间数据发到新 Socket", async () => {
    const oldSocket = createSocket();
    const newSocket = createSocket();
    const { collab } = createCollab();
    const portal = new Portal(collab);
    portal.open(
      oldSocket as any,
      "0123456789abcdefabcd",
      "jUgf6TAAvOrLXbsmq4Hpnw",
    );
    confirmRoomJoined(oldSocket);

    const pending = portal._broadcastSocketData({
      type: WS_SUBTYPES.UPDATE,
      payload: { elements: [] },
    } as any);
    portal.open(
      newSocket as any,
      "abcdef0123456789abcd",
      "1234567890123456789012",
    );

    await expect(pending).resolves.toBe(false);
    expect(oldSocket.emit).not.toHaveBeenCalledWith(
      "server-broadcast",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(newSocket.emit).not.toHaveBeenCalledWith(
      "server-broadcast",
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });
});
