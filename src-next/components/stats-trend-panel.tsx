"use client";

import { useState } from "react";
import useSWR from "swr";
import { useI18n } from "../lib/i18n/use-i18n";
import {
  STATS_TREND_INTERVALS,
  fetchUserStatsTrends,
  type StatsTrendInterval,
  type StatsTrendSeries,
} from "../lib/screeps/stats-trends";
import type { TranslationKey } from "../lib/i18n/dict";
import { useAuthStore } from "../stores/auth-store";
import { useSettingsStore } from "../stores/settings-store";

const SERIES_META: Record<
  StatsTrendSeries["statName"],
  { labelKey: TranslationKey; color: string }
> = {
  energyHarvested: { labelKey: "trends.energyHarvested", color: "#d8b14a" },
  energyControl: { labelKey: "trends.energyControl", color: "#4cc4cb" },
  energyConstruction: { labelKey: "trends.energyConstruction", color: "#7ca5ff" },
  creepsProduced: { labelKey: "trends.creepsProduced", color: "#8f88ff" },
};

const INTERVAL_LABEL_KEYS: Record<StatsTrendInterval, TranslationKey> = {
  8: "trends.range1h",
  180: "trends.range24h",
  1440: "trends.range7d",
};

const CHART_WIDTH = 300;
const CHART_HEIGHT = 80;
const CHART_PADDING = 4;

function formatCompact(value: number | undefined): string {
  if (value === undefined) {
    return "N/A";
  }
  return value.toLocaleString(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  });
}

function buildChartGeometry(points: StatsTrendSeries["points"]) {
  if (points.length === 0) {
    return undefined;
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (point.value < min) min = point.value;
    if (point.value > max) max = point.value;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }
  if (max === min) {
    max = min + 1;
  }

  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const firstTime = points[0].time;
  const lastTime = points[points.length - 1].time;
  const timeSpan = Math.max(lastTime - firstTime, 1);

  const coords = points.map((point) => {
    const x = CHART_PADDING + ((point.time - firstTime) / timeSpan) * innerWidth;
    const y =
      CHART_PADDING + (1 - (point.value - min) / (max - min)) * innerHeight;
    return { x, y };
  });

  const linePath = coords
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x.toFixed(2)} ${coord.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(2)} ${CHART_HEIGHT - CHART_PADDING} L${coords[0].x.toFixed(2)} ${CHART_HEIGHT - CHART_PADDING} Z`;

  return { linePath, areaPath, min, max, latest: points[points.length - 1].value };
}

function TrendChart({ series }: { series: StatsTrendSeries }) {
  const { t } = useI18n();
  const meta = SERIES_META[series.statName];
  const geometry = buildChartGeometry(series.points);
  const gradientId = `trend-fill-${series.statName}`;

  return (
    <div className="trend-chart">
      <div className="trend-chart-head">
        <span className="trend-chart-label">
          <span className="trend-chart-dot" style={{ background: meta.color }} />
          {t(meta.labelKey)}
        </span>
        <strong className="trend-chart-value">{formatCompact(geometry?.latest)}</strong>
      </div>
      {geometry ? (
        <svg
          className="trend-chart-svg"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={meta.color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="trend-chart-area" d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path
            className="trend-chart-line"
            d={geometry.linePath}
            fill="none"
            stroke={meta.color}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <p className="hint-text">{t("trends.empty")}</p>
      )}
      {geometry ? (
        <div className="trend-chart-foot">
          <span>{formatCompact(geometry.min)}</span>
          <span>{formatCompact(geometry.max)}</span>
        </div>
      ) : null}
    </div>
  );
}

export function StatsTrendPanel() {
  const session = useAuthStore((state) => state.session);
  const refreshIntervalMs = useSettingsStore((state) => state.refreshIntervalMs);
  const { t } = useI18n();
  const [interval, setInterval] = useState<StatsTrendInterval>(180);

  const { data, error, isLoading } = useSWR(
    session ? ["user-stats-trends", session.baseUrl, interval] : null,
    () => {
      if (!session) {
        throw new Error("No session");
      }
      return fetchUserStatsTrends(interval);
    },
    {
      refreshInterval: refreshIntervalMs,
      dedupingInterval: 8_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  if (!session) {
    return null;
  }

  return (
    <article className="card trend-panel">
      <div className="trend-panel-head">
        <h2>{t("trends.title")}</h2>
        <div className="trend-range-tabs" role="tablist">
          {STATS_TREND_INTERVALS.map((option) => (
            <button
              aria-selected={interval === option}
              className={interval === option ? "trend-range-tab active" : "trend-range-tab"}
              key={option}
              onClick={() => setInterval(option)}
              role="tab"
              type="button"
            >
              {t(INTERVAL_LABEL_KEYS[option])}
            </button>
          ))}
        </div>
      </div>
      {error && !data ? <p className="error-text">{t("common.unknownError")}</p> : null}
      {!data && isLoading ? (
        <div className="trend-grid">
          <div className="skeleton-line" style={{ height: 110 }} />
          <div className="skeleton-line" style={{ height: 110 }} />
        </div>
      ) : null}
      {data ? (
        data.length > 0 ? (
          <div className="trend-grid">
            {data.map((series) => (
              <TrendChart key={series.statName} series={series} />
            ))}
          </div>
        ) : (
          <p className="hint-text">{t("trends.empty")}</p>
        )
      ) : null}
    </article>
  );
}
