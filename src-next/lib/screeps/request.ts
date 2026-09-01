import type { QueryParams, ScreepsRequest, ScreepsResponse } from "./types";

const DEFAULT_SERVER_URL = "https://screeps.com";
const FALLBACK_TIMEOUT_MS = 20_000;
const BATCH_DEFAULT_CONCURRENCY = 8;
const BATCH_MAX_CONCURRENCY = 24;

const inflightRequestByKey = new Map<string, Promise<ScreepsResponse>>();

interface ScreepsBatchRequestOptions {
  maxConcurrency?: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolveFn: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  });
  return { promise, resolve: (value) => resolveFn?.(value) };
}

function stableSerialize(value: unknown): string {
  const visited = new WeakSet<object>();
  return JSON.stringify(value, (_key, current) => {
    if (typeof current !== "object" || current === null) return current;
    if (visited.has(current)) return "[Circular]";
    visited.add(current);
    if (Array.isArray(current)) return current;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(current as Record<string, unknown>).sort()) {
      sorted[key] = (current as Record<string, unknown>)[key];
    }
    return sorted;
  }) ?? "null";
}

function requestIdentity(request: ScreepsRequest): string {
  return [
    request.method ?? "GET",
    request.endpoint,
    stableSerialize(request.query ?? {}),
    stableSerialize(request.body ?? null),
  ].join("|");
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function normalizeRequest(request: ScreepsRequest): ScreepsRequest {
  return {
    ...request,
    baseUrl: normalizeBaseUrl(request.baseUrl ?? ""),
    endpoint: normalizeEndpoint(request.endpoint),
    method: request.method ?? "GET",
  };
}

function normalizeBatchConcurrency(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return BATCH_DEFAULT_CONCURRENCY;
  return Math.max(1, Math.min(BATCH_MAX_CONCURRENCY, Math.floor(value)));
}

export function normalizeBaseUrl(rawInput: string): string {
  const input = rawInput.trim().length > 0 ? rawInput.trim() : DEFAULT_SERVER_URL;
  const withProtocol = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  try {
    const url = new URL(withProtocol);
    if (url.pathname.endsWith("/api")) url.pathname = url.pathname.slice(0, -4);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString().replace(/\/$/, "");
  } catch {
    throw new Error(`Invalid server URL: ${rawInput}`);
  }
}

export function buildApiUrl(baseUrl: string, endpoint: string, query?: QueryParams): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}${normalizeEndpoint(endpoint)}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, String(value));
  return url.toString();
}

function toErrorResponse(request: ScreepsRequest, error: unknown): ScreepsResponse {
  return {
    status: 0,
    ok: false,
    data: { error: error instanceof Error ? error.message : "Unknown error" },
    url: buildApiUrl(request.baseUrl ?? "", request.endpoint, request.query),
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const output = new Array<R>(items.length);
  let cursor = 0;
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

async function browserRequest(request: ScreepsRequest): Promise<ScreepsResponse> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);
  try {
    const response = await fetch("/api/screeps-proxy", {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: request.endpoint,
        method: request.method,
        query: request.query,
        body: request.body,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json()) as ScreepsResponse | { error?: string };
    if (!response.ok || !("status" in payload)) {
      throw new Error("error" in payload ? payload.error ?? "Proxy request failed" : "Proxy request failed");
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function dispatchBatchRequests(
  requests: ScreepsRequest[],
  options?: ScreepsBatchRequestOptions
): Promise<ScreepsResponse[]> {
  return mapWithConcurrency(
    requests,
    normalizeBatchConcurrency(options?.maxConcurrency),
    (request) => browserRequest(request).catch((error) => toErrorResponse(request, error))
  );
}

export async function screepsBatchRequest(
  requests: ScreepsRequest[],
  options?: ScreepsBatchRequestOptions
): Promise<ScreepsResponse[]> {
  if (typeof window === "undefined") throw new Error("Screeps request is only supported in a browser context.");
  if (requests.length === 0) return [];

  const normalizedRequests = requests.map(normalizeRequest);
  const responsePromises: Array<Promise<ScreepsResponse>> = [];
  const deferredByKey = new Map<string, Deferred<ScreepsResponse>>();
  const newRequests: ScreepsRequest[] = [];
  const newKeys: string[] = [];

  for (const request of normalizedRequests) {
    const key = requestIdentity(request);
    const inflight = inflightRequestByKey.get(key);
    if (inflight) {
      responsePromises.push(inflight);
      continue;
    }
    const duplicate = deferredByKey.get(key);
    if (duplicate) {
      responsePromises.push(duplicate.promise);
      continue;
    }
    const deferred = createDeferred<ScreepsResponse>();
    deferredByKey.set(key, deferred);
    inflightRequestByKey.set(key, deferred.promise);
    responsePromises.push(deferred.promise);
    newRequests.push(request);
    newKeys.push(key);
  }

  if (newRequests.length > 0) {
    void dispatchBatchRequests(newRequests, options)
      .then((responses) => {
        responses.forEach((response, index) => {
          const request = newRequests[index];
          deferredByKey.get(newKeys[index])?.resolve(response ?? toErrorResponse(request, "Missing response"));
        });
      })
      .catch((error) => {
        newRequests.forEach((request, index) => {
          deferredByKey.get(newKeys[index])?.resolve(toErrorResponse(request, error));
        });
      })
      .finally(() => newKeys.forEach((key) => inflightRequestByKey.delete(key)));
  }

  return Promise.all(responsePromises);
}

export async function screepsRequest(request: ScreepsRequest): Promise<ScreepsResponse> {
  const [response] = await screepsBatchRequest([request], { maxConcurrency: 1 });
  return response ?? toErrorResponse(normalizeRequest(request), "Request failed: empty response");
}
