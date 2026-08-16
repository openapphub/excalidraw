/**
 * animateSvg - SVG 元素逐个绘制动画
 *
 * 复刻自 SimpleExcalidraw，改为用 requestAnimationFrame 手动更新 inline style
 * （而非 Web Animations API），使序列化 SVG DOM 时能捕获当前动画状态。
 *
 * 两种模式：
 * - auto: 自动按顺序播放所有元素的描边/淡入动画
 * - manual: 逐个触发描边动画（stepForward/stepBackward）
 */

export interface AnimateOptions {
  duration: number;
  loop: boolean;
}

export interface AnimateController {
  cancel: () => void;
  pause: () => void;
  play: () => void;
  seek: (time: number) => void;
  stepForward: (stepDuration?: number) => void;
  stepBackward: () => void;
  getTotalSteps: () => number;
  getCurrentStep: () => number;
  goToStep: (step: number) => void;
  destroy: () => void;
}

const emptyAnimationController: AnimateController = {
  cancel: () => undefined,
  pause: () => undefined,
  play: () => undefined,
  seek: () => undefined,
  stepForward: () => undefined,
  stepBackward: () => undefined,
  getTotalSteps: () => 0,
  getCurrentStep: () => 0,
  goToStep: () => undefined,
  destroy: () => undefined,
};

interface PathAnimState {
  path: SVGPathElement;
  length: number;
  hasFill: boolean;
  // 当前 strokeDashoffset 值（动画过程中更新）
  currentOffset: number;
  // 当前 fillOpacity 值
  currentFillOpacity: number;
}

interface ElementState {
  el: SVGElement;
  paths: PathAnimState[];
  hasPaths: boolean;
  // 该元素的动画时长分配
  duration: number;
  // 元素是否已完全显示
  visible: boolean;
  // 元素当前 opacity
  currentOpacity: number;
}

// 缓动函数
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIn = (t: number) => t * t;

export const animateSvg = (
  svg: SVGSVGElement,
  opts: AnimateOptions,
): AnimateController => {
  const children = Array.from(svg.children).filter((el) => {
    const tag = el.tagName.toLowerCase();
    return tag !== "defs" && tag !== "style" && tag !== "metadata";
  }) as SVGElement[];
  if (children.length === 0) {
    return emptyAnimationController;
  }

  // 初始化：隐藏所有元素
  children.forEach((el) => {
    el.style.opacity = "0";
  });

  // 计算度量
  let totalMetric = 0;
  const elementMetrics: number[] = [];

  children.forEach((el) => {
    let metric = 0;
    const paths = el.querySelectorAll("path");
    if (paths.length > 0) {
      paths.forEach((p) => {
        try {
          metric += (p as SVGPathElement).getTotalLength();
        } catch (e) {
          // ignore
        }
      });
    } else {
      metric = 100;
    }
    metric = Math.max(metric, 50);
    elementMetrics.push(metric);
    totalMetric += metric;
  });

  // 构建元素状态
  const elementStates: ElementState[] = [];
  let currentDelay = 0;
  const elementDelays: number[] = [];

  children.forEach((el, index) => {
    const metric = elementMetrics[index];
    let elDuration = (metric / totalMetric) * opts.duration;
    elDuration = Math.max(elDuration, 100);

    elementDelays.push(currentDelay);

    const pathElements = Array.from(el.querySelectorAll("path"));
    const pathStates: PathAnimState[] = [];

    pathElements.forEach((path) => {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch (e) {
        // ignore
      }

      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;

      const fill = path.getAttribute("fill") || path.style.fill;
      const hasFill = !!fill && fill !== "none" && fill !== "transparent";
      if (hasFill) {
        path.style.fillOpacity = "0";
      }

      pathStates.push({
        path,
        length,
        hasFill,
        currentOffset: length,
        currentFillOpacity: 0,
      });
    });

    elementStates.push({
      el,
      paths: pathStates,
      hasPaths: pathElements.length > 0,
      duration: elDuration,
      visible: false,
      currentOpacity: 0,
    });

    currentDelay += elDuration;
    currentDelay -= elDuration * 0.1; // 轻微重叠
  });

  // ===== 自动播放引擎 =====
  let autoRafId: number | null = null;
  let autoStartTime = 0;
  let autoPausedAt: number | null = null;
  let isAutoRunning = false;

  // 更新单个元素在某时间点的状态
  const updateElementAtTime = (
    state: ElementState,
    delay: number,
    globalTime: number,
  ) => {
    const localTime = globalTime - delay;
    if (localTime < 0) {
      // 尚未开始
      state.el.style.opacity = "0";
      state.currentOpacity = 0;
      state.paths.forEach((ps) => {
        ps.path.style.strokeDashoffset = `${ps.length}`;
        ps.currentOffset = ps.length;
        if (ps.hasFill) {
          ps.path.style.fillOpacity = "0";
          ps.currentFillOpacity = 0;
        }
      });
      return;
    }

    if (state.hasPaths) {
      // 容器立即显示
      state.el.style.opacity = "1";
      state.currentOpacity = 1;

      const progress = Math.min(1, localTime / state.duration);
      const eased = easeOut(progress);

      state.paths.forEach((ps) => {
        const offset = ps.length * (1 - eased);
        ps.path.style.strokeDashoffset = `${offset}`;
        ps.currentOffset = offset;

        if (ps.hasFill) {
          // 描边 80% 后开始填充
          const fillProgress = Math.max(0, Math.min(1, (progress - 0.8) / 0.2));
          ps.path.style.fillOpacity = `${fillProgress}`;
          ps.currentFillOpacity = fillProgress;
        }
      });

      if (progress >= 1) {
        state.visible = true;
      }
    } else {
      // 非路径元素淡入
      const progress = Math.min(1, localTime / state.duration);
      const eased = easeIn(progress);
      state.el.style.opacity = `${eased}`;
      state.currentOpacity = eased;
      if (progress >= 1) {
        state.visible = true;
      }
    }
  };

  const autoTick = (timestamp: number) => {
    if (!isAutoRunning) return;

    if (autoStartTime === 0) {
      autoStartTime = timestamp;
    }
    if (autoPausedAt !== null) {
      autoStartTime += timestamp - autoPausedAt;
      autoPausedAt = null;
    }

    const elapsed = timestamp - autoStartTime;

    // 更新所有元素
    elementStates.forEach((state, i) => {
      updateElementAtTime(state, elementDelays[i], elapsed);
    });

    // 检查是否全部完成
    const totalDuration =
      elementDelays[elementDelays.length - 1] +
      elementStates[elementStates.length - 1].duration;
    if (elapsed >= totalDuration) {
      if (opts.loop) {
        // 重置
        autoStartTime = timestamp;
      } else {
        isAutoRunning = false;
        return;
      }
    }

    autoRafId = requestAnimationFrame(autoTick);
  };

  const startAuto = () => {
    if (autoRafId) cancelAnimationFrame(autoRafId);
    autoStartTime = 0;
    autoPausedAt = null;
    isAutoRunning = true;
    autoRafId = requestAnimationFrame(autoTick);
  };

  // ===== 手动步进 =====
  let currentStep = 0;
  let manualRafId: number | null = null;

  // 手动播放单个元素的描边动画
  const playElementAnimManual = (state: ElementState, stepDuration: number) => {
    return new Promise<void>((resolve) => {
      if (state.hasPaths) {
        state.el.style.opacity = "1";
        state.currentOpacity = 1;

        // 初始化：隐藏所有 path
        state.paths.forEach((ps) => {
          ps.path.style.strokeDasharray = `${ps.length}`;
          ps.path.style.strokeDashoffset = `${ps.length}`;
          ps.currentOffset = ps.length;
          if (ps.hasFill) {
            ps.path.style.fillOpacity = "0";
            ps.currentFillOpacity = 0;
          }
        });

        const startTime = performance.now();

        const tick = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / stepDuration);
          const eased = easeOut(progress);

          state.paths.forEach((ps) => {
            const offset = ps.length * (1 - eased);
            ps.path.style.strokeDashoffset = `${offset}`;
            ps.currentOffset = offset;

            if (ps.hasFill) {
              const fillProgress = Math.max(
                0,
                Math.min(1, (progress - 0.8) / 0.2),
              );
              ps.path.style.fillOpacity = `${fillProgress}`;
              ps.currentFillOpacity = fillProgress;
            }
          });

          if (progress < 1) {
            manualRafId = requestAnimationFrame(tick);
          } else {
            state.visible = true;
            // 确保 final state
            state.paths.forEach((ps) => {
              ps.path.style.strokeDashoffset = "0";
              ps.currentOffset = 0;
              if (ps.hasFill) {
                ps.path.style.fillOpacity = "1";
                ps.currentFillOpacity = 1;
              }
            });
            resolve();
          }
        };

        manualRafId = requestAnimationFrame(tick);
      } else {
        // 非路径元素淡入
        state.el.style.opacity = "0";
        state.currentOpacity = 0;

        const startTime = performance.now();

        const tick = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(1, elapsed / stepDuration);
          const eased = easeIn(progress);

          state.el.style.opacity = `${eased}`;
          state.currentOpacity = eased;

          if (progress < 1) {
            manualRafId = requestAnimationFrame(tick);
          } else {
            state.el.style.opacity = "1";
            state.currentOpacity = 1;
            state.visible = true;
            resolve();
          }
        };

        manualRafId = requestAnimationFrame(tick);
      }
    });
  };

  const hideElement = (state: ElementState) => {
    state.el.style.opacity = "0";
    state.currentOpacity = 0;
    state.paths.forEach((ps) => {
      ps.path.style.strokeDashoffset = `${ps.length}`;
      ps.currentOffset = ps.length;
      if (ps.hasFill) {
        ps.path.style.fillOpacity = "0";
        ps.currentFillOpacity = 0;
      }
    });
    state.visible = false;
  };

  const showElementInstant = (state: ElementState) => {
    state.el.style.opacity = "1";
    state.currentOpacity = 1;
    state.paths.forEach((ps) => {
      ps.path.style.strokeDashoffset = "0";
      ps.currentOffset = 0;
      if (ps.hasFill) {
        ps.path.style.fillOpacity = "1";
        ps.currentFillOpacity = 1;
      }
    });
    state.visible = true;
  };

  // ===== Controller =====
  const controller: AnimateController = {
    cancel: () => {
      if (autoRafId) {
        cancelAnimationFrame(autoRafId);
        autoRafId = null;
      }
      if (manualRafId) {
        cancelAnimationFrame(manualRafId);
        manualRafId = null;
      }
      isAutoRunning = false;
      children.forEach((el) => {
        el.style.opacity = "";
        const paths = el.querySelectorAll("path");
        paths.forEach((p) => {
          (p as SVGPathElement).style.strokeDasharray = "";
          (p as SVGPathElement).style.strokeDashoffset = "";
          (p as SVGPathElement).style.fillOpacity = "";
        });
      });
    },

    pause: () => {
      if (isAutoRunning) {
        isAutoRunning = false;
        autoPausedAt = performance.now();
      }
      if (manualRafId) {
        cancelAnimationFrame(manualRafId);
        manualRafId = null;
      }
    },

    play: () => {
      if (autoPausedAt !== null) {
        isAutoRunning = true;
        autoRafId = requestAnimationFrame(autoTick);
      } else {
        startAuto();
      }
    },

    seek: (time: number) => {
      // 更新所有元素到指定时间
      elementStates.forEach((state, i) => {
        updateElementAtTime(state, elementDelays[i], time);
      });
    },

    stepForward: (stepDuration?: number) => {
      if (currentStep >= children.length) return;

      // 暂停自动播放
      if (isAutoRunning) {
        isAutoRunning = false;
        if (autoRafId) cancelAnimationFrame(autoRafId);
      }

      const state = elementStates[currentStep];
      if (state) {
        const dur = stepDuration ?? state.duration;
        playElementAnimManual(state, dur);
        currentStep++;
      }
    },

    stepBackward: () => {
      if (currentStep <= 0) return;

      if (isAutoRunning) {
        isAutoRunning = false;
        if (autoRafId) cancelAnimationFrame(autoRafId);
      }
      if (manualRafId) {
        cancelAnimationFrame(manualRafId);
        manualRafId = null;
      }

      currentStep--;
      const state = elementStates[currentStep];
      if (state) {
        hideElement(state);
      }
    },

    getTotalSteps: () => children.length,

    getCurrentStep: () => currentStep,

    goToStep: (step: number) => {
      const target = Math.max(0, Math.min(step, children.length));
      if (isAutoRunning) {
        isAutoRunning = false;
        if (autoRafId) cancelAnimationFrame(autoRafId);
      }
      elementStates.forEach((state, i) => {
        if (i < target) {
          showElementInstant(state);
        } else {
          hideElement(state);
        }
      });
      currentStep = target;
    },

    destroy: () => {
      if (autoRafId) cancelAnimationFrame(autoRafId);
      if (manualRafId) cancelAnimationFrame(manualRafId);
      isAutoRunning = false;
    },
  };

  // 默认启动自动播放
  startAuto();

  return controller;
};
