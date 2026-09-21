# @full-self-browsing/concierge-dom

## 0.4.0

### Minor Changes

- 2ffb743: Ship `@full-self-browsing/concierge-dom`: registered-element resolve, reveal, and untrusted readback.
- 2ffb743: Ship Concierge 0.4: contract v4 consent kernel, catalog acknowledgement, dispatch observability, DOM and realtime packages, adapter last-event/null-bridge hooks, and the five-package release set.

  Two details worth knowing before you write against `concierge-dom`. An `AnchorRef` now returns the cleanup for the element it attached, so React 19 releases exactly the node each JSX site registered; React 18 ignores the return value and keeps the `ref(null)` protocol. A key holds a set of registrations rather than one, so several simultaneously mounted nodes for one record all stay reachable.

## 0.3.0

### Minor Changes

- Introduce the package identity for the five-package Concierge 0.4 set.
