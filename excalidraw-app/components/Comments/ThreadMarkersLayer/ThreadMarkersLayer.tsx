/**
 * ThreadMarkersLayer - 画布上的评论图钉层
 *
 * 与 AstraDraw 的差异：AstraDraw 把 marker 数据写进 appState.commentMarkers，
 * 由 packages 内的 renderCommentMarkers 画在 canvas 上（需要改 6 个 packages 文件）。
 * 本仓改为用 DOM 图钉（ThreadMarker）叠在画布上，行为一致但不侵入 packages。
 *
 * - 拉取该场景的线程，过滤掉已解决的
 * - 订阅 scroll/zoom 与容器 offset 变化，保持图钉贴合画布坐标
 * - 拖拽结束把视口坐标换算回场景坐标并落库
 */

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  sceneCoordsToViewportCoords,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import type {
  AppState,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../../../app-jotai";
import { selectThreadAtom, selectedThreadIdAtom } from "../commentsState";
import {
  useCommentMutations,
  useCommentThreads,
} from "../../../hooks/useCommentThreads";
import { ThreadMarker } from "../ThreadMarker";

import styles from "./ThreadMarkersLayer.module.scss";

export interface ThreadMarkersLayerProps {
  /** Scene ID to fetch threads for */
  sceneId: string;
  /** Excalidraw API for reading app state and subscribing to changes */
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

/**
 * 场景坐标 → Excalidraw 容器内坐标（图钉是容器的绝对定位子元素）。
 */
function getMarkerPosition(
  sceneX: number,
  sceneY: number,
  appState: AppState,
): { x: number; y: number } {
  const viewportCoords = sceneCoordsToViewportCoords(
    { sceneX, sceneY },
    appState,
  );

  return {
    x: viewportCoords.x - appState.offsetLeft,
    y: viewportCoords.y - appState.offsetTop,
  };
}

export function ThreadMarkersLayer({
  sceneId,
  excalidrawAPI,
}: ThreadMarkersLayerProps) {
  const selectedThreadId = useAtomValue(selectedThreadIdAtom);
  const selectThread = useSetAtom(selectThreadAtom);
  const { updateThreadPosition } = useCommentMutations(sceneId);

  const [appState, setAppState] = useState<AppState | null>(null);

  // Subscribe to scroll/zoom changes for marker positioning
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    setAppState(excalidrawAPI.getAppState());

    const unsubscribe = excalidrawAPI.onScrollChange(() => {
      setAppState(excalidrawAPI.getAppState());
    });

    return unsubscribe;
  }, [excalidrawAPI]);

  // Also subscribe to onChange to catch offsetLeft/offsetTop changes
  useEffect(() => {
    if (!excalidrawAPI) {
      return;
    }

    let lastOffsetLeft = excalidrawAPI.getAppState().offsetLeft;
    let lastOffsetTop = excalidrawAPI.getAppState().offsetTop;

    const unsubscribe = excalidrawAPI.onChange(() => {
      const currentState = excalidrawAPI.getAppState();
      if (
        currentState.offsetLeft !== lastOffsetLeft ||
        currentState.offsetTop !== lastOffsetTop
      ) {
        lastOffsetLeft = currentState.offsetLeft;
        lastOffsetTop = currentState.offsetTop;
        setAppState(currentState);
      }
    });

    return unsubscribe;
  }, [excalidrawAPI]);

  const { threads: allThreads } = useCommentThreads({
    sceneId,
    enabled: !!sceneId,
  });

  const threads = useMemo(
    () => allThreads.filter((t) => !t.resolved),
    [allThreads],
  );

  const markers = useMemo(() => {
    if (!appState) {
      return [];
    }
    return threads.map((thread) => ({
      thread,
      position: getMarkerPosition(thread.x, thread.y, appState),
    }));
  }, [threads, appState]);

  // 拖拽结束：容器坐标 → 视口坐标 → 场景坐标
  const handlePositionChange = useCallback(
    async (threadId: string, containerX: number, containerY: number) => {
      if (!appState) {
        return;
      }
      const sceneCoords = viewportCoordsToSceneCoords(
        {
          clientX: containerX + appState.offsetLeft,
          clientY: containerY + appState.offsetTop,
        },
        appState,
      );
      await updateThreadPosition({
        threadId,
        x: sceneCoords.x,
        y: sceneCoords.y,
      });
    },
    [appState, updateThreadPosition],
  );

  if (!appState || markers.length === 0) {
    return null;
  }

  return (
    <div className={styles.layer}>
      {markers.map(({ thread, position }) => (
        <ThreadMarker
          key={thread.id}
          thread={thread}
          x={position.x}
          y={position.y}
          isSelected={thread.id === selectedThreadId}
          onClick={() => selectThread(thread.id)}
          onPositionChange={(x, y) => handlePositionChange(thread.id, x, y)}
        />
      ))}
    </div>
  );
}
