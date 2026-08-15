import type { DragEvent } from "react";

import { MIME_TYPES } from "@excalidraw/common";

import type { CartesianChartType } from "../charts/charts.constants";
import { t } from "../i18n";

import DropdownMenu from "./dropdownMenu/DropdownMenu";
import { chartBarIcon, chartLineIcon } from "./icons";

import type { AppClassProperties } from "../types";

const CHART_TYPES: CartesianChartType[] = ["bar", "line"];

const bindChartToolDrag = (
  app: AppClassProperties,
  type: CartesianChartType,
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
    {CHART_TYPES.map((type) => (
      <DropdownMenu.Item
        key={type}
        onSelect={() => app.insertChart(type)}
        icon={type === "bar" ? chartBarIcon : chartLineIcon}
        data-testid={`toolbar-chart-${type}`}
        {...bindChartToolDrag(app, type)}
      >
        {type === "bar"
          ? t("labels.chartType_bar")
          : t("labels.chartType_line")}
      </DropdownMenu.Item>
    ))}
  </>
);
