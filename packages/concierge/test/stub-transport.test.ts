import { expect, it } from "vitest";

import { transportHarness } from "./fixtures/v2-session.js";

it("the v2 transport harness publishes exact catalog snapshots", () => {
  const harness = transportHarness();
  const catalog = Object.freeze({ stage: null, revision: Symbol("catalog"), tools: [] });
  harness.transport.setCatalog(catalog);
  expect(harness.publications).toEqual([catalog]);
  expect(harness.publications[0]).toBe(catalog);
});

it("the v2 transport harness routes awaited batch outcomes", async () => {
  const harness = transportHarness();
  const expected = Object.freeze({ kind: "completed", rows: Object.freeze([]) });
  harness.transport.onToolBatch(async () => expected);
  await expect(harness.dispatch({})).resolves.toBe(expected);
});

it("the v2 transport harness emits status transitions to snapshot listeners", () => {
  const harness = transportHarness({ status: "idle" });
  const observed = [];
  const remove = harness.transport.onStatusChange((status) => observed.push(status));
  harness.setStatus("connected");
  remove();
  harness.setStatus("closed");
  expect(observed).toEqual(["connected"]);
  expect(harness.statusUnsubscribes).toBe(1);
});

it("the v2 transport harness detaches its exact batch subscription", () => {
  const harness = transportHarness();
  const handler = async () => ({ kind: "completed", rows: [] });
  const remove = harness.transport.onToolBatch(handler);
  remove();
  expect(harness.batchUnsubscribes).toBe(1);
  expect(() => harness.dispatch({})).toThrow("No batch handler");
});
