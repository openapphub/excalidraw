/**
 * Collections API - Collection CRUD and team access management
 */

import { apiRequest, jsonBody } from "./client";
import { sceneClientHeaders } from "../sceneClient";

import type {
  Collection,
  CollectionAccessLevel,
  CollectionTeamAccess,
} from "./types";

// ============================================================================
// Collection CRUD
// ============================================================================

/**
 * Options for listing collections
 */
export interface ListCollectionsOptions {
  /**
   * Filter response to include only specified fields.
   * Reduces payload size when you don't need all collection data.
   *
   * Example: ['id', 'name', 'icon', 'isPrivate', 'sceneCount', 'canWrite', 'isOwner']
   */
  fields?: string[];
}

/**
 * List all accessible collections in a workspace
 *
 * @param workspaceId - The workspace to list collections from
 * @param options - Optional settings like field filtering
 */
export async function listCollections(
  workspaceId: string,
  options?: ListCollectionsOptions,
): Promise<Collection[]> {
  const params = new URLSearchParams();
  if (options?.fields?.length) {
    params.append("fields", options.fields.join(","));
  }

  const queryString = params.toString();
  const url = queryString
    ? `/workspaces/${workspaceId}/collections?${queryString}`
    : `/workspaces/${workspaceId}/collections`;

  return apiRequest(url, {
    errorMessage: "Failed to list collections",
  });
}

/**
 * Create a new collection
 */
export async function createCollection(
  workspaceId: string,
  data: {
    name: string;
    icon?: string;
    color?: string;
    isPrivate?: boolean;
  },
): Promise<Collection> {
  return apiRequest(`/workspaces/${workspaceId}/collections`, {
    method: "POST",
    ...jsonBody(data),
    errorMessage: "Failed to create collection",
  });
}

/**
 * Get a single collection
 */
export async function getCollection(collectionId: string): Promise<Collection> {
  return apiRequest(`/collections/${collectionId}`, {
    errorMessage: "Failed to get collection",
  });
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: string,
  data: {
    name?: string;
    icon?: string;
    color?: string;
    isPrivate?: boolean;
  },
): Promise<Collection> {
  return apiRequest(`/collections/${collectionId}`, {
    method: "PUT",
    ...jsonBody(data),
    errorMessage: "Failed to update collection",
  });
}

/**
 * Delete a collection
 */
export async function deleteCollection(
  collectionId: string,
): Promise<{ success: boolean }> {
  return apiRequest(`/collections/${collectionId}`, {
    method: "DELETE",
    headers: sceneClientHeaders(),
    errorMessage: "Failed to delete collection",
  });
}

/**
 * Copy a collection to another workspace
 */
export async function copyCollectionToWorkspace(
  collectionId: string,
  targetWorkspaceId: string,
): Promise<Collection> {
  return apiRequest(`/collections/${collectionId}/copy-to-workspace`, {
    method: "POST",
    ...jsonBody({ targetWorkspaceId }),
    errorMessage: "Failed to copy collection",
  });
}

/**
 * Move a collection to another workspace
 */
export async function moveCollectionToWorkspace(
  collectionId: string,
  targetWorkspaceId: string,
): Promise<Collection> {
  return apiRequest(`/collections/${collectionId}/move-to-workspace`, {
    method: "POST",
    headers: sceneClientHeaders(),
    ...jsonBody({ targetWorkspaceId }),
    errorMessage: "Failed to move collection",
  });
}

// ============================================================================
// Collection Team Access
// ============================================================================

/**
 * List teams with access to a collection — 2A stub（无 Teams）
 */
export async function listCollectionTeams(
  _workspaceId: string,
  _collectionId: string,
): Promise<CollectionTeamAccess[]> {
  return [];
}

/**
 * Set team access — 2A stub
 */
export async function setCollectionTeamAccess(
  _workspaceId: string,
  _collectionId: string,
  _teamId: string,
  _accessLevel: CollectionAccessLevel = "EDIT",
): Promise<{ success: boolean }> {
  return { success: false };
}

/**
 * Remove team access — 2A stub
 */
export async function removeCollectionTeamAccess(
  _workspaceId: string,
  _collectionId: string,
  _teamId: string,
): Promise<{ success: boolean }> {
  return { success: false };
}
