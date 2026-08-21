import test from "node:test";
import assert from "node:assert/strict";
import { appendRuntimeHistory } from "../src-next/lib/screeps/runtime-history.ts";

const empty = { cpu: [], bucket: [] };

test("appends CPU and bucket samples while ignoring missing values", () => {
  const next = appendRuntimeHistory(empty, { cpu: 12.5, bucket: 8_700 }, 1_000);
  assert.deepEqual(next.cpu, [{ time: 1_000, value: 12.5 }]);
  assert.deepEqual(next.bucket, [{ time: 1_000, value: 8_700 }]);
  assert.deepEqual(appendRuntimeHistory(next, {}, 2_000), next);
});

test("keeps one point per metric for the same timestamp", () => {
  const first = appendRuntimeHistory(empty, { cpu: 10 }, 1_000);
  const next = appendRuntimeHistory(first, { cpu: 20, bucket: 4_000 }, 1_000);
  assert.deepEqual(next.cpu, [{ time: 1_000, value: 20 }]);
  assert.deepEqual(next.bucket, [{ time: 1_000, value: 4_000 }]);
});

test("evicts the oldest points after reaching the configured limit", () => {
  let snapshot = empty;
  snapshot = appendRuntimeHistory(snapshot, { cpu: 1, bucket: 1 }, 1, 2);
  snapshot = appendRuntimeHistory(snapshot, { cpu: 2, bucket: 2 }, 2, 2);
  snapshot = appendRuntimeHistory(snapshot, { cpu: 3, bucket: 3 }, 3, 2);
  assert.deepEqual(snapshot.cpu, [
    { time: 2, value: 2 },
    { time: 3, value: 3 },
  ]);
  assert.deepEqual(snapshot.bucket, [
    { time: 2, value: 2 },
    { time: 3, value: 3 },
  ]);
});
