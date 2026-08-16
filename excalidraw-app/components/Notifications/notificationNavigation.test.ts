import { beforeEach, describe, expect, it, vi } from "vitest";

import { resolveNotificationUrl } from "./notificationNavigation";

const workspaceApiMocks = vi.hoisted(() => ({
  getScene: vi.fn(),
  getWorkspace: vi.fn(),
}));

vi.mock("../../auth/workspaceApi", () => workspaceApiMocks);

describe("resolveNotificationUrl", () => {
  beforeEach(() => {
    workspaceApiMocks.getScene.mockReset();
    workspaceApiMocks.getWorkspace.mockReset();
  });

  it("使用 Scene 所属 Workspace 的权威 slug 构造深链", async () => {
    workspaceApiMocks.getScene.mockResolvedValue({
      id: "scene-a",
      workspaceId: "workspace-b",
    });
    workspaceApiMocks.getWorkspace.mockResolvedValue({
      id: "workspace-b",
      slug: "team-b",
    });

    await expect(
      resolveNotificationUrl({
        sceneId: "scene-a",
        threadId: "thread-a",
        commentId: "comment-a",
      }),
    ).resolves.toBe(
      "/workspace/team-b/scene/scene-a?thread=thread-a&comment=comment-a",
    );
  });

  it("Scene 已删除或无权访问时拒绝导航", async () => {
    workspaceApiMocks.getScene.mockRejectedValue(new Error("Not found"));

    await expect(
      resolveNotificationUrl({ sceneId: "deleted-scene" }),
    ).rejects.toThrow("Not found");
    expect(workspaceApiMocks.getWorkspace).not.toHaveBeenCalled();
  });
});
