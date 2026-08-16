import { describe, expect, it } from "vitest";

import {
  canCommitWorkspaceRouteMutation,
  canCommitWorkspaceMutation,
  getWorkspaceDeleteRedirect,
} from "./workspaceMutationRouting";

describe("Workspace mutation routing", () => {
  it("同一 Workspace 内切换页面后仍可提交元数据，但不改变页面身份", () => {
    expect(
      canCommitWorkspaceMutation({
        mutationWorkspaceId: "workspace-a",
        mutationWorkspaceSlug: "source",
        currentWorkspaceId: "workspace-a",
        currentRoute: {
          type: "scene",
          workspaceSlug: "source",
          sceneId: "scene-b",
        },
      }),
    ).toBe(true);
  });

  it("mutation 期间切到其他 Workspace 后拒绝旧响应提交", () => {
    expect(
      canCommitWorkspaceMutation({
        mutationWorkspaceId: "workspace-a",
        mutationWorkspaceSlug: "source",
        currentWorkspaceId: "workspace-b",
        currentRoute: {
          type: "dashboard",
          workspaceSlug: "target",
        },
      }),
    ).toBe(false);
    expect(
      canCommitWorkspaceMutation({
        mutationWorkspaceId: "workspace-a",
        mutationWorkspaceSlug: "source",
        currentWorkspaceId: "workspace-a",
        currentRoute: {
          type: "dashboard",
          workspaceSlug: "target",
        },
      }),
    ).toBe(false);
  });

  it("Scene CREATE 期间任意导航都会使旧响应失去路由提交权", () => {
    expect(
      canCommitWorkspaceRouteMutation({
        workspaceIdAtStart: "workspace-a",
        currentWorkspaceId: "workspace-a",
        urlAtStart: "http://localhost/workspace/source/dashboard",
        currentUrl: "http://localhost/workspace/source/scene/scene-b",
      }),
    ).toBe(false);
    expect(
      canCommitWorkspaceRouteMutation({
        workspaceIdAtStart: "workspace-a",
        currentWorkspaceId: "workspace-a",
        urlAtStart: "http://localhost/workspace/source/dashboard",
        currentUrl: "http://localhost/workspace/source/dashboard",
      }),
    ).toBe(true);
  });

  it("删除当前 Workspace 后跳转剩余 Workspace，删除最后一个则回首页", () => {
    expect(
      getWorkspaceDeleteRedirect({
        deletedWorkspaceSlug: "source",
        currentRoute: {
          type: "settings",
          workspaceSlug: "source",
        },
        fallbackWorkspaceSlug: "target",
      }),
    ).toBe("/workspace/target/dashboard");
    expect(
      getWorkspaceDeleteRedirect({
        deletedWorkspaceSlug: "source",
        currentRoute: {
          type: "scene",
          workspaceSlug: "source",
          sceneId: "scene-a",
        },
        fallbackWorkspaceSlug: null,
      }),
    ).toBe("/");
  });

  it("删除期间已导航到其他 Workspace 时不覆盖新 URL", () => {
    expect(
      getWorkspaceDeleteRedirect({
        deletedWorkspaceSlug: "source",
        currentRoute: {
          type: "dashboard",
          workspaceSlug: "target",
        },
        fallbackWorkspaceSlug: "target",
      }),
    ).toBeNull();
  });
});
