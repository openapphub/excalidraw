import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Provider, appJotaiStore } from "../app-jotai";
import {
  currentWorkspaceAtom,
  currentWorkspaceSlugAtom,
  workspacesAtom,
} from "../components/Settings/settingsState";

import { useWorkspaces } from "./useWorkspaces";

import type { PropsWithChildren } from "react";
import type { Workspace } from "../auth/workspaceApi";

const workspaceApiMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  createWorkspace: vi.fn(),
  deleteWorkspace: vi.fn(),
}));

vi.mock("../auth/workspaceApi", () => workspaceApiMocks);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const workspace = (id: string, slug: string): Workspace =>
  ({
    id,
    slug,
    name: id,
    avatarUrl: null,
    role: "ADMIN",
    type: "SHARED",
    memberCount: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  } as Workspace);

const workspaceA = workspace("workspace-a", "source");
const workspaceB = workspace("workspace-b", "target");

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

describe("useWorkspaces mutation 上下文", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/workspace/source/dashboard");
    appJotaiStore.set(workspacesAtom, []);
    appJotaiStore.set(currentWorkspaceAtom, workspaceA);
    appJotaiStore.set(currentWorkspaceSlugAtom, workspaceA.slug);
    Object.values(workspaceApiMocks).forEach((mock) => mock.mockReset());
    workspaceApiMocks.listWorkspaces.mockResolvedValue([
      workspaceA,
      workspaceB,
    ]);
  });

  it("CREATE 期间用户切 Workspace 后不选中新建结果", async () => {
    const gate = deferred<Workspace>();
    const workspaceC = workspace("workspace-c", "created");
    workspaceApiMocks.createWorkspace.mockReturnValueOnce(gate.promise);
    const hook = renderHook(() => useWorkspaces({ isAuthenticated: true }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(appJotaiStore.get(workspacesAtom)).toEqual([
        workspaceA,
        workspaceB,
      ]);
    });

    let mutation!: Promise<Workspace>;
    act(() => {
      mutation = hook.result.current.createWorkspace({
        name: workspaceC.name,
        slug: workspaceC.slug,
        type: "SHARED",
      });
    });
    act(() => {
      appJotaiStore.set(currentWorkspaceAtom, workspaceB);
      appJotaiStore.set(currentWorkspaceSlugAtom, workspaceB.slug);
      window.history.replaceState({}, "", "/workspace/target/dashboard");
    });

    await act(async () => {
      gate.resolve(workspaceC);
      await mutation;
    });

    expect(appJotaiStore.get(currentWorkspaceAtom)?.id).toBe(workspaceB.id);
    expect(appJotaiStore.get(currentWorkspaceSlugAtom)).toBe(workspaceB.slug);
  });

  it("DELETE 期间用户切 Workspace 后不回退到列表第一项或覆盖 URL", async () => {
    const gate = deferred<{ success: boolean }>();
    workspaceApiMocks.deleteWorkspace.mockReturnValueOnce(gate.promise);
    const hook = renderHook(() => useWorkspaces({ isAuthenticated: true }), {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(appJotaiStore.get(workspacesAtom)).toEqual([
        workspaceA,
        workspaceB,
      ]);
    });

    let mutation!: Promise<void>;
    act(() => {
      mutation = hook.result.current.deleteWorkspace(workspaceA.id);
    });
    act(() => {
      appJotaiStore.set(currentWorkspaceAtom, workspaceB);
      appJotaiStore.set(currentWorkspaceSlugAtom, workspaceB.slug);
      window.history.replaceState({}, "", "/workspace/target/dashboard");
    });
    workspaceApiMocks.listWorkspaces.mockResolvedValue([workspaceB]);

    await act(async () => {
      gate.resolve({ success: true });
      await mutation;
    });

    expect(appJotaiStore.get(currentWorkspaceAtom)?.id).toBe(workspaceB.id);
    expect(appJotaiStore.get(currentWorkspaceSlugAtom)).toBe(workspaceB.slug);
    expect(window.location.pathname).toBe("/workspace/target/dashboard");
  });
});
