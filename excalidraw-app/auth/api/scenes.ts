/**
 * Scene API - CRUD operations for scenes
 */

import { apiRequest, apiRequestRaw, jsonBody, binaryBody } from "./client";

import type { WorkspaceScene, CreateSceneDto, UpdateSceneDto } from "./types";

/**
 * List all scenes for the current user
 */
export async function listScenes(): Promise<WorkspaceScene[]> {
  return apiRequest("/workspace/scenes", {
    errorMessage: "Failed to list scenes",
  });
}

/**
 * Get a specific scene by ID
 */
export async function getScene(id: string): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}`, {
    errorMessage: "Failed to get scene",
  });
}

/**
 * Get scene data (the actual Excalidraw content)
 */
export async function getSceneData(id: string): Promise<ArrayBuffer> {
  const response = await apiRequestRaw(`/workspace/scenes/${id}/data`, {
    errorMessage: "Failed to get scene data",
  });
  return response.arrayBuffer();
}

/**
 * Create a new scene
 */
export async function createScene(
  dto: CreateSceneDto,
): Promise<WorkspaceScene> {
  return apiRequest("/workspace/scenes", {
    method: "POST",
    ...jsonBody(dto),
    errorMessage: "Failed to create scene",
  });
}

/**
 * Update a scene
 */
export async function updateScene(
  id: string,
  dto: UpdateSceneDto,
): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}`, {
    method: "PUT",
    ...jsonBody(dto),
    errorMessage: "Failed to update scene",
  });
}

/**
 * Update scene data only (for auto-save)
 */
export async function updateSceneData(
  id: string,
  data: Blob | ArrayBuffer,
): Promise<{ success: boolean }> {
  return apiRequest(`/workspace/scenes/${id}/data`, {
    method: "PUT",
    ...binaryBody(data),
    errorMessage: "Failed to update scene data",
  });
}

/**
 * Upload scene thumbnail (PNG image)
 * Called after successful scene save to update the preview image.
 * This is a best-effort operation - failures are logged but don't affect save status.
 */
export async function uploadSceneThumbnail(
  id: string,
  thumbnailBlob: Blob,
): Promise<{ thumbnailUrl: string }> {
  return apiRequest(`/workspace/scenes/${id}/thumbnail`, {
    method: "PUT",
    ...binaryBody(thumbnailBlob),
    errorMessage: "Failed to upload thumbnail",
  });
}

/**
 * Delete a scene
 */
export async function deleteScene(id: string): Promise<{ success: boolean }> {
  return apiRequest(`/workspace/scenes/${id}`, {
    method: "DELETE",
    errorMessage: "Failed to delete scene",
  });
}

/**
 * 从 sceneId 派生稳定的 AES-GCM JWK `k`（22 字符 base64url）。
 * 不能直接用 ULID 当地 roomKey：WebCrypto importKey 要求 JWK oct 密钥。
 */
export async function roomKeyFromSceneId(sceneId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`excalidraw-scene:${sceneId}`),
  );
  const bytes = new Uint8Array(digest).subarray(0, 16);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Start collaboration on a scene
 */
export async function startCollaboration(
  id: string,
): Promise<{ roomId: string; roomKey: string }> {
  // 本仓协作走现有 collab/WS；roomId 用 sceneId，roomKey 从 sceneId 派生。
  return { roomId: id, roomKey: await roomKeyFromSceneId(id) };
}

export async function acquireSceneLock(
  id: string,
  clientId: string,
  displayName: string,
): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}/lock`, {
    method: "POST",
    ...jsonBody({ clientId, displayName }),
    errorMessage: "Failed to acquire scene lock",
  });
}

export async function releaseSceneLock(
  id: string,
  clientId: string,
): Promise<void> {
  await apiRequest(`/workspace/scenes/${id}/lock?clientId=${encodeURIComponent(clientId)}`, {
    method: "DELETE",
    errorMessage: "Failed to release scene lock",
  });
}

export async function enableSceneCollab(id: string): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}/collab`, {
    method: "POST",
    errorMessage: "Failed to enable scene collaboration",
  });
}

export async function disableSceneCollab(id: string): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}/collab`, {
    method: "DELETE",
    errorMessage: "Failed to disable scene collaboration",
  });
}

/**
 * Duplicate a scene
 */
export async function duplicateScene(id: string): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${id}/duplicate`, {
    method: "POST",
    errorMessage: "Failed to duplicate scene",
  });
}

/**
 * Options for listing scenes
 */
export interface ListScenesOptions {
  /**
   * Filter response to include only specified fields.
   * Reduces payload size when you don't need all scene data.
   *
   * Example: ['id', 'title', 'thumbnailUrl', 'updatedAt', 'isPublic', 'canEdit']
   */
  fields?: string[];
}

/**
 * List scenes in a workspace (optionally filtered by collection)
 *
 * @param workspaceId - The workspace to list scenes from
 * @param collectionId - Optional collection filter
 * @param options - Optional settings like field filtering
 */
export async function listWorkspaceScenes(
  workspaceId: string,
  collectionId?: string,
  options?: ListScenesOptions,
): Promise<WorkspaceScene[]> {
  const params = new URLSearchParams({ workspaceId });
  if (collectionId) {
    params.append("collectionId", collectionId);
  }
  if (options?.fields?.length) {
    params.append("fields", options.fields.join(","));
  }

  return apiRequest(`/workspace/scenes?${params.toString()}`, {
    errorMessage: "Failed to list scenes",
  });
}

/**
 * Move a scene to a different collection
 */
export async function moveScene(
  sceneId: string,
  collectionId: string | null,
): Promise<WorkspaceScene> {
  return apiRequest(`/workspace/scenes/${sceneId}/move`, {
    method: "PUT",
    ...jsonBody({ collectionId }),
    errorMessage: "Failed to move scene",
  });
}
