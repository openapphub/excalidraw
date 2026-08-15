import { useCallback, useEffect, useRef } from "react";

import { useUIAppState } from "@excalidraw/excalidraw/context/ui-appState";

import type { ExcalidrawFrameLikeElement } from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { atom, useAtom, useSetAtom } from "../../app-jotai";
import { closeWorkspaceSidebarAtom } from "../Settings/settingsState";

// 演示模式状态 atom（官方 master AppState 无 presentationMode 字段，
// 用 jotai 管理演示模式的活跃/当前页/幻灯片列表）
export const presentationModeAtom = atom(false);
export const currentSlideAtom = atom(0);

// 幻灯片元素列表（PresentationPanel 排序用）
export const slidesAtom = atom<ExcalidrawFrameLikeElement[]>([]);

// 自定义幻灯片顺序（frame ID 列表）
export const slideOrderAtom = atom<string[]>([]);

export interface UsePresentationModeOptions {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

// 幻灯片切换动画时长（ms）
const SLIDE_TRANSITION_DURATION = 800;

// 视口填充比例
const PRESENTATION_VIEWPORT_ZOOM_FACTOR = 1.0;

export const usePresentationMode = ({
  excalidrawAPI,
}: UsePresentationModeOptions) => {
  const appState = useUIAppState();

  // jotai 状态
  const [isPresentationMode, setIsPresentationMode] = useAtom(presentationModeAtom);
  const [currentSlide, setCurrentSlide] = useAtom(currentSlideAtom);
  const [slides, setSlides] = useAtom(slidesAtom);

  const closeWorkspaceSidebar = useSetAtom(closeWorkspaceSidebarAtom);

  // 全屏状态
  const isFullscreenRef = useRef(false);

  // 保存进入演示前的原始状态，用于退出时恢复
  const originalStateRef = useRef<{
    theme: string;
    frameRendering: { enabled: boolean; name: boolean; outline: boolean; clip: boolean };
  } | null>(null);

  // 获取所有 frame 元素（按名称排序）
  const getFrames = useCallback((): ExcalidrawFrameLikeElement[] => {
    if (!excalidrawAPI) {
      return [];
    }

    const elements = excalidrawAPI.getSceneElements();
    const frames: ExcalidrawFrameLikeElement[] = [];

    for (const el of elements) {
      if ((el.type === "frame" || el.type === "magicframe") && !el.isDeleted) {
        frames.push(el as ExcalidrawFrameLikeElement);
      }
    }

    return frames.sort((a, b) => {
      const nameA = a.name || `Frame ${a.id}`;
      const nameB = b.name || `Frame ${b.id}`;
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
  }, [excalidrawAPI]);

  // 导航到指定幻灯片（用 setViewport 替代 scrollToContent）
  const goToSlide = useCallback(
    (slideIndex: number) => {
      if (!excalidrawAPI || !isPresentationMode) {
        return;
      }

      const currentSlides = slides;
      if (currentSlides.length === 0) {
        return;
      }

      const targetIndex = Math.max(
        0,
        Math.min(slideIndex, currentSlides.length - 1),
      );
      const frame = currentSlides[targetIndex];

      if (frame) {
        // 使用官方 setViewport API 导航到 frame
        excalidrawAPI.setViewport({
          target: frame,
          fit: "contain",
          animation: { duration: SLIDE_TRANSITION_DURATION },
        });
      }

      setCurrentSlide(targetIndex);
    },
    [excalidrawAPI, isPresentationMode, slides, setCurrentSlide],
  );

  // 下一页
  const nextSlide = useCallback(() => {
    if (!isPresentationMode) {
      return;
    }
    if (currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    }
  }, [isPresentationMode, currentSlide, slides.length, goToSlide]);

  // 上一页
  const prevSlide = useCallback(() => {
    if (!isPresentationMode) {
      return;
    }
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  }, [isPresentationMode, currentSlide, goToSlide]);

  // 切换主题
  const toggleTheme = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    const currentTheme = excalidrawAPI.getAppState().theme;
    const newTheme = currentTheme === "dark" ? "light" : "dark";

    excalidrawAPI.updateScene({
      appState: { theme: newTheme },
    });
  }, [excalidrawAPI]);

  // 切换全屏（浏览器 API）
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        isFullscreenRef.current = true;
      } else {
        await document.exitFullscreen();
        isFullscreenRef.current = false;
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  }, []);

  // 开始演示
  const startPresentation = useCallback(() => {
    if (!excalidrawAPI) {
      return;
    }

    // 使用已排序的幻灯片或从画布获取
    const frames = slides.length > 0 ? slides : getFrames();
    if (frames.length === 0) {
      excalidrawAPI.setToast({
        message: "没有找到 Frame。请先添加 Frame 来创建幻灯片。",
        duration: 3000,
        closable: true,
      });
      return;
    }

    // 关闭工作区侧边栏
    closeWorkspaceSidebar();

    // 关闭官方右侧 default sidebar
    excalidrawAPI.toggleSidebar({ name: "default", force: false });

    // 添加 body class（CSS 隐藏 UI 元素）
    document.body.classList.add("excalidraw-presentation-mode");

    // 保存当前状态
    const currentAppState = excalidrawAPI.getAppState();
    originalStateRef.current = {
      theme: currentAppState.theme,
      frameRendering: { ...currentAppState.frameRendering },
    };

    // 进入演示模式
    setIsPresentationMode(true);
    setCurrentSlide(0);
    setSlides(frames);

    // 设置 view mode + zen mode + 隐藏 frame 边框/名称
    excalidrawAPI.updateScene({
      appState: {
        viewModeEnabled: true,
        zenModeEnabled: true,
        frameRendering: {
          ...currentAppState.frameRendering,
          outline: false,
          name: false,
        },
      },
    });

    // 导航到第一页
    setTimeout(() => {
      if (frames[0]) {
        excalidrawAPI.setViewport({
          target: frames[0],
          fit: "contain",
          animation: { duration: SLIDE_TRANSITION_DURATION },
        });
      }
    }, 50);
  }, [excalidrawAPI, slides, getFrames, closeWorkspaceSidebar, setIsPresentationMode, setCurrentSlide, setSlides]);

  // 结束演示
  const endPresentation = useCallback(async () => {
    if (!excalidrawAPI || !isPresentationMode) {
      return;
    }

    // 退出全屏
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Exit fullscreen error:", err);
      }
    }

    // 移除 body class
    document.body.classList.remove("excalidraw-presentation-mode");

    // 恢复状态
    const restoredAppState: Record<string, unknown> = {
      viewModeEnabled: false,
      zenModeEnabled: false,
    };

    if (originalStateRef.current) {
      restoredAppState.theme = originalStateRef.current.theme;
      restoredAppState.frameRendering = originalStateRef.current.frameRendering;
    }

    excalidrawAPI.updateScene({
      appState: restoredAppState as Parameters<typeof excalidrawAPI.updateScene>[0]["appState"],
    });

    // 重置状态
    setIsPresentationMode(false);
    setCurrentSlide(0);
    setSlides([]);
    originalStateRef.current = null;

    // 恢复选择工具
    excalidrawAPI.setActiveTool({ type: "selection" });
  }, [excalidrawAPI, isPresentationMode, setIsPresentationMode, setCurrentSlide, setSlides]);

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      isFullscreenRef.current = !!document.fullscreenElement;
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // 同步 CSS class
  useEffect(() => {
    if (isPresentationMode) {
      document.body.classList.add("excalidraw-presentation-mode");
    } else {
      document.body.classList.remove("excalidraw-presentation-mode");
    }
  }, [isPresentationMode]);

  // 键盘快捷键：F 切换全屏
  useEffect(() => {
    if (!isPresentationMode) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "f" || e.key === "F") {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPresentationMode, toggleFullscreen]);

  return {
    isPresentationMode,
    currentSlide,
    slides,
    setSlides,
    totalSlides: slides.length,
    startPresentation,
    endPresentation,
    nextSlide,
    prevSlide,
    goToSlide,
    toggleTheme,
    toggleFullscreen,
    getFrames,
  };
};