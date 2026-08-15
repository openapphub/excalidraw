import { useCallback, useEffect, useMemo, useState } from "react";

import { EVENT, KEYS, sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import {
  INTERACTIVE_CHART_TYPES,
  type InteractiveChartType,
} from "../charts/charts.constants";
import {
  getChartElements,
  getChartSpec,
  type ChartSpec,
} from "../charts/chartSpec";
import {
  getChartPaletteColors,
  isSpreadsheetValidForChartType,
  resolveSeriesColors,
} from "../charts/charts.helpers";
import type { Spreadsheet, SpreadsheetSeries } from "../charts/charts.types";
import { t } from "../i18n";

import { CloseIcon } from "./icons";

import "./ChartDataEditor.scss";

import type { AppClassProperties } from "../types";

const cloneSpreadsheet = (spreadsheet: Spreadsheet): Spreadsheet => ({
  title: spreadsheet.title,
  labels: spreadsheet.labels ? [...spreadsheet.labels] : null,
  series: spreadsheet.series.map((series) => ({
    title: series.title,
    values: [...series.values],
  })),
});

const rowCountOf = (spreadsheet: Spreadsheet) =>
  spreadsheet.labels?.length ?? spreadsheet.series[0]?.values.length ?? 0;

const chartTypeLabel = (type: InteractiveChartType) => {
  switch (type) {
    case "bar":
      return t("labels.chartType_bar");
    case "line":
      return t("labels.chartType_line");
    case "area":
      return t("labels.chartType_area");
    case "radar":
      return t("labels.chartType_radar");
  }
};

const ChartDataEditor = ({
  app,
  chartId,
}: {
  app: AppClassProperties;
  chartId: string;
}) => {
  const elements = getChartElements(app.scene.getNonDeletedElements(), chartId);
  const liveSpec = getChartSpec(elements[0]);

  const [draftType, setDraftType] = useState<InteractiveChartType>(
    liveSpec?.type ?? "bar",
  );
  const [draft, setDraft] = useState<Spreadsheet>(() =>
    cloneSpreadsheet(
      liveSpec?.spreadsheet ?? { title: null, labels: [], series: [] },
    ),
  );
  const [draftColors, setDraftColors] = useState<string[]>(() =>
    liveSpec
      ? [
          ...resolveSeriesColors(
            liveSpec.spreadsheet.series.length,
            liveSpec.colorSeed,
            liveSpec.seriesColors,
          ),
        ]
      : [],
  );
  const [colorSeed, setColorSeed] = useState(
    () => liveSpec?.colorSeed ?? Math.random(),
  );

  useEffect(() => {
    if (!liveSpec) {
      app.setAppState({ editingChart: null });
      return;
    }
    setDraftType(liveSpec.type);
    setDraft(cloneSpreadsheet(liveSpec.spreadsheet));
    setColorSeed(liveSpec.colorSeed ?? Math.random());
    setDraftColors([
      ...resolveSeriesColors(
        liveSpec.spreadsheet.series.length,
        liveSpec.colorSeed,
        liveSpec.seriesColors,
      ),
    ]);
    // 只在切换正在编辑的图表时重置草稿
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartId, liveSpec?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === KEYS.ESCAPE) {
        event.preventDefault();
        app.setAppState({ editingChart: null });
      }
    };
    window.addEventListener(EVENT.KEYDOWN, onKeyDown, { capture: true });
    return () =>
      window.removeEventListener(EVENT.KEYDOWN, onKeyDown, { capture: true });
  }, [app]);

  // 系列增减时补齐颜色
  useEffect(() => {
    setDraftColors((prev) => {
      const next = resolveSeriesColors(draft.series.length, colorSeed, prev);
      if (
        prev.length === next.length &&
        prev.every((color, index) => color === next[index])
      ) {
        return prev;
      }
      return [...next];
    });
  }, [draft.series.length, colorSeed]);

  const apply = useCallback(() => {
    if (!liveSpec) {
      return;
    }
    if (!isSpreadsheetValidForChartType(draft, draftType)) {
      return;
    }
    const nextSpec: ChartSpec = {
      ...liveSpec,
      type: draftType,
      spreadsheet: draft,
      colorSeed,
      seriesColors: draftColors.slice(0, draft.series.length),
    };
    app.replaceChartFromSpec(nextSpec);
  }, [app, liveSpec, draftType, draft, colorSeed, draftColors]);

  const rowCount = rowCountOf(draft);
  const canApply = isSpreadsheetValidForChartType(draft, draftType);
  const palette = useMemo(() => getChartPaletteColors(), []);

  const updateRowLabel = (rowIndex: number, label: string) => {
    setDraft((prev) => {
      const labels = prev.labels ? [...prev.labels] : Array(rowCount).fill("");
      labels[rowIndex] = label;
      return { ...prev, labels };
    });
  };

  const updateCell = (seriesIndex: number, rowIndex: number, raw: string) => {
    setDraft((prev) => {
      const series = prev.series.map((item, index) => {
        if (index !== seriesIndex) {
          return item;
        }
        const values = [...item.values];
        const parsed = Number(raw);
        values[rowIndex] = Number.isFinite(parsed) ? parsed : 0;
        return { ...item, values };
      });
      return { ...prev, series };
    });
  };

  const updateSeriesTitle = (seriesIndex: number, title: string) => {
    setDraft((prev) => ({
      ...prev,
      series: prev.series.map((item, index) =>
        index === seriesIndex ? { ...item, title } : item,
      ),
    }));
  };

  const updateSeriesColor = (seriesIndex: number, color: string) => {
    setDraftColors((prev) => {
      const next = [...prev];
      next[seriesIndex] = color;
      return next;
    });
  };

  const reshuffleColors = () => {
    const nextSeed = Math.random();
    setColorSeed(nextSeed);
    setDraftColors([
      ...resolveSeriesColors(draft.series.length, nextSeed, null),
    ]);
  };

  const addRow = () => {
    setDraft((prev) => {
      const labels = [...(prev.labels ?? Array(rowCountOf(prev)).fill(""))];
      labels.push(`Row ${labels.length + 1}`);
      return {
        ...prev,
        labels,
        series: prev.series.map((item) => ({
          ...item,
          values: [...item.values, 0],
        })),
      };
    });
  };

  const removeRow = (rowIndex: number) => {
    setDraft((prev) => {
      if (rowCountOf(prev) <= 2) {
        return prev;
      }
      const labels = prev.labels
        ? prev.labels.filter((_, i) => i !== rowIndex)
        : null;
      return {
        ...prev,
        labels,
        series: prev.series.map((item) => ({
          ...item,
          values: item.values.filter((_, i) => i !== rowIndex),
        })),
      };
    });
  };

  const addSeries = () => {
    setDraft((prev) => {
      const count = rowCountOf(prev);
      const next: SpreadsheetSeries = {
        title: `Series ${prev.series.length + 1}`,
        values: Array.from({ length: count }, () => 0),
      };
      return { ...prev, series: [...prev.series, next] };
    });
  };

  const removeSeries = (seriesIndex: number) => {
    setDraft((prev) => {
      if (prev.series.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        series: prev.series.filter((_, i) => i !== seriesIndex),
      };
    });
    setDraftColors((prev) => prev.filter((_, i) => i !== seriesIndex));
  };

  const position = useMemo(() => {
    if (elements.length === 0) {
      return null;
    }
    const [, minY, maxX] = getCommonBounds(elements);
    const { x, y } = sceneCoordsToViewportCoords(
      { sceneX: maxX, sceneY: minY },
      app.state,
    );
    return {
      top: Math.max(12, y - app.state.offsetTop),
      left: Math.max(12, x - app.state.offsetLeft + 16),
    };
  }, [elements, app.state]);

  if (!liveSpec || !position) {
    return null;
  }

  return (
    <div
      className="ChartDataEditor"
      data-testid="chart-data-editor"
      style={{
        top: position.top,
        left: position.left,
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
    >
      <div className="ChartDataEditor__header">
        <div className="ChartDataEditor__title">{t("labels.chartData")}</div>
        <button
          type="button"
          className="ChartDataEditor__close"
          aria-label={t("buttons.close")}
          onClick={() => app.setAppState({ editingChart: null })}
        >
          {CloseIcon}
        </button>
      </div>

      <div className="ChartDataEditor__type">
        {INTERACTIVE_CHART_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className={draftType === type ? "is-active" : undefined}
            onClick={() => setDraftType(type)}
          >
            {chartTypeLabel(type)}
          </button>
        ))}
      </div>

      <div className="ChartDataEditor__section">{t("labels.chartColors")}</div>
      <div className="ChartDataEditor__colors">
        {draft.series.map((series, seriesIndex) => (
          <div key={seriesIndex} className="ChartDataEditor__colorRow">
            <label className="ChartDataEditor__colorSwatch">
              <input
                type="color"
                value={draftColors[seriesIndex] ?? "#1971c2"}
                aria-label={t("labels.chartSeriesColor")}
                onChange={(event) =>
                  updateSeriesColor(seriesIndex, event.target.value)
                }
              />
            </label>
            <span className="ChartDataEditor__colorName">
              {series.title?.trim() || `Series ${seriesIndex + 1}`}
            </span>
            <div className="ChartDataEditor__palette">
              {palette.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={
                    draftColors[seriesIndex] === color
                      ? "ChartDataEditor__paletteDot is-active"
                      : "ChartDataEditor__paletteDot"
                  }
                  style={{ background: color }}
                  aria-label={color}
                  onClick={() => updateSeriesColor(seriesIndex, color)}
                />
              ))}
            </div>
          </div>
        ))}
        <button
          type="button"
          className="ChartDataEditor__ghost ChartDataEditor__reshuffle"
          onClick={reshuffleColors}
        >
          {t("labels.chartReshuffleColors")}
        </button>
      </div>

      <div className="ChartDataEditor__section">{t("labels.chartRows")}</div>
      <div className="ChartDataEditor__tableWrap">
        <table className="ChartDataEditor__table">
          <thead>
            <tr>
              <th>{t("labels.chartRowLabel")}</th>
              {draft.series.map((series, seriesIndex) => (
                <th key={seriesIndex}>
                  <div className="ChartDataEditor__seriesHead">
                    <span
                      className="ChartDataEditor__seriesDot"
                      style={{
                        background: draftColors[seriesIndex] ?? "#1971c2",
                      }}
                    />
                    <input
                      value={series.title ?? ""}
                      aria-label={t("labels.chartSeries")}
                      onChange={(event) =>
                        updateSeriesTitle(seriesIndex, event.target.value)
                      }
                    />
                    {draft.series.length > 1 && (
                      <button
                        type="button"
                        className="ChartDataEditor__iconBtn"
                        aria-label={t("labels.chartRemoveSeries")}
                        onClick={() => removeSeries(seriesIndex)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowCount }, (_, rowIndex) => (
              <tr key={rowIndex}>
                <td>
                  <input
                    value={draft.labels?.[rowIndex] ?? ""}
                    onChange={(event) =>
                      updateRowLabel(rowIndex, event.target.value)
                    }
                  />
                </td>
                {draft.series.map((series, seriesIndex) => (
                  <td key={seriesIndex}>
                    <input
                      inputMode="decimal"
                      value={series.values[rowIndex] ?? 0}
                      onChange={(event) =>
                        updateCell(seriesIndex, rowIndex, event.target.value)
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    className="ChartDataEditor__iconBtn"
                    aria-label={t("labels.chartRemoveRow")}
                    disabled={rowCount <= 2}
                    onClick={() => removeRow(rowIndex)}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!canApply && draftType === "radar" && (
        <div className="ChartDataEditor__hint">
          {t("labels.chartRadarMinRows")}
        </div>
      )}

      <div className="ChartDataEditor__actions">
        <button type="button" className="ChartDataEditor__ghost" onClick={addRow}>
          {t("labels.chartAddRow")}
        </button>
        <button
          type="button"
          className="ChartDataEditor__ghost"
          onClick={addSeries}
        >
          {t("labels.chartAddSeries")}
        </button>
        <button
          type="button"
          className="ChartDataEditor__apply"
          disabled={!canApply}
          onClick={apply}
        >
          {t("labels.chartApply")}
        </button>
      </div>
    </div>
  );
};

export default ChartDataEditor;
