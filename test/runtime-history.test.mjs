import test from "node:test";
import assert from "node:assert/strict";
import { appendRuntimeHistory } from "../src-next/lib/screeps/runtime-history.ts";

const empty = { cpu: [] };

test("appends CPU samples while ignoring missing values", () => {
  const next = appendRuntimeHistory(empty, 12.5, 1_000);
  assert.deepEqual(next.cpu, [{ time: 1_000, value: 12.5 }]);
  assert.deepEqual(appendRuntimeHistory(next, undefined, 2_000), next);
});

test("keeps one point for the same timestamp", () => {
  const first = appendRuntimeHistory(empty, 10, 1_000);
  const next = appendRuntimeHistory(first, 20, 1_000);
  assert.deepEqual(next.cpu, [{ time: 1_000, value: 20 }]);
});

test("evicts the oldest points after reaching the configured limit", () => {
  let snapshot = empty;
  snapshot = appendRuntimeHistory(snapshot, 1, 1, 2);
  snapshot = appendRuntimeHistory(snapshot, 2, 2, 2);
  snapshot = appendRuntimeHistory(snapshot, 3, 3, 2);
  assert.deepEqual(snapshot.cpu, [
    { time: 2, value: 2 },
    { time: 3, value: 3 },
  ]);
});
