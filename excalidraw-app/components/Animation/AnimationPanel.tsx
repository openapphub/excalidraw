import { useCallback, useEffect, useRef, useState } from "react";

import { exportToSvg } from "@excalidraw/utils";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";

import { animateSvg, type AnimateController } from "./animate";

import "./AnimationPanel.scss";

interface AnimationPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

type PlayMode = "auto" | "manual";

// 手动模式默认步进时长（ms），可在 UI 中调整
const DEFAULT_STEP_DURATION = 800;

export const AnimationPanel: React.FC<AnimationPanelProps> = ({
  excalidrawAPI,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AnimateController | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [duration, setDuration] = useState(10000);
  const [loop, setLoop] = useState(false);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<PlayMode>("auto");
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  // 手动模式每步动画时长（ms）
  const [stepDuration, setStepDuration] = useState(DEFAULT_STEP_DURATION);

  // 录制状态
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordDialogOpen, setIsRecordDialogOpen] = useState(false);
  const [isRecordFullscreen, setIsRecordFullscreen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [recordError, setRecordError] = useState<string | null>(null);

  // 录制用的全屏容器
  const recordContainerRef = useRef<HTMLDivElement>(null);
  const recordSvgRef = useRef<SVGSVGElement | null>(null);
  const recordControllerRef = useRef<AnimateController | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const canvasStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const recordStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const framePendingRef = useRef(false);
  const lastFrameAtRef = useRef(0);

  // 渲染 SVG + 启动动画（侧栏预览）
  useEffect(() => {
    const render = async () => {
      if (!containerRef.current || !excalidrawAPI) {
        return;
      }

      if (controllerRef.current) {
        controllerRef.current.cancel();
        controllerRef.current = null;
      }

      try {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles() as BinaryFiles;

        const svg = await exportToSvg({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: appState.viewBackgroundColor,
          },
          files,
        });

        svgRef.current = svg;
        containerRef.current.innerHTML = "";
        containerRef.current.appendChild(svg);

        svg.style.maxWidth = "100%";
        svg.style.height = "100%";
        svg.style.objectFit = "contain";

        const controller = animateSvg(svg, { duration, loop });
        controllerRef.current = controller;
        setTotalSteps(controller.getTotalSteps());
        setCurrentStep(0);

        if (mode === "manual") {
          controller.pause();
          setIsPlaying(false);
        } else {
          setIsPlaying(true);
        }
      } catch (error) {
        console.error("Failed to render animation", error);
      }
    };

    render();
  }, [excalidrawAPI, duration, loop, version, mode]);

  // 手动步进
  const handleStepForward = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.stepForward(stepDuration);
    setCurrentStep(controllerRef.current.getCurrentStep());
  }, [stepDuration]);

  const handleStepBackward = useCallback(() => {
    if (!controllerRef.current) return;
    controllerRef.current.stepBackward();
    setCurrentStep(controllerRef.current.getCurrentStep());
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!controllerRef.current) return;
    if (isPlaying) {
      controllerRef.current.pause();
      setIsPlaying(false);
    } else {
      controllerRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleReplay = useCallback(() => {
    setVersion((v) => v + 1);
    setIsPlaying(true);
  }, []);

  const handleModeChange = useCallback((newMode: PlayMode) => {
    setMode(newMode);
    setVersion((v) => v + 1);
  }, []);

  // ===== 录制：全屏 Modal + SVG DOM 每帧截图到 canvas =====

  // 准备录制用的全屏 SVG
  const prepareRecordSvg = useCallback(async () => {
    if (!excalidrawAPI || !recordContainerRef.current) return null;

    const elements = excalidrawAPI.getSceneElements();
    const appState = excalidrawAPI.getAppState();
    const files = excalidrawAPI.getFiles() as BinaryFiles;

    const svg = await exportToSvg({
      elements,
      appState: {
        ...appState,
        exportBackground: true,
        viewBackgroundColor: appState.viewBackgroundColor,
      },
      files,
    });

    // 用 SVG 原始导出尺寸作为录制 canvas 尺寸（不缩放 SVG，避免裁切变形）
    const svgWidth = parseFloat(svg.getAttribute("width") || "800");
    const svgHeight = parseFloat(svg.getAttribute("height") || "600");

    // 不修改 SVG 尺寸，保持原始导出比例
    svg.style.position = "absolute";
    // 居中放置在全屏容器中
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const fitScale =
      Math.min(viewportW / svgWidth, viewportH / svgHeight) * 0.9;
    const displayW = svgWidth * fitScale;
    const displayH = svgHeight * fitScale;
    svg.style.width = `${displayW}px`;
    svg.style.height = `${displayH}px`;
    svg.style.left = `${(viewportW - displayW) / 2}px`;
    svg.style.top = `${(viewportH - displayH) / 2}px`;
    svg.style.backgroundColor = appState.viewBackgroundColor || "#ffffff";

    recordContainerRef.current.innerHTML = "";
    recordContainerRef.current.appendChild(svg);
    recordSvgRef.current = svg;

    return svg;
  }, [excalidrawAPI]);

  // 开始录制：全屏 Modal + captureStream
  const handleStartRecording = useCallback(async () => {
    setRecordError(null);
    let canvas: HTMLCanvasElement | null = null;

    const cleanupFailedRecording = () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
        animFrameIdRef.current = null;
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach((track) => track.stop());
        canvasStreamRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      recordControllerRef.current?.destroy();
      recordControllerRef.current = null;
      mediaRecorderRef.current = null;
      framePendingRef.current = false;
      lastFrameAtRef.current = 0;
      canvas?.remove();
    };

    try {
      // 先显示全屏 Modal
      setIsRecordFullscreen(true);
      setIsRecordDialogOpen(false);

      // 等待 DOM 渲染
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 准备录制用 SVG
      const svg = await prepareRecordSvg();
      if (!svg) {
        setRecordError("动画未就绪");
        setIsRecordFullscreen(false);
        return;
      }

      // 创建录制用 canvas（匹配 SVG 原始导出尺寸，2x 分辨率）
      const recordSvgEl = recordSvgRef.current;
      if (!recordSvgEl) {
        setRecordError("SVG 未就绪");
        setIsRecordFullscreen(false);
        return;
      }
      const svgOrigW = parseFloat(recordSvgEl.getAttribute("width") || "800");
      const svgOrigH = parseFloat(recordSvgEl.getAttribute("height") || "600");
      // canvas 比 SVG 大 10% 余量
      const canvasPadding = 0.1;
      canvas = document.createElement("canvas");
      const recordCanvas = canvas;
      recordCanvas.width = Math.round(svgOrigW * 2 * (1 + canvasPadding));
      recordCanvas.height = Math.round(svgOrigH * 2 * (1 + canvasPadding));
      recordCanvas.style.display = "none";
      document.body.appendChild(recordCanvas);

      const ctx = recordCanvas.getContext("2d");
      if (!ctx) {
        setRecordError("无法创建画布");
        cleanupFailedRecording();
        setIsRecordFullscreen(false);
        return;
      }

      const tracks: MediaStreamTrack[] = [];

      // canvas 流
      canvasStreamRef.current = recordCanvas.captureStream(30);
      tracks.push(...canvasStreamRef.current.getVideoTracks());

      // 音频流
      if (audioEnabled) {
        try {
          audioStreamRef.current = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          tracks.push(...audioStreamRef.current.getAudioTracks());
        } catch (err) {
          console.warn("Failed to get audio:", err);
        }
      }

      const combinedStream = new MediaStream(tracks);
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 5_000_000,
      });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (recordStopTimeoutRef.current) {
          clearTimeout(recordStopTimeoutRef.current);
          recordStopTimeoutRef.current = null;
        }
        // 下载
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ts = new Date().toISOString().replace(/[:]/g, "-").slice(0, 19);
        a.download = `animation_${ts}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // 清理
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
          animFrameIdRef.current = null;
        }
        if (canvasStreamRef.current) {
          canvasStreamRef.current.getTracks().forEach((t) => t.stop());
          canvasStreamRef.current = null;
        }
        if (audioStreamRef.current) {
          audioStreamRef.current.getTracks().forEach((t) => t.stop());
          audioStreamRef.current = null;
        }
        if (recordControllerRef.current) {
          recordControllerRef.current.destroy();
          recordControllerRef.current = null;
        }
        recordCanvas.remove();
        framePendingRef.current = false;
        lastFrameAtRef.current = 0;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setIsRecordFullscreen(false);
      };

      // 启动动画控制器（在录制全屏 SVG 上）
      const controller = animateSvg(svg, { duration, loop });
      recordControllerRef.current = controller;

      // 手动模式则暂停自动动画
      if (mode === "manual") {
        controller.pause();
      }

      // 核心录制循环：每帧将 SVG DOM 直接绘制到 canvas
      // 使用 data URL 方式（serializeToString + Image），因为 animateSvg
      // 现在用 requestAnimationFrame 更新 inline style，序列化能捕获当前状态
      const drawFrame = (timestamp: number) => {
        if (!ctx || !recordSvgRef.current) {
          return;
        }

        // MediaRecorder 是 30fps；限制 SVG 序列化并保证同一时刻只解码一帧，
        // 避免长录制时堆积 Blob/Image 导致 GC 和主线程持续抖动。
        if (
          !framePendingRef.current &&
          timestamp - lastFrameAtRef.current >= 1000 / 30
        ) {
          lastFrameAtRef.current = timestamp;
          framePendingRef.current = true;
          try {
            const svgEl = recordSvgRef.current;
            // 序列化当前 SVG DOM（用原始 width/height 属性，不被 CSS style 覆盖）
            // 临时移除 CSS width/height 使序列化用原始属性值
            const savedCssW = svgEl.style.width;
            const savedCssH = svgEl.style.height;
            svgEl.style.width = "";
            svgEl.style.height = "";

            const svgData = new XMLSerializer().serializeToString(svgEl);
            const svgBlob = new Blob([svgData], {
              type: "image/svg+xml;charset=utf-8",
            });
            const svgUrl = URL.createObjectURL(svgBlob);

            // 恢复 CSS
            svgEl.style.width = savedCssW;
            svgEl.style.height = savedCssH;

            const img = new Image();
            img.onload = () => {
              // 白色背景
              ctx.fillStyle = "#ffffff";
              ctx.fillRect(
                0,
                0,
                recordCanvas.width,
                recordCanvas.height,
              );
              // 缩小到 90% 居中绘制（留余量避免裁切）
              const scale = 0.9;
              const dw = recordCanvas.width * scale;
              const dh = recordCanvas.height * scale;
              const dx = (recordCanvas.width - dw) / 2;
              const dy = (recordCanvas.height - dh) / 2;
              ctx.drawImage(img, dx, dy, dw, dh);
              URL.revokeObjectURL(svgUrl);
              framePendingRef.current = false;
            };
            img.onerror = () => {
              URL.revokeObjectURL(svgUrl);
              framePendingRef.current = false;
            };
            img.src = svgUrl;
          } catch (err) {
            framePendingRef.current = false;
            // 忽略单帧错误
          }
        }

        animFrameIdRef.current = requestAnimationFrame(drawFrame);
      };

      // 开始录制
      recorder.start(1000);
      setIsRecording(true);
      drawFrame(performance.now());

      // 自动模式：录制结束后自动停止
      if (mode === "auto" && !loop) {
        const totalDuration = duration + 2000;
        recordStopTimeoutRef.current = setTimeout(() => {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        }, totalDuration);
      }
    } catch (err) {
      console.error("Recording failed:", err);
      cleanupFailedRecording();
      setRecordError(err instanceof Error ? err.message : "录制失败");
      setIsRecordFullscreen(false);
    }
  }, [audioEnabled, duration, loop, mode, prepareRecordSvg]);

  const handleStopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // 录制全屏 Modal 中的手动步进
  const handleRecordStepForward = useCallback(() => {
    if (!recordControllerRef.current) return;
    recordControllerRef.current.stepForward(stepDuration);
  }, [stepDuration]);

  const handleRecordStepBackward = useCallback(() => {
    if (!recordControllerRef.current) return;
    recordControllerRef.current.stepBackward();
  }, []);

  const handleRecordPlayPause = useCallback(() => {
    if (!recordControllerRef.current) return;
    // toggle play/pause
    const animations = recordControllerRef.current as unknown as {
      pause: () => void;
      play: () => void;
    };
    // 简单方案：手动模式下不用 play/pause，用步进
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.cancel();
      }
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      if (recordStopTimeoutRef.current) {
        clearTimeout(recordStopTimeoutRef.current);
      }
      if (canvasStreamRef.current) {
        canvasStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recordControllerRef.current) {
        recordControllerRef.current.destroy();
      }
    };
  }, []);

  const durationOptions = [
    { label: "5s", value: 5000 },
    { label: "10s", value: 10000 },
    { label: "15s", value: 15000 },
    { label: "30s", value: 30000 },
    { label: "60s", value: 60000 },
  ];

  return (
    <>
      <div className="animation-panel">
        {/* 预览区 */}
        <div className="animation-panel__preview" ref={containerRef} />

        {/* 控制区 */}
        <div className="animation-panel__controls">
          {/* 模式切换 */}
          <div className="animation-panel__mode">
            <button
              className={
                mode === "auto"
                  ? "animation-panel__mode-btn--active"
                  : "animation-panel__mode-btn"
              }
              onClick={() => handleModeChange("auto")}
            >
              自动播放
            </button>
            <button
              className={
                mode === "manual"
                  ? "animation-panel__mode-btn--active"
                  : "animation-panel__mode-btn"
              }
              onClick={() => handleModeChange("manual")}
            >
              手动控制
            </button>
          </div>

          {/* 自动模式控制 */}
          {mode === "auto" && (
            <div className="animation-panel__auto-controls">
              <button
                className="animation-panel__btn"
                onClick={handlePlayPause}
                title={isPlaying ? "暂停" : "播放"}
              >
                {isPlaying ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <button
                className="animation-panel__btn"
                onClick={handleReplay}
                title="重播"
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
              <label className="animation-panel__select-label">
                时长
                <select
                  className="animation-panel__select"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {durationOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="animation-panel__checkbox-label">
                <input
                  type="checkbox"
                  checked={loop}
                  onChange={(e) => setLoop(e.target.checked)}
                />
                循环
              </label>
            </div>
          )}

          {/* 手动模式控制 */}
          {mode === "manual" && (
            <div className="animation-panel__manual-controls">
              <button
                className="animation-panel__btn"
                onClick={handleStepBackward}
                disabled={currentStep === 0}
                title="上一步"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className="animation-panel__step-counter">
                {currentStep} / {totalSteps}
              </span>
              <button
                className="animation-panel__btn"
                onClick={handleStepForward}
                disabled={currentStep === totalSteps}
                title="下一步"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
              <button
                className="animation-panel__btn"
                onClick={handleReplay}
                title="重置"
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
              <label className="animation-panel__select-label">
                步进时长
                <select
                  className="animation-panel__select"
                  value={stepDuration}
                  onChange={(e) => setStepDuration(Number(e.target.value))}
                >
                  <option value={300}>0.3s</option>
                  <option value={500}>0.5s</option>
                  <option value={800}>0.8s</option>
                  <option value={1000}>1s</option>
                  <option value={2000}>2s</option>
                  <option value={3000}>3s</option>
                </select>
              </label>
            </div>
          )}

          {/* 录制按钮 */}
          <div className="animation-panel__record">
            {!isRecording ? (
              <button
                className="animation-panel__record-btn"
                onClick={() => setIsRecordDialogOpen(true)}
                title="录制动画"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="12" cy="12" r="8" fill="#ef5350" />
                </svg>
                <span>录制</span>
              </button>
            ) : (
              <button
                className="animation-panel__stop-record-btn"
                onClick={handleStopRecording}
                title="停止并下载"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <rect x="6" y="6" width="12" height="12" rx="1" />
                </svg>
                <span>停止并下载</span>
              </button>
            )}
            {isRecording && (
              <span className="animation-panel__recording-indicator">
                ● 录制中
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 录制设置弹窗 */}
      {isRecordDialogOpen && (
        <div className="animation-panel__record-dialog-overlay">
          <div className="animation-panel__record-dialog">
            <h3 className="animation-panel__record-dialog-title">录制设置</h3>
            <p className="animation-panel__record-dialog-desc">
              录制动画播放过程（全屏），生成 .webm 文件下载到本地。
              {mode === "manual" && " 手动模式下可在全屏中逐步控制动画。"}
            </p>
            <label className="animation-panel__checkbox-label">
              <input
                type="checkbox"
                checked={audioEnabled}
                onChange={(e) => setAudioEnabled(e.target.checked)}
              />
              开启麦克风录音
            </label>
            {recordError && (
              <p className="animation-panel__record-error">{recordError}</p>
            )}
            <div className="animation-panel__record-dialog-actions">
              <button
                className="animation-panel__btn animation-panel__btn--secondary"
                onClick={() => setIsRecordDialogOpen(false)}
              >
                取消
              </button>
              <button
                className="animation-panel__btn animation-panel__btn--primary"
                onClick={handleStartRecording}
              >
                开始录制
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 录制全屏 Modal */}
      {isRecordFullscreen && (
        <div className="animation-record-fullscreen" ref={recordContainerRef}>
          {isRecording && (
            <div className="animation-record-fullscreen__controls">
              {mode === "manual" && (
                <>
                  <button
                    className="animation-record-fullscreen__btn"
                    onClick={handleRecordStepBackward}
                    title="上一步"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                  </button>
                  <button
                    className="animation-record-fullscreen__btn"
                    onClick={handleRecordStepForward}
                    title="下一步"
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </>
              )}
              <button
                className="animation-record-fullscreen__stop-btn"
                onClick={handleStopRecording}
                title="停止并下载"
              >
                停止并下载
              </button>
              <span className="animation-record-fullscreen__indicator">
                ● 录制中
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

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
