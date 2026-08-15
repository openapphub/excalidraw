import type { ChartType } from "@excalidraw/element/types";

import { renderAreaChart } from "./charts.area";
import { renderBarChart } from "./charts.bar";
import { renderLineChart } from "./charts.line";
import {
  tryParseCells,
  tryParseNumber,
  tryParseSpreadsheet,
} from "./charts.parse";
import { renderRadarChart } from "./charts.radar";
import { stampChartSpec, type ChartSpec } from "./chartSpec";

import type { InteractiveChartType } from "./charts.constants";
import type { ChartElements, Spreadsheet } from "./charts.types";

export {
  type ParseSpreadsheetResult,
  type Spreadsheet,
  type SpreadsheetSeries,
  type ChartElements,
} from "./charts.types";

export { isSpreadsheetValidForChartType } from "./charts.helpers";
export {
  resolveSeriesColors,
  getChartPaletteColors,
} from "./charts.helpers";
export { tryParseCells, tryParseNumber, tryParseSpreadsheet };
export {
  type ChartSpec,
  type ChartHit,
  type ChartHoverContent,
  DEFAULT_CHART_SPREADSHEET,
  createChartSpec,
  getChartSpec,
  getChartHit,
  getChartElements,
  buildChartHoverContent,
  stampChartSpec,
  isInteractiveChartType,
} from "./chartSpec";
export {
  type InteractiveChartType,
  INTERACTIVE_CHART_TYPES,
} from "./charts.constants";

export const renderSpreadsheet = (
  chartType: ChartType | InteractiveChartType,
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
  seriesColors?: readonly string[] | null,
): ChartElements | null => {
  if (chartType === "area") {
    return renderAreaChart(spreadsheet, x, y, colorSeed, seriesColors);
  }
  if (chartType === "line") {
    return renderLineChart(spreadsheet, x, y, colorSeed, seriesColors);
  }
  if (chartType === "radar") {
    return renderRadarChart(spreadsheet, x, y, colorSeed, seriesColors);
  }
  return renderBarChart(spreadsheet, x, y, colorSeed, seriesColors);
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
    spec.seriesColors,
  );
  if (!elements) {
    return null;
  }
  return stampChartSpec(elements, spec);
};
