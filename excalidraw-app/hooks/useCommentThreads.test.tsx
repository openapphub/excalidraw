import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "../lib/queryClient";

import { useCommentMutations } from "./useCommentThreads";

import type { PropsWithChildren } from "react";
import type { CommentThread } from "../auth/api/types";

const commentsApiMocks = vi.hoisted(() => ({
  listThreads: vi.fn(),
  createThread: vi.fn(),
  deleteThread: vi.fn(),
  resolveThread: vi.fn(),
  reopenThread: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  updateThread: vi.fn(),
}));

const commentSyncMocks = vi.hoisted(() => ({
  emitEvent: vi.fn(),
}));

vi.mock("../auth/api/comments", () => commentsApiMocks);
vi.mock("../components/Comments/CommentSyncContext", () => ({
  useCommentSyncContext: () => ({ emitEvent: commentSyncMocks.emitEvent }),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const thread = (id: string, sceneId: string): CommentThread => ({
  id,
  sceneId,
  x: 10,
  y: 20,
  resolved: false,
  createdBy: {
    id: "user-a",
    name: "User A",
    email: "a@example.com",
  },
  comments: [],
  commentCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
});

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

describe("useCommentMutations Scene 上下文", () => {
  beforeEach(() => {
    Object.values(commentsApiMocks).forEach((mock) => mock.mockReset());
    commentSyncMocks.emitEvent = vi.fn();
  });

  it("Scene A 的完成响应只更新 A 缓存并广播到 A 房间", async () => {
    const gate = deferred<CommentThread>();
    commentsApiMocks.createThread.mockReturnValueOnce(gate.promise);
    const emitSceneA = commentSyncMocks.emitEvent;
    const { queryClient, wrapper } = createHarness();
    const keyA = queryKeys.commentThreads.list("scene-a");
    const keyB = queryKeys.commentThreads.list("scene-b");
    const threadA = thread("thread-a", "scene-a");
    const threadB = thread("thread-b", "scene-b");
    queryClient.setQueryData(keyA, [threadA]);
    queryClient.setQueryData(keyB, [threadB]);
    const hook = renderHook(({ sceneId }) => useCommentMutations(sceneId), {
      initialProps: { sceneId: "scene-a" },
      wrapper,
    });

    let mutation!: Promise<CommentThread>;
    act(() => {
      mutation = hook.result.current.createThread({
        x: 30,
        y: 40,
        content: "comment-a",
      });
    });
    await waitFor(() => {
      expect(commentsApiMocks.createThread).toHaveBeenCalledWith("scene-a", {
        x: 30,
        y: 40,
        content: "comment-a",
      });
    });

    const emitSceneB = vi.fn();
    commentSyncMocks.emitEvent = emitSceneB;
    hook.rerender({ sceneId: "scene-b" });
    const created = thread("thread-new-a", "scene-a");

    await act(async () => {
      gate.resolve(created);
      await mutation;
    });

    expect(queryClient.getQueryData(keyA)).toEqual([threadA, created]);
    expect(queryClient.getQueryData(keyB)).toEqual([threadB]);
    expect(emitSceneA).toHaveBeenCalledWith({
      type: "thread-created",
      thread: created,
    });
    expect(emitSceneB).not.toHaveBeenCalled();
  });
});
