// @ts-nocheck -- This isolated Astro fixture intentionally omits Node typings;
// Vitest still executes the proof in a Node process.

import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  join,
  normalize,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

type RegistryEvidence = Readonly<{
  pre: null | "registered";
  post: null | "registered";
}>;

type SsrEvidence = Readonly<{
  schemaVersion: number;
  renderId: string;
  adapters: Readonly<{ react: string; svelte: string }>;
  globals: Readonly<{
    window: boolean;
    document: boolean;
    navigator: boolean;
  }>;
  globalsAbsent: boolean;
  identities: Readonly<{
    react: string;
    svelte: string;
    distinct: boolean;
  }>;
  catalog: ReadonlyArray<unknown>;
  catalogDigest: string;
  catalogsShared: boolean;
  instancesDistinct: boolean;
  registries: Readonly<{
    react: RegistryEvidence;
    svelte: RegistryEvidence;
  }>;
}>;

type BuildEvidence = Readonly<{
  html: string;
  evidence: SsrEvidence;
}>;

const EXAMPLE_DIR = fileURLToPath(new URL("../", import.meta.url));
const OUTPUT_PREFIX = "concierge-adapter-ssr-";
const PROCESS_TIMEOUT_MS = 30_000;
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const EVIDENCE_PATTERN =
  /<script\b(?=[^>]*\bid="adapter-ssr-evidence")(?=[^>]*\btype="application\/json")[^>]*>([\s\S]*?)<\/script>/gu;
const EVIDENCE_LINE =
  "ASTRO_SSR_EVIDENCE renders=2 catalogs=shared registries=null globals=absent fresh=true";

function assertOwnedOutputRoot(outputRoot: string): void {
  expect(outputRoot, "T04 output root must be normalized").toBe(
    normalize(outputRoot),
  );
  expect(dirname(outputRoot), "T04 output root must be a direct temp child").toBe(
    resolve(tmpdir()),
  );
  expect(
    basename(outputRoot).startsWith(OUTPUT_PREFIX),
    "T04 output root must retain its owned prefix",
  ).toBe(true);
  expect(basename(outputRoot).length).toBeGreaterThan(OUTPUT_PREFIX.length);
}

function runAstro(
  command: "check" | "build",
  environment: NodeJS.ProcessEnv,
  label: string,
): string {
  const result = spawnSync(PNPM, ["exec", "astro", command], {
    cwd: EXAMPLE_DIR,
    encoding: "utf8",
    env: environment,
    maxBuffer: 8 * 1024 * 1024,
    timeout: PROCESS_TIMEOUT_MS,
  });

  expect(
    result.error,
    `${label} process error: ${result.error?.message ?? "none"}`,
  ).toBeUndefined();
  expect(
    result.signal,
    `${label} exceeded its bounded process timeout`,
  ).toBeNull();
  expect(result.status, `${label} stderr:\n${result.stderr}`).toBe(0);
  return `${result.stdout}\n${result.stderr}`;
}

function parseEvidence(html: string, renderId: string): SsrEvidence {
  const blocks = [...html.matchAll(EVIDENCE_PATTERN)];
  expect(
    blocks,
    "T04 requires exactly one built index evidence block",
  ).toHaveLength(1);

  const source = blocks[0]?.[1];
  expect(source, "T04 evidence JSON must be nonempty").toBeTruthy();
  const evidence = JSON.parse(source ?? "") as SsrEvidence;

  expect(evidence.schemaVersion).toBe(1);
  expect(evidence.renderId).toBe(renderId);
  expect(evidence.adapters).toEqual({
    react: "@fullselfbrowsing/concierge-react/client",
    svelte: "@fullselfbrowsing/concierge-svelte/client.svelte",
  });
  expect(evidence.globals, "T04 browser globals must be absent").toEqual({
    window: false,
    document: false,
    navigator: false,
  });
  expect(evidence.globalsAbsent, "T04 globals=absent").toBe(true);
  expect(evidence.identities).toEqual({
    react: `${renderId}:react`,
    svelte: `${renderId}:svelte`,
    distinct: true,
  });
  expect(evidence.catalogsShared, "T04 catalogs=shared within one render").toBe(
    true,
  );
  expect(evidence.catalog).toEqual([
    {
      type: "function",
      name: "inspectServerRender",
      description: "Report whether the adapter server-render harness is active.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
  ]);
  expect(evidence.catalogDigest).toMatch(/^[0-9a-f]{8}$/u);
  expect(evidence.instancesDistinct, "T04 request objects must be distinct").toBe(
    true,
  );

  for (const adapter of ["react", "svelte"] as const) {
    expect(
      evidence.registries[adapter],
      `T04/SSR1 ${adapter} registry must remain null before and after render`,
    ).toEqual({ pre: null, post: null });
    expect(html, `T04 ${adapter} built adapter entry must execute`).toContain(
      `data-adapter-evidence="${adapter}"`,
    );
    expect(html).toContain(`value="${renderId}:${adapter}"`);
  }

  expect(html.match(/data-concierge="exact"/gu)).toHaveLength(2);
  expect(html.match(/data-registry="null"/gu)).toHaveLength(2);
  expect(
    html,
    "T04/SSR1 React render payload must remain registration-silent",
  ).not.toContain("&quot;registry&quot;:&quot;registered&quot;");
  expect(html).toContain(
    'data-entry="@fullselfbrowsing/concierge-react/client"',
  );
  expect(html).toContain(
    'data-entry="@fullselfbrowsing/concierge-svelte/client.svelte"',
  );

  return evidence;
}

function runFreshAstroBuild(iteration: number): BuildEvidence {
  const outputRoot = mkdtempSync(join(tmpdir(), OUTPUT_PREFIX));
  const renderId = `fresh-${iteration}`;
  assertOwnedOutputRoot(outputRoot);

  const nodeOptions = [
    process.env.NODE_OPTIONS,
    "--no-experimental-global-navigator",
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ");
  const environment = {
    ...process.env,
    ADAPTER_SSR_OUT_DIR: outputRoot,
    ADAPTER_SSR_RENDER_ID: renderId,
    ASTRO_TELEMETRY_DISABLED: "1",
    CI: "1",
    NODE_OPTIONS: nodeOptions,
  };

  try {
    const checkOutput = runAstro(
      "check",
      environment,
      `Astro check ${iteration}`,
    );
    expect(checkOutput).toContain("0 errors");

    const buildOutput = runAstro(
      "build",
      environment,
      `Astro build ${iteration}`,
    );
    expect(buildOutput).toContain("1 page(s) built");

    const pagePath = join(outputRoot, "index.html");
    expect(
      statSync(pagePath).isFile(),
      "T04 built index.html must be a file",
    ).toBe(true);
    expect(
      statSync(pagePath).size,
      "T04 built index.html must be nonempty",
    ).toBeGreaterThan(0);
    const html = readFileSync(pagePath, "utf8");
    return Object.freeze({ html, evidence: parseEvidence(html, renderId) });
  } finally {
    assertOwnedOutputRoot(outputRoot);
    rmSync(outputRoot, { recursive: true });
  }
}

describe("ADP-04 normal Astro SSR", () => {
  it("T04/SSR1 proves two fresh normal builds remain registration-silent", () => {
    const builds = [runFreshAstroBuild(1), runFreshAstroBuild(2)] as const;
    const [first, second] = builds;

    expect(second.evidence.catalog, "T04 catalogs=shared across processes").toEqual(
      first.evidence.catalog,
    );
    expect(second.evidence.catalogDigest).toBe(first.evidence.catalogDigest);
    expect(
      second.evidence.renderId,
      "T04 fresh process render IDs must differ",
    ).not.toBe(first.evidence.renderId);
    expect(
      new Set(
        builds.flatMap(({ evidence }) => [
          evidence.identities.react,
          evidence.identities.svelte,
        ]),
      ).size,
      "T04 all request identities must be fresh",
    ).toBe(4);

    console.log(EVIDENCE_LINE);
  }, 120_000);
});
