#!/usr/bin/env bash
# scripts/node-floor-check.sh — PKG-03
#
# Installs the packed tarball with npm and imports it on the EXACT Node version
# this package declares as its floor — not on whatever newer runtime the
# developer happens to have.
#
# The distinction is the entire requirement. `engines.node` is a promise made to
# consumers, and a promise checked only on the developer's runtime is a promise
# nobody has ever tested. Two mechanisms make it a checked claim here: the floor
# runtime is downloaded at an exact triple rather than resolved from a range,
# and the job asserts its own `process.version` once it is running.
#
# Same file locally and in CI, invoked as `pnpm run check:node-floor`.

set -euo pipefail

FLOOR=22.12.0
PKG_NAME="@full-self-browsing/concierge"

# Resolved from this file's own location so the script behaves identically no
# matter which directory it is invoked from.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG_DIR="$REPO_ROOT/packages/concierge"

START_EPOCH=$(date +%s)

echo "==> developer runtime: $(node --version)"

# ---------------------------------------------------------------------------
# Phase one — obtain the exact floor runtime.
# ---------------------------------------------------------------------------

# The official tarball is used directly. No third-party Node version manager is
# installed, depended on, or required: the tarball has no install footprint,
# leaves no shell hook behind, and behaves identically on a laptop and on a CI
# runner. A version manager would add a repo dependency to test a runtime.
ARCH="$(uname -m | sed 's/x86_64/x64/; s/aarch64/arm64/')"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
DIR="${TMPDIR:-/tmp}/node-v$FLOOR"

if [ -x "$DIR/bin/node" ]; then
  echo "==> floor runtime cache: warm ($DIR)"
else
  echo "==> floor runtime cache: cold, downloading node-v$FLOOR-$OS-$ARCH"
  mkdir -p "$DIR"
  if ! curl -sfL "https://nodejs.org/dist/v$FLOOR/node-v$FLOOR-$OS-$ARCH.tar.xz" \
    | tar -xJ -C "$DIR" --strip-components=1; then
    echo "FAIL: could not download the floor runtime from nodejs.org." >&2
    echo "If nodejs.org is unreachable, this is a NETWORK failure and not a packaging defect." >&2
    rm -rf "$DIR"
    exit 1
  fi
fi

# Fail loudly rather than silently proceeding on whatever the cache happens to
# hold. A stale or truncated cache entry is the one way this script could go
# green while testing the wrong runtime.
FOUND="$("$DIR/bin/node" --version)"
if [ "$FOUND" != "v22.12.0" ]; then
  echo "FAIL: cached runtime at $DIR reports $FOUND, not v22.12.0" >&2
  exit 1
fi
echo "==> floor runtime: $FOUND"

# ---------------------------------------------------------------------------
# Phase two — build and pack under the DEVELOPER's runtime, before switching.
# ---------------------------------------------------------------------------

OUT="$(mktemp -d)"

# Cleanup on every exit path: success, failure, and interrupt.
trap 'rm -rf "$OUT"' EXIT

echo "==> building and packing $PKG_NAME under $(node --version)"
pnpm --filter "$PKG_NAME" build
TGZ="$(cd "$PKG_DIR" && pnpm pack --pack-destination "$OUT" | tail -1)"

if [ ! -f "$TGZ" ]; then
  echo "FAIL: pnpm pack did not produce a tarball at: $TGZ" >&2
  exit 1
fi
echo "==> tarball: $TGZ"

# ---------------------------------------------------------------------------
# Phase three — the floor runtime. Everything below runs on it.
# ---------------------------------------------------------------------------

cd "$OUT"
export PATH="$DIR/bin:$PATH"

# NOTHING BELOW THIS LINE MAY INVOKE pnpm, and that is a finding rather than a
# preference. pnpm@11.17.0 refuses to start on Node 22.12.0:
#
#   ERROR: This version of pnpm requires at least Node.js v22.13
#
# confirmed at the manifest level by `npm view pnpm@11.17.0 engines`, which
# reports {"node":">=22.13"}. A floor job written with pnpm therefore fails on
# the TOOLING rather than on the artifact, and the obvious remedy — raising
# engines.node to >=22.13 — abandons the requirement while appearing to fix it.
#
# The two numbers are not the same kind of thing and MUST NOT be harmonized:
# engines.node is the PACKAGE's floor, a promise to consumers about where the
# published artifact runs. pnpm's >=22.13 is a CONTRIBUTOR requirement about
# where this repo is developed. Leave engines.node at >=22.12.0.
#
# npm and node only from here down. npm ships inside the Node tarball, so the
# floor runtime brings its own.

# npm init -y rather than a hand-written manifest: this project has no content
# of its own, and the fewer authored bytes stand between the tarball and the
# import, the less there is to get wrong.
npm init -y > /dev/null

echo "==> installing the tarball with npm on the floor runtime"
if ! npm install --no-audit --no-fund "$TGZ"; then
  echo "FAIL: npm install failed on the floor runtime." >&2
  echo "If the npm registry is unreachable, this is a NETWORK failure and not a packaging defect." >&2
  exit 1
fi

# The assertion that makes the pin a checked claim rather than a hoped-for one.
# A version SPEC of 22.12 resolves to the newest 22.12.x and a spec of 22 to the
# newest 22.x — which is exactly the "developer's newer runtime" this
# requirement exists to exclude. Only a runtime that reports its own complete
# triple has been pinned.
echo "==> asserting the runtime is the floor"
node -e "if(process.version!=='v22.12.0') throw new Error('floor drifted: '+process.version)"
node --version

# The artifact itself: import it, run the one function it executes, and confirm
# a value export survived the build. Types were already checked by check:pack;
# this is the runtime half, on the floor.
echo "==> importing the artifact on the floor runtime"
node --input-type=module -e '
  const m = await import("@full-self-browsing/concierge");
  m.assertSingleInstance();
  if (m.MESSAGE_MAX_CHARS !== 180) {
    throw new Error("runtime binding erased: MESSAGE_MAX_CHARS is " + String(m.MESSAGE_MAX_CHARS));
  }
'

echo "==> wall time: $(( $(date +%s) - START_EPOCH ))s"
echo "PASS: the published artifact installed with npm and imported on a pinned $FOUND"
