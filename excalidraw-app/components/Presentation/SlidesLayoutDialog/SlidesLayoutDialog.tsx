import clsx from "clsx";
import { useState } from "react";

import { Dialog } from "@excalidraw/excalidraw/components/Dialog";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import "./SlidesLayoutDialog.scss";

export type LayoutType = "row" | "column" | "grid";

interface SlidesLayoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (layout: LayoutType, columnCount: number) => void;
}

export const SlidesLayoutDialog: React.FC<SlidesLayoutDialogProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>("row");
  const [columnCount, setColumnCount] = useState(3);

  if (!isOpen) {
    return null;
  }

  const handleApply = () => {
    onApply(selectedLayout, columnCount);
    onClose();
  };

  return (
    <Dialog onCloseRequest={onClose} title="幻灯片布局" size="wide">
      <div className="slides-layout-dialog">
        <p className="slides-layout-dialog__description">
          选择 Frame 的排列方式。排列后可拖拽调整顺序。
        </p>

        <p className="slides-layout-dialog__order-note">
          <strong>提示</strong>
          <br />
          <span className="slides-layout-dialog__order-note-sub">
            Frame 名称前的序号（如 "1." "2."）决定演示顺序
          </span>
        </p>

        <div className="slides-layout-dialog__options">
          {/* 横向排列 */}
          <button
            className={clsx("slides-layout-dialog__option", {
              "slides-layout-dialog__option--selected": selectedLayout === "row",
            })}
            onClick={() => setSelectedLayout("row")}
          >
            <div className="slides-layout-dialog__option-preview">
              <div className="slides-layout-dialog__mock-window">
                <div className="slides-layout-dialog__window-dots">
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--red" />
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--yellow" />
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--green" />
                </div>
                <div className="slides-layout-dialog__mock-frames slides-layout-dialog__mock-frames--row">
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--circle" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--square" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--triangle" />
                  </div>
                </div>
              </div>
            </div>
            <div className="slides-layout-dialog__option-label">
              <span className="slides-layout-dialog__option-name">横向</span>
              {selectedLayout === "row" && (
                <span className="slides-layout-dialog__option-check">✓</span>
              )}
            </div>
          </button>

          {/* 纵向排列 */}
          <button
            className={clsx("slides-layout-dialog__option", {
              "slides-layout-dialog__option--selected": selectedLayout === "column",
            })}
            onClick={() => setSelectedLayout("column")}
          >
            <div className="slides-layout-dialog__option-preview">
              <div className="slides-layout-dialog__mock-window">
                <div className="slides-layout-dialog__window-dots">
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--red" />
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--yellow" />
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--green" />
                </div>
                <div className="slides-layout-dialog__mock-frames slides-layout-dialog__mock-frames--column">
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--circle" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--square" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--triangle" />
                  </div>
                </div>
              </div>
            </div>
            <div className="slides-layout-dialog__option-label">
              <span className="slides-layout-dialog__option-name">纵向</span>
              {selectedLayout === "column" && (
                <span className="slides-layout-dialog__option-check">✓</span>
              )}
            </div>
          </button>

          {/* 网格排列 */}
          <button
            className={clsx("slides-layout-dialog__option", {
              "slides-layout-dialog__option--selected": selectedLayout === "grid",
            })}
            onClick={() => setSelectedLayout("grid")}
          >
            <div className="slides-layout-dialog__option-preview">
              <div className="slides-layout-dialog__mock-window">
                <div className="slides-layout-dialog__window-dots">
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--red" />
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--yellow" />
                  <span className="slides-layout-dialog__dot slides-layout-dialog__dot--green" />
                </div>
                <div className="slides-layout-dialog__mock-frames slides-layout-dialog__mock-frames--grid">
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--circle" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--square" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--triangle" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--star" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--diamond" />
                  </div>
                  <div className="slides-layout-dialog__mock-frame">
                    <span className="slides-layout-dialog__mock-shape slides-layout-dialog__mock-shape--hexagon" />
                  </div>
                </div>
              </div>
            </div>
            <div className="slides-layout-dialog__option-label">
              <span className="slides-layout-dialog__option-name">网格</span>
              {selectedLayout === "grid" && (
                <span className="slides-layout-dialog__option-check">✓</span>
              )}
            </div>
          </button>
        </div>

        {/* 网格列数选择 */}
        <div className="slides-layout-dialog__column-count">
          <label className="slides-layout-dialog__column-label">
            列数
            <span className="slides-layout-dialog__column-description">
              仅网格布局有效
            </span>
          </label>
          <select
            className="slides-layout-dialog__column-select"
            value={columnCount}
            onChange={(e) => setColumnCount(Number(e.target.value))}
            disabled={selectedLayout !== "grid"}
          >
            {[2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        {/* 操作按钮 */}
        <div className="slides-layout-dialog__actions">
          <button
            className="slides-layout-dialog__button slides-layout-dialog__button--secondary"
            onClick={onClose}
          >
            关闭
          </button>
          <button
            className="slides-layout-dialog__button slides-layout-dialog__button--primary"
            onClick={handleApply}
          >
            应用
          </button>
        </div>
      </div>
    </Dialog>
  );
};

// 辅助函数：将布局应用到 Frame
export const applyLayoutToFrames = (
  excalidrawAPI: ExcalidrawImperativeAPI,
  frames: ExcalidrawFrameLikeElement[],
  layout: LayoutType,
  columnCount: number,
  gap: number = 50,
): void => {
  if (!excalidrawAPI || frames.length === 0) {
    return;
  }

  const elements = excalidrawAPI.getSceneElements();

  // 找最大 Frame 尺寸作为参考
  let maxWidth = 0;
  let maxHeight = 0;
  for (const frame of frames) {
    maxWidth = Math.max(maxWidth, frame.width);
    maxHeight = Math.max(maxHeight, frame.height);
  }

  // 计算起始位置
  const appState = excalidrawAPI.getAppState();
  const startX = appState.scrollX * -1 + 100;
  const startY = appState.scrollY * -1 + 100;

  const framePositions: Map<string, { x: number; y: number }> = new Map();

  frames.forEach((frame, index) => {
    let x: number;
    let y: number;

    switch (layout) {
      case "row":
        x = startX + index * (maxWidth + gap);
        y = startY;
        break;
      case "column":
        x = startX;
        y = startY + index * (maxHeight + gap);
        break;
      case "grid": {
        const col = index % columnCount;
        const row = Math.floor(index / columnCount);
        x = startX + col * (maxWidth + gap);
        y = startY + row * (maxHeight + gap);
        break;
      }
      default:
        x = frame.x;
        y = frame.y;
    }

    framePositions.set(frame.id, { x, y });
  });

  // 更新元素位置
  const updatedElements = elements.map((el) => {
    const newPos = framePositions.get(el.id);
    if (newPos) {
      const frame = frames.find((f) => f.id === el.id);
      if (frame) {
        const _deltaX = newPos.x - frame.x;
        const _deltaY = newPos.y - frame.y;
        void _deltaX;
        void _deltaY;
        return {
          ...el,
          x: newPos.x,
          y: newPos.y,
        };
      }
    }

    // 移动 Frame 内的子元素
    if (el.frameId) {
      const frame = frames.find((f) => f.id === el.frameId);
      if (frame) {
        const newPos = framePositions.get(frame.id);
        if (newPos) {
          const deltaX = newPos.x - frame.x;
          const deltaY = newPos.y - frame.y;
          return {
            ...el,
            x: el.x + deltaX,
            y: el.y + deltaY,
          };
        }
      }
    }

    return el;
  });

  excalidrawAPI.updateScene({
    elements: updatedElements,
  });

  // 滚动到排列后的 Frame
  setTimeout(() => {
    excalidrawAPI.setViewport({
      target: frames,
      fit: "scale-down",
      animation: { duration: 500 },
    });
  }, 100);
};