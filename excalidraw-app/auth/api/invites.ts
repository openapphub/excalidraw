/**
 * Invite Links API - Workspace invite link management
 */

import { apiRequest, jsonBody } from "./client";

import type { InviteLink, Workspace, WorkspaceRole } from "./types";

/**
 * List invite links for a workspace
 */
export async function listInviteLinks(
  workspaceId: string,
): Promise<InviteLink[]> {
  return apiRequest(`/workspaces/${workspaceId}/invite-links`, {
    errorMessage: "Failed to list invite links",
  });
}

/**
 * Create an invite link
 */
export async function createInviteLink(
  workspaceId: string,
  options?: { role?: WorkspaceRole; expiresAt?: string; maxUses?: number },
): Promise<InviteLink> {
  return apiRequest(`/workspaces/${workspaceId}/invite-links`, {
    method: "POST",
    ...jsonBody(options || {}),
    errorMessage: "Failed to create invite link",
  });
}

/**
 * Delete an invite link
 */
export async function deleteInviteLink(
  workspaceId: string,
  linkId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/workspaces/${workspaceId}/invite-links/${linkId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete invite link",
  });
}

/**
 * Join a workspace via invite link
 */
export async function joinViaInviteLink(code: string): Promise<Workspace> {
  return apiRequest("/workspaces/join", {
    method: "POST",
    ...jsonBody({ code }),
    errorMessage: "Failed to join workspace",
  });
}
