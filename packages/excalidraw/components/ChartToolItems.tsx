import type { DragEvent } from "react";

import { MIME_TYPES } from "@excalidraw/common";

import {
  INTERACTIVE_CHART_TYPES,
  type InteractiveChartType,
} from "../charts/charts.constants";
import { t } from "../i18n";

import DropdownMenu from "./dropdownMenu/DropdownMenu";
import {
  chartAreaIcon,
  chartBarIcon,
  chartLineIcon,
  chartRadarIcon,
} from "./icons";

import type { AppClassProperties } from "../types";

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

const chartTypeIcon = (type: InteractiveChartType) => {
  switch (type) {
    case "bar":
      return chartBarIcon;
    case "line":
      return chartLineIcon;
    case "area":
      return chartAreaIcon;
    case "radar":
      return chartRadarIcon;
  }
};

const bindChartToolDrag = (
  app: AppClassProperties,
  type: InteractiveChartType,
) => ({
  draggable: true as const,
  onDragStart: (event: DragEvent<HTMLButtonElement>) => {
    app.pendingChartInsert = type;
    event.dataTransfer.setData(
      MIME_TYPES.excalidrawChart,
      JSON.stringify({ type }),
    );
    event.dataTransfer.setData(MIME_TYPES.text, `excalidraw-chart:${type}`);
    event.dataTransfer.effectAllowed = "copy";
  },
  onDragEnd: () => {
    requestAnimationFrame(() => {
      app.pendingChartInsert = null;
    });
  },
});

export const ChartToolMenuItems = ({ app }: { app: AppClassProperties }) => (
  <>
    <div style={{ margin: "6px 0", fontSize: 14, fontWeight: 600 }}>
      {t("toolBar.chart")}
    </div>
    {INTERACTIVE_CHART_TYPES.map((type) => (
      <DropdownMenu.Item
        key={type}
        onSelect={() => app.insertChart(type)}
        icon={chartTypeIcon(type)}
        data-testid={`toolbar-chart-${type}`}
        {...bindChartToolDrag(app, type)}
      >
        {chartTypeLabel(type)}
      </DropdownMenu.Item>
    ))}
  </>
);
