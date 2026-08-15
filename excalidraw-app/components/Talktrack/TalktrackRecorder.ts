/**
 * TalktrackRecorder - Core recording logic for canvas + camera PIP + mic
 *
 * Captures the Excalidraw canvas, overlays camera feed as PIP,
 * records with audio, and produces a webm blob for local download.
 */

export interface RecordingDevice {
  deviceId: string;
  label: string;
}

export interface RecordingOptions {
  /** Video device ID or null for no camera */
  videoDeviceId: string | null;
  /** Audio device ID or null for no mic */
  audioDeviceId: string | null;
  /** Frame rate for recording (default: 30) */
  frameRate?: number;
  /** PIP size as percentage of canvas width (default: 0.15 = 15%) */
  pipSize?: number;
  /** PIP position from corner in pixels (default: 20) */
  pipMargin?: number;
}

export interface RecordingState {
  status: "idle" | "preparing" | "recording" | "paused" | "stopping" | "error";
  duration: number;
  error?: string;
}

export type RecordingStateCallback = (state: RecordingState) => void;

/**
 * Get available video input devices (cameras)
 */
export async function getVideoDevices(): Promise<RecordingDevice[]> {
  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ video: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "videoinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Camera ${device.deviceId.slice(0, 8)}`,
      }));
  } catch (error) {
    console.warn("Failed to get video devices:", error);
    return [];
  }
}

/**
 * Get available audio input devices (microphones)
 */
export async function getAudioDevices(): Promise<RecordingDevice[]> {
  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ audio: true });
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === "audioinput")
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `Microphone ${device.deviceId.slice(0, 8)}`,
      }));
  } catch (error) {
    console.warn("Failed to get audio devices:", error);
    return [];
  }
}

/**
 * Check if MediaRecorder is supported with the given mime type
 */
function getSupportedMimeType(): string {
  const mimeTypes = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];

  for (const mimeType of mimeTypes) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return "video/webm";
}

export class TalktrackRecorder {
  private staticCanvas: HTMLCanvasElement | null = null;
  private interactiveCanvas: HTMLCanvasElement | null = null;
  private compositorCanvas: HTMLCanvasElement | null = null;
  private compositorCtx: CanvasRenderingContext2D | null = null;
  private cameraVideo: HTMLVideoElement | null = null;
  private cameraStream: MediaStream | null = null;
  private audioStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private animationFrameId: number | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private durationInterval: number | null = null;

  private state: RecordingState = { status: "idle", duration: 0 };
  private onStateChange: RecordingStateCallback | null = null;

  private options: Required<RecordingOptions> = {
    videoDeviceId: null,
    audioDeviceId: null,
    frameRate: 30,
    pipSize: 0.15,
    pipMargin: 20,
  };

  constructor() {
    // Create hidden video element for camera feed
    this.cameraVideo = document.createElement("video");
    this.cameraVideo.autoplay = true;
    this.cameraVideo.muted = true;
    this.cameraVideo.playsInline = true;
    this.cameraVideo.style.display = "none";
    document.body.appendChild(this.cameraVideo);

    // Create compositor canvas
    this.compositorCanvas = document.createElement("canvas");
    this.compositorCanvas.style.display = "none";
    document.body.appendChild(this.compositorCanvas);
    this.compositorCtx = this.compositorCanvas.getContext("2d");
  }

  /**
   * Set the state change callback
   */
  setOnStateChange(callback: RecordingStateCallback) {
    this.onStateChange = callback;
  }

  /**
   * Get current recording state
   */
  getState(): RecordingState {
    return { ...this.state };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(partial: Partial<RecordingState>) {
    this.state = { ...this.state, ...partial };
    this.onStateChange?.(this.state);
  }

  /**
   * Find and return both Excalidraw canvas elements (static and interactive)
   */
  private findExcalidrawCanvases(): {
    static: HTMLCanvasElement | null;
    interactive: HTMLCanvasElement | null;
  } {
    const staticCanvas = document.querySelector(
      ".excalidraw__canvas.static",
    ) as HTMLCanvasElement;
    const interactiveCanvas = document.querySelector(
      ".excalidraw__canvas.interactive",
    ) as HTMLCanvasElement;

    return { static: staticCanvas, interactive: interactiveCanvas };
  }

  /**
   * Initialize camera stream
   */
  private async initCamera(deviceId: string): Promise<void> {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });

      if (this.cameraVideo) {
        this.cameraVideo.srcObject = this.cameraStream;
        await this.cameraVideo.play();
      }
    } catch (error) {
      console.error("Failed to initialize camera:", error);
      throw new Error("无法访问摄像头，请检查权限设置");
    }
  }

  /**
   * Initialize audio stream
   */
  private async initAudio(deviceId: string): Promise<void> {
    try {
      this.audioStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      throw new Error("无法访问麦克风，请检查权限设置");
    }
  }

  /**
   * Draw a single frame to the compositor canvas
   */
  private drawFrame = () => {
    if (
      !this.compositorCtx ||
      !this.compositorCanvas ||
      !this.staticCanvas ||
      this.state.status !== "recording"
    ) {
      return;
    }

    const ctx = this.compositorCtx;
    const width = this.compositorCanvas.width;
    const height = this.compositorCanvas.height;

    // Fill with white background first (prevents black bars from transparent areas)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    // 1. Draw the static canvas (main drawing) - use source dimensions to avoid stretching
    const srcWidth = this.staticCanvas.width;
    const srcHeight = this.staticCanvas.height;
    ctx.drawImage(
      this.staticCanvas,
      0,
      0,
      srcWidth,
      srcHeight,
      0,
      0,
      width,
      height,
    );

    // 2. Draw the interactive canvas (laser pointer, selections) if available
    if (this.interactiveCanvas) {
      const interSrcWidth = this.interactiveCanvas.width;
      const interSrcHeight = this.interactiveCanvas.height;
      ctx.drawImage(
        this.interactiveCanvas,
        0,
        0,
        interSrcWidth,
        interSrcHeight,
        0,
        0,
        width,
        height,
      );
    }

    // Draw camera PIP if available
    if (
      this.cameraVideo &&
      this.cameraStream &&
      this.cameraVideo.readyState >= 2
    ) {
      const pipWidth = width * this.options.pipSize;
      const pipHeight =
        pipWidth * (this.cameraVideo.videoHeight / this.cameraVideo.videoWidth);
      const pipX = width - pipWidth - this.options.pipMargin;
      const pipY = height - pipHeight - this.options.pipMargin;

      // Draw circular PIP
      ctx.save();

      // Create circular clipping path
      const centerX = pipX + pipWidth / 2;
      const centerY = pipY + pipHeight / 2;
      const radius = Math.min(pipWidth, pipHeight) / 2;

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw camera feed
      ctx.drawImage(this.cameraVideo, pipX, pipY, pipWidth, pipHeight);

      ctx.restore();

      // Draw PIP border
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw outer shadow
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Continue animation loop
    this.animationFrameId = requestAnimationFrame(this.drawFrame);
  };

  /**
   * Start the duration timer
   */
  private startDurationTimer() {
    this.durationInterval = window.setInterval(() => {
      if (this.state.status === "recording") {
        const now = Date.now();
        const elapsed = Math.floor(
          (now - this.startTime - this.pausedTime) / 1000,
        );
        this.updateState({ duration: elapsed });
      }
    }, 1000);
  }

  /**
   * Stop the duration timer
   */
  private stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Prepare for recording (get permissions, set up streams)
   */
  async prepare(options: RecordingOptions): Promise<void> {
    this.options = {
      videoDeviceId: options.videoDeviceId,
      audioDeviceId: options.audioDeviceId,
      frameRate: options.frameRate ?? 30,
      pipSize: options.pipSize ?? 0.15,
      pipMargin: options.pipMargin ?? 20,
    };

    this.updateState({ status: "preparing", duration: 0, error: undefined });

    try {
      // Find the Excalidraw canvases (static and interactive)
      const canvases = this.findExcalidrawCanvases();
      this.staticCanvas = canvases.static;
      this.interactiveCanvas = canvases.interactive;

      if (!this.staticCanvas) {
        throw new Error("找不到画布元素");
      }

      // Set up compositor canvas to match source canvas CSS display size
      if (this.compositorCanvas) {
        const rect = this.staticCanvas.getBoundingClientRect();
        // Use a reasonable resolution for recording (1080p max to avoid huge files)
        const maxWidth = 1920;
        const maxHeight = 1080;
        const scale = Math.min(
          1,
          maxWidth / rect.width,
          maxHeight / rect.height,
        );
        this.compositorCanvas.width = Math.round(rect.width * scale);
        this.compositorCanvas.height = Math.round(rect.height * scale);
      }

      // Initialize camera if selected
      if (this.options.videoDeviceId) {
        await this.initCamera(this.options.videoDeviceId);
      }

      // Initialize audio if selected
      if (this.options.audioDeviceId) {
        await this.initAudio(this.options.audioDeviceId);
      }
    } catch (error) {
      this.updateState({
        status: "error",
        error: error instanceof Error ? error.message : "准备录制失败",
      });
      throw error;
    }
  }

  /**
   * Start recording
   */
  async start(): Promise<void> {
    if (this.state.status !== "preparing" && this.state.status !== "idle") {
      throw new Error("Cannot start recording in current state");
    }

    if (!this.compositorCanvas) {
      throw new Error("Compositor canvas not initialized");
    }

    try {
      // Create combined stream from compositor canvas
      const canvasStream = this.compositorCanvas.captureStream(
        this.options.frameRate,
      );
      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      // Add audio track if available
      if (this.audioStream) {
        const audioTracks = this.audioStream.getAudioTracks();
        tracks.push(...audioTracks);
      }

      const combinedStream = new MediaStream(tracks);

      // Set up MediaRecorder
      const mimeType = getSupportedMimeType();
      this.mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
      });

      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        this.updateState({
          status: "error",
          error: "录制出错",
        });
      };

      // Start recording
      this.mediaRecorder.start(1000); // Collect data every second
      this.startTime = Date.now();
      this.pausedTime = 0;

      // Start drawing frames
      this.updateState({ status: "recording", duration: 0 });
      this.drawFrame();
      this.startDurationTimer();
    } catch (error) {
      this.updateState({
        status: "error",
        error:
          error instanceof Error ? error.message : "开始录制失败",
      });
      throw error;
    }
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.state.status !== "recording" || !this.mediaRecorder) {
      return;
    }

    this.mediaRecorder.pause();
    this.updateState({ status: "paused" });

    // Stop animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.state.status !== "paused" || !this.mediaRecorder) {
      return;
    }

    this.mediaRecorder.resume();
    this.updateState({ status: "recording" });

    // Resume animation frame
    this.drawFrame();
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.state.status === "idle") {
        reject(new Error("没有正在进行的录制"));
        return;
      }

      this.updateState({ status: "stopping" });
      this.stopDurationTimer();

      // Stop animation frame
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = getSupportedMimeType();
        const blob = new Blob(this.recordedChunks, { type: mimeType });
        this.recordedChunks = [];

        // Clean up streams
        this.cleanup();

        this.updateState({ status: "idle" });
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Cancel and discard recording
   */
  cancel(): void {
    this.stopDurationTimer();

    // Stop animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    this.recordedChunks = [];
    this.cleanup();
    this.updateState({ status: "idle", duration: 0 });
  }

  /**
   * Clean up all streams and resources
   */
  private cleanup(): void {
    // Stop camera stream
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }

    // Stop audio stream
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }

    // Clear video source
    if (this.cameraVideo) {
      this.cameraVideo.srcObject = null;
    }
  }

  /**
   * Dispose of the recorder and clean up DOM elements
   */
  dispose(): void {
    this.cancel();

    if (this.cameraVideo) {
      this.cameraVideo.remove();
      this.cameraVideo = null;
    }

    if (this.compositorCanvas) {
      this.compositorCanvas.remove();
      this.compositorCanvas = null;
      this.compositorCtx = null;
    }
  }
}

// Singleton instance
let recorderInstance: TalktrackRecorder | null = null;

/**
 * Get or create the TalktrackRecorder singleton instance
 */
export function getTalktrackRecorder(): TalktrackRecorder {
  if (!recorderInstance) {
    recorderInstance = new TalktrackRecorder();
  }
  return recorderInstance;
}

/**
 * Dispose of the TalktrackRecorder singleton and reset the reference.
 * This should be called when the TalktrackManager component unmounts
 * to ensure a fresh instance is created on next mount.
 */
export function disposeTalktrackRecorder(): void {
  if (recorderInstance) {
    recorderInstance.dispose();
    recorderInstance = null;
  }
}

/**
 * Format duration in seconds to MM:SS string
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}