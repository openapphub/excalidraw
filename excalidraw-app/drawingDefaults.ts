/**
 * 个人默认笔触：边框样式 / 线宽 / 线条风格 / 字体。
 * 只影响之后新画的图形，不改已有元素。
 */
import { FONT_FAMILY, ROUGHNESS } from "@excalidraw/common";

export const DRAWING_DEFAULTS_KEY = "excalidraw_drawing_defaults";

export type StrokeStylePref = "solid" | "dashed" | "dotted";
export type StrokeWidthKeyPref = "thin" | "medium" | "bold";
export type RoughnessPref = 0 | 1 | 2;
export type FontFamilyPref = number;

export type DrawingDefaults = {
  strokeStyle: StrokeStylePref;
  strokeWidthKey: StrokeWidthKeyPref;
  roughness: RoughnessPref;
  fontFamily: FontFamilyPref;
};

export const DEFAULT_DRAWING_DEFAULTS: DrawingDefaults = {
  strokeStyle: "solid",
  strokeWidthKey: "medium",
  roughness: ROUGHNESS.artist,
  fontFamily: FONT_FAMILY.Excalifont,
};

export function loadDrawingDefaults(): DrawingDefaults {
  try {
    const raw = localStorage.getItem(DRAWING_DEFAULTS_KEY);
    if (!raw) {
      return { ...DEFAULT_DRAWING_DEFAULTS };
    }
    const parsed = JSON.parse(raw) as Partial<DrawingDefaults>;
    return {
      strokeStyle:
        parsed.strokeStyle === "dashed" || parsed.strokeStyle === "dotted"
          ? parsed.strokeStyle
          : "solid",
      strokeWidthKey:
        parsed.strokeWidthKey === "thin" || parsed.strokeWidthKey === "bold"
          ? parsed.strokeWidthKey
          : "medium",
      roughness:
        parsed.roughness === ROUGHNESS.architect ||
        parsed.roughness === ROUGHNESS.cartoonist
          ? parsed.roughness
          : ROUGHNESS.artist,
      fontFamily:
        typeof parsed.fontFamily === "number"
          ? parsed.fontFamily
          : FONT_FAMILY.Excalifont,
    };
  } catch {
    return { ...DEFAULT_DRAWING_DEFAULTS };
  }
}

export function saveDrawingDefaults(next: DrawingDefaults): void {
  localStorage.setItem(DRAWING_DEFAULTS_KEY, JSON.stringify(next));
}

export function drawingDefaultsToAppState(defaults: DrawingDefaults) {
  return {
    currentItemStrokeStyle: defaults.strokeStyle,
    currentItemStrokeWidthKey: defaults.strokeWidthKey,
    currentItemRoughness: defaults.roughness,
    currentItemFontFamily: defaults.fontFamily,
  };
}
