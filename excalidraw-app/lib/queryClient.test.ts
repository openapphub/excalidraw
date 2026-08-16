import { beforeEach, describe, expect, it } from "vitest";

import { appJotaiStore, userAtom, type User } from "../app-jotai";

import { queryClient } from "./queryClient";

const user = (id: string, name = id): User => ({
  id,
  subject: id,
  login: id,
  name,
  avatarUrl: "",
});

describe("QueryClient 身份隔离", () => {
  beforeEach(() => {
    appJotaiStore.set(userAtom, null);
    queryClient.clear();
  });

  it("用户 ID 变化时同步清空上一用户缓存", () => {
    appJotaiStore.set(userAtom, user("user-a"));
    queryClient.setQueryData(["workspaces"], [{ id: "workspace-a" }]);

    appJotaiStore.set(userAtom, user("user-b"));

    expect(queryClient.getQueryData(["workspaces"])).toBeUndefined();
  });

  it("同一用户资料更新不清空资源缓存", () => {
    appJotaiStore.set(userAtom, user("user-a"));
    queryClient.setQueryData(["workspaces"], [{ id: "workspace-a" }]);

    appJotaiStore.set(userAtom, user("user-a", "新名称"));

    expect(queryClient.getQueryData(["workspaces"])).toEqual([
      { id: "workspace-a" },
    ]);
  });
});
