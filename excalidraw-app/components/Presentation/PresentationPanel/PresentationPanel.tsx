import clsx from "clsx";
import { useCallback, useEffect, useState, useRef } from "react";

import { PlusIcon } from "@excalidraw/excalidraw/components/icons";
import { exportToCanvas } from "@excalidraw/utils";

import type { ExcalidrawFrameLikeElement, NonDeleted } from "@excalidraw/element/types";
import type {
  ExcalidrawImperativeAPI,
  BinaryFiles,
} from "@excalidraw/excalidraw/types";

import { usePresentationMode } from "../usePresentationMode";
import { SlidesLayoutDialog, applyLayoutToFrames } from "../SlidesLayoutDialog";

import "./PresentationPanel.scss";

import type { LayoutType } from "../SlidesLayoutDialog";

// 从 Frame 名称中提取序号前缀（如 "3. My Frame" → 3）
const extractOrderPrefix = (name: string | null): number | null => {
  if (!name) {
    return null;
  }
  const match = name.match(/^(\d+)\.\s*/);
  return match ? parseInt(match[1], 10) : null;
};

// 去除序号前缀
const removeOrderPrefix = (name: string | null): string => {
  if (!name) {
    return "";
  }
  return name.replace(/^\d+\.\s*/, "");
};

// 添加/更新序号前缀
const setOrderPrefix = (name: string | null, order: number): string => {
  const baseName = removeOrderPrefix(name) || `Frame`;
  return `${order}. ${baseName}`;
};

interface PresentationPanelProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

interface SlideThumbProps {
  frame: ExcalidrawFrameLikeElement;
  index: number;
  isActive: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onClick: () => void;
  onRename: (newName: string) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  refreshKey?: number;
}

const SlideThumb: React.FC<SlideThumbProps> = ({
  frame,
  index,
  isActive,
  isDragging,
  isDragOver,
  onClick,
  onRename,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  excalidrawAPI,
  refreshKey,
}) => {
  const frameName = frame.name || `Frame ${index + 1}`;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewError, setPreviewError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(frameName);

  useEffect(() => {
    if (!isEditing) {
      setEditValue(frame.name || `Frame ${index + 1}`);
    }
  }, [frame.name, index, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditing(true);
    setEditValue(frame.name || "");
  };

  const handleFinishEditing = () => {
    setIsEditing(false);
    const trimmedValue = editValue.trim();
    if (trimmedValue !== frame.name) {
      onRename(trimmedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleFinishEditing();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditValue(frame.name || `Frame ${index + 1}`);
    }
  };

  // 生成 Frame 预览
  useEffect(() => {
    if (!excalidrawAPI || !canvasRef.current) {
      return;
    }

    const generatePreview = async () => {
      try {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();

        const exportedCanvas = await exportToCanvas({
          elements,
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: appState.viewBackgroundColor,
          },
          files: files as BinaryFiles,
          exportingFrame: frame as NonDeleted<ExcalidrawFrameLikeElement>,
          maxWidthOrHeight: 300,
        });

        const ctx = canvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
          const previewWidth = canvasRef.current.width;
          const previewHeight = canvasRef.current.height;

          ctx.clearRect(0, 0, previewWidth, previewHeight);

          const scale = Math.min(
            previewWidth / exportedCanvas.width,
            previewHeight / exportedCanvas.height,
          );

          const scaledWidth = exportedCanvas.width * scale;
          const scaledHeight = exportedCanvas.height * scale;

          const offsetX = (previewWidth - scaledWidth) / 2;
          const offsetY = (previewHeight - scaledHeight) / 2;

          ctx.drawImage(
            exportedCanvas,
            offsetX,
            offsetY,
            scaledWidth,
            scaledHeight,
          );
          setPreviewError(false);
        }
      } catch (error) {
        console.error("Failed to generate frame preview:", error);
        setPreviewError(true);
      }
    };

    const timeoutId = setTimeout(generatePreview, 100);
    return () => clearTimeout(timeoutId);
  }, [frame, excalidrawAPI, refreshKey]);

  return (
    <div
      className={clsx("presentation-panel__slide", {
        "presentation-panel__slide--active": isActive,
        "presentation-panel__slide--dragging": isDragging,
        "presentation-panel__slide--drag-over": isDragOver,
      })}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {isDragOver && <div className="presentation-panel__drop-indicator" />}

      <div
        className="presentation-panel__slide-content"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        title={`跳转到 ${frameName}`}
      >
        <div className="presentation-panel__slide-preview">
          <canvas
            ref={canvasRef}
            width={280}
            height={158}
            className="presentation-panel__slide-canvas"
          />
          {previewError && (
            <span className="presentation-panel__slide-number">{index + 1}</span>
          )}
          <div className="presentation-panel__slide-overlay">
            <button
              className="presentation-panel__overlay-action"
              onClick={handleStartEditing}
              title="重命名"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <div className="presentation-panel__overlay-drag-handle" title="拖拽排序">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="9" cy="5" r="1.5" />
                <circle cx="15" cy="5" r="1.5" />
                <circle cx="9" cy="12" r="1.5" />
                <circle cx="15" cy="12" r="1.5" />
                <circle cx="9" cy="19" r="1.5" />
                <circle cx="15" cy="19" r="1.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          className="presentation-panel__slide-name-input"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleFinishEditing}
          onKeyDown={handleKeyDown}
          onClick={(e) => e.stopPropagation()}
          placeholder={`Frame ${index + 1}`}
        />
      ) : (
        <span
          className="presentation-panel__slide-name"
          onDoubleClick={handleStartEditing}
          title="双击重命名"
        >
          {frameName}
        </span>
      )}
    </div>
  );
};

const PresentationInstructions: React.FC<{
  onCreateSlide: () => void;
}> = ({ onCreateSlide }) => {
  return (
    <div className="presentation-panel__instructions">
      <div className="presentation-panel__instructions-icon">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4l18 0" />
          <path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" />
          <path d="M12 16l0 4" />
          <path d="M9 20l6 0" />
          <path d="M8 12l3 -3l2 2l3 -3" />
        </svg>
      </div>
      <h3 className="presentation-panel__instructions-title">没有 Frame</h3>
      <p className="presentation-panel__instructions-text">
        演示模式使用 Frame 作为幻灯片。请先在画布上添加 Frame。
      </p>
      <ol className="presentation-panel__instructions-steps">
        <li>从工具栏选择 Frame 工具</li>
        <li>在画布上拖拽创建 Frame</li>
        <li>在 Frame 内放置内容</li>
        <li>可创建多个 Frame 作为多页幻灯片</li>
      </ol>
      <button className="presentation-panel__create-slide-button" onClick={onCreateSlide}>
        {PlusIcon}
        <span>创建第一个幻灯片</span>
      </button>
    </div>
  );
};

export const PresentationPanel: React.FC<PresentationPanelProps> = ({
  excalidrawAPI,
}) => {
  const [orderedFrames, setOrderedFrames] = useState<ExcalidrawFrameLikeElement[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState<number | null>(null);
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0);
  const [isLayoutDialogOpen, setIsLayoutDialogOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const slidesContainerRef = useRef<HTMLDivElement>(null);
  const autoScrollIntervalRef = useRef<number | null>(null);

  const { startPresentation, getFrames, isPresentationMode, setSlides } =
    usePresentationMode({ excalidrawAPI });

  // 刷新 Frame 列表
  const refreshFrames = useCallback(() => {
    const currentFrames = getFrames();

    const sortedFrames = [...currentFrames].sort((a, b) => {
      const orderA = extractOrderPrefix(a.name);
      const orderB = extractOrderPrefix(b.name);

      if (orderA !== null && orderB !== null) {
        return orderA - orderB;
      }
      if (orderA !== null) {
        return -1;
      }
      if (orderB !== null) {
        return 1;
      }
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });

    setOrderedFrames((prevOrdered) => {
      if (prevOrdered.length === 0) {
        return sortedFrames;
      }

      const existingIds = new Set(currentFrames.map((f) => f.id));
      const orderedIds = new Set(prevOrdered.map((f) => f.id));

      const kept = prevOrdered.filter((f) => existingIds.has(f.id));
      const newFrames = sortedFrames.filter((f) => !orderedIds.has(f.id));
      const updatedKept = kept.map(
        (f) => currentFrames.find((cf) => cf.id === f.id) || f,
      );

      return [...updatedKept, ...newFrames];
    });

    setPreviewRefreshKey((prev) => prev + 1);
  }, [getFrames]);

  useEffect(() => {
    refreshFrames();

    if (!excalidrawAPI) {
      return;
    }

    const unsubscribe = excalidrawAPI.onChange(() => {
      refreshFrames();
    });

    return () => unsubscribe();
  }, [excalidrawAPI, refreshFrames]);

  const handleCreateSlide = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    excalidrawAPI.setActiveTool({ type: "frame" });
    excalidrawAPI.setToast({
      message: "在画布上拖拽创建 Frame",
      duration: 3000,
      closable: true,
    });
  }, [excalidrawAPI]);

  const handleSlideClick = useCallback(
    (index: number) => {
      if (!excalidrawAPI || !orderedFrames[index]) {
        return;
      }

      setSelectedFrameIndex(index);
      // 用 setViewport 替代 scrollToContent(fitToContent)
      excalidrawAPI.setViewport({
        target: orderedFrames[index],
        fit: "scale-down",
        animation: { duration: 300 },
      });
    },
    [excalidrawAPI, orderedFrames],
  );

  const updateFrameOrderPrefixes = useCallback(
    (frames: ExcalidrawFrameLikeElement[]) => {
      if (!excalidrawAPI) {
        return;
      }

      const elements = excalidrawAPI.getSceneElements();
      const updatedElements = elements.map((el) => {
        if (el.type === "frame" || el.type === "magicframe") {
          const frameIndex = frames.findIndex((f) => f.id === el.id);
          if (frameIndex !== -1) {
            const newName = setOrderPrefix(el.name, frameIndex + 1);
            if (newName !== el.name) {
              return { ...el, name: newName };
            }
          }
        }
        return el;
      });

      excalidrawAPI.updateScene({ elements: updatedElements });
    },
    [excalidrawAPI],
  );

  // 拖拽处理
  const handleDragStart = useCallback(
    (index: number) => (e: React.DragEvent) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", String(index));

      requestAnimationFrame(() => {
        const target = e.target as HTMLElement;
        target.style.opacity = "0.5";
      });
    },
    [],
  );

  const handleDragEnd = useCallback(
    () => (e: React.DragEvent) => {
      const target = e.target as HTMLElement;
      target.style.opacity = "";
      setDraggedIndex(null);
      setDragOverIndex(null);

      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    },
    [],
  );

  const handleDragOver = useCallback(
    (index: number) => (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      if (draggedIndex !== null && draggedIndex !== index) {
        setDragOverIndex(index);
      }

      const container = slidesContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const scrollZone = 60;

        if (autoScrollIntervalRef.current) {
          clearInterval(autoScrollIntervalRef.current);
          autoScrollIntervalRef.current = null;
        }

        if (e.clientY < rect.top + scrollZone) {
          autoScrollIntervalRef.current = window.setInterval(() => {
            container.scrollBy(0, -8);
          }, 16);
        } else if (e.clientY > rect.bottom - scrollZone) {
          autoScrollIntervalRef.current = window.setInterval(() => {
            container.scrollBy(0, 8);
          }, 16);
        }
      }
    },
    [draggedIndex],
  );

  const handleDragLeave = useCallback(
    () => (e: React.DragEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      const currentTarget = e.currentTarget as HTMLElement;
      if (!currentTarget.contains(relatedTarget)) {
        setDragOverIndex(null);
      }
    },
    [],
  );

  const handleDrop = useCallback(
    (dropIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();

      if (draggedIndex === null || draggedIndex === dropIndex) {
        setDraggedIndex(null);
        setDragOverIndex(null);
        return;
      }

      setOrderedFrames((prev) => {
        const newOrder = [...prev];
        const [draggedItem] = newOrder.splice(draggedIndex, 1);

        const adjustedDropIndex =
          draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
        newOrder.splice(adjustedDropIndex, 0, draggedItem);

        updateFrameOrderPrefixes(newOrder);

        return newOrder;
      });

      setDraggedIndex(null);
      setDragOverIndex(null);

      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    },
    [draggedIndex, updateFrameOrderPrefixes],
  );

  const handleRenameFrame = useCallback(
    (frameId: string, newName: string) => {
      if (!excalidrawAPI) {
        return;
      }

      const elements = excalidrawAPI.getSceneElements();
      const updatedElements = elements.map((el) => {
        if (
          el.id === frameId &&
          (el.type === "frame" || el.type === "magicframe")
        ) {
          return { ...el, name: newName || null };
        }
        return el;
      });

      excalidrawAPI.updateScene({ elements: updatedElements });
    },
    [excalidrawAPI],
  );

  const handleStartPresentation = useCallback(() => {
    setSlides(orderedFrames);
    startPresentation();
  }, [startPresentation, setSlides, orderedFrames]);

  const handleApplyLayout = useCallback(
    (layout: LayoutType, columnCount: number) => {
      if (!excalidrawAPI || orderedFrames.length === 0) {
        return;
      }
      applyLayoutToFrames(excalidrawAPI, orderedFrames, layout, columnCount);
    },
    [excalidrawAPI, orderedFrames],
  );

  useEffect(() => {
    return () => {
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
      }
    };
  }, []);

  if (isPresentationMode) {
    return null;
  }

  const hasFrames = orderedFrames.length > 0;

  return (
    <div className="presentation-panel" onWheel={(e) => e.stopPropagation()}>
      {hasFrames ? (
        <>
          <div className="presentation-panel__header">
            <span className="presentation-panel__title">幻灯片</span>
            <div className="presentation-panel__header-actions">
              <button
                className="presentation-panel__header-button"
                onClick={() => setIsLayoutDialogOpen(true)}
                title="布局"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              </button>
              <button
                className="presentation-panel__header-button"
                onClick={handleCreateSlide}
                title="创建幻灯片"
              >
                {PlusIcon}
              </button>
            </div>
          </div>

          <SlidesLayoutDialog
            isOpen={isLayoutDialogOpen}
            onClose={() => setIsLayoutDialogOpen(false)}
            onApply={handleApplyLayout}
          />

          <div
            className="presentation-panel__slides"
            ref={slidesContainerRef}
            onWheel={(e) => e.stopPropagation()}
          >
            {orderedFrames.map((frame, index) => (
              <SlideThumb
                key={frame.id}
                frame={frame}
                index={index}
                isActive={selectedFrameIndex === index}
                isDragging={draggedIndex === index}
                isDragOver={dragOverIndex === index}
                onClick={() => handleSlideClick(index)}
                onRename={(newName) => handleRenameFrame(frame.id, newName)}
                onDragStart={handleDragStart(index)}
                onDragEnd={handleDragEnd()}
                onDragOver={handleDragOver(index)}
                onDragLeave={handleDragLeave()}
                onDrop={handleDrop(index)}
                excalidrawAPI={excalidrawAPI}
                refreshKey={previewRefreshKey}
              />
            ))}
          </div>

          <div className="presentation-panel__footer">
            <button
              className="presentation-panel__start-button"
              onClick={handleStartPresentation}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <span>开始演示</span>
            </button>
          </div>
        </>
      ) : (
        <PresentationInstructions onCreateSlide={handleCreateSlide} />
      )}
    </div>
  );
};