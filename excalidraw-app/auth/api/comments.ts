/**
 * Comments API - CRUD operations for comment threads and comments
 *
 * 本仓后端更新用 PUT（与 workspaces/members 一致，服务端同时接受 PATCH）。
 */

import { apiRequest, jsonBody } from "./client";

import type {
  CommentThread,
  Comment,
  CreateThreadDto,
  CreateCommentDto,
  UpdateThreadDto,
  UpdateCommentDto,
} from "./types";

// ============================================================================
// Thread Operations
// ============================================================================

export interface ListThreadsOptions {
  /** Filter by resolved status */
  resolved?: boolean;
  /** Sort order */
  sort?: "date" | "unread";
  /** Fields to include in response */
  fields?: string[];
}

/**
 * List all comment threads for a scene
 */
export async function listThreads(
  sceneId: string,
  options?: ListThreadsOptions,
): Promise<CommentThread[]> {
  const params = new URLSearchParams();
  if (options?.resolved !== undefined) {
    params.append("resolved", String(options.resolved));
  }
  if (options?.sort) {
    params.append("sort", options.sort);
  }
  if (options?.fields?.length) {
    params.append("fields", options.fields.join(","));
  }

  const queryString = params.toString();
  const url = `/scenes/${sceneId}/threads${
    queryString ? `?${queryString}` : ""
  }`;

  return apiRequest(url, {
    errorMessage: "Failed to list comment threads",
  });
}

/**
 * Get a single thread with all its comments
 */
export async function getThread(threadId: string): Promise<CommentThread> {
  return apiRequest(`/threads/${threadId}`, {
    errorMessage: "Failed to get comment thread",
  });
}

/**
 * Create a new thread with its first comment
 */
export async function createThread(
  sceneId: string,
  dto: CreateThreadDto,
): Promise<CommentThread> {
  return apiRequest(`/scenes/${sceneId}/threads`, {
    method: "POST",
    ...jsonBody(dto),
    errorMessage: "Failed to create comment thread",
  });
}

/**
 * Update thread position
 */
export async function updateThread(
  threadId: string,
  dto: UpdateThreadDto,
): Promise<CommentThread> {
  return apiRequest(`/threads/${threadId}`, {
    method: "PUT",
    ...jsonBody(dto),
    errorMessage: "Failed to update thread position",
  });
}

/**
 * Delete a thread and all its comments
 */
export async function deleteThread(
  threadId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/threads/${threadId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete comment thread",
  });
}

/**
 * Mark a thread as resolved
 */
export async function resolveThread(threadId: string): Promise<CommentThread> {
  return apiRequest(`/threads/${threadId}/resolve`, {
    method: "POST",
    errorMessage: "Failed to resolve thread",
  });
}

/**
 * Reopen a resolved thread
 */
export async function reopenThread(threadId: string): Promise<CommentThread> {
  return apiRequest(`/threads/${threadId}/reopen`, {
    method: "POST",
    errorMessage: "Failed to reopen thread",
  });
}

// ============================================================================
// Comment Operations
// ============================================================================

/**
 * Add a reply to an existing thread
 */
export async function addComment(
  threadId: string,
  dto: CreateCommentDto,
): Promise<Comment> {
  return apiRequest(`/threads/${threadId}/comments`, {
    method: "POST",
    ...jsonBody(dto),
    errorMessage: "Failed to add comment",
  });
}

/**
 * Edit a comment's content
 */
export async function updateComment(
  commentId: string,
  dto: UpdateCommentDto,
): Promise<Comment> {
  return apiRequest(`/comments/${commentId}`, {
    method: "PUT",
    ...jsonBody(dto),
    errorMessage: "Failed to update comment",
  });
}

/**
 * Delete a single comment
 */
export async function deleteComment(
  commentId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/comments/${commentId}`, {
    method: "DELETE",
    errorMessage: "Failed to delete comment",
  });
}
