import { useEffect, useLayoutEffect, useRef } from "react";

import type { AppState } from "../types";

import "./ChartHoverTooltip.scss";

const ChartHoverTooltip = ({
  chartHover,
}: {
  chartHover: NonNullable<AppState["chartHover"]>;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const pad = 14;
    const { offsetWidth, offsetHeight } = node;
    let left = chartHover.clientX + pad;
    let top = chartHover.clientY + pad;
    if (left + offsetWidth > window.innerWidth - 8) {
      left = chartHover.clientX - offsetWidth - pad;
    }
    if (top + offsetHeight > window.innerHeight - 8) {
      top = chartHover.clientY - offsetHeight - pad;
    }
    node.style.left = `${Math.max(8, left)}px`;
    node.style.top = `${Math.max(8, top)}px`;
  }, [chartHover.clientX, chartHover.clientY, chartHover.label, chartHover.rows]);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    node.classList.add("is-visible");
  }, [chartHover.categoryIndex, chartHover.seriesIndex]);

  return (
    <div
      ref={ref}
      className="ChartHoverTooltip"
      data-testid="chart-hover-tooltip"
      role="tooltip"
    >
      <div className="ChartHoverTooltip__label">{chartHover.label}</div>
      <ul className="ChartHoverTooltip__rows">
        {chartHover.rows.map((row) => (
          <li
            key={row.title}
            className={
              row.active
                ? "ChartHoverTooltip__row is-active"
                : "ChartHoverTooltip__row"
            }
          >
            <span className="ChartHoverTooltip__title">{row.title}</span>
            <span className="ChartHoverTooltip__value">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ChartHoverTooltip;
