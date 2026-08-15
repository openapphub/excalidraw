/**
 * PresentationTalktrackMount - 演示和录制功能的 DefaultSidebar 挂载点
 *
 * 参考 CommentsMount 的实现方式，把演示（PresentationPanel）和录制（TalktrackPanel）
 * 挂在官方 DefaultSidebar 的 tab 里，而不是独立的 Sidebar name={CREATIONS_SIDEBAR_NAME}。
 *
 * App.tsx 只需渲染 <PresentationTalktrackMount excalidrawAPI={...} />（放在 <Excalidraw> 子节点内）。
 * 与 CommentsMount 并列，各自向 DefaultSidebar 贡献自己的 TabTrigger + Tab。
 */

import { useState } from "react";
import { DefaultSidebar, Sidebar } from "@excalidraw/excalidraw";
import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { PresentationPanel } from "../Presentation/PresentationPanel";
import { TalktrackPanel } from "./TalktrackPanel";
import { TalktrackManager } from "./TalktrackManager";
import { AnimationPanel } from "../Animation/AnimationPanel";

import "./PresentationTalktrackMount.scss";

// 图标：演示
const presentationIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
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

// 图标：录制
const videoIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <g strokeWidth="1.25">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <rect x="3" y="5" width="14" height="14" rx="2" />
      <path d="M17 9l4 -2v10l-4 -2" />
    </g>
  </svg>
);

// 图标：动画
const animationIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    strokeWidth="2"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <g strokeWidth="1.25">
      <path stroke="none" d="M0 0h24v24H0z" fill="none" />
      <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
    </g>
  </svg>
);

export interface PresentationTalktrackMountProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

export const PresentationTalktrackMount = ({
  excalidrawAPI,
}: PresentationTalktrackMountProps) => {
  const { openSidebar } = useUIAppState();
  const [isRecordingDialogOpen, setIsRecordingDialogOpen] = useState(false);

  const handleStartRecording = () => {
    // 关闭侧栏，打开录制设置对话框
    excalidrawAPI?.updateScene({ appState: { openSidebar: null } });
    setIsRecordingDialogOpen(true);
  };

  return (
    <>
      <DefaultSidebar>
        <DefaultSidebar.TabTriggers>
          <Sidebar.TabTrigger
            tab="presentation"
            style={{
              opacity: openSidebar?.tab === "presentation" ? 1 : 0.4,
            }}
          >
            {presentationIcon}
          </Sidebar.TabTrigger>
          <Sidebar.TabTrigger
            tab="recording"
            style={{
              opacity: openSidebar?.tab === "recording" ? 1 : 0.4,
            }}
          >
            {videoIcon}
          </Sidebar.TabTrigger>
          <Sidebar.TabTrigger
            tab="animation"
            style={{
              opacity: openSidebar?.tab === "animation" ? 1 : 0.4,
            }}
          >
            {animationIcon}
          </Sidebar.TabTrigger>
        </DefaultSidebar.TabTriggers>
        <Sidebar.Tab tab="presentation">
          <PresentationPanel excalidrawAPI={excalidrawAPI} />
        </Sidebar.Tab>
        <Sidebar.Tab tab="recording">
          <TalktrackPanel
            excalidrawAPI={excalidrawAPI}
            onStartRecording={handleStartRecording}
          />
        </Sidebar.Tab>
        <Sidebar.Tab tab="animation">
          <AnimationPanel excalidrawAPI={excalidrawAPI} />
        </Sidebar.Tab>
      </DefaultSidebar>

      {/* 录制管理器：设置对话框 + 倒计时 + 工具栏（portal 到 body） */}
      <TalktrackManager
        excalidrawAPI={excalidrawAPI}
        isRecordingDialogOpen={isRecordingDialogOpen}
        onCloseRecordingDialog={() => setIsRecordingDialogOpen(false)}
      />
    </>
  );
};

export default PresentationTalktrackMount;