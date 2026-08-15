import { Footer, useTunnels } from "@excalidraw/excalidraw/index";
import { Tooltip } from "@excalidraw/excalidraw/components/Tooltip";
import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { isExcalidrawPlusSignedUser } from "../app_constants";
import { useAuth } from "../auth";
import { useAtomValue } from "../app-jotai";
import { currentCanvasIdAtom } from "../app-jotai";
import { currentSceneIdAtom } from "./Settings/settingsState";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

import "./AppFooter.scss";

// 图标：演示
const presentationIcon = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <g strokeWidth="1.25">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 4l18 0" />
      <path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" />
      <path d="M12 16l0 4" />
      <path d="M9 20l6 0" />
      <path d="M8 12l3 -3l2 2l3 -3" />
    </g>
  </svg>
);

const videoIcon = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <g strokeWidth="1.25">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M17 9l4 -2v10l-4 -2" />
    </g>
  </svg>
);

const animationIcon = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <g strokeWidth="1.25">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </g>
  </svg>
);

const commentsIcon = (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
    <g strokeWidth="1.25">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <path d="M3 20l1.3 -3.9c-2.324 -3.437 -1.426 -7.872 2.1 -10.374c3.526 -2.501 8.59 -2.296 11.845 .48c3.255 2.777 3.695 7.266 1.029 10.501c-2.666 3.235 -7.615 4.215 -11.574 2.293l-4.7 1" />
    </g>
  </svg>
);

export interface AppFooterProps {
  onChange: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

// 底部左侧图标按钮：演示、录制、评论。
// 全部 toggle 官方 DefaultSidebar 的对应 tab（和评论按钮一致）。
const AppFooterLeft = React.memo(
  ({ excalidrawAPI }: { excalidrawAPI: ExcalidrawImperativeAPI | null }) => {
    const { FooterLeftExtraTunnel } = useTunnels();
    const { isAuthenticated } = useAuth();
    const sceneId = useAtomValue(currentSceneIdAtom);
    const currentCanvasId = useAtomValue(currentCanvasIdAtom);
    const showComments =
      isAuthenticated && !!sceneId && sceneId === currentCanvasId;

    const handleToggleComments = () => {
      excalidrawAPI?.toggleSidebar({ name: "default", tab: "comments" });
    };

    const handleTogglePresentation = () => {
      excalidrawAPI?.toggleSidebar({ name: "default", tab: "presentation" });
    };

    const handleToggleRecording = () => {
      excalidrawAPI?.toggleSidebar({ name: "default", tab: "recording" });
    };

    const handleToggleAnimation = () => {
      excalidrawAPI?.toggleSidebar({ name: "default", tab: "animation" });
    };

    return (
      <FooterLeftExtraTunnel.In>
        <div className="footer-left-extra zen-mode-transition">
          <Tooltip label="演示">
            <button
              className="sidebarButton"
              onClick={handleTogglePresentation}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
              aria-label="演示"
            >
              <div className="toolIconWrapper" aria-hidden="true">
                {presentationIcon}
              </div>
            </button>
          </Tooltip>
          <Tooltip label="录制">
            <button
              className="sidebarButton"
              onClick={handleToggleRecording}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
              aria-label="录制"
            >
              <div className="toolIconWrapper" aria-hidden="true">
                {videoIcon}
              </div>
            </button>
          </Tooltip>
          <Tooltip label="动画">
            <button
              className="sidebarButton"
              onClick={handleToggleAnimation}
              onPointerDown={(e) => e.stopPropagation()}
              type="button"
              aria-label="动画"
            >
              <div className="toolIconWrapper" aria-hidden="true">
                {animationIcon}
              </div>
            </button>
          </Tooltip>
          {/* 评论依赖后端 JWT，IndexedDB 本地模式不可用，未登录不展示以免误解。 */}
          {showComments && (
            <Tooltip label="评论">
              <button
                className="sidebarButton"
                onClick={handleToggleComments}
                onPointerDown={(e) => e.stopPropagation()}
                type="button"
                aria-label="评论"
              >
                <div className="toolIconWrapper" aria-hidden="true">
                  {commentsIcon}
                </div>
              </button>
            </Tooltip>
          )}
        </div>
      </FooterLeftExtraTunnel.In>
    );
  },
);

export const AppFooter = React.memo(
  ({ onChange, excalidrawAPI }: AppFooterProps) => {
    return (
      <>
        {/* 底部左侧：图标按钮组（演示 + 录制 + 评论） */}
        <AppFooterLeft excalidrawAPI={excalidrawAPI} />

        {/* 底部中央内容 */}
        <Footer>
          <div
            style={{
              display: "flex",
              gap: ".5rem",
              alignItems: "center",
            }}
          >
            {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
            {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
          </div>
        </Footer>
      </>
    );
  },
);