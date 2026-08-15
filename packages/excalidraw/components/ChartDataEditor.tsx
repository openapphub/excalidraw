import { useCallback, useEffect, useMemo, useState } from "react";

import { EVENT, KEYS, sceneCoordsToViewportCoords } from "@excalidraw/common";
import { getCommonBounds } from "@excalidraw/element";

import type { CartesianChartType } from "../charts/charts.constants";
import {
  getChartElements,
  getChartSpec,
  type ChartSpec,
} from "../charts/chartSpec";
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

const ChartDataEditor = ({
  app,
  chartId,
}: {
  app: AppClassProperties;
  chartId: string;
}) => {
  const elements = getChartElements(app.scene.getNonDeletedElements(), chartId);
  const liveSpec = getChartSpec(elements[0]);

  const [draftType, setDraftType] = useState<CartesianChartType>(
    liveSpec?.type ?? "bar",
  );
  const [draft, setDraft] = useState<Spreadsheet>(() =>
    cloneSpreadsheet(liveSpec?.spreadsheet ?? { title: null, labels: [], series: [] }),
  );

  useEffect(() => {
    if (!liveSpec) {
      app.setAppState({ editingChart: null });
      return;
    }
    setDraftType(liveSpec.type);
    setDraft(cloneSpreadsheet(liveSpec.spreadsheet));
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

  const apply = useCallback(
    (nextType: CartesianChartType, nextSpreadsheet: Spreadsheet) => {
      if (!liveSpec) {
        return;
      }
      const nextSpec: ChartSpec = {
        ...liveSpec,
        type: nextType,
        spreadsheet: nextSpreadsheet,
      };
      app.replaceChartFromSpec(nextSpec);
    },
    [app, liveSpec],
  );

  const rowCount = rowCountOf(draft);

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
      const labels = prev.labels ? prev.labels.filter((_, i) => i !== rowIndex) : null;
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
        {(["bar", "line"] as const).map((type) => (
          <button
            key={type}
            type="button"
            className={draftType === type ? "is-active" : undefined}
            onClick={() => setDraftType(type)}
          >
            {type === "bar"
              ? t("labels.chartType_bar")
              : t("labels.chartType_line")}
          </button>
        ))}
      </div>

      <div className="ChartDataEditor__section">{t("labels.chartRows")}</div>
      <div className="ChartDataEditor__tableWrap">
        <table className="ChartDataEditor__table">
          <thead>
            <tr>
              <th>{t("labels.chartRowLabel")}</th>
              {draft.series.map((series, seriesIndex) => (
                <th key={seriesIndex}>
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
          onClick={() => apply(draftType, draft)}
        >
          {t("labels.chartApply")}
        </button>
      </div>
    </div>
  );
};

export default ChartDataEditor;
