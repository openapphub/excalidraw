import type { ChartType } from "@excalidraw/element/types";

import { renderBarChart } from "./charts.bar";
import { renderLineChart } from "./charts.line";
import {
  tryParseCells,
  tryParseNumber,
  tryParseSpreadsheet,
} from "./charts.parse";
import { renderRadarChart } from "./charts.radar";
import {
  stampChartSpec,
  type ChartSpec,
} from "./chartSpec";

import type { ChartElements, Spreadsheet } from "./charts.types";

export {
  type ParseSpreadsheetResult,
  type Spreadsheet,
  type SpreadsheetSeries,
  type ChartElements,
} from "./charts.types";

export { isSpreadsheetValidForChartType } from "./charts.helpers";
export { tryParseCells, tryParseNumber, tryParseSpreadsheet };
export {
  type ChartSpec,
  DEFAULT_CHART_SPREADSHEET,
  createChartSpec,
  getChartSpec,
  getChartElements,
  stampChartSpec,
} from "./chartSpec";

export const renderSpreadsheet = (
  chartType: ChartType,
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
): ChartElements | null => {
  if (chartType === "line") {
    return renderLineChart(spreadsheet, x, y, colorSeed);
  }
  if (chartType === "radar") {
    return renderRadarChart(spreadsheet, x, y, colorSeed);
  }
  return renderBarChart(spreadsheet, x, y, colorSeed);
};

export const createChartElements = (
  spec: ChartSpec,
  x: number,
  y: number,
): ChartElements | null => {
  const elements = renderSpreadsheet(
    spec.type,
    spec.spreadsheet,
    x,
    y,
    spec.colorSeed,
  );
  if (!elements) {
    return null;
  }
  return stampChartSpec(elements, spec);
};
