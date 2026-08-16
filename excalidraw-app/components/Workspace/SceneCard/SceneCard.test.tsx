import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SceneCard } from "./SceneCard";

import type { WorkspaceScene } from "../../../auth/workspaceApi";

const scene: WorkspaceScene = {
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
};

const renderCard = (isActive: boolean, onOpen = vi.fn()) => {
  render(
    <SceneCard
      scene={scene}
      isActive={isActive}
      onOpen={onOpen}
      onDuplicate={() => undefined}
    />,
  );
  const card = screen
    .getByRole("heading", { name: scene.title })
    .closest('[role="button"]');
  if (!card) {
    throw new Error("找不到 Scene 卡片");
  }
  return { card, onOpen };
};

describe("SceneCard 当前 Scene 重试", () => {
  it("当前卡片的主指针操作只触发一次打开", () => {
    const { card, onOpen } = renderCard(true);

    fireEvent.pointerDown(card, { button: 0, isPrimary: true });
    fireEvent.click(card);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("非当前卡片仍由 click 打开", () => {
    const { card, onOpen } = renderCard(false);

    fireEvent.pointerDown(card, { button: 0, isPrimary: true });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.click(card);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("更多操作按钮不会提前打开 Scene", () => {
    const { onOpen } = renderCard(true);
    const menuButton = screen.getByRole("button", { name: "More options" });

    fireEvent.pointerDown(menuButton, { button: 0, isPrimary: true });
    fireEvent.click(menuButton);

    expect(onOpen).not.toHaveBeenCalled();
  });
});
