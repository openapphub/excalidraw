import { randomId } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { InteractiveChartType } from "./charts.constants";
import { resolveSeriesColors } from "./charts.helpers";
import type { ChartElements, Spreadsheet } from "./charts.types";

export type ChartSpec = {
  id: string;
  type: InteractiveChartType;
  spreadsheet: Spreadsheet;
  colorSeed?: number;
  /** 每个系列的自定义颜色；缺省时按 colorSeed 从调色板生成 */
  seriesColors?: string[];
};

/** 柱/折线/面积/雷达数据点上的命中信息，用于 hover 提示 */
export type ChartHit = {
  seriesIndex: number;
  categoryIndex: number;
};

export type ChartHoverContent = {
  label: string;
  categoryIndex: number;
  seriesIndex: number;
  rows: { title: string; value: number; active: boolean }[];
};

export const getChartHit = (
  element: NonDeletedExcalidrawElement | null | undefined,
): ChartHit | null => {
  const hit = element?.customData?.chartHit;
  if (
    !hit ||
    typeof hit.seriesIndex !== "number" ||
    typeof hit.categoryIndex !== "number"
  ) {
    return null;
  }
  return {
    seriesIndex: hit.seriesIndex,
    categoryIndex: hit.categoryIndex,
  };
};

export const buildChartHoverContent = (
  spec: ChartSpec,
  hit: ChartHit,
): ChartHoverContent => {
  const label =
    spec.spreadsheet.labels?.[hit.categoryIndex] ??
    `Row ${hit.categoryIndex + 1}`;
  const rows = spec.spreadsheet.series.map((series, index) => ({
    title: series.title?.trim() || `Series ${index + 1}`,
    value: series.values[hit.categoryIndex] ?? 0,
    active: index === hit.seriesIndex,
  }));
  return {
    label,
    categoryIndex: hit.categoryIndex,
    seriesIndex: hit.seriesIndex,
    rows,
  };
};

export const DEFAULT_CHART_SPREADSHEET: Spreadsheet = {
  title: null,
  labels: ["Row 1", "Row 2", "Row 3", "Row 4"],
  series: [
    { title: "Series 1", values: [12, 18, 9, 22] },
    { title: "Series 2", values: [7, 14, 16, 11] },
  ],
};

export const isInteractiveChartType = (
  type: unknown,
): type is InteractiveChartType =>
  type === "bar" || type === "line" || type === "area" || type === "radar";

export const createChartSpec = (
  type: InteractiveChartType,
  spreadsheet: Spreadsheet = DEFAULT_CHART_SPREADSHEET,
  colorSeed: number = Math.random(),
  seriesColors?: string[],
): ChartSpec => ({
  id: randomId(),
  type,
  spreadsheet,
  colorSeed,
  seriesColors:
    seriesColors ??
    ([...resolveSeriesColors(spreadsheet.series.length, colorSeed)] as string[]),
});

export const getChartSpec = (
  element: NonDeletedExcalidrawElement | null | undefined,
): ChartSpec | null => {
  const chart = element?.customData?.chart;
  if (
    !chart ||
    typeof chart.id !== "string" ||
    !isInteractiveChartType(chart.type) ||
    !chart.spreadsheet ||
    !Array.isArray(chart.spreadsheet.series)
  ) {
    return null;
  }
  return chart as ChartSpec;
};

export const getChartElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  chartId: string,
): NonDeletedExcalidrawElement[] =>
  elements.filter((element) => getChartSpec(element)?.id === chartId);

export const stampChartSpec = (
  elements: ChartElements,
  spec: ChartSpec,
  groupId: string = randomId(),
): ChartElements =>
  elements.map((element) =>
    newElementWith(element, {
      groupIds: element.groupIds.includes(groupId)
        ? element.groupIds
        : [...element.groupIds, groupId],
      customData: {
        ...element.customData,
        chart: spec,
      },
    }),
  );
