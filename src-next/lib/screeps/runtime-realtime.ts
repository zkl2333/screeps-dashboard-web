import { type ScreepsRealtimeEvent } from "./realtime-client";

export interface RuntimeMetricsPatch {
  cpuUsed?: number;
  cpuLimit?: number;
  cpuBucket?: number;
  memUsed?: number;
  memLimit?: number;
  memPercent?: number;
}

const DEFAULT_MEMORY_LIMIT_KB = 2_048;
const MEMORY_MB_UPPER_BOUND = 16;
const MEMORY_BYTES_LOWER_BOUND = 16_384;

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
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function normalizePercent(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value > 0 && value <= 1) {
    return value * 100;
  }
  return value;
}

function toPercent(used: number | undefined, total: number | undefined): number | undefined {
  if (used === undefined || total === undefined || total <= 0) {
    return undefined;
  }
  return (used / total) * 100;
}

function normalizeMemoryValueToKB(value: number | undefined): number | undefined {
  if (value === undefined || value <= 0) {
    return value;
  }

  if (value > MEMORY_BYTES_LOWER_BOUND) {
    return value / 1024;
  }

  if (value <= MEMORY_MB_UPPER_BOUND) {
    return value * 1024;
  }

  return value;
}

function normalizeMemoryToKB(
  used: number | undefined,
  limit: number | undefined
): { used?: number; limit?: number } {
  return {
    used: normalizeMemoryValueToKB(used),
    limit: normalizeMemoryValueToKB(limit),
  };
}

function isRuntimeChannel(channel: string): boolean {
  const normalized = channel.trim().toLowerCase();
  if (
    normalized === "cpu" ||
    normalized === "memory" ||
    normalized === "stats" ||
    normalized === "bucket" ||
    normalized === "cpubucket"
  ) {
    return true;
  }

  return (
    normalized.includes("/cpu") ||
    normalized.includes("/memory") ||
    normalized.includes("/stats") ||
    normalized.includes("/bucket") ||
    normalized.includes("/cpubucket")
  );
}

function normalizeMetricKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function compactRecords(records: Array<Record<string, unknown> | null>): Record<string, unknown>[] {
  const output: Record<string, unknown>[] = [];
  for (const record of records) {
    if (record) {
      output.push(record);
    }
  }
  return output;
}

function pickFromScopes(
  scopes: Record<string, unknown>[],
  keys: readonly string[]
): number | undefined {
  const normalizedKeys = new Set(keys.map(normalizeMetricKey));
  for (const scope of scopes) {
    for (const [key, value] of Object.entries(scope)) {
      if (!normalizedKeys.has(normalizeMetricKey(key))) {
        continue;
      }
      const parsed = asNumber(value);
      if (parsed !== undefined) {
        return parsed;
      }
    }
  }
  return undefined;
}

function pickFromNestedScopes(
  scopes: Record<string, unknown>[],
  nestedKey: string,
  keys: readonly string[]
): number | undefined {
  const normalizedNestedKey = normalizeMetricKey(nestedKey);
  const nestedScopes = compactRecords(
    scopes.map((scope) => {
      const entry = Object.entries(scope).find(([key]) => normalizeMetricKey(key) === normalizedNestedKey);
      return asRecord(entry?.[1]);
    })
  );
  return pickFromScopes(nestedScopes, keys);
}

export function extractRuntimeMetricsPatch(payload: unknown): RuntimeMetricsPatch | null {
  const root = asRecord(payload) ?? {};
  const scopes = compactRecords([
    root,
    asRecord(root.data),
    asRecord(root.result),
    asRecord(root.message),
    asRecord(root.payload),
    asRecord(root.runtime),
    ...(Array.isArray(payload) ? payload.map(asRecord) : []),
    ...(Array.isArray(root.data) ? root.data.map(asRecord) : []),
    ...(Array.isArray(root.payload) ? root.payload.map(asRecord) : []),
  ]);

  const cpuUsed =
    pickFromScopes(scopes, ["cpuUsed", "cpu"]) ?? pickFromNestedScopes(scopes, "cpu", ["cpu", "used"]);
  const cpuLimit =
    pickFromScopes(scopes, ["cpuLimit", "tickLimit"]) ??
    pickFromNestedScopes(scopes, "cpu", ["cpuLimit", "limit"]);
  const cpuBucket =
    pickFromScopes(scopes, ["cpubucket", "cpuBucket", "bucket"]) ??
    pickFromNestedScopes(scopes, "cpu", ["cpubucket", "cpuBucket", "bucket"]);

  const memUsed =
    pickFromScopes(scopes, ["memory"]) ?? pickFromNestedScopes(scopes, "memory", ["memory", "used"]);
  const memLimit =
    pickFromScopes(scopes, ["memoryLimit"]) ??
    pickFromNestedScopes(scopes, "memory", ["memoryLimit", "limit"]);
  const rawResolvedMemLimit =
    memLimit ?? (memUsed !== undefined ? DEFAULT_MEMORY_LIMIT_KB : undefined);
  const normalizedMemory = normalizeMemoryToKB(memUsed, rawResolvedMemLimit);
  const normalizedMemUsed = normalizedMemory.used;
  const normalizedMemLimit = normalizedMemory.limit;
  const memPercent =
    normalizePercent(
      pickFromScopes(scopes, ["memoryPercent"]) ??
        pickFromNestedScopes(scopes, "memory", ["memoryPercent", "percent"])
    ) ?? toPercent(normalizedMemUsed, normalizedMemLimit);

  const patch: RuntimeMetricsPatch = {};
  if (cpuUsed !== undefined) {
    patch.cpuUsed = cpuUsed;
  }
  if (cpuLimit !== undefined) {
    patch.cpuLimit = cpuLimit;
  }
  if (cpuBucket !== undefined) {
    patch.cpuBucket = cpuBucket;
  }
  if (normalizedMemUsed !== undefined) {
    patch.memUsed = normalizedMemUsed;
  }
  if (normalizedMemLimit !== undefined) {
    patch.memLimit = normalizedMemLimit;
  }
  if (memPercent !== undefined) {
    patch.memPercent = memPercent;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

function extractMetricFromText(value: string, names: readonly string[]): number | undefined {
  const namePattern = names.join("|");
  const match = new RegExp("(?:" + namePattern + ")\\s*[=:]\\s*(-?\\d+(?:\\.\\d+)?)", "i").exec(value);
  return match ? asNumber(match[1]) : undefined;
}

export function extractRuntimeMetricsFromEvent(
  event: ScreepsRealtimeEvent
): RuntimeMetricsPatch | null {
  const normalizedChannel = event.channel.trim().toLowerCase();
  const scalar = asNumber(event.payload);
  const textPayload = typeof event.payload === "string" ? event.payload : undefined;

  if (scalar !== undefined) {
    if (normalizedChannel.includes("cpubucket") || normalizedChannel.includes("bucket")) {
      return { cpuBucket: scalar };
    }
    if (normalizedChannel.includes("memory")) {
      const normalizedMemoryScalar = normalizeMemoryToKB(scalar, DEFAULT_MEMORY_LIMIT_KB);
      const normalizedMemUsed = normalizedMemoryScalar.used ?? scalar;
      const normalizedMemLimit = normalizedMemoryScalar.limit ?? DEFAULT_MEMORY_LIMIT_KB;
      return {
        memUsed: normalizedMemUsed,
        memLimit: normalizedMemLimit,
        memPercent: toPercent(normalizedMemUsed, normalizedMemLimit),
      };
    }
    if (normalizedChannel.includes("cpu")) {
      return { cpuUsed: scalar };
    }
  }

  if (textPayload) {
    const bucket = extractMetricFromText(textPayload, ["cpubucket", "cpu_bucket", "bucket"]);
    if (bucket !== undefined) {
      return { cpuBucket: bucket };
    }
  }

  const patch = extractRuntimeMetricsPatch(event.payload);
  if (!patch) {
    return null;
  }

  if (isRuntimeChannel(event.channel)) {
    return patch;
  }

  if (event.channel.startsWith("__")) {
    return null;
  }

  return patch;
}
