import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Provider, appJotaiStore, userAtom } from "../../../app-jotai";
import { quickSearchOpenAtom } from "../../Settings/settingsState";

import { QuickSearchModal } from "./QuickSearchModal";

import type { GlobalSearchResponse } from "../../../auth/workspaceApi";
import type { User } from "../../../app-jotai";

const workspaceApiMocks = vi.hoisted(() => ({
  globalSearch: vi.fn(),
}));

vi.mock("../../../auth/workspaceApi", () => workspaceApiMocks);
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

const user = (id: string): User => ({
  id,
  subject: id,
  login: id,
  name: id,
  avatarUrl: "",
});

const searchResponse = (userId: string): GlobalSearchResponse => ({
  collections: [],
  scenes: [
    {
      id: `scene-${userId}`,
      title: `secret-${userId}`,
      thumbnailUrl: null,
      collectionId: null,
      collectionName: null,
      isPrivate: false,
      workspaceId: `workspace-${userId}`,
      workspaceName: `workspace-${userId}`,
      workspaceSlug: `workspace-${userId}`,
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
});

describe("QuickSearchModal 身份隔离", () => {
  beforeEach(() => {
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    workspaceApiMocks.globalSearch.mockReset();
    appJotaiStore.set(userAtom, null);
    appJotaiStore.set(quickSearchOpenAtom, false);
  });

  it("身份切换后不显示旧缓存，旧请求也不能覆盖新用户结果", async () => {
    const userBRequest = deferred<GlobalSearchResponse>();
    workspaceApiMocks.globalSearch
      .mockResolvedValueOnce(searchResponse("user-a"))
      .mockReturnValueOnce(userBRequest.promise)
      .mockResolvedValueOnce(searchResponse("user-c"))
      .mockResolvedValueOnce(searchResponse("user-b"));

    appJotaiStore.set(userAtom, user("user-a"));
    appJotaiStore.set(quickSearchOpenAtom, true);
    render(
      <Provider store={appJotaiStore}>
        <QuickSearchModal />
      </Provider>,
    );

    const input = screen.getByPlaceholderText(
      "workspace.quickSearchPlaceholder",
    );
    fireEvent.change(input, { target: { value: "secret-user-a" } });
    expect(await screen.findByText("secret-user-a")).toBeInTheDocument();

    act(() => {
      appJotaiStore.set(userAtom, user("user-b"));
    });
    await waitFor(() => {
      expect(workspaceApiMocks.globalSearch).toHaveBeenCalledTimes(2);
      expect(screen.queryByText("secret-user-a")).not.toBeInTheDocument();
    });

    act(() => {
      appJotaiStore.set(userAtom, user("user-c"));
    });
    fireEvent.change(input, { target: { value: "secret-user-c" } });
    expect(await screen.findByText("secret-user-c")).toBeInTheDocument();

    await act(async () => {
      userBRequest.resolve(searchResponse("user-b"));
      await userBRequest.promise;
    });
    expect(screen.queryByText("secret-user-b")).not.toBeInTheDocument();
    expect(screen.getByText("secret-user-c")).toBeInTheDocument();

    act(() => {
      appJotaiStore.set(userAtom, user("user-b"));
    });
    await waitFor(() => {
      expect(workspaceApiMocks.globalSearch).toHaveBeenCalledTimes(4);
    });
  });
});
