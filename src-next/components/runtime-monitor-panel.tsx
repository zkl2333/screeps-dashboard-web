"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n/use-i18n";
import {
  appendRuntimeHistory,
  RUNTIME_HISTORY_MAX_POINTS,
  RUNTIME_HISTORY_SAMPLE_INTERVAL_MS,
  type RuntimeHistoryPoint,
  type RuntimeHistorySnapshot,
} from "../lib/screeps/runtime-history";

interface RuntimeMonitorPanelProps {
  cpuBucket?: number;
  cpuLimit?: number;
  cpuUsed?: number;
}

interface MetricChartProps {
  color: string;
  label: string;
  maxValue?: number;
  minValue?: number;
  points: RuntimeHistoryPoint[];
  value: number | undefined;
  valueFormatter: (value: number | undefined) => string;
}

const CHART_WIDTH = 300;
const CHART_HEIGHT = 86;
const CHART_PADDING = 5;

function formatCpu(value: number | undefined): string {
  if (value === undefined) {
    return "N/A";
  }
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatBucket(value: number | undefined): string {
  if (value === undefined) {
    return "N/A";
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function buildChartGeometry(
  points: RuntimeHistoryPoint[],
  minValue?: number,
  maxValue?: number
) {
  if (points.length === 0) {
    return undefined;
  }

  let min = minValue ?? Math.min(...points.map((point) => point.value));
  let max = maxValue ?? Math.max(...points.map((point) => point.value));
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return undefined;
  }

  if (minValue === undefined || maxValue === undefined) {
    const range = Math.max(max - min, 1);
    if (minValue === undefined) {
      min = Math.max(0, min - range * 0.1);
    }
    if (maxValue === undefined) {
      max += range * 0.1;
    }
  }
  if (max <= min) {
    max = min + 1;
  }

  const firstTime = points[0].time;
  const lastTime = points[points.length - 1].time;
  const timeSpan = Math.max(lastTime - firstTime, 1);
  const innerWidth = CHART_WIDTH - CHART_PADDING * 2;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const coordinates = points.map((point) => ({
    x: CHART_PADDING + ((point.time - firstTime) / timeSpan) * innerWidth,
    y: CHART_PADDING + (1 - (point.value - min) / (max - min)) * innerHeight,
  }));
  const linePath = coordinates
    .map((coordinate, index) => `${index === 0 ? "M" : "L"}${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`)
    .join(" ");
  const baseline = CHART_HEIGHT - CHART_PADDING;
  const areaPath = `${linePath} L${coordinates[coordinates.length - 1].x.toFixed(2)} ${baseline} L${coordinates[0].x.toFixed(2)} ${baseline} Z`;

  return { areaPath, linePath, max, min };
}

function MetricChart({
  color,
  label,
  maxValue,
  minValue,
  points,
  value,
  valueFormatter,
}: MetricChartProps) {
  const geometry = buildChartGeometry(points, minValue, maxValue);
  const gradientId = `runtime-fill-${label.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`;

  return (
    <div className="runtime-chart">
      <div className="runtime-chart-head">
        <span className="runtime-chart-label">
          <span className="runtime-chart-dot" style={{ background: color }} />
          {label}
        </span>
        <strong className="runtime-chart-value">{valueFormatter(value)}</strong>
      </div>
      {geometry ? (
        <svg
          aria-label={label}
          className="runtime-chart-svg"
          role="img"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="runtime-chart-area" d={geometry.areaPath} fill={`url(#${gradientId})`} />
          <path
            className="runtime-chart-line"
            d={geometry.linePath}
            fill="none"
            stroke={color}
            strokeWidth="1.7"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <p className="hint-text">—</p>
      )}
      {geometry ? (
        <div className="runtime-chart-foot">
          <span>{valueFormatter(geometry.min)}</span>
          <span>{valueFormatter(geometry.max)}</span>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY_SNAPSHOT: RuntimeHistorySnapshot = { cpu: [], bucket: [] };

export function RuntimeMonitorPanel({
  cpuBucket,
  cpuLimit,
  cpuUsed,
}: RuntimeMonitorPanelProps) {
  const { t } = useI18n();
  const latestValuesRef = useRef({ cpu: cpuUsed, bucket: cpuBucket });
  const historyRef = useRef<RuntimeHistorySnapshot>(EMPTY_SNAPSHOT);
  const [history, setHistory] = useState<RuntimeHistorySnapshot>(EMPTY_SNAPSHOT);

  useEffect(() => {
    latestValuesRef.current = { cpu: cpuUsed, bucket: cpuBucket };
  }, [cpuBucket, cpuUsed]);

  useEffect(() => {
    const sample = () => {
      const next = appendRuntimeHistory(
        historyRef.current,
        latestValuesRef.current,
        Date.now(),
        RUNTIME_HISTORY_MAX_POINTS
      );
      historyRef.current = next;
      setHistory(next);
    };

    sample();
    const timer = window.setInterval(sample, RUNTIME_HISTORY_SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  function clearHistory() {
    historyRef.current = { cpu: [], bucket: [] };
    setHistory({ cpu: [], bucket: [] });
  }

  return (
    <article className="card runtime-monitor-panel">
      <div className="runtime-monitor-head">
        <div>
          <h2>{t("runtime.title")}</h2>
          <p className="runtime-monitor-subtitle">{t("runtime.live")}</p>
        </div>
        <button className="runtime-clear-button" onClick={clearHistory} type="button">
          {t("runtime.clear")}
        </button>
      </div>
      <div className="runtime-monitor-grid">
        <MetricChart
          color="#7ca5ff"
          label={t("runtime.cpu")}
          points={history.cpu}
          value={cpuUsed}
          valueFormatter={(value) =>
            value === undefined || cpuLimit === undefined
              ? formatCpu(value)
              : `${formatCpu(value)} / ${formatCpu(cpuLimit)}`
          }
        />
        <MetricChart
          color="#e6bd5b"
          label={t("runtime.bucket")}
          maxValue={10_000}
          minValue={0}
          points={history.bucket}
          value={cpuBucket}
          valueFormatter={formatBucket}
        />
      </div>
    </article>
  );
}
