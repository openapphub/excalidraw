/**
 * Jotai atoms for comment system UI state
 *
 * These atoms manage client-side UI state for comments:
 * - Selected thread for popup display
 * - Comment creation mode (cursor state)
 * - Sidebar filter/sort settings
 *
 * Server state (threads, comments) is managed by React Query hooks.
 */

import { atom } from "../../app-jotai";

import type { ThreadFilters } from "../../auth/api/types";

// ============================================================================
// UI State Atoms
// ============================================================================

/**
 * Currently selected thread ID (for popup display)
 * When set, the ThreadPopup component shows this thread
 */
export const selectedThreadIdAtom = atom<string | null>(null);

/**
 * Whether comment creation mode is active
 * When true, cursor shows comment icon and clicking canvas creates a thread
 */
export const isCommentModeAtom = atom<boolean>(false);

/**
 * Filter and sort settings for the comments sidebar
 */
export const commentFiltersAtom = atom<ThreadFilters>({
  resolved: false, // false = show all, true = show only resolved
  sort: "date",
  search: "",
});

/**
 * Pending comment creation position
 * Set when user clicks canvas in comment mode, before typing content
 */
export const pendingCommentPositionAtom = atom<{ x: number; y: number } | null>(
  null,
);

// ============================================================================
// Action Atoms
// ============================================================================

/**
 * Clear comment selection (e.g., when closing popup)
 */
export const clearCommentSelectionAtom = atom(null, (_get, set) => {
  set(selectedThreadIdAtom, null);
  set(isCommentModeAtom, false);
  set(pendingCommentPositionAtom, null);
});

/**
 * Toggle comment mode on/off
 */
export const toggleCommentModeAtom = atom(null, (get, set) => {
  const current = get(isCommentModeAtom);
  set(isCommentModeAtom, !current);
  if (current) {
    // Exiting comment mode - clear selection
    set(selectedThreadIdAtom, null);
    set(pendingCommentPositionAtom, null);
  }
});

/**
 * Select a thread (for popup display)
 */
export const selectThreadAtom = atom(null, (_get, set, threadId: string) => {
  set(selectedThreadIdAtom, threadId);
  set(isCommentModeAtom, false);
  set(pendingCommentPositionAtom, null);
});

/**
 * Start creating a comment at a specific position
 * Called when user clicks canvas in comment mode
 */
export const startCommentCreationAtom = atom(
  null,
  (_get, set, position: { x: number; y: number }) => {
    set(pendingCommentPositionAtom, position);
  },
);

/**
 * Cancel pending comment creation
 */
export const cancelCommentCreationAtom = atom(null, (_get, set) => {
  set(pendingCommentPositionAtom, null);
  set(isCommentModeAtom, false);
});

/**
 * Update sidebar filters
 */
export const updateCommentFiltersAtom = atom(
  null,
  (get, set, updates: Partial<ThreadFilters>) => {
    const current = get(commentFiltersAtom);
    set(commentFiltersAtom, { ...current, ...updates });
  },
);

/**
 * Reset sidebar filters to defaults
 */
export const resetCommentFiltersAtom = atom(null, (_get, set) => {
  set(commentFiltersAtom, {
    resolved: false,
    sort: "date",
    search: "",
  });
});
