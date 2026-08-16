import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Provider, appJotaiStore } from "../app-jotai";
import {
  activeCollectionIdAtom,
  collectionsAtom,
} from "../components/Settings/settingsState";

import { useCollections } from "./useCollections";

import type { PropsWithChildren } from "react";
import type { Collection } from "../auth/workspaceApi";

const workspaceApiMocks = vi.hoisted(() => ({
  listCollections: vi.fn(),
  createCollection: vi.fn(),
  updateCollection: vi.fn(),
  deleteCollection: vi.fn(),
  getScene: vi.fn(),
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

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const collection = (
  id: string,
  workspaceId: string,
  isPrivate = false,
): Collection =>
  ({
    id,
    workspaceId,
    name: id,
    icon: null,
    color: null,
    isPrivate,
    userId: "user-a",
    sceneCount: 0,
    canWrite: true,
    isOwner: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as Collection);

const workspaceACollections = [collection("collection-a", "workspace-a")];
const workspaceBCollections = [collection("collection-b", "workspace-b", true)];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <Provider store={appJotaiStore}>{children}</Provider>
    </QueryClientProvider>
  );
};

describe("useCollections Workspace 上下文", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/workspace/source/dashboard");
    appJotaiStore.set(collectionsAtom, []);
    appJotaiStore.set(activeCollectionIdAtom, null);
    confirmMocks.openConfirmModal.mockReset();
    confirmMocks.openConfirmModal.mockResolvedValue(true);
    Object.values(workspaceApiMocks).forEach((mock) => mock.mockReset());
    workspaceApiMocks.listCollections.mockImplementation(
      async (workspaceId: string) =>
        workspaceId === "workspace-a"
          ? workspaceACollections
          : workspaceBCollections,
    );
  });

  it("旧 Workspace 的 CREATE 响应不写入新 Workspace 集合 atom", async () => {
    const gate = deferred<Collection>();
    workspaceApiMocks.createCollection.mockReturnValueOnce(gate.promise);
    const hook = renderHook(
      ({ workspaceId }) => useCollections({ workspaceId }),
      {
        initialProps: { workspaceId: "workspace-a" },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceACollections);
    });

    let mutation!: Promise<Collection | null>;
    act(() => {
      mutation = hook.result.current.createCollection({ name: "new-a" });
    });
    hook.rerender({ workspaceId: "workspace-b" });
    window.history.replaceState({}, "", "/workspace/target/dashboard");
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceBCollections);
    });

    await act(async () => {
      gate.resolve(collection("new-a", "workspace-a"));
      await mutation;
    });

    expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceBCollections);
  });

  it("旧 Workspace 的 UPDATE 响应不覆盖新 Workspace 集合 atom", async () => {
    const gate = deferred<Collection>();
    workspaceApiMocks.updateCollection.mockReturnValueOnce(gate.promise);
    const hook = renderHook(
      ({ workspaceId }) => useCollections({ workspaceId }),
      {
        initialProps: { workspaceId: "workspace-a" },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceACollections);
    });

    let mutation!: Promise<Collection | null>;
    act(() => {
      mutation = hook.result.current.updateCollection("collection-a", {
        name: "renamed-a",
      });
    });
    hook.rerender({ workspaceId: "workspace-b" });
    window.history.replaceState({}, "", "/workspace/target/dashboard");
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceBCollections);
    });

    await act(async () => {
      gate.resolve({
        ...workspaceACollections[0],
        name: "renamed-a",
      });
      await mutation;
    });

    expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceBCollections);
  });

  it("旧 Workspace 的 DELETE 响应不清空新 Workspace 集合或选中项", async () => {
    const gate = deferred<void>();
    workspaceApiMocks.deleteCollection.mockReturnValueOnce(gate.promise);
    const hook = renderHook(
      ({ workspaceId }) => useCollections({ workspaceId }),
      {
        initialProps: { workspaceId: "workspace-a" },
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceACollections);
    });

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = hook.result.current.deleteCollection("collection-a");
    });
    hook.rerender({ workspaceId: "workspace-b" });
    window.history.replaceState({}, "", "/workspace/target/dashboard");
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceBCollections);
    });
    act(() => {
      appJotaiStore.set(activeCollectionIdAtom, "collection-b");
    });

    await act(async () => {
      gate.resolve();
      await mutation;
    });

    expect(appJotaiStore.get(collectionsAtom)).toEqual(workspaceBCollections);
    expect(appJotaiStore.get(activeCollectionIdAtom)).toBe("collection-b");
  });

  it("DELETE 期间同 Workspace 切换 Collection 后不覆盖新选中项", async () => {
    const gate = deferred<void>();
    const collectionC = collection("collection-c", "workspace-a");
    workspaceApiMocks.listCollections
      .mockResolvedValueOnce([...workspaceACollections, collectionC])
      .mockResolvedValue([collectionC]);
    workspaceApiMocks.deleteCollection.mockReturnValueOnce(gate.promise);
    const hook = renderHook(
      () => useCollections({ workspaceId: "workspace-a" }),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => {
      expect(appJotaiStore.get(collectionsAtom)).toEqual([
        ...workspaceACollections,
        collectionC,
      ]);
    });
    act(() => {
      appJotaiStore.set(activeCollectionIdAtom, "collection-a");
    });
    await waitFor(() => {
      expect(hook.result.current.activeCollectionId).toBe("collection-a");
    });

    let mutation!: Promise<boolean>;
    act(() => {
      mutation = hook.result.current.deleteCollection("collection-a");
    });
    await waitFor(() => {
      expect(workspaceApiMocks.deleteCollection).toHaveBeenCalledWith(
        "collection-a",
      );
    });
    act(() => {
      appJotaiStore.set(activeCollectionIdAtom, "collection-c");
    });
    await waitFor(() => {
      expect(hook.result.current.activeCollectionId).toBe("collection-c");
    });

    await act(async () => {
      gate.resolve();
      await mutation;
    });

    expect(appJotaiStore.get(activeCollectionIdAtom)).toBe("collection-c");
  });
});
