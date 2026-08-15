import { randomId } from "@excalidraw/common";
import { newElementWith } from "@excalidraw/element";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import type { CartesianChartType } from "./charts.constants";
import type { ChartElements, Spreadsheet } from "./charts.types";

export type ChartSpec = {
  id: string;
  type: CartesianChartType;
  spreadsheet: Spreadsheet;
  colorSeed?: number;
};

export const DEFAULT_CHART_SPREADSHEET: Spreadsheet = {
  title: null,
  labels: ["Row 1", "Row 2", "Row 3", "Row 4"],
  series: [
    { title: "Series 1", values: [12, 18, 9, 22] },
    { title: "Series 2", values: [7, 14, 16, 11] },
  ],
};

export const createChartSpec = (
  type: CartesianChartType,
  spreadsheet: Spreadsheet = DEFAULT_CHART_SPREADSHEET,
  colorSeed: number = Math.random(),
): ChartSpec => ({
  id: randomId(),
  type,
  spreadsheet,
  colorSeed,
});

export const getChartSpec = (
  element: NonDeletedExcalidrawElement | null | undefined,
): ChartSpec | null => {
  const chart = element?.customData?.chart;
  if (
    !chart ||
    typeof chart.id !== "string" ||
    (chart.type !== "bar" && chart.type !== "line") ||
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
