import { CaptureUpdateAction, newElementWith } from "@excalidraw/excalidraw";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRedoAction,
  createUndoAction,
} from "@excalidraw/excalidraw/actions/actionHistory";
import { syncInvalidIndices } from "@excalidraw/element";
import { API } from "@excalidraw/excalidraw/tests/helpers/api";
import { act, render, waitFor } from "@excalidraw/excalidraw/tests/test-utils";
import { beforeEach, vi } from "vitest";

import { StoreIncrement } from "@excalidraw/element";

import type { DurableIncrement, EphemeralIncrement } from "@excalidraw/element";

import ExcalidrawApp from "../App";
import { appJotaiStore, currentCanvasIdAtom } from "../app-jotai";
import { WS_SUBTYPES } from "../app_constants";
import { isCollaboratingAtom } from "../collab/Collab";
import {
  currentSceneCanEditAtom,
  currentSceneIdAtom,
} from "../components/Settings/settingsState";
import { queryClient } from "../lib/queryClient";

const { h } = window;

const renderApp = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <ExcalidrawApp />
    </QueryClientProvider>,
  );

Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: number[]) =>
      arr.forEach((v, i) => (arr[i] = Math.floor(Math.random() * 256))),
    subtle: {
      generateKey: () => {},
      exportKey: () => ({ k: "sTdLvMC_M3V8_vGa3UVRDg" }),
    },
  },
});

const firebaseMocks = vi.hoisted(() => ({
  loadFromFirebase: vi.fn(async (): Promise<readonly any[] | null> => null),
  saveToFirebase: vi.fn(async () => null),
  isSavedToFirebase: vi.fn(() => true),
  loadFilesFromFirebase: vi.fn(async () => ({
    loadedFiles: [],
    erroredFiles: [],
  })),
  saveFilesToFirebase: vi.fn(async () => ({
    savedFiles: new Map(),
    erroredFiles: new Map(),
  })),
}));

const socketMocks = vi.hoisted(() => ({
  sockets: [] as any[],
}));

vi.mock("../../excalidraw-app/data/firebase.ts", () => firebaseMocks);

vi.mock("socket.io-client", () => {
  return {
    default: () => {
      const socket = {
        connected: false,
        close: vi.fn(),
        connect: vi.fn(() => {
          socket.connected = true;
        }),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
      };
      socketMocks.sockets.push(socket);
      return socket;
    },
  };
});

/**
 * These test would deserve to be extended by testing collab with (at least) two clients simultanouesly,
 * while having access to both scenes, appstates stores, histories and etc.
 * i.e. multiplayer history tests could be a good first candidate, as we could test both history stacks simultaneously.
 */
describe("collaboration", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    appJotaiStore.set(isCollaboratingAtom, false);
    firebaseMocks.loadFromFirebase.mockReset().mockResolvedValue(null);
    firebaseMocks.saveToFirebase.mockReset().mockResolvedValue(null);
    socketMocks.sockets.length = 0;
  });

  it("连接前注册房间初始化监听器，避免错过旧成员 INIT", async () => {
    await renderApp();

    const roomLinkData = {
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
    };
    window.history.replaceState(
      {},
      "",
      `#room=${roomLinkData.roomId},${roomLinkData.roomKey}`,
    );

    let pendingCollaboration = Promise.resolve<unknown>(null);
    await act(async () => {
      window.collab.setUsername("测试用户");
      pendingCollaboration = window.collab.startCollaboration(roomLinkData);
      await waitFor(() => {
        expect(socketMocks.sockets).toHaveLength(1);
        expect(socketMocks.sockets[0].connect).toHaveBeenCalledTimes(1);
      });

      const socket = socketMocks.sockets[0];
      const connectOrder = socket.connect.mock.invocationCallOrder[0];
      for (const eventName of ["client-broadcast", "first-in-room"]) {
        const listenerIndex = socket.on.mock.calls.findIndex(
          ([registeredEvent]: [string]) => registeredEvent === eventName,
        );
        expect(listenerIndex).toBeGreaterThanOrEqual(0);
        expect(socket.on.mock.invocationCallOrder[listenerIndex]).toBeLessThan(
          connectOrder,
        );
      }

      (window.collab as any).destroySocketClient();
      await pendingCollaboration;
    });
  });

  it("should replace the scene and broadcast a full replacement init", async () => {
    await renderApp();

    const previousElement = API.createElement({
      type: "rectangle",
      id: "previous",
      width: 100,
      height: 100,
    });
    const targetElement = API.createElement({
      type: "diamond",
      id: "target",
      width: 200,
      height: 120,
    });

    API.updateScene({
      elements: [previousElement],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    const broadcastSpy = vi
      .spyOn(window.collab.portal, "_broadcastSocketData")
      .mockResolvedValue(true);
    const saveSpy = vi
      .spyOn(window.collab, "saveCollabRoomToFirebase")
      .mockResolvedValue(undefined);
    window.history.replaceState(
      {},
      "",
      "#room=0123456789abcdefabcd,jUgf6TAAvOrLXbsmq4Hpnw",
    );
    Object.assign(window.collab.portal, {
      socket: { close: vi.fn(), connected: true },
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
      realtimeState: "live",
      snapshotInitialized: true,
    });

    await act(async () => {
      await window.collab.replaceScene({
        elements: [targetElement],
        appState: window.collab.excalidrawAPI.getAppState(),
        files: {},
      });
    });

    expect(h.elements).toEqual([expect.objectContaining({ id: "target" })]);
    expect(broadcastSpy).toHaveBeenCalledWith({
      type: WS_SUBTYPES.INIT,
      payload: {
        elements: [expect.objectContaining({ id: "target" })],
        replace: true,
      },
    });
    expect(saveSpy).toHaveBeenCalledWith(
      [expect.objectContaining({ id: "target" })],
      { replace: true },
    );
  });

  it("临时房间不受残留 Workspace Scene 状态阻断", async () => {
    await renderApp();

    act(() => {
      appJotaiStore.set(currentCanvasIdAtom, "stale-workspace-scene");
      appJotaiStore.set(currentSceneIdAtom, null);
      appJotaiStore.set(currentSceneCanEditAtom, false);
      appJotaiStore.set(isCollaboratingAtom, true);
    });

    const broadcastSpy = vi.spyOn(window.collab as any, "broadcastElements");
    const element = API.createElement({
      type: "rectangle",
      id: "temporary-room-element",
      width: 100,
      height: 100,
    });

    API.updateScene({
      elements: [element],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      expect(broadcastSpy).toHaveBeenCalledWith([
        expect.objectContaining({ id: "temporary-room-element" }),
      ]);
    });
  });

  it("旧房间快照晚到时不初始化新房间", async () => {
    await renderApp();

    let resolveLoad: (elements: readonly any[] | null) => void = () => {};
    firebaseMocks.loadFromFirebase.mockImplementationOnce(
      () =>
        new Promise<readonly any[] | null>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const oldSocket = { connected: true, close: vi.fn(), off: vi.fn() };
    window.history.replaceState(
      {},
      "",
      "#room=0123456789abcdefabcd,jUgf6TAAvOrLXbsmq4Hpnw",
    );
    Object.assign(window.collab.portal, {
      socket: oldSocket,
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
      realtimeState: "live",
      snapshotInitialized: false,
    });
    const session = (window.collab as any).captureCollabSession();
    let pending: Promise<unknown> = Promise.resolve(null);
    await act(async () => {
      pending = (window.collab as any).initializeRoom({
        fetchScene: true,
        roomLinkData: {
          roomId: "0123456789abcdefabcd",
          roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
        },
        session,
      });
    });

    const newSocket = { connected: true, close: vi.fn(), off: vi.fn() };
    window.history.replaceState(
      {},
      "",
      "#room=abcdef0123456789abcd,1234567890123456789012",
    );
    Object.assign(window.collab.portal, {
      socket: newSocket,
      roomId: "abcdef0123456789abcd",
      roomKey: "1234567890123456789012",
      realtimeState: "live",
      snapshotInitialized: false,
    });
    let result: unknown;
    await act(async () => {
      resolveLoad([
        API.createElement({
          type: "rectangle",
          id: "old-room-element",
          width: 100,
          height: 100,
        }),
      ]);
      result = await pending;
    });

    expect(result).toBeNull();
    expect(window.collab.portal.snapshotInitialized).toBe(false);
    expect(h.elements).not.toEqual([
      expect.objectContaining({ id: "old-room-element" }),
    ]);
  });

  it("单人临时房间也会提交尾随快照", async () => {
    await renderApp();

    window.history.replaceState(
      {},
      "",
      "#room=0123456789abcdefabcd,jUgf6TAAvOrLXbsmq4Hpnw",
    );
    Object.assign(window.collab.portal, {
      socket: { id: "self-socket", close: vi.fn(), connected: true },
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
      realtimeState: "live",
      snapshotInitialized: true,
    });
    const saveSpy = vi
      .spyOn(window.collab, "saveCollabRoomToFirebase")
      .mockResolvedValue(undefined);

    window.collab.queueSaveToFirebase();
    window.collab.queueSaveToFirebase.flush();

    expect(saveSpy).toHaveBeenCalledTimes(1);
  });

  it("连续元素变化不会绕过完整场景广播节流", async () => {
    await renderApp();

    Object.assign(window.collab.portal, {
      socket: { id: "self-socket", close: vi.fn(), connected: true },
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
      realtimeState: "live",
      snapshotInitialized: true,
    });
    act(() => {
      window.collab.setCollaborators(["self-socket", "peer-socket"] as any);
    });
    window.collab.setLastBroadcastedOrReceivedSceneVersion(-1);
    window.collab.queueBroadcastAllElements.cancel();

    const [first] = syncInvalidIndices([
      API.createElement({
        type: "rectangle",
        id: "resized-element",
        width: 100,
        height: 100,
      }),
    ]);
    const second = newElementWith(first, { width: 200, height: 200 });
    const third = newElementWith(second, { width: 300, height: 300 });
    const broadcastSpy = vi
      .spyOn(window.collab.portal, "broadcastScene")
      .mockResolvedValue(true);

    window.collab.broadcastElements([first]);
    window.collab.broadcastElements([second]);
    window.collab.broadcastElements([third]);

    const incrementalCalls = broadcastSpy.mock.calls.filter(
      ([, , syncAll]) => syncAll === false,
    );
    const fullSceneCalls = broadcastSpy.mock.calls.filter(
      ([, , syncAll]) => syncAll === true,
    );
    expect(incrementalCalls).toHaveLength(3);
    expect(fullSceneCalls).toHaveLength(1);

    window.collab.queueBroadcastAllElements.cancel();
  });

  it("快照 CAS 合并结果不会反向覆盖实时画布", async () => {
    await renderApp();

    const localElement = API.createElement({
      type: "rectangle",
      id: "local-element",
      width: 100,
      height: 100,
    });
    const persistedElement = API.createElement({
      type: "diamond",
      id: "persisted-element",
      width: 200,
      height: 120,
    });
    window.history.replaceState(
      {},
      "",
      "#room=0123456789abcdefabcd,jUgf6TAAvOrLXbsmq4Hpnw",
    );
    Object.assign(window.collab.portal, {
      socket: { id: "self-socket", close: vi.fn(), connected: true },
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
      realtimeState: "live",
      snapshotInitialized: true,
    });
    firebaseMocks.saveToFirebase.mockResolvedValueOnce([
      persistedElement,
    ] as any);
    const remoteUpdateSpy = vi.spyOn(
      window.collab as any,
      "handleRemoteSceneUpdate",
    );

    await act(async () => {
      await window.collab.saveCollabRoomToFirebase([localElement] as any);
    });

    expect(firebaseMocks.saveToFirebase).toHaveBeenCalledTimes(1);
    expect(remoteUpdateSpy).not.toHaveBeenCalled();
    expect(h.elements).not.toEqual([
      expect.objectContaining({ id: "persisted-element" }),
    ]);
  });

  it("同一客户端的匿名房间快照按顺序保存", async () => {
    await renderApp();

    const firstElement = API.createElement({
      type: "rectangle",
      id: "first-element",
      width: 100,
      height: 100,
    });
    const secondElement = API.createElement({
      type: "diamond",
      id: "second-element",
      width: 200,
      height: 120,
    });
    window.history.replaceState(
      {},
      "",
      "#room=0123456789abcdefabcd,jUgf6TAAvOrLXbsmq4Hpnw",
    );
    Object.assign(window.collab.portal, {
      socket: { id: "self-socket", close: vi.fn(), connected: true },
      roomId: "0123456789abcdefabcd",
      roomKey: "jUgf6TAAvOrLXbsmq4Hpnw",
      realtimeState: "live",
      snapshotInitialized: true,
    });

    let resolveFirstSave: () => void = () => {};
    firebaseMocks.saveToFirebase
      .mockImplementationOnce(
        () =>
          new Promise<null>((resolve) => {
            resolveFirstSave = () => resolve(null);
          }),
      )
      .mockResolvedValueOnce(null);

    const firstSave = window.collab.saveCollabRoomToFirebase([
      firstElement,
    ] as any);
    const secondSave = window.collab.saveCollabRoomToFirebase([
      secondElement,
    ] as any);

    await waitFor(() => {
      expect(firebaseMocks.saveToFirebase).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      resolveFirstSave();
      await firstSave;
      await secondSave;
    });

    expect(firebaseMocks.saveToFirebase).toHaveBeenCalledTimes(2);
    const secondCall = firebaseMocks.saveToFirebase.mock
      .calls[1] as unknown as [unknown, readonly any[]];
    expect(secondCall[1]).toEqual([
      expect.objectContaining({ id: "second-element" }),
    ]);
  });

  it("should emit two ephemeral increments even though updates get batched", async () => {
    const durableIncrements: DurableIncrement[] = [];
    const ephemeralIncrements: EphemeralIncrement[] = [];

    await renderApp();

    h.store.onStoreIncrementEmitter.on((increment) => {
      if (StoreIncrement.isDurable(increment)) {
        durableIncrements.push(increment);
      } else {
        ephemeralIncrements.push(increment);
      }
    });

    // eslint-disable-next-line dot-notation
    expect(h.store["scheduledMicroActions"].length).toBe(0);
    expect(durableIncrements.length).toBe(0);
    expect(ephemeralIncrements.length).toBe(0);

    const rectProps = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
      x: 0,
      y: 0,
    } as const;

    const rect = API.createElement({ ...rectProps });

    API.updateScene({
      elements: [rect],
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      // expect(commitSpy).toHaveBeenCalledTimes(1);
      expect(durableIncrements.length).toBe(1);
    });

    // simulate two batched remote updates
    act(() => {
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 100 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      h.app.updateScene({
        elements: [newElementWith(h.elements[0], { x: 200 })],
        captureUpdate: CaptureUpdateAction.NEVER,
      });

      // we scheduled two micro actions,
      // which confirms they are going to be executed as part of one batched component update
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(2);
    });

    await waitFor(() => {
      // altough the updates get batched,
      // we expect two ephemeral increments for each update,
      // and each such update should have the expected change
      expect(ephemeralIncrements.length).toBe(2);
      expect(ephemeralIncrements[0].change.elements.A).toEqual(
        expect.objectContaining({ x: 100 }),
      );
      expect(ephemeralIncrements[1].change.elements.A).toEqual(
        expect.objectContaining({ x: 200 }),
      );
      // eslint-disable-next-line dot-notation
      expect(h.store["scheduledMicroActions"].length).toBe(0);
    });
  });

  it("should allow to undo / redo even on force-deleted elements", async () => {
    await renderApp();
    const rect1Props = {
      type: "rectangle",
      id: "A",
      height: 200,
      width: 100,
    } as const;

    const rect2Props = {
      type: "rectangle",
      id: "B",
      width: 100,
      height: 200,
    } as const;

    const rect1 = API.createElement({ ...rect1Props });
    const rect2 = API.createElement({ ...rect2Props });

    API.updateScene({
      elements: syncInvalidIndices([rect1, rect2]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    API.updateScene({
      elements: syncInvalidIndices([
        rect1,
        newElementWith(h.elements[1], { isDeleted: true }),
      ]),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
    });

    // one form of force deletion happens when starting the collab, not to sync potentially sensitive data into the server
    window.collab.startCollaboration(null);

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      // we never delete from the local snapshot as it is used for correct diff calculation
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([expect.objectContaining(rect1Props)]);
    });

    const undoAction = createUndoAction(h.history);
    act(() => h.app.actionManager.executeAction(undoAction));

    // with explicit undo (as addition) we expect our item to be restored from the snapshot!
    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: false }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: false }),
      ]);
    });

    // simulate force deleting the element remotely
    API.updateScene({
      elements: syncInvalidIndices([rect1]),
      captureUpdate: CaptureUpdateAction.NEVER,
    });

    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(1);
      expect(API.getRedoStack().length).toBe(1);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([expect.objectContaining(rect1Props)]);
    });

    const redoAction = createRedoAction(h.history);
    act(() => h.app.actionManager.executeAction(redoAction));

    // with explicit redo (as removal) we again restore the element from the snapshot!
    await waitFor(() => {
      expect(API.getUndoStack().length).toBe(2);
      expect(API.getRedoStack().length).toBe(0);
      expect(API.getSnapshot()).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
      expect(h.elements).toEqual([
        expect.objectContaining(rect1Props),
        expect.objectContaining({ ...rect2Props, isDeleted: true }),
      ]);
    });
  });
});
