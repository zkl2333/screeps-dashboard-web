import { screepsBatchRequest } from "./request";
import type { ScreepsSession } from "./types";

export const STATS_TREND_STAT_NAMES = [
  "energyHarvested",
  "energyControl",
  "energyConstruction",
  "creepsProduced",
] as const;

export type StatsTrendStatName = (typeof STATS_TREND_STAT_NAMES)[number];

export const STATS_TREND_INTERVALS = [8, 180, 1440] as const;

export type StatsTrendInterval = (typeof STATS_TREND_INTERVALS)[number];

export interface StatsTrendPoint {
  time: number;
  value: number;
}

export interface StatsTrendSeries {
  statName: StatsTrendStatName;
  points: StatsTrendPoint[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

// 官方 overview 接口真实结构（已用线上 token 验证）：
// { ok, statsMax, totals, shards: { <shard>: { rooms: [...], stats: { <room>: [{value, endTime}] }, gametimes: [...] } } }
// endTime 是"第几个 interval 分钟"的时间槽（如 165477 * 180min），需要乘 interval*60*1000 还原成 epoch ms。
// 这里递归下钻收集所有 [{value, endTime}] 序列，按时间槽合并各 shard/房间求和，得到账号整体曲线。
function parseStatsSeries(
  data: unknown,
  statName: string,
  interval: StatsTrendInterval
): StatsTrendPoint[] {
  const root = asRecord(data);
  if (!root) {
    return [];
  }

  const totalsByTime = new Map<number, number>();
  const slotMs = interval * 60_000;

  const addEntries = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }
    for (const entry of value) {
      const record = asRecord(entry);
      if (!record) {
        continue;
      }
      const pointValue = asNumber(record.value);
      const endTime = asNumber(record.endTime) ?? asNumber(record.time) ?? asNumber(record.tick);
      if (pointValue === undefined || endTime === undefined) {
        continue;
      }
      // 防御：若 endTime 已是 epoch ms 则直接使用，否则按时间槽换算。
      const time = endTime > 1e11 ? endTime : endTime * slotMs;
      totalsByTime.set(time, (totalsByTime.get(time) ?? 0) + pointValue);
    }
  };

  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      addEntries(node);
      return;
    }
    const record = asRecord(node);
    if (!record) {
      return;
    }
    // 兼容按 statName 嵌套一层的形状，命中后不再下钻，避免混入其他指标。
    const named = record[statName];
    if (Array.isArray(named)) {
      addEntries(named);
      return;
    }
    for (const value of Object.values(record)) {
      walk(value);
    }
  };

  walk(root);

  return [...totalsByTime.entries()]
    .map(([time, value]) => ({ time, value }))
    .sort((left, right) => left.time - right.time);
}

export async function fetchUserStatsTrends(
  session: ScreepsSession,
  interval: StatsTrendInterval
): Promise<StatsTrendSeries[]> {
  const responses = await screepsBatchRequest(
    STATS_TREND_STAT_NAMES.map((statName) => ({
      baseUrl: session.baseUrl,
      endpoint: "/api/user/overview",
      method: "GET" as const,
      query: { interval, statName },
      token: session.token,
      username: session.username,
    })),
    { maxConcurrency: 4 }
  );

  const series: StatsTrendSeries[] = [];
  for (let index = 0; index < STATS_TREND_STAT_NAMES.length; index += 1) {
    const response = responses[index];
    if (!response || !response.ok) {
      continue;
    }
    const points = parseStatsSeries(response.data, STATS_TREND_STAT_NAMES[index], interval);
    if (points.length === 0) {
      continue;
    }
    series.push({ statName: STATS_TREND_STAT_NAMES[index], points });
  }
  return series;
}
