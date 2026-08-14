/**
 * Search API - Global search across all workspaces
 */

import { apiRequest } from "./client";

import type {
  GlobalSearchResponse,
  GlobalSearchCollectionResult,
  GlobalSearchSceneResult,
} from "./types";

export type {
  GlobalSearchResponse,
  GlobalSearchCollectionResult,
  GlobalSearchSceneResult,
};

/**
 * Perform a global search across all workspaces the user has access to.
 *
 * @param query - Optional search query to filter results
 * @param limit - Maximum number of results per category (default: 50)
 * @returns Collections and scenes matching the query from all accessible workspaces
 */
export async function globalSearch(
  query?: string,
  limit: number = 50,
): Promise<GlobalSearchResponse> {
  const params = new URLSearchParams();
  if (query) {
    params.append("q", query);
  }
  if (limit !== 50) {
    params.append("limit", limit.toString());
  }

  const queryString = params.toString();
  const url = queryString ? `/search/global?${queryString}` : "/search/global";

  return apiRequest(url, {
    errorMessage: "Failed to perform global search",
  });
}
