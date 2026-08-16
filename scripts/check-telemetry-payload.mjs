#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const RUNTIME = resolve(ROOT, "packages/concierge/src/telemetry/runtime.ts");
const source = readFileSync(RUNTIME, "utf8");
const EXPECTED_KEYS = [
  "event_id",
  "install_uuid",
  "ts_minute",
  "mcp_client",
  "model",
  "tokens_in",
  "tokens_out",
  "active_agent_count",
  "event_type",
  "active_count_version",
];

function fail(message) {
  throw new Error(`Concierge telemetry payload audit failed: ${message}`);
}

function balancedBlock(startNeedle) {
  const start = source.indexOf(startNeedle);
  if (start < 0) fail(`missing ${startNeedle}`);
  const open = source.indexOf("{", start);
  if (open < 0) fail(`missing block for ${startNeedle}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  fail(`unterminated block for ${startNeedle}`);
}

const eventInterface = balancedBlock("interface TelemetryEvent");
const declaredKeys = [...eventInterface.matchAll(/^\s*readonly\s+([a-z_]+):/gmu)]
  .map((match) => match[1]);
if (JSON.stringify(declaredKeys) !== JSON.stringify(EXPECTED_KEYS)) {
  fail(`wire interface keys changed: ${JSON.stringify(declaredKeys)}`);
}

const projectionFunction = balancedBlock("function projectWireEvent");
const returnObjectStart = projectionFunction.indexOf("return {");
if (returnObjectStart < 0) fail("projectWireEvent has no literal return object");
const projection = projectionFunction.slice(returnObjectStart);
const projectedKeys = [...projection.matchAll(/^\s{4}([a-z_]+):/gmu)]
  .map((match) => match[1]);
if (JSON.stringify(projectedKeys) !== JSON.stringify(EXPECTED_KEYS)) {
  fail(`wire projection keys changed: ${JSON.stringify(projectedKeys)}`);
}
if (/\.\.\./u.test(projection)) fail("wire projection may not use object spread");

const observer = balancedBlock("concierge.onDispatch((event)");
const observerReads = [...observer.matchAll(/\bevent\.([A-Za-z_$][\w$]*)/gu)]
  .map((match) => match[1]);
if (observerReads.some((name) => name !== "phase")) {
  fail(`dispatch observer reads non-phase data: ${JSON.stringify(observerReads)}`);
}

for (const required of [
  'credentials: "omit"',
  'referrerPolicy: "no-referrer"',
  "keepalive: true",
  'mcp_client: "Concierge"',
  'model: "unknown"',
  "tokensIn += ACTION_TOKENS_IN",
  "tokensOut += ACTION_TOKENS_OUT",
  "JSON.stringify({ events: batch.events })",
]) {
  if (!source.includes(required)) fail(`missing privacy invariant ${required}`);
}

for (const forbidden of [
  /event\.name/u,
  /event\.input/u,
  /event\.result/u,
  /event\.stage/u,
  /document\./u,
  /location\./u,
  /\.cookie\b/u,
  /Authorization/u,
]) {
  if (forbidden.test(source)) fail(`forbidden data flow matched ${forbidden}`);
}

console.log("Concierge telemetry payload audit passed (10 fields; phase-only observer).");
