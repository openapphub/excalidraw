import { useCallback, useEffect, useState, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  getTalktrackRecorder,
  disposeTalktrackRecorder,
  type RecordingState,
  type TalktrackRecorder,
} from "./TalktrackRecorder";
import { TalktrackSetupDialog } from "./TalktrackSetupDialog";
import { TalktrackToolbar } from "./TalktrackToolbar";

interface TalktrackManagerProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  isRecordingDialogOpen: boolean;
  onCloseRecordingDialog: () => void;
}

export const TalktrackManager: React.FC<TalktrackManagerProps> = ({
  excalidrawAPI,
  isRecordingDialogOpen,
  onCloseRecordingDialog,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>({
    status: "idle",
    duration: 0,
  });
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const recorderRef = useRef<TalktrackRecorder | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  // Initialize recorder
  useEffect(() => {
    recorderRef.current = getTalktrackRecorder();
    recorderRef.current.setOnStateChange(setRecordingState);

    return () => {
      // Use disposeTalktrackRecorder to properly reset the singleton
      // This ensures a fresh instance is created on next mount
      disposeTalktrackRecorder();
    };
  }, []);

  // Start recording with countdown
  const startRecording = useCallback(
    async (videoDeviceId: string | null, audioDeviceId: string | null) => {
      if (!recorderRef.current) {
        return;
      }

      setCameraEnabled(!!videoDeviceId);
      onCloseRecordingDialog();

      // Small delay to allow sidebar animation to complete and canvas to resize
      await new Promise((resolve) => setTimeout(resolve, 300));

      try {
        // Prepare the recorder
        await recorderRef.current.prepare({
          videoDeviceId,
          audioDeviceId,
        });

        // Start countdown
        setCountdown(3);

        countdownIntervalRef.current = window.setInterval(() => {
          setCountdown((prev) => {
            if (prev === null || prev <= 1) {
              // Clear interval and start recording
              if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }

              // Start recording
              recorderRef.current?.start().catch((err) => {
                console.error("Failed to start recording:", err);
                excalidrawAPI?.setToast({
                  message: "录制启动失败",
                  duration: 3000,
                  closable: true,
                });
              });

              return null;
            }
            return prev - 1;
          });
        }, 1000);
      } catch (err) {
        console.error("Failed to prepare recording:", err);
        excalidrawAPI?.setToast({
          message: err instanceof Error ? err.message : "录制准备失败",
          duration: 3000,
          closable: true,
        });
      }
    },
    [excalidrawAPI, onCloseRecordingDialog],
  );

  // Stop recording and download locally
  const stopRecording = useCallback(async () => {
    if (!recorderRef.current) {
      return;
    }

    // 立即关闭摄像头和麦克风预览
    setCameraEnabled(false);

    try {
      const blob = await recorderRef.current.stop();

      // Generate URL and download webm file locally
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date()
        .toISOString()
        .replace(/[:]/g, "-")
        .slice(0, 19);
      a.download = `talktrack_${timestamp}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      excalidrawAPI?.setToast({
        message: "录制已保存到本地",
        duration: 3000,
        closable: true,
      });
    } catch (err) {
      console.error("Failed to stop recording:", err);
      excalidrawAPI?.setToast({
        message: err instanceof Error ? err.message : "停止录制失败",
        duration: 5000,
        closable: true,
      });
    }
  }, [excalidrawAPI]);

  // Delete (cancel) recording
  const deleteRecording = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
    // 立即关闭摄像头和麦克风预览
    setCameraEnabled(false);
    recorderRef.current?.cancel();
  }, []);

  // Restart recording
  const restartRecording = useCallback(async () => {
    if (!recorderRef.current) {
      return;
    }

    recorderRef.current.cancel();

    // Re-start countdown
    setCountdown(3);

    countdownIntervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }

          recorderRef.current?.start().catch(console.error);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Pause recording
  const pauseRecording = useCallback(() => {
    recorderRef.current?.pause();
  }, []);

  // Resume recording
  const resumeRecording = useCallback(() => {
    recorderRef.current?.resume();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  const isActive =
    recordingState.status === "recording" ||
    recordingState.status === "paused" ||
    countdown !== null;

  return (
    <>
      {/* Setup dialog */}
      <TalktrackSetupDialog
        isOpen={isRecordingDialogOpen}
        onClose={onCloseRecordingDialog}
        onStart={startRecording}
      />

      {/* Countdown overlay */}
      {countdown !== null && (
        <div className="talktrack-countdown">
          <div className="talktrack-countdown__number">{countdown}</div>
        </div>
      )}

      {/* Recording toolbar */}
      {isActive && countdown === null && (
        <TalktrackToolbar
          recordingState={recordingState}
          onDelete={deleteRecording}
          onRestart={restartRecording}
          onPause={pauseRecording}
          onResume={resumeRecording}
          onStop={stopRecording}
          cameraEnabled={cameraEnabled}
        />
      )}

      {/* Error toast */}
      {recordingState.status === "error" && recordingState.error && (
        <div className="talktrack-error-toast">
          {recordingState.error}
        </div>
      )}

      {/* Countdown + error styles */}
      <style>{`
        .talktrack-countdown {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          pointer-events: none;
        }
        .talktrack-countdown__number {
          font-size: 120px;
          font-weight: 700;
          color: white;
          animation: talktrack-countdown-pulse 1s ease-in-out;
        }
        @keyframes talktrack-countdown-pulse {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        .talktrack-error-toast {
          position: fixed;
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 20px;
          background: #fee8e8;
          color: #d32f2f;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
      `}</style>
    </>
  );
};