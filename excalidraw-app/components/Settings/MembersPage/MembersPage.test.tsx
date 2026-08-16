import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MembersPage } from "./MembersPage";

import type { WorkspaceMember } from "../../../auth/workspaceApi";

const workspaceApiMocks = vi.hoisted(() => ({
  listWorkspaceMembers: vi.fn(),
  updateMemberRole: vi.fn(),
  removeMember: vi.fn(),
  createInviteLink: vi.fn(),
}));

vi.mock("../../../auth/workspaceApi", () => workspaceApiMocks);
vi.mock("@excalidraw/excalidraw/i18n", () => ({
  t: (key: string) => key,
}));
vi.mock("../../../utils/toast", () => ({
  showSuccess: vi.fn(),
}));

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const member = (id: string, name: string, email: string): WorkspaceMember => ({
  id,
  role: "MEMBER",
  userId: id,
  user: {
    id,
    name,
    email,
    avatarUrl: null,
  },
  createdAt: "2026-01-01T00:00:00Z",
});

describe("MembersPage Workspace 上下文", () => {
  beforeEach(() => {
    Object.values(workspaceApiMocks).forEach((mock) => mock.mockReset());
  });

  it("旧 Workspace 的慢列表响应不会覆盖新 Workspace 成员", async () => {
    const workspaceAGate = deferred<WorkspaceMember[]>();
    const memberA = member("member-a", "Alice", "alice@example.com");
    const memberB = member("member-b", "Bob", "bob@example.com");
    workspaceApiMocks.listWorkspaceMembers.mockImplementation(
      (workspaceId: string) =>
        workspaceId === "workspace-a"
          ? workspaceAGate.promise
          : Promise.resolve([memberB]),
    );

    const view = render(
      <MembersPage workspaceId="workspace-a" isAdmin={true} />,
    );
    await waitFor(() => {
      expect(workspaceApiMocks.listWorkspaceMembers).toHaveBeenCalledWith(
        "workspace-a",
      );
    });

    view.rerender(<MembersPage workspaceId="workspace-b" isAdmin={true} />);
    await screen.findByText("Bob");

    await act(async () => {
      workspaceAGate.resolve([memberA]);
      await workspaceAGate.promise;
    });

    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.queryByText("Alice")).not.toBeInTheDocument();
  });
});
