# @full-self-browsing/concierge-react

## 0.4.0

### Minor Changes

- 2ffb743: Ship `@full-self-browsing/concierge-dom`: registered-element resolve, reveal, and untrusted readback.
- 2ffb743: Ship Concierge 0.4: contract v4 consent kernel, catalog acknowledgement, dispatch observability, DOM and realtime packages, adapter last-event/null-bridge hooks, and the five-package release set.

  Two details worth knowing before you write against `concierge-dom`. An `AnchorRef` now returns the cleanup for the element it attached, so React 19 releases exactly the node each JSX site registered; React 18 ignores the return value and keeps the `ref(null)` protocol. A key holds a set of registrations rather than one, so several simultaneously mounted nodes for one record all stay reachable.

## 0.3.0

### Minor Changes

- Upgrade the runtime guard to Concierge contract v3. Existing provider,
  bridge hook, telemetry, and action-activity APIs remain unchanged.

## 0.2.1

### Patch Changes

- 6b3fba6: Add an opt-in React action overlay with configurable two-color glow, an
  optional Powered by FSB badge, and a concurrency-safe activity hook.
- 6b3fba6: Add FSB-compatible anonymous browser telemetry with origin-wide privacy
  controls and automatic, opt-out React and Svelte runtime mounting.

## 0.2.0

### Minor Changes

- Upgrade the adapter guard and provider types to Concierge contract v2.

## 0.1.0

### Minor Changes

- Ship the consent-gated core together with its reactive React and Svelte adapters.
