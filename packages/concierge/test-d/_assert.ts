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

// Conditional-identity formulation — invariant, not the naive bidirectional-extends form.
// The naive form silently equates `{ a?: string }` with `{ a: string | undefined }`, a
// distinction `exactOptionalPropertyTypes` makes load-bearing throughout this phase.
export type Equals<A, B> =
  (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2 ? true : false;

export type Assignable<From, To> = [From] extends [To] ? true : false;

export type Not<T extends boolean> = T extends true ? false : true;
