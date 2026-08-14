/**
 * Comments module - Canvas comment threads and discussions
 *
 * This module provides:
 * - Jotai atoms for UI state (commentsState.ts)
 * - Components for comment markers on canvas
 * - Comment creation overlay for click-to-create mode
 * - Thread popup for viewing/replying to comments
 * - @mention input with autocomplete
 */

// State management
export {
  // UI state atoms
  selectedThreadIdAtom,
  isCommentModeAtom,
  commentFiltersAtom,
  pendingCommentPositionAtom,
  // Action atoms
  clearCommentSelectionAtom,
  toggleCommentModeAtom,
  selectThreadAtom,
  startCommentCreationAtom,
  cancelCommentCreationAtom,
  updateCommentFiltersAtom,
  resetCommentFiltersAtom,
} from "./commentsState";

// Canvas overlay components
export { ThreadMarkersLayer } from "./ThreadMarkersLayer";
export type { ThreadMarkersLayerProps } from "./ThreadMarkersLayer";

export { ThreadMarker } from "./ThreadMarker";
export type { ThreadMarkerProps } from "./ThreadMarker";

export { ThreadMarkerTooltip } from "./ThreadMarkerTooltip";
export type { ThreadMarkerTooltipProps } from "./ThreadMarkerTooltip";

export { CommentCreationOverlay } from "./CommentCreationOverlay";
export type { CommentCreationOverlayProps } from "./CommentCreationOverlay";

// Thread popup components
export { ThreadPopup } from "./ThreadPopup";
export type { ThreadPopupProps } from "./ThreadPopup";

export { NewThreadPopup } from "./NewThreadPopup";
export type { NewThreadPopupProps } from "./NewThreadPopup";

export { ThreadPopupHeader } from "./ThreadPopupHeader";
export type { ThreadPopupHeaderProps } from "./ThreadPopupHeader";

export { CommentItem } from "./CommentItem";
export type { CommentItemProps } from "./CommentItem";

export { CommentInput } from "./CommentInput";
export type { CommentInputProps } from "./CommentInput";

export { MentionInput } from "./MentionInput";
export type { MentionInputProps, MentionInputHandle } from "./MentionInput";

// Sidebar components
export { CommentsSidebar } from "./CommentsSidebar";
export type { CommentsSidebarProps } from "./CommentsSidebar";

export { CommentsSidebarHeader } from "./CommentsSidebarHeader";
export type { CommentsSidebarHeaderProps } from "./CommentsSidebarHeader";

export { ThreadListItem } from "./ThreadListItem";
export type { ThreadListItemProps } from "./ThreadListItem";

// 单一挂载点（本仓新增：App.tsx 只接这一个组件）
export { CommentsMount, useToggleCommentsSidebar } from "./CommentsMount";
export type { CommentsMountProps } from "./CommentsMount";

// Real-time sync context
export {
  CommentSyncProvider,
  useCommentSyncContext,
} from "./CommentSyncContext";
