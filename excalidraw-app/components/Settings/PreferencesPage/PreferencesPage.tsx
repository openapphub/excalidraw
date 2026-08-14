import React, { useState } from "react";
import { t } from "@excalidraw/excalidraw/i18n";
import { THEME } from "@excalidraw/excalidraw";
import { FONT_FAMILY } from "@excalidraw/common";

import type { Theme } from "@excalidraw/element/types";

import {
  loadDrawingDefaults,
  saveDrawingDefaults,
  type DrawingDefaults,
  type StrokeStylePref,
  type StrokeWidthKeyPref,
  type RoughnessPref,
  type FontFamilyPref,
} from "../../../drawingDefaults";

import styles from "./PreferencesPage.module.scss";

const stopPropagation = (e: React.KeyboardEvent) => {
  e.stopPropagation();
};

const sunIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.24" />
  </svg>
);

const moonIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const monitorIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

export interface PreferencesPageProps {
  theme: Theme | "system";
  setTheme: (theme: Theme | "system") => void;
  onDrawingDefaultsChange?: (defaults: DrawingDefaults) => void;
}

export const PreferencesPage: React.FC<PreferencesPageProps> = ({
  theme,
  setTheme,
  onDrawingDefaultsChange,
}) => {
  const [drawing, setDrawing] = useState<DrawingDefaults>(() =>
    loadDrawingDefaults(),
  );

  const updateDrawing = (patch: Partial<DrawingDefaults>) => {
    const next = { ...drawing, ...patch };
    setDrawing(next);
    saveDrawingDefaults(next);
    onDrawingDefaultsChange?.(next);
  };

  return (
    <div className={styles.page}>
      <div>
        <h1 className={styles.title}>{t("settings.myPreferences")}</h1>

        <div className={styles.separator} />

        <section className={styles.row}>
          <div className={styles.rowLabel}>
            <h2>{t("labels.theme")}</h2>
            <p className={styles.shortcutHint}>⌥ + ⇧ + D</p>
          </div>
          <div className={styles.rowContent}>
            <div className={styles.themeSelector}>
              <select
                className={styles.themeDropdown}
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme | "system")}
                onKeyDown={stopPropagation}
                onKeyUp={stopPropagation}
              >
                <option value={THEME.DARK}>{t("buttons.darkMode")}</option>
                <option value={THEME.LIGHT}>{t("buttons.lightMode")}</option>
                <option value="system">{t("buttons.systemMode")}</option>
              </select>
              <span className={styles.themeIcon}>
                {theme === THEME.DARK
                  ? moonIcon
                  : theme === THEME.LIGHT
                  ? sunIcon
                  : monitorIcon}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.row}>
          <div className={styles.rowLabel}>
            <h2>{t("settings.drawingDefaults")}</h2>
            <p>{t("settings.drawingDefaultsDescription")}</p>
          </div>
          <div className={styles.rowContent}>
            <div className={styles.drawingGrid}>
              <label className={styles.drawingField}>
                <span>{t("labels.strokeStyle")}</span>
                <select
                  className={styles.themeDropdown}
                  value={drawing.strokeStyle}
                  onChange={(e) =>
                    updateDrawing({
                      strokeStyle: e.target.value as StrokeStylePref,
                    })
                  }
                  onKeyDown={stopPropagation}
                  onKeyUp={stopPropagation}
                >
                  <option value="solid">{t("labels.strokeStyle_solid")}</option>
                  <option value="dashed">
                    {t("labels.strokeStyle_dashed")}
                  </option>
                  <option value="dotted">
                    {t("labels.strokeStyle_dotted")}
                  </option>
                </select>
              </label>

              <label className={styles.drawingField}>
                <span>{t("labels.strokeWidth")}</span>
                <select
                  className={styles.themeDropdown}
                  value={drawing.strokeWidthKey}
                  onChange={(e) =>
                    updateDrawing({
                      strokeWidthKey: e.target.value as StrokeWidthKeyPref,
                    })
                  }
                  onKeyDown={stopPropagation}
                  onKeyUp={stopPropagation}
                >
                  <option value="thin">{t("labels.thin")}</option>
                  <option value="medium">{t("labels.medium")}</option>
                  <option value="bold">{t("labels.bold")}</option>
                </select>
              </label>

              <label className={styles.drawingField}>
                <span>{t("labels.sloppiness")}</span>
                <select
                  className={styles.themeDropdown}
                  value={drawing.roughness}
                  onChange={(e) =>
                    updateDrawing({
                      roughness: Number(e.target.value) as RoughnessPref,
                    })
                  }
                  onKeyDown={stopPropagation}
                  onKeyUp={stopPropagation}
                >
                  <option value={0}>{t("labels.architect")}</option>
                  <option value={1}>{t("labels.artist")}</option>
                  <option value={2}>{t("labels.cartoonist")}</option>
                </select>
              </label>

              <label className={styles.drawingField}>
                <span>{t("labels.fontFamily")}</span>
                <select
                  className={styles.themeDropdown}
                  value={drawing.fontFamily}
                  onChange={(e) =>
                    updateDrawing({
                      fontFamily: Number(e.target.value) as FontFamilyPref,
                    })
                  }
                  onKeyDown={stopPropagation}
                  onKeyUp={stopPropagation}
                >
                  <option value={FONT_FAMILY.Excalifont}>
                    {t("labels.handDrawn")}
                  </option>
                  <option value={FONT_FAMILY.Nunito}>{t("labels.normal")}</option>
                  <option value={FONT_FAMILY["Comic Shanns"]}>
                    {t("labels.code")}
                  </option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PreferencesPage;
