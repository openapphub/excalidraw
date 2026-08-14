/**
 * Members API - Workspace member management
 */

import { apiRequest, jsonBody } from "./client";

import type { WorkspaceMember, WorkspaceRole } from "./types";

/**
 * List all members of a workspace
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  return apiRequest(`/workspaces/${workspaceId}/members`, {
    errorMessage: "Failed to list members",
  });
}

/**
 * Invite a user to the workspace by email
 */
export async function inviteToWorkspace(
  workspaceId: string,
  email: string,
  role?: WorkspaceRole,
): Promise<WorkspaceMember> {
  return apiRequest(`/workspaces/${workspaceId}/members/invite`, {
    method: "POST",
    ...jsonBody({ email, role }),
    errorMessage: "Failed to invite user",
  });
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMember> {
  return apiRequest(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: "PUT",
    ...jsonBody({ role }),
    errorMessage: "Failed to update member role",
  });
}

/**
 * Remove a member from the workspace
 */
export async function removeMember(
  workspaceId: string,
  memberId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/workspaces/${workspaceId}/members/${memberId}`, {
    method: "DELETE",
    errorMessage: "Failed to remove member",
  });
}
