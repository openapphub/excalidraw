import React, { useMemo, useCallback } from "react";

import { t } from "@excalidraw/excalidraw/i18n";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtom, useSetAtom } from "../../../app-jotai";
import { useCommentThreads } from "../../../hooks/useCommentThreads";
import {
  commentFiltersAtom,
  selectedThreadIdAtom,
  selectThreadAtom,
} from "../commentsState";
import { CommentsSidebarHeader } from "../CommentsSidebarHeader";
import { ThreadListItem } from "../ThreadListItem";

import styles from "./CommentsSidebar.module.scss";

import type { CommentThread } from "../../../auth/api/types";

// ============================================================================
// Types
// ============================================================================

export interface CommentsSidebarProps {
  sceneId: string | undefined;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  poll?: boolean;
}

// ============================================================================
// Helper Components
// ============================================================================

const LoadingSkeleton: React.FC = () => (
  <div className={styles.skeletonList}>
    {[1, 2, 3].map((i) => (
      <div key={i} className={styles.skeletonItem}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonContent}>
          <div className={styles.skeletonLine} style={{ width: "60%" }} />
          <div className={styles.skeletonLine} style={{ width: "40%" }} />
          <div className={styles.skeletonLine} style={{ width: "80%" }} />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ hasFilters: boolean }> = ({ hasFilters }) => (
  <div className={styles.empty}>
    <div className={styles.emptyIcon}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </div>
    <h3 className={styles.emptyTitle}>
      {hasFilters ? t("comments.noMatchingComments") : t("comments.noComments")}
    </h3>
    <p className={styles.emptyDescription}>
      {hasFilters
        ? t("comments.tryDifferentSearch")
        : t("comments.noCommentsDescription")}
    </p>
  </div>
);

const NoSceneState: React.FC = () => (
  <div className={styles.noScene}>
    <div className={styles.noSceneIcon}>
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    </div>
    <h3 className={styles.noSceneTitle}>{t("comments.openSceneFirst")}</h3>
    <p className={styles.noSceneDescription}>
      {t("comments.openSceneDescription")}
    </p>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const CommentsSidebar: React.FC<CommentsSidebarProps> = ({
  sceneId,
  excalidrawAPI,
  poll = false,
}) => {
  const { threads, isLoading } = useCommentThreads({
    sceneId,
    enabled: !!sceneId,
    poll,
  });
  const [filters, setFilters] = useAtom(commentFiltersAtom);
  const selectThread = useSetAtom(selectThreadAtom);
  const setSelectedThreadId = useSetAtom(selectedThreadIdAtom);

  // Filter and sort threads based on current filter settings
  const filteredThreads = useMemo(() => {
    let result = [...threads];

    // Filter by resolved status
    if (filters.resolved) {
      result = result.filter((t) => t.resolved === true);
    }

    // Filter by search query
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter((thread) =>
        thread.comments.some(
          (c) =>
            c.content.toLowerCase().includes(query) ||
            c.createdBy.name.toLowerCase().includes(query),
        ),
      );
    }

    // Sort
    if (filters.sort === "date") {
      result.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );
    }
    // Note: "unread" sort requires read tracking (future feature)

    return result;
  }, [threads, filters]);

  // Handle thread click - select thread and pan to position
  const handleThreadClick = useCallback(
    (thread: CommentThread) => {
      // Select the thread to open popup
      selectThread(thread.id);

      // Pan canvas to center the thread marker
      if (excalidrawAPI) {
        const appState = excalidrawAPI.getAppState();
        const { width, height } = appState;
        const zoom = appState.zoom.value;

        // In Excalidraw, scrollX/scrollY represent the offset of viewport from scene origin
        // To center a point (thread.x, thread.y), we need:
        // scrollX = -thread.x + (width / 2) / zoom
        // This positions the thread at the center of the viewport
        const scrollX = -thread.x + width / (2 * zoom);
        const scrollY = -thread.y + height / (2 * zoom);

        excalidrawAPI.updateScene({
          appState: {
            scrollX,
            scrollY,
          },
        });
      }
    },
    [selectThread, excalidrawAPI],
  );

  // Handle resolve toggle from list item
  const handleResolveToggle = useCallback(
    (_threadId: string) => {
      // This will be handled by ThreadListItem using useCommentMutations
      // Just need to ensure the popup is closed if it was open
      setSelectedThreadId(null);
    },
    [setSelectedThreadId],
  );

  // Show "open a scene" state if no scene
  if (!sceneId) {
    return (
      <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
        <NoSceneState />
      </div>
    );
  }

  // Show loading state
  if (isLoading && threads.length === 0) {
    return (
      <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
        <CommentsSidebarHeader filters={filters} onFiltersChange={setFilters} />
        <LoadingSkeleton />
      </div>
    );
  }

  const hasFilters = !!(filters.search || filters.resolved);
  const hasThreads = filteredThreads.length > 0;

  return (
    <div className={styles.panel} onWheel={(e) => e.stopPropagation()}>
      <CommentsSidebarHeader filters={filters} onFiltersChange={setFilters} />

      {hasThreads ? (
        <div className={styles.list}>
          {filteredThreads.map((thread) => (
            <ThreadListItem
              key={thread.id}
              thread={thread}
              searchQuery={filters.search}
              sceneId={sceneId}
              onClick={() => handleThreadClick(thread)}
              onResolveToggle={() => handleResolveToggle(thread.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState hasFilters={hasFilters} />
      )}
    </div>
  );
};
