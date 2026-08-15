import { pointFrom } from "@excalidraw/math";

import { isDevEnv } from "@excalidraw/common";

import { newElement, newLinearElement } from "@excalidraw/element";

import type { LocalPoint } from "@excalidraw/math";

import { commonProps } from "./charts.constants";
import {
  chartBaseElements,
  chartXLabels,
  createSeriesLegend,
  getBackgroundColor,
  getCartesianChartLayout,
  getChartDimensions,
  getColorOffset,
  getRotatedTextElementBottom,
  resolveSeriesColors,
} from "./charts.helpers";

import type { ChartElements, Spreadsheet } from "./charts.types";

/** 面积图：折线 + 半透明填充 + 可 hover 的点 */
export const renderAreaChart = (
  spreadsheet: Spreadsheet,
  x: number,
  y: number,
  colorSeed?: number,
  seriesColorsOverride?: readonly string[] | null,
): ChartElements => {
  const series = spreadsheet.series;
  const layout = getCartesianChartLayout("line", series.length);
  const max = Math.max(1, ...series.flatMap((seriesData) => seriesData.values));
  const colorOffset = getColorOffset(colorSeed);
  const backgroundColor = getBackgroundColor(colorOffset);
  const seriesColors = resolveSeriesColors(
    series.length,
    colorSeed,
    seriesColorsOverride,
  );

  const areas = series.map((seriesData, seriesIndex) => {
    const topPoints = seriesData.values.map((value, valueIndex) =>
      pointFrom<LocalPoint>(
        valueIndex * (layout.slotWidth + layout.gap),
        -(Math.max(0, value) / max) * layout.chartHeight,
      ),
    );
    const last = topPoints[topPoints.length - 1];
    const first = topPoints[0];
    const points: LocalPoint[] = [
      ...topPoints,
      pointFrom(last[0], 0),
      pointFrom(first[0], 0),
      pointFrom(first[0], first[1]),
    ];

    const xs = points.map((point) => point[0]);
    const ys = points.map((point) => point[1]);
    return newLinearElement({
      ...commonProps,
      type: "line",
      backgroundColor: seriesColors[seriesIndex],
      fillStyle: "solid",
      strokeColor: seriesColors[seriesIndex],
      strokeWidth: 2,
      opacity: 45,
      polygon: true,
      x: x + layout.gap + layout.slotWidth / 2,
      y: y - layout.gap,
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
      points,
    });
  });

  const lines = series.map((seriesData, seriesIndex) => {
    const points = seriesData.values.map((value, valueIndex) =>
      pointFrom<LocalPoint>(
        valueIndex * (layout.slotWidth + layout.gap),
        -(Math.max(0, value) / max) * layout.chartHeight,
      ),
    );
    const maxX = Math.max(...points.map((point) => point[0]));
    const maxY = Math.max(...points.map((point) => point[1]));
    const minX = Math.min(...points.map((point) => point[0]));
    const minY = Math.min(...points.map((point) => point[1]));

    return newLinearElement({
      backgroundColor: "transparent",
      ...commonProps,
      type: "line",
      x: x + layout.gap + layout.slotWidth / 2,
      y: y - layout.gap,
      height: maxY - minY,
      width: maxX - minX,
      strokeColor: seriesColors[seriesIndex],
      strokeWidth: 2,
      points,
    });
  });

  const dots = series.flatMap((seriesData, seriesIndex) =>
    seriesData.values.map((value, valueIndex) => {
      const cx = valueIndex * (layout.slotWidth + layout.gap) + layout.gap / 2;
      const cy =
        -(Math.max(0, value) / max) * layout.chartHeight + layout.gap / 2;
      return newElement({
        backgroundColor: seriesColors[seriesIndex],
        ...commonProps,
        fillStyle: "solid",
        strokeColor: seriesColors[seriesIndex],
        strokeWidth: 2,
        type: "ellipse",
        x: x + cx + layout.slotWidth / 2,
        y: y + cy - layout.gap * 2,
        width: layout.gap,
        height: layout.gap,
        customData: {
          chartHit: {
            seriesIndex,
            categoryIndex: valueIndex,
          },
        },
      });
    }),
  );

  const baseElements = chartBaseElements(
    spreadsheet,
    x,
    y,
    backgroundColor,
    layout,
    max,
    isDevEnv(),
  );
  const xLabels = chartXLabels(spreadsheet, x, y, backgroundColor, layout);
  const xLabelsBottomY = Math.max(
    y + layout.gap / 2,
    ...xLabels.map((label) => getRotatedTextElementBottom(label)),
  );
  const { chartWidth } = getChartDimensions(spreadsheet, layout);
  const seriesLegend = createSeriesLegend(
    series,
    seriesColors,
    x + chartWidth / 2,
    xLabelsBottomY,
    y + layout.gap * 5,
    backgroundColor,
  );

  return [...baseElements, ...areas, ...lines, ...dots, ...seriesLegend];
};
