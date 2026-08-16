import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CopyMoveDialog } from "./CopyMoveDialog";

import type { Workspace } from "../../../auth/workspaceApi";

const workspaceApiMocks = vi.hoisted(() => ({
  listWorkspaces: vi.fn(),
  copyCollectionToWorkspace: vi.fn(),
  moveCollectionToWorkspace: vi.fn(),
  getScene: vi.fn(),
}));

vi.mock("../../../auth/workspaceApi", () => workspaceApiMocks);
vi.mock("@excalidraw/excalidraw/i18n", () => ({
  t: (key: string) => key,
}));
vi.mock("@excalidraw/excalidraw/components/Dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@excalidraw/excalidraw/components/FilledButton", () => ({
  FilledButton: ({
    label,
    onClick,
  }: {
    label: string;
    onClick: () => void;
  }) => <button onClick={onClick}>{label}</button>,
}));
vi.mock("../../../utils/toast", () => ({
  showError: vi.fn(),
}));

const targetWorkspace = {
  id: "workspace-b",
  name: "Target",
  slug: "target",
  avatarUrl: null,
  role: "ADMIN",
  type: "SHARED",
  memberCount: 1,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
} as Workspace;

describe("CopyMoveDialog", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/workspace/source/scene/scene-a");
    Object.values(workspaceApiMocks).forEach((mock) => mock.mockReset());
    workspaceApiMocks.listWorkspaces.mockResolvedValue([targetWorkspace]);
    workspaceApiMocks.getScene.mockResolvedValue({
      id: "scene-a",
      collectionId: "collection-a",
    });
    workspaceApiMocks.copyCollectionToWorkspace.mockResolvedValue({});
  });

  it("COPY 当前 Scene 所属 Collection 时先保存再调用复制 API", async () => {
    const onBeforeMutation = vi.fn().mockResolvedValue(undefined);
    render(
      <CopyMoveDialog
        isOpen={true}
        onClose={vi.fn()}
        collectionId="collection-a"
        collectionName="Collection A"
        mode="copy"
        onBeforeMutation={onBeforeMutation}
      />,
    );

    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: targetWorkspace.id } });
    fireEvent.click(screen.getByRole("button", { name: "buttons.copy" }));

    await waitFor(() => {
      expect(workspaceApiMocks.copyCollectionToWorkspace).toHaveBeenCalledWith(
        "collection-a",
        targetWorkspace.id,
      );
    });
    expect(onBeforeMutation).toHaveBeenCalledTimes(1);
    expect(onBeforeMutation.mock.invocationCallOrder[0]).toBeLessThan(
      workspaceApiMocks.copyCollectionToWorkspace.mock.invocationCallOrder[0],
    );
  });
});
