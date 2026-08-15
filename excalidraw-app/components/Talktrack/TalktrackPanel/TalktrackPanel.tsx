import { useCallback } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import "./TalktrackPanel.scss";

interface TalktrackPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onStartRecording: () => void;
}

export const TalktrackPanel: React.FC<TalktrackPanelProps> = ({
  onStartRecording,
}) => {
  const handleStart = useCallback(() => {
    onStartRecording();
  }, [onStartRecording]);

  return (
    <div className="talktrack-panel">
      <div className="talktrack-panel__header">
        <span className="talktrack-panel__title">录制</span>
      </div>

      <div className="talktrack-panel__content">
        <div className="talktrack-panel__instructions">
          <div className="talktrack-panel__instructions-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="5" width="14" height="14" rx="2" />
              <path d="M17 9l4 -2v10l-4 -2" />
            </svg>
          </div>
          <h3 className="talktrack-panel__instructions-title">录制画布操作</h3>
          <p className="talktrack-panel__instructions-text">
            录制画布上的所有操作和麦克风语音，支持摄像头画中画，生成 .webm 视频文件下载到本地。
          </p>
          <ol className="talktrack-panel__instructions-steps">
            <li>点击「开始录制」按钮</li>
            <li>选择摄像头和麦克风设备（可选）</li>
            <li>3 秒倒计时后开始录制</li>
            <li>在画布上进行操作</li>
            <li>点击「停止」下载 .webm 文件</li>
          </ol>
          <button
            className="talktrack-panel__start-button"
            onClick={handleStart}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" fill="#ef5350" />
            </svg>
            <span>开始录制</span>
          </button>
        </div>
      </div>
    </div>
  );
};