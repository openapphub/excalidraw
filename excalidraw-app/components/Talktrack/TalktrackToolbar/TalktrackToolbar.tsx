import clsx from "clsx";
import { useCallback, useEffect, useState, useRef } from "react";

import { formatDuration, type RecordingState } from "../TalktrackRecorder";

import "./TalktrackToolbar.scss";

interface TalktrackToolbarProps {
  recordingState: RecordingState;
  onDelete: () => void;
  onRestart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  cameraEnabled: boolean;
}

export const TalktrackToolbar: React.FC<TalktrackToolbarProps> = ({
  recordingState,
  onDelete,
  onRestart,
  onPause,
  onResume,
  onStop,
  cameraEnabled,
}) => {
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraBubbleRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Initialize camera bubble at viewport top-right position
  const [bubblePosition, setBubblePosition] = useState(() => {
    const viewportWidth = window.innerWidth;
    return {
      x: viewportWidth - 140, // 120px bubble + 20px margin from right
      y: 20, // 20px from top
    };
  });

  // Initialize toolbar at bottom-left with margin from hamburger menu
  const [toolbarPosition, setToolbarPosition] = useState(() => {
    return {
      x: 80, // 80px from left (away from hamburger menu)
      y: window.innerHeight - 80, // 80px from bottom
    };
  });

  const [isDraggingBubble, setIsDraggingBubble] = useState(false);
  const [isDraggingToolbar, setIsDraggingToolbar] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, elementX: 0, elementY: 0 });

  const isPaused = recordingState.status === "paused";

  // Handle camera preview for toolbar
  useEffect(() => {
    if (!cameraEnabled) {
      return;
    }

    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 320 } },
        });

        cameraStreamRef.current = stream;

        if (cameraPreviewRef.current) {
          cameraPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to start toolbar camera preview:", err);
      }
    };

    startPreview();

    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
        cameraStreamRef.current = null;
      }
    };
  }, [cameraEnabled]);

  // Handle drag for camera bubble
  const handleBubbleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingBubble(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        elementX: bubblePosition.x,
        elementY: bubblePosition.y,
      };
    },
    [bubblePosition],
  );

  // Handle drag for toolbar controls
  const handleToolbarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only drag if clicking on the controls container, not buttons
      if ((e.target as HTMLElement).closest("button")) {
        return;
      }
      e.preventDefault();
      setIsDraggingToolbar(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        elementX: toolbarPosition.x,
        elementY: toolbarPosition.y,
      };
    },
    [toolbarPosition],
  );

  // Handle bubble dragging
  useEffect(() => {
    if (!isDraggingBubble) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setBubblePosition({
        x: dragStartRef.current.elementX + deltaX,
        y: dragStartRef.current.elementY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingBubble(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingBubble]);

  // Handle toolbar dragging
  useEffect(() => {
    if (!isDraggingToolbar) {
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaY = e.clientY - dragStartRef.current.y;
      setToolbarPosition({
        x: dragStartRef.current.elementX + deltaX,
        y: dragStartRef.current.elementY + deltaY,
      });
    };

    const handleMouseUp = () => {
      setIsDraggingToolbar(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingToolbar]);

  const handleDeleteClick = useCallback(() => {
    if (showConfirmDelete) {
      onDelete();
      setShowConfirmDelete(false);
    } else {
      setShowConfirmDelete(true);
      // Auto-hide after 3 seconds
      setTimeout(() => setShowConfirmDelete(false), 3000);
    }
  }, [showConfirmDelete, onDelete]);

  const handlePauseResume = useCallback(() => {
    if (isPaused) {
      onResume();
    } else {
      onPause();
    }
  }, [isPaused, onPause, onResume]);

  // Don't render if not recording or paused
  if (
    recordingState.status !== "recording" &&
    recordingState.status !== "paused"
  ) {
    return null;
  }

  return (
    <>
      {/* Camera preview bubble - draggable, positioned absolutely */}
      {cameraEnabled && (
        <div
          ref={cameraBubbleRef}
          className={clsx("talktrack-toolbar__camera-preview", {
            "talktrack-toolbar__camera-preview--dragging": isDraggingBubble,
          })}
          style={{
            position: "fixed",
            left: `${bubblePosition.x}px`,
            top: `${bubblePosition.y}px`,
            zIndex: 1001,
          }}
          onMouseDown={handleBubbleMouseDown}
        >
          <video
            ref={cameraPreviewRef}
            autoPlay
            muted
            playsInline
            className="talktrack-toolbar__camera-video"
          />
        </div>
      )}

      {/* Main toolbar - draggable */}
      <div
        ref={toolbarRef}
        className={clsx("talktrack-toolbar", {
          "talktrack-toolbar--dragging": isDraggingToolbar,
        })}
        style={{
          position: "fixed",
          left: `${toolbarPosition.x}px`,
          top: `${toolbarPosition.y}px`,
        }}
      >
        <div
          className="talktrack-toolbar__controls"
          onMouseDown={handleToolbarMouseDown}
        >
          {/* Delete button */}
          <button
            className={clsx("talktrack-toolbar__button", {
              "talktrack-toolbar__button--confirm": showConfirmDelete,
            })}
            onClick={handleDeleteClick}
            title={showConfirmDelete ? "确认删除" : "删除"}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </button>

          {/* Restart button */}
          <button
            className="talktrack-toolbar__button"
            onClick={onRestart}
            title="重录"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="1 4 1 10 7 10" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>

          {/* Pause/Resume button */}
          <button
            className="talktrack-toolbar__button"
            onClick={handlePauseResume}
            title={isPaused ? "恢复" : "暂停"}
          >
            {isPaused ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            )}
          </button>

          {/* Timer */}
          <div
            className={clsx("talktrack-toolbar__timer", {
              "talktrack-toolbar__timer--paused": isPaused,
            })}
          >
            {formatDuration(recordingState.duration)}
          </div>

          {/* Stop button */}
          <button
            className="talktrack-toolbar__stop-button"
            onClick={onStop}
          >
            停止
          </button>
        </div>
      </div>
    </>
  );
};