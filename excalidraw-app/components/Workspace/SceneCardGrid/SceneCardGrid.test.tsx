import { render, screen } from "@testing-library/react";

import { SceneCardGrid } from "./SceneCardGrid";

import type { WorkspaceScene } from "../../../auth/workspaceApi";

const createScene = (
  overrides: Partial<WorkspaceScene> = {},
): WorkspaceScene => ({
  id: "scene-1",
  title: "设计草图",
  thumbnailUrl: null,
  storageKey: "scene-1",
  roomId: null,
  workspaceId: "workspace-1",
  collectionId: "collection-1",
  isPublic: false,
  lastOpenedAt: null,
  createdAt: "2026-08-16T00:00:00.000Z",
  updatedAt: "2026-08-16T00:00:00.000Z",
  ...overrides,
});

describe("SceneCardGrid 编辑锁标识", () => {
  it("私有 Scene 没有活跃编辑者时不显示锁", () => {
    render(
      <SceneCardGrid scenes={[createScene()]} onOpenScene={() => undefined} />,
    );

    expect(screen.queryByTitle("私有")).not.toBeInTheDocument();
  });

  it("存在活跃编辑者时显示编辑锁", () => {
    render(
      <SceneCardGrid
        scenes={[
          createScene({
            editor: { userId: "user-2", name: "Alice", isSelf: false },
          }),
        ]}
        onOpenScene={() => undefined}
      />,
    );

    expect(screen.getByTitle("Alice 正在编辑")).toBeInTheDocument();
  });
});
