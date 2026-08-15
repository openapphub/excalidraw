import clsx from "clsx";
import { useCallback, useEffect, useState, useRef } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import {
  getVideoDevices,
  getAudioDevices,
  type RecordingDevice,
} from "../TalktrackRecorder";

import "./TalktrackSetupDialog.scss";

interface TalktrackSetupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (videoDeviceId: string | null, audioDeviceId: string | null) => void;
}

export const TalktrackSetupDialog: React.FC<TalktrackSetupDialogProps> = ({
  isOpen,
  onClose,
  onStart,
}) => {
  const [videoDevices, setVideoDevices] = useState<RecordingDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<RecordingDevice[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [selectedAudio, setSelectedAudio] = useState<string | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  // Load devices when dialog opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const loadDevices = async () => {
      setLoading(true);
      setError(null);

      try {
        const [videoList, audioList] = await Promise.all([
          getVideoDevices(),
          getAudioDevices(),
        ]);

        setVideoDevices(videoList);
        setAudioDevices(audioList);

        // Select first device by default
        if (videoList.length > 0) {
          setSelectedVideo(videoList[0].deviceId);
        }
        if (audioList.length > 0) {
          setSelectedAudio(audioList[0].deviceId);
        }
      } catch (err) {
        console.error("Failed to load devices:", err);
        setError("无法获取设备列表");
      } finally {
        setLoading(false);
      }
    };

    loadDevices();
  }, [isOpen]);

  // Update video preview when selection changes
  useEffect(() => {
    if (!isOpen || !videoEnabled || !selectedVideo) {
      // Stop preview stream
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      return;
    }

    const startPreview = async () => {
      try {
        // Stop existing preview
        if (previewStreamRef.current) {
          previewStreamRef.current.getTracks().forEach((track) => track.stop());
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: selectedVideo } },
        });

        previewStreamRef.current = stream;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Failed to start preview:", err);
      }
    };

    startPreview();

    return () => {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
      }
    };
  }, [isOpen, videoEnabled, selectedVideo]);

  // Cleanup on close
  useEffect(() => {
    if (!isOpen) {
      if (previewStreamRef.current) {
        previewStreamRef.current.getTracks().forEach((track) => track.stop());
        previewStreamRef.current = null;
      }
    }
  }, [isOpen]);

  const handleStart = useCallback(() => {
    const videoId = videoEnabled ? selectedVideo : null;
    const audioId = audioEnabled ? selectedAudio : null;
    onStart(videoId, audioId);
  }, [videoEnabled, audioEnabled, selectedVideo, selectedAudio, onStart]);

  const toggleVideo = useCallback(() => {
    setVideoEnabled((prev) => !prev);
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => !prev);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onCloseRequest={onClose}
      title="录制设置"
      className="talktrack-setup-dialog"
    >
      <div className="talktrack-setup-dialog__content">
        {/* Camera preview */}
        <div className="talktrack-setup-dialog__preview">
          {videoEnabled && selectedVideo ? (
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="talktrack-setup-dialog__video"
            />
          ) : (
            <div className="talktrack-setup-dialog__avatar">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          )}
        </div>

        {/* Toggle buttons */}
        <div className="talktrack-setup-dialog__toggles">
          <button
            className={clsx("talktrack-setup-dialog__toggle", {
              "talktrack-setup-dialog__toggle--active": videoEnabled,
              "talktrack-setup-dialog__toggle--disabled": videoDevices.length === 0,
            })}
            onClick={toggleVideo}
            disabled={videoDevices.length === 0}
            title={videoEnabled ? "关闭摄像头" : "开启摄像头"}
          >
            {videoEnabled ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="5" width="14" height="14" rx="2" />
                <path d="M22 7l-6 5 6 5V7z" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M16 16v1a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
                <path d="M22 7l-6 5 6 5V7z" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            )}
          </button>

          <button
            className={clsx("talktrack-setup-dialog__toggle", {
              "talktrack-setup-dialog__toggle--active": audioEnabled,
              "talktrack-setup-dialog__toggle--disabled": audioDevices.length === 0,
            })}
            onClick={toggleAudio}
            disabled={audioDevices.length === 0}
            title={audioEnabled ? "关闭麦克风" : "开启麦克风"}
          >
            {audioEnabled ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>
        </div>

        {/* Device selection */}
        {loading ? (
          <div className="talktrack-setup-dialog__loading">
            <div className="talktrack-setup-dialog__spinner" />
            <span>正在加载设备...</span>
          </div>
        ) : error ? (
          <div className="talktrack-setup-dialog__error">{error}</div>
        ) : (
          <div className="talktrack-setup-dialog__devices">
            {/* Video source */}
            <div className="talktrack-setup-dialog__device-row">
              <label className="talktrack-setup-dialog__label">
                摄像头
              </label>
              <select
                className="talktrack-setup-dialog__select"
                value={selectedVideo || "none"}
                onChange={(e) =>
                  setSelectedVideo(
                    e.target.value === "none" ? null : e.target.value,
                  )
                }
                disabled={!videoEnabled}
              >
                <option value="none">无摄像头</option>
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Audio source */}
            <div className="talktrack-setup-dialog__device-row">
              <label className="talktrack-setup-dialog__label">
                麦克风
              </label>
              <select
                className="talktrack-setup-dialog__select"
                value={selectedAudio || "none"}
                onChange={(e) =>
                  setSelectedAudio(
                    e.target.value === "none" ? null : e.target.value,
                  )
                }
                disabled={!audioEnabled}
              >
                <option value="none">无麦克风</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="talktrack-setup-dialog__actions">
          <button
            className="talktrack-setup-dialog__start-button"
            onClick={handleStart}
            disabled={loading}
          >
            开始录制
          </button>
          <button
            className="talktrack-setup-dialog__back-button"
            onClick={onClose}
          >
            取消
          </button>
        </div>
      </div>
    </Dialog>
  );
};