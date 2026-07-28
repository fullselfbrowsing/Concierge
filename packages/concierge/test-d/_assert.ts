// Phase 1's only assertion mechanism. There is no test runner and there will not be one
// until Phase 2, so `tsc --noEmit` is the entire verification apparatus and these four
// aliases are how a type invariant is phrased as something that can go red.
//
// Predicates, not `@ts-expect-error`. A directive suppresses ANY error on the line that
// follows it — including an unrelated typo — so a directive written to prove that a bad
// value is rejected can pass green for the wrong reason, and TypeScript offers no way to
// scope a directive to an error code. `Expect<...>` fails with TS2344 and puts the alias
// name on the echoed source line, so a failure says which guarantee broke. Name every
// assertion after the invariant it guards; that name is the only carrier of meaning in
// these diagnostics.
//
// Reserve `@ts-expect-error` for object-literal freshness (excess properties), which
// predicates cannot model: `Assignable<{...; extra: 1}, T>` evaluates to `true`.

export {}; // makes this file's module status unconditional rather than dependent on what it declares

export type Expect<T extends true> = T;

// Conditional-identity formulation. Do NOT "simplify" this to the naive bidirectional
// `A extends B ? (B extends A ? true : false) : false` — that form is distributive, so it
// returns `boolean` rather than a decision whenever an operand is a union or `any`, and
// `Expect<boolean>` fails just like `Expect<false>`. Measured under this repo's flags:
//
//                                              conditional-identity | naive
//   Equals<string | number, number | string>            true        | boolean  ← wrong
//   Equals<any, string>                                 false       | boolean  ← wrong
//   Equals<{ a?: string }, { a: string | undefined }>   false       | false    ← same
//
// Note the third row: both forms distinguish the optional-vs-`undefined` pair, because
// `exactOptionalPropertyTypes` already blocks that assignability. The reason to prefer the
// conditional-identity form is the first two rows, not that one.
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type Assignable<From, To> = [From] extends [To] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;
