import clsx from "clsx";
import { useCallback, useEffect, useState, useRef } from "react";

import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";
import { t } from "@excalidraw/excalidraw/i18n";

import "./PresentationControls.scss";

interface PresentationControlsProps {
  currentSlide: number;
  totalSlides: number;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onToggleTheme: () => void;
  onToggleFullscreen: () => void;
  onEndPresentation: () => void;
}

const FADE_DELAY = 3000;

const SunIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);

const MoonIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const FullscreenIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />
  </svg>
);

export const PresentationControls: React.FC<PresentationControlsProps> = ({
  currentSlide,
  totalSlides,
  onPrevSlide,
  onNextSlide,
  onToggleTheme,
  onToggleFullscreen,
  onEndPresentation,
}) => {
  const { theme } = useUIAppState();
  const [isVisible, setIsVisible] = useState(true);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetFadeTimer = useCallback(() => {
    setIsVisible(true);

    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }

    fadeTimeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, FADE_DELAY);
  }, []);

  // 鼠标移动时重置淡出计时
  useEffect(() => {
    const handleMouseMove = () => resetFadeTimer();
    const handleMouseDown = () => resetFadeTimer();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);

    resetFadeTimer();

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);

      if (fadeTimeoutRef.current) {
        clearTimeout(fadeTimeoutRef.current);
      }
    };
  }, [resetFadeTimer]);

  const handleControlsMouseEnter = () => {
    setIsVisible(true);
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
    }
  };

  const handleControlsMouseLeave = () => {
    resetFadeTimer();
  };

  return (
    <div
      className={clsx("presentation-controls", {
        "presentation-controls--hidden": !isVisible,
      })}
      onMouseEnter={handleControlsMouseEnter}
      onMouseLeave={handleControlsMouseLeave}
    >
      <div className="presentation-controls__bar">
        {/* 导航 */}
        <button
          className="presentation-controls__button"
          onClick={onPrevSlide}
          disabled={currentSlide === 0}
          title="上一页 (←)"
          aria-label="上一页"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <span className="presentation-controls__counter">
          {currentSlide + 1}/{totalSlides}
        </span>

        <button
          className="presentation-controls__button"
          onClick={onNextSlide}
          disabled={currentSlide === totalSlides - 1}
          title="下一页 (→)"
          aria-label="下一页"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        <div className="presentation-controls__divider" />

        {/* 主题切换 */}
        <button
          className="presentation-controls__button"
          onClick={onToggleTheme}
          title="切换主题"
          aria-label="切换主题"
        >
          {theme === "dark" ? SunIcon : MoonIcon}
        </button>

        {/* 全屏 */}
        <button
          className="presentation-controls__button"
          onClick={onToggleFullscreen}
          title="全屏 (F)"
          aria-label="全屏"
        >
          {FullscreenIcon}
        </button>

        <div className="presentation-controls__divider" />

        {/* 结束演示 */}
        <button
          className="presentation-controls__button presentation-controls__button--end"
          onClick={onEndPresentation}
          title="结束演示 (Esc)"
        >
          结束
        </button>
      </div>
    </div>
  );
};