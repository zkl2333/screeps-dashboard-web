export const RUNTIME_HISTORY_MAX_POINTS = 900;
export const RUNTIME_HISTORY_SAMPLE_INTERVAL_MS = 1_000;

export interface RuntimeHistoryPoint {
  time: number;
  value: number;
}

export interface RuntimeHistorySnapshot {
  cpu: RuntimeHistoryPoint[];
}

function isFiniteMetric(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function appendPoint(
  points: RuntimeHistoryPoint[],
  point: RuntimeHistoryPoint,
  maxPoints: number
): RuntimeHistoryPoint[] {
  const previous = points[points.length - 1];
  if (previous?.time === point.time) {
    const replaced = points.slice(0, -1);
    replaced.push(point);
    return replaced;
  }

  const next = [...points, point];
  return next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
}

export function appendRuntimeHistory(
  snapshot: RuntimeHistorySnapshot,
  cpu: number | undefined,
  time: number,
  maxPoints = RUNTIME_HISTORY_MAX_POINTS
): RuntimeHistorySnapshot {
  if (!isFiniteMetric(cpu)) {
    return snapshot;
  }

  return {
    cpu: appendPoint(snapshot.cpu, { time, value: cpu }, maxPoints),
  };
}
