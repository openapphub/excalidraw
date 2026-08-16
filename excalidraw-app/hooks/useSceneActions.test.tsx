import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../lib/queryClient";

import { useSceneActions } from "./useSceneActions";

import type { PropsWithChildren } from "react";
import type { WorkspaceScene } from "../auth/workspaceApi";

const workspaceApiMocks = vi.hoisted(() => ({
  deleteScene: vi.fn(),
  updateScene: vi.fn(),
  duplicateScene: vi.fn(),
}));

const confirmMocks = vi.hoisted(() => ({
  openConfirmModal: vi.fn(),
}));

vi.mock("../auth/workspaceApi", () => workspaceApiMocks);
vi.mock(
  "@excalidraw/excalidraw/components/OverwriteConfirm/OverwriteConfirmState",
  () => confirmMocks,
);
vi.mock("@excalidraw/excalidraw/i18n", () => ({
  t: (key: string) => key,
}));
vi.mock("../utils/toast", () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const scene = (
  id: string,
  workspaceId: string,
  collectionId: string,
  title = id,
): WorkspaceScene => ({
  id,
  title,
  workspaceId,
  collectionId,
  thumbnailUrl: null,
  storageKey: id,
  roomId: null,
  isPublic: false,
  lastOpenedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

const sceneA = scene("scene-a", "workspace-a", "collection-a", "Scene A");
const sceneB = scene("scene-b", "workspace-b", "collection-b", "Scene B");

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

describe("useSceneActions mutation queryKey", () => {
  beforeEach(() => {
    Object.values(workspaceApiMocks).forEach((mock) => mock.mockReset());
    confirmMocks.openConfirmModal.mockReset();
    confirmMocks.openConfirmModal.mockResolvedValue(true);
  });

  it("RENAME 完成时只更新发起 Workspace 的缓存", async () => {
    const gate = deferred<WorkspaceScene>();
    workspaceApiMocks.updateScene.mockReturnValueOnce(gate.promise);
    const { queryClient, wrapper } = createHarness();
    const keyA = queryKeys.scenes.list("workspace-a", "collection-a");
    const keyB = queryKeys.scenes.list("workspace-b", "collection-b");
    queryClient.setQueryData(keyA, [sceneA]);
    queryClient.setQueryData(keyB, [sceneB]);
    const hook = renderHook(
      ({ workspaceId, collectionId }) =>
        useSceneActions({ workspaceId, collectionId }),
      {
        initialProps: {
          workspaceId: "workspace-a",
          collectionId: "collection-a",
        },
        wrapper,
      },
    );

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = hook.result.current.renameScene("scene-a", "Renamed A");
    });
    await waitFor(() => {
      expect(workspaceApiMocks.updateScene).toHaveBeenCalled();
    });
    hook.rerender({
      workspaceId: "workspace-b",
      collectionId: "collection-b",
    });

    await act(async () => {
      gate.resolve({ ...sceneA, title: "Renamed A" });
      await mutation;
    });

    expect(queryClient.getQueryData<WorkspaceScene[]>(keyA)?.[0].title).toBe(
      "Renamed A",
    );
    expect(queryClient.getQueryData(keyB)).toEqual([sceneB]);
  });

  it("DELETE 失败时只回滚发起 Workspace 的缓存", async () => {
    const gate = deferred<void>();
    workspaceApiMocks.deleteScene.mockReturnValueOnce(gate.promise);
    const { queryClient, wrapper } = createHarness();
    const keyA = queryKeys.scenes.list("workspace-a", "collection-a");
    const keyB = queryKeys.scenes.list("workspace-b", "collection-b");
    queryClient.setQueryData(keyA, [sceneA]);
    queryClient.setQueryData(keyB, [sceneB]);
    const hook = renderHook(
      ({ workspaceId, collectionId }) =>
        useSceneActions({ workspaceId, collectionId }),
      {
        initialProps: {
          workspaceId: "workspace-a",
          collectionId: "collection-a",
        },
        wrapper,
      },
    );

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = hook.result.current.deleteScene("scene-a");
    });
    await waitFor(() => {
      expect(queryClient.getQueryData(keyA)).toEqual([]);
    });
    hook.rerender({
      workspaceId: "workspace-b",
      collectionId: "collection-b",
    });

    await act(async () => {
      gate.reject(new Error("delete failed"));
      await mutation;
    });

    expect(queryClient.getQueryData(keyA)).toEqual([sceneA]);
    expect(queryClient.getQueryData(keyB)).toEqual([sceneB]);
  });

  it("DELETE 完成后失效通知缓存", async () => {
    workspaceApiMocks.deleteScene.mockResolvedValueOnce(undefined);
    const { queryClient, wrapper } = createHarness();
    const sceneKey = queryKeys.scenes.list("workspace-a", "collection-a");
    const notificationKey = queryKeys.notifications.list();
    queryClient.setQueryData(sceneKey, [sceneA]);
    queryClient.setQueryData(notificationKey, {
      pages: [
        {
          notifications: [{ id: "notification-a", scene: { id: sceneA.id } }],
          hasMore: false,
        },
      ],
      pageParams: [undefined],
    });
    const hook = renderHook(
      () =>
        useSceneActions({
          workspaceId: "workspace-a",
          collectionId: "collection-a",
        }),
      { wrapper },
    );

    await act(async () => {
      await hook.result.current.deleteScene(sceneA.id);
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(notificationKey)?.isInvalidated).toBe(
        true,
      );
    });
  });

  it("DUPLICATE 完成时不把源 Scene 副本插入新 Workspace", async () => {
    const gate = deferred<WorkspaceScene>();
    workspaceApiMocks.duplicateScene.mockReturnValueOnce(gate.promise);
    const { queryClient, wrapper } = createHarness();
    const keyA = queryKeys.scenes.list("workspace-a", "collection-a");
    const keyB = queryKeys.scenes.list("workspace-b", "collection-b");
    queryClient.setQueryData(keyA, [sceneA]);
    queryClient.setQueryData(keyB, [sceneB]);
    const hook = renderHook(
      ({ workspaceId, collectionId }) =>
        useSceneActions({ workspaceId, collectionId }),
      {
        initialProps: {
          workspaceId: "workspace-a",
          collectionId: "collection-a",
        },
        wrapper,
      },
    );

    let mutation!: Promise<WorkspaceScene | null>;
    act(() => {
      mutation = hook.result.current.duplicateScene("scene-a");
    });
    await waitFor(() => {
      expect(workspaceApiMocks.duplicateScene).toHaveBeenCalled();
    });
    hook.rerender({
      workspaceId: "workspace-b",
      collectionId: "collection-b",
    });
    const duplicate = scene(
      "scene-a-copy",
      "workspace-a",
      "collection-a",
      "Scene A copy",
    );

    await act(async () => {
      gate.resolve(duplicate);
      await mutation;
    });

    expect(queryClient.getQueryData(keyA)).toEqual([duplicate, sceneA]);
    expect(queryClient.getQueryData(keyB)).toEqual([sceneB]);
  });
});
