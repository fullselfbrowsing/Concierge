/**
 * packages/concierge/test/fixtures/probe.ts — PKG-02, the consumer-side type probe.
 *
 * This file is never compiled by this repository. `scripts/pack-install-check.sh`
 * copies it into a `mktemp -d` scratch project outside the repo, where it is
 * compiled by that project's own `typescript@7.0.2` against the **shipped**
 * `dist/index.d.ts` from a real packed tarball, with `skipLibCheck: false`.
 *
 * Two consequences follow, and both are the reason this file looks unlike
 * anything in `test-d/`:
 *
 * 1. It uses plain type annotations rather than `Expect<Equals<…>>`. The
 *    `test-d` helpers live in this repo's program; a foreign program cannot see
 *    them, and installing them would defeat the point of compiling against only
 *    what the tarball ships.
 * 2. It **exports** every binding, unlike every `test-d` file, which export
 *    nothing. Those files are script-shaped on purpose so `isolatedDeclarations`
 *    has nothing to emit for them. This one is a module in a program that has no
 *    `isolatedDeclarations` interaction with this repo at all, so exporting is
 *    free — and it is what stops TS 7 treating the declarations as unused.
 *
 * The scratch project compiles under `lib: ["ES2022"]` with no `@types/node`,
 * the same no-DOM discipline core itself holds. So there is no `console` call
 * anywhere below: `console.log` is `TS2584` under that lib set, and it bit the
 * first draft of this harness. The runtime half of the check is a separate
 * `node --input-type=module -e` in the script, where `console` is available and
 * irrelevant.
 *
 * `MESSAGE_MAX_CHARS`'s literal type is the strongest single assertion available
 * today, because it is the one thing that degrades *silently*: an
 * `isolatedDeclarations` slip widens it to `number`, the build stays green, the
 * repo's own type tests stay green, and only a consumer compiling against the
 * shipped `.d.ts` can see it. That is exactly what this file is.
 */

import {
  MESSAGE_MAX_CHARS,
  CONTRACT_VERSION,
  assertSingleInstance,
} from "@fullselfbrowsing/concierge";
import type {
  ActionResult,
  ConsentAck,
  Transport,
} from "@fullselfbrowsing/concierge";

/**
 * The shipped interface is constructible from a plain object literal under
 * `strict` and `exactOptionalPropertyTypes: true`. `reason` is omitted here
 * deliberately — its declared `| undefined` is what makes omission legal.
 */
export const r: ActionResult = { ok: true, message: "ok" };

/**
 * The whole point of the harness, in one line. If the emitted declaration ever
 * widens to `declare const MESSAGE_MAX_CHARS: number`, this is `TS2322`.
 */
export const n: 180 = MESSAGE_MAX_CHARS; // the literal type survived into the shipped .d.ts

/** Same guard for the contract version, which 02-06 left unannotated in source. */
export const v: 1 = CONTRACT_VERSION;

/**
 * A value import of the one function the package actually executes. Annotating
 * it pins the shipped signature as zero-argument and `void`-returning, and
 * importing it as a *value* proves the runtime binding survived the build and
 * is not a type-only export.
 */
export const f: () => void = assertSingleInstance;

/**
 * Two type-only imports that are never instantiated. They exist so that
 * `skipLibCheck: false` has to fully resolve the declaration bodies these names
 * reach — `ConsentAck` pulls in the branded server-challenge machinery and
 * `Transport` pulls in the tool/batch surface, so between them a large share of
 * the ~53 kB `index.d.ts` is checked rather than merely parsed.
 */
export type ProbeAck = ConsentAck;
export type ProbeTransport = Transport;
