#!/usr/bin/env node

/**
 * Report whether the working tree's version of the fixed set is already on the
 * registry.
 *
 * `release.yml` fires on every push to `main`, and the release chain is gated
 * only on there being no pending Changesets. That is true of an ordinary merge
 * as well as a Version Packages merge, so every unrelated commit ran the whole
 * chain and parked a deployment at the `npm-production` gate. Approving one is
 * worse than pointless: the sealed commit no longer matches the commit named in
 * the published packages' provenance, so `[REGISTRY_PROVENANCE]` refuses the
 * set — correctly, because the publisher must not certify bytes it did not
 * produce. A gate that can only fail is a trap standing open on `main`.
 *
 * **Unreachable is reported as not published.** A registry this cannot read is
 * a registry it cannot claim anything about, and the safe direction is to let
 * the release chain run: the worst case is the pending deployment this exists
 * to avoid, whereas wrongly reporting "published" would silently skip a real
 * release. Partial publication reports not-published too, which is what keeps
 * the documented resume path reachable.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ROOT, loadReleaseLine } from "./config.mjs";

function registryVersions(name) {
  try {
    const output = execFileSync("npm", ["view", name, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 60_000,
    });
    const parsed = JSON.parse(output);
    // npm answers with a bare string when a package has exactly one version.
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
}

function report() {
  const config = loadReleaseLine();
  const corePath = join(ROOT, config.packages[0].path, "package.json");
  const version = JSON.parse(readFileSync(corePath, "utf8")).version;
  const missing = [];
  for (const spec of config.packages) {
    const versions = registryVersions(spec.name);
    if (versions === null || !versions.includes(version)) {
      missing.push(spec.name);
    }
  }
  process.stdout.write(
    `${JSON.stringify({
      version,
      allPublished: missing.length === 0,
      missing,
    })}\n`,
  );
}

report();
