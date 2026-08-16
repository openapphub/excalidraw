/**
 * CommentsMount - 评论功能的单一挂载点
 *
 * 把 AstraDraw 里散落在 App.tsx / AppSidebar.tsx 的评论接线收敛到一个文件，
 * App.tsx 只需渲染 <CommentsMount excalidrawAPI={...} />（放在 <Excalidraw> 子节点内）。
 *
 * 包含：
 * - 官方 DefaultSidebar 的 comments tab（非 __fallback 实例，会顶掉 App.tsx 里的 fallback）
 * - 画布图钉层 ThreadMarkersLayer + 建评论遮罩 CommentCreationOverlay
 * - 线程弹窗 ThreadPopup / 新建弹窗 NewThreadPopup
 * - C 键切换评论模式（AstraDraw useKeyboardShortcuts 的评论部分）
 * - CommentSyncProvider：协作中通过 socket.io 转发 CommentEvent，非协作时靠 react-query 重新拉取
 *
 * sceneId / workspace / 协作 socket 直接从 jotai 读，避免给 App.tsx 增加 props。
 * 协作开始后 collabSocketAtom 会更新，本组件重渲染并监听 comment:event。
 */

import { useCallback, useEffect } from "react";

import type { ReactNode } from "react";
import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import { messageCircleIcon } from "@excalidraw/excalidraw/components/icons";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAtomValue, useSetAtom } from "../../app-jotai";
import { currentCanvasIdAtom } from "../../app-jotai";
import { useAuth } from "../../auth/AuthContext";
import {
  collabAPIAtom,
  collabSocketAtom,
  isCollaboratingAtom,
} from "../../collab/Collab";
import { useCommentSync } from "../../hooks/useCommentSync";
import { parseUrl } from "../../router";
import {
  currentSceneIdAtom,
  currentSceneCanEditAtom,
  currentWorkspaceAtom,
} from "../Settings/settingsState";

import { CommentSyncProvider } from "./CommentSyncContext";
import { selectedThreadIdAtom } from "./commentsState";
import { CommentCreationOverlay } from "./CommentCreationOverlay";
import { CommentsSidebar } from "./CommentsSidebar";
import { NewThreadPopup } from "./NewThreadPopup";
import { ThreadMarkersLayer } from "./ThreadMarkersLayer";
import { ThreadPopup } from "./ThreadPopup";
import { toggleCommentModeAtom } from "./commentsState";

import type { Socket } from "socket.io-client";

export interface CommentsMountProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  /** 同一个 DefaultSidebar 宿主中的其他应用标签。 */
  sidebarExtras?: ReactNode;
  /** 协作 socket（可选）：传入后同房间的评论变更会实时同步 */
  socket?: Socket | null;
  /** 协作房间 id（可选） */
  roomId?: string | null;
  /** 是否正在协作（可选） */
  isCollaborating?: boolean;
}

/**
 * C 键切换评论模式。只在已登录且打开了场景时生效，输入框内不触发。
 */
function useCommentModeShortcut(enabled: boolean) {
  const toggleCommentMode = useSetAtom(toggleCommentModeAtom);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "c" || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) {
        return;
      }

      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      toggleCommentMode();
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [enabled, toggleCommentMode]);
}

/**
 * 消费通知里的 ?thread=xxx 深链：打开评论侧栏并选中该线程，然后清掉参数，
 * 避免刷新时重复弹出。
 */
function useThreadDeepLink(
  sceneId: string | null,
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) {
  const setSelectedThreadId = useSetAtom(selectedThreadIdAtom);

  useEffect(() => {
    if (!sceneId || !excalidrawAPI) {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const threadId = params.get("thread");
    if (!threadId) {
      return;
    }

    setSelectedThreadId(threadId);
    excalidrawAPI.updateScene({
      appState: { openSidebar: { name: "default", tab: "comments" } },
    });

    params.delete("thread");
    params.delete("comment");
    const query = params.toString();
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, [sceneId, excalidrawAPI, setSelectedThreadId]);
}

export const CommentsMount = ({
  excalidrawAPI,
  sidebarExtras,
  socket: socketProp,
  roomId: roomIdProp,
  isCollaborating: isCollaboratingProp,
}: CommentsMountProps) => {
  const { openSidebar } = useUIAppState();
  const { isAuthenticated } = useAuth();
  const sceneId = useAtomValue(currentSceneIdAtom);
  const currentCanvasId = useAtomValue(currentCanvasIdAtom);
  const canEditScene = useAtomValue(currentSceneCanEditAtom);
  const workspace = useAtomValue(currentWorkspaceAtom);
  const collabAPI = useAtomValue(collabAPIAtom);
  const collabSocket = useAtomValue(collabSocketAtom);
  const collabIsCollaborating = useAtomValue(isCollaboratingAtom);
  const socket = socketProp !== undefined ? socketProp : collabSocket;
  const isCollaborating =
    isCollaboratingProp !== undefined
      ? isCollaboratingProp
      : collabIsCollaborating;
  const roomId =
    roomIdProp !== undefined ? roomIdProp : (collabAPI?.getRoomId() ?? null);
  // 内存状态可能在根路径恢复上一条 Scene；评论只能属于 URL 明确指向的 Workspace Scene。
  const isWorkspaceSceneRoute = parseUrl().type === "scene";
  const sceneReady =
    isWorkspaceSceneRoute &&
    isAuthenticated &&
    !!sceneId &&
    sceneId === currentCanvasId;
  const canWriteComments = sceneReady && canEditScene !== false;

  useCommentModeShortcut(canWriteComments);
  useCommentSync(
    sceneReady ? sceneId : null,
    socket,
    roomId,
    isCollaborating && sceneReady,
  );
  useThreadDeepLink(sceneReady ? sceneId : null, excalidrawAPI);

  // 评论未就绪时不能注册评论 UI，但 DefaultSidebar 仍须保留为其他
  // 应用标签的宿主。否则演示、录制和动画触发器仍会打开 "default"
  // 侧栏，却没有对应的 Tab 内容可渲染。
  if (!sceneReady) {
    return <DefaultSidebar>{sidebarExtras}</DefaultSidebar>;
  }

  return (
    <CommentSyncProvider
      socket={socket}
      roomId={roomId}
      isCollaborating={isCollaborating}
    >
      <DefaultSidebar>
        <DefaultSidebar.TabTriggers>
          <Sidebar.TabTrigger
            tab="comments"
            style={{ opacity: openSidebar?.tab === "comments" ? 1 : 0.4 }}
          >
            {messageCircleIcon}
          </Sidebar.TabTrigger>
        </DefaultSidebar.TabTriggers>
        <Sidebar.Tab tab="comments">
          <CommentsSidebar
            sceneId={sceneId ?? undefined}
            excalidrawAPI={excalidrawAPI}
            poll={openSidebar?.tab === "comments"}
          />
        </Sidebar.Tab>
        {sidebarExtras}
      </DefaultSidebar>

      {sceneId && (
        <>
          <ThreadMarkersLayer sceneId={sceneId} excalidrawAPI={excalidrawAPI} />
          {canWriteComments && (
            <CommentCreationOverlay excalidrawAPI={excalidrawAPI} />
          )}
          <ThreadPopup
            sceneId={sceneId}
            workspaceId={workspace?.id}
            excalidrawAPI={excalidrawAPI}
          />
          {canWriteComments && (
            <NewThreadPopup
              sceneId={sceneId}
              workspaceId={workspace?.id}
              excalidrawAPI={excalidrawAPI}
            />
          )}
        </>
      )}
    </CommentSyncProvider>
  );
};

/** 打开/关闭评论侧栏（底部评论按钮与通知跳转共用）。 */
export function useToggleCommentsSidebar(
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) {
  return useCallback(() => {
    excalidrawAPI?.toggleSidebar({ name: "default", tab: "comments" });
  }, [excalidrawAPI]);
}

export default CommentsMount;
