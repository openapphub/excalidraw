import { describe, expect, it } from "vitest";

import {
  getCollectionDeleteRedirect,
  getCollectionMoveRedirect,
} from "./collectionMutationRouting";

describe("Collection mutation routing", () => {
  it("删除当前 Scene 所属 Collection 后跳转 Dashboard", () => {
    expect(
      getCollectionDeleteRedirect({
        routeAtStart: {
          type: "scene",
          workspaceSlug: "source",
          sceneId: "scene-a",
        },
        currentRoute: {
          type: "scene",
          workspaceSlug: "source",
          sceneId: "scene-a",
        },
        collectionId: "collection-a",
        currentSceneBelongsToCollection: true,
      }),
    ).toBe("/workspace/source/dashboard");
  });

  it("移动当前 Collection 和 Scene 后使用目标 Workspace slug", () => {
    expect(
      getCollectionMoveRedirect({
        routeAtStart: {
          type: "collection",
          workspaceSlug: "source",
          collectionId: "collection-a",
        },
        currentRoute: {
          type: "collection",
          workspaceSlug: "source",
          collectionId: "collection-a",
        },
        collectionId: "collection-a",
        currentSceneBelongsToCollection: false,
        targetWorkspaceSlug: "target",
      }),
    ).toBe("/workspace/target/collection/collection-a");

    expect(
      getCollectionMoveRedirect({
        routeAtStart: {
          type: "scene",
          workspaceSlug: "source",
          sceneId: "scene-a",
        },
        currentRoute: {
          type: "scene",
          workspaceSlug: "source",
          sceneId: "scene-a",
        },
        collectionId: "collection-a",
        currentSceneBelongsToCollection: true,
        targetWorkspaceSlug: "target",
      }),
    ).toBe("/workspace/target/scene/scene-a");
  });

  it("mutation 期间用户已导航时不覆盖新 URL", () => {
    const routeAtStart = {
      type: "scene" as const,
      workspaceSlug: "source",
      sceneId: "scene-a",
    };
    const currentRoute = {
      type: "scene" as const,
      workspaceSlug: "source",
      sceneId: "scene-b",
    };

    expect(
      getCollectionDeleteRedirect({
        routeAtStart,
        currentRoute,
        collectionId: "collection-a",
        currentSceneBelongsToCollection: true,
      }),
    ).toBeNull();
    expect(
      getCollectionMoveRedirect({
        routeAtStart,
        currentRoute,
        collectionId: "collection-a",
        currentSceneBelongsToCollection: true,
        targetWorkspaceSlug: "target",
      }),
    ).toBeNull();
  });
});
