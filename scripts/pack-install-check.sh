#!/usr/bin/env bash
# scripts/pack-install-check.sh — PKG-02
#
# Packs @full-self-browsing/concierge, installs the tarball into a throwaway
# project that is NOT part of this workspace, typechecks a consumer-side probe
# against the SHIPPED declarations with skipLibCheck off, and imports the
# shipped runtime.
#
# Why a script rather than steps in a workflow file: CI and a developer must run
# the same bytes. CI calls `pnpm run check:pack`, which is this file.
#
# What this proves that nothing else in the repo can: `pnpm build` proves the
# package compiles, `publint` and `attw` prove the manifest describes the files
# correctly, but only an actual install into a foreign project proves that what
# a consumer resolves is what we think we published.

set -euo pipefail

# Resolved from this file's own location so the script behaves identically no
# matter which directory it is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$REPO_ROOT/packages/concierge"
PKG_NAME="@full-self-browsing/concierge"

START_EPOCH=$(date +%s)

# The scratch project MUST live outside the repository tree.
# pnpm-workspace.yaml globs `packages/*` and `examples/*`; a scratch directory
# created under either is absorbed into the workspace, and pnpm then links the
# local workspace copy instead of installing the tarball. The harness would go
# green while testing nothing at all, which is the exact failure family this
# phase exists to close.
OUT="$(mktemp -d)"

# Cleanup on every exit path: success, failure, and interrupt.
trap 'rm -rf "$OUT"' EXIT

echo "==> scratch project: $OUT"

echo "==> building $PKG_NAME"
pnpm --filter "$PKG_NAME" build

# `pnpm pack --pack-destination` prints the tarball path as its last output
# line, so the last line is the reliable capture point.
echo "==> packing"
TGZ="$(cd "$PKG_DIR" && pnpm pack --pack-destination "$OUT" | tail -1)"

if [ ! -f "$TGZ" ]; then
  echo "FAIL: pnpm pack did not produce a tarball at: $TGZ" >&2
  exit 1
fi

echo "==> tarball: $TGZ"
echo "==> tarball bytes: $(wc -c < "$TGZ" | tr -d ' ')"

# Inspect the archive itself before installing it. Test-only helpers must never
# become reachable through an accidentally widened `files` allow-list.
echo "==> tarball entries"
TAR_ENTRIES="$(tar -tzf "$TGZ")"
printf '%s\n' "$TAR_ENTRIES"
TAR_ENTRY_COUNT="$(printf '%s\n' "$TAR_ENTRIES" | sed '/^$/d' | wc -l | tr -d ' ')"
TAR_ENTRY_SHA256="$(printf '%s\n' "$TAR_ENTRIES" | shasum -a 256 | awk '{print $1}')"
if printf '%s\n' "$TAR_ENTRIES" | grep -Eq 'stub-transport|(^|/)package/(test|test-d)(/|$)|(^|/)package/fixtures(/|$)|test/fixtures'; then
  echo "FAIL: [RED:P01:stub-tarball-exclusion] tarball contains a test fixture or stub transport" >&2
  exit 1
fi
for required in \
  package/dist/telemetry/index.js \
  package/dist/telemetry/index.d.ts \
  package/dist/telemetry/index.js.map \
  package/dist/telemetry/index.d.ts.map
do
  if ! printf '%s\n' "$TAR_ENTRIES" | grep -Fxq "$required"; then
    echo "FAIL: packed browser telemetry subpath is missing $required" >&2
    exit 1
  fi
done

cd "$OUT"

cat > package.json <<'JSON'
{
  "name": "concierge-install-probe",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
JSON

# Two settings carry the whole harness, and both are easy to get wrong.
#
# "module": "node20" with NO "moduleResolution" key at all.
# TS 7.0.2 REJECTS "moduleResolution": "node20" outright — 'Argument for
# --moduleResolution option must be: node16, nodenext, bundler'. Setting
# "module": "node20" alone implies moduleResolution: "node16" plus
# moduleDetection: "force", which is the strictest realistic consumer setting.
# Adding the moduleResolution key back does not tighten anything; it makes the
# scratch project fail to configure.
#
# "skipLibCheck": false is the value of this harness.
# The repo's own tsconfig.base.json sets skipLibCheck true, so nothing in this
# repository ever typechecks the ~53 kB shipped index.d.ts — it is trusted.
# Turning the flag off here checks it in full, from a program that can see only
# what the tarball actually ships.
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "node20",
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noEmit": true,
    "skipLibCheck": false
  },
  "include": ["probe.ts"]
}
JSON

cp "$PKG_DIR/test/fixtures/probe.ts" ./probe.ts

# npm, not `pnpm add`.
# npm avoids the workspace and the pnpm store entirely, produces the flat
# node_modules a real consumer has, and resolves @standard-schema/spec from the
# registry — which is the point, because the shipped .d.ts imports from it.
#
# typescript is installed INTO the scratch project so the consumer typechecks
# with its own compiler. A repo-relative tsc would resolve repo node_modules and
# mask a dependency the tarball forgot to declare.
echo "==> installing tarball + typescript@7.0.2 with npm"
if ! npm install --no-audit --no-fund "$TGZ" typescript@7.0.2; then
  echo "FAIL: npm install failed inside the scratch project." >&2
  echo "If the npm registry is unreachable, this is a NETWORK failure and not a packaging defect." >&2
  echo "Re-run with connectivity before treating it as a build regression." >&2
  exit 1
fi

echo "==> installed dependencies:"
npm ls --depth=0 || true

# The scratch project's own compiler, against the shipped declarations.
echo "==> typechecking the probe against the shipped .d.ts (skipLibCheck: false)"
./node_modules/.bin/tsc -p tsconfig.json

# Types are not enough: a declaration file can be perfect while the runtime
# binding was erased from dist/index.js. This exercises the shipped runtime.
echo "==> importing the shipped runtime"
node --input-type=module -e '
  const m = await import("@full-self-browsing/concierge");
  const telemetry = await import("@full-self-browsing/concierge/telemetry");
  if (m.MESSAGE_MAX_CHARS !== 180) {
    throw new Error("runtime binding erased: MESSAGE_MAX_CHARS is " + String(m.MESSAGE_MAX_CHARS));
  }
  if (typeof m.createSession !== "function") {
    throw new Error("runtime binding erased: createSession is " + typeof m.createSession);
  }
  if (typeof m.createConcierge !== "function") {
    throw new Error("runtime binding erased: createConcierge is " + typeof m.createConcierge);
  }
  const concierge = m.createConcierge({ stages: [] });
  if (typeof concierge.dispatch !== "function") {
    throw new Error("runtime createConcierge did not return a callable artifact");
  }
  if (
    !Object.isFrozen(m.CONSENT_GRADE_ORDER) ||
    JSON.stringify(m.CONSENT_GRADE_ORDER) !== JSON.stringify(["none", "delivered", "relayed", "attested"])
  ) {
    throw new Error("runtime consent grade order is missing, mutable, or reordered");
  }
  if (
    !Object.isFrozen(m.USER_CANCELLED) ||
    m.USER_CANCELLED.ok !== false ||
    m.USER_CANCELLED.reason !== "cancelled"
  ) {
    throw new Error("runtime USER_CANCELLED contract drifted");
  }
  if (
    !Object.isFrozen(m.USER_DECLINED) ||
    m.USER_DECLINED.ok !== false ||
    m.USER_DECLINED.reason !== "declined"
  ) {
    throw new Error("runtime USER_DECLINED contract drifted");
  }
  const telemetryExports = [
    "getConciergeTelemetryStatus",
    "mountConciergeTelemetry",
    "onConciergeTelemetryStatusChange",
    "setConciergeTelemetryEnabled",
  ];
  if (JSON.stringify(Object.keys(telemetry).sort()) !== JSON.stringify(telemetryExports)) {
    throw new Error("telemetry runtime export drift");
  }
  const noOpUnmount = telemetry.mountConciergeTelemetry(concierge);
  if (typeof noOpUnmount !== "function") {
    throw new Error("telemetry SSR mount did not fail closed");
  }
  noOpUnmount();
'

echo "==> wall time: $(( $(date +%s) - START_EPOCH ))s"
echo "PACK_EVIDENCE tar_entries=$TAR_ENTRY_COUNT tar_entries_sha256=$TAR_ENTRY_SHA256 forbidden_entries=absent foreign_typecheck=passed foreign_runtime=passed"
echo "PASS: a foreign project installed the tarball, typechecked the shipped declarations, and imported the runtime"
