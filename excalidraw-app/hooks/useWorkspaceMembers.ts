/**
 * useWorkspaceMembers - React Query hook for fetching workspace members
 *
 * Used for @mention autocomplete in comments.
 */

import { useQuery } from "@tanstack/react-query";

import { queryKeys } from "../lib/queryClient";
import { listWorkspaceMembers } from "../auth/api/members";

import type { WorkspaceMember } from "../auth/api/types";

// ============================================================================
// Types
// ============================================================================

export interface MentionableUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface UseWorkspaceMembersOptions {
  workspaceId: string | undefined;
  enabled?: boolean;
}

interface UseWorkspaceMembersResult {
  members: MentionableUser[];
  isLoading: boolean;
  error: Error | null;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Fetch workspace members for @mention autocomplete.
 *
 * Transforms WorkspaceMember[] to MentionableUser[] for simpler usage.
 *
 * @example
 * ```ts
 * const { members, isLoading } = useWorkspaceMembers({
 *   workspaceId: workspace?.id,
 *   enabled: !!workspace,
 * });
 * ```
 */
export function useWorkspaceMembers({
  workspaceId,
  enabled = true,
}: UseWorkspaceMembersOptions): UseWorkspaceMembersResult {
  const {
    data: rawMembers = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: workspaceId
      ? queryKeys.members.list(workspaceId)
      : ["members", "disabled"],
    queryFn: () => listWorkspaceMembers(workspaceId!),
    enabled: enabled && !!workspaceId,
    // Members don't change often, use longer stale time
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });

  // Transform to MentionableUser format
  const members: MentionableUser[] = rawMembers.map(
    (member: WorkspaceMember) => ({
      id: member.user.id,
      name: member.user.name || member.user.email.split("@")[0],
      email: member.user.email,
      avatar: member.user.avatarUrl || undefined,
    }),
  );

  return {
    members,
    isLoading,
    error: error as Error | null,
  };
}
