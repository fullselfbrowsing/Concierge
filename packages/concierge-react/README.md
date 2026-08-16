<div align="center">

<img src="https://raw.githubusercontent.com/fullselfbrowsing/Concierge/main/assets/concierge-wordmark-horizontal.svg" alt="Concierge" width="280">

# `@full-self-browsing/concierge-react`

</div>

React lifecycle bindings and optional action-state chrome for an existing
[`@full-self-browsing/concierge`](https://github.com/fullselfbrowsing/Concierge)
instance and bridge registry.

Version 0.2 is a public preview of contract 2. It supports React 18 and 19,
requires Node 22.12 or newer for server rendering, and does not support Edge
runtimes in the 0.2 line.

## Entry points

The package root is server-safe and type-only. It forwards the public core
`Bridge`, `BridgeRegistry`, and `Concierge` types without importing React
runtime code:

```ts
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
} from "@full-self-browsing/concierge-react";
```

Import runtime bindings only from the client entry:

```tsx
import {
  ConciergeActivityOverlay,
  ConciergeProvider,
  useConcierge,
  useConciergeActivity,
  useConciergeBridge,
  useConciergeValue,
} from "@full-self-browsing/concierge-react/client";
```

The client entry carries the `"use client"` directive. The package root and
the framework-neutral core do not.

## Construct core in application setup

The React package does not call or wrap `createConcierge`. Build the core
objects in application code with the public `createBridge` and
`createConcierge` exports, then inject those exact objects into React.

```ts
// concierge.ts
import {
  createBridge,
  createConcierge,
} from "@full-self-browsing/concierge";
import type { Bridge } from "@full-self-browsing/concierge";

import { resultsActions } from "./actions.js";

export type ResultsBridge = Bridge<
  {
    readonly applyFilter: (
      key: string,
      values: readonly string[],
    ) => void;
  },
  {
    readonly selectedBrands: () => readonly string[];
  }
>;

export const resultsRegistry =
  createBridge<ResultsBridge>("results");

export const concierge = createConcierge({
  stages: [
    {
      id: "results",
      match: (context) => context.pathname === "/results",
      actions: resultsActions,
      bridge: resultsRegistry,
    },
  ],
});
```

`resultsActions` above is the application's existing set of core action
declarations. The adapter neither declares those actions nor assembles their
catalog.

## Provide, read, and register

Pass a plain current value to `useConciergeValue`. The hook owns the ref and
returns a stable getter, so application code does not maintain a parallel ref.
Construct an ordinary core `Bridge`, then give that bridge and the existing
registry to `useConciergeBridge`.

```tsx
// ResultsRoute.tsx
import { useMemo } from "react";

import {
  ConciergeProvider,
  useConcierge,
  useConciergeBridge,
  useConciergeValue,
} from "@full-self-browsing/concierge-react/client";

import {
  concierge,
  resultsRegistry,
} from "./concierge.js";
import type { ResultsBridge } from "./concierge.js";

type ResultsBindingProps = {
  readonly selectedBrands: readonly string[];
  readonly applyFilter: (
    key: string,
    values: readonly string[],
  ) => void;
};

function ResultsBinding({
  selectedBrands,
  applyFilter,
}: ResultsBindingProps) {
  const currentConcierge = useConcierge();
  const readSelectedBrands = useConciergeValue(selectedBrands);

  const bridge = useMemo<ResultsBridge>(
    () => ({
      actions: { applyFilter },
      snapshot: { selectedBrands: readSelectedBrands },
    }),
    [applyFilter, readSelectedBrands],
  );

  useConciergeBridge(resultsRegistry, bridge);

  // `useConcierge` returns the exact object supplied to the provider.
  if (currentConcierge !== concierge) {
    throw new Error("Unexpected Concierge provider.");
  }

  return null;
}

export function ResultsRoute(props: ResultsBindingProps) {
  return (
    <ConciergeProvider concierge={concierge}>
      <ResultsBinding {...props} />
    </ConciergeProvider>
  );
}
```

`ConciergeProvider` carries the supplied reference through React context and,
by default, mounts the browser-only anonymous telemetry runtime. Pass
`telemetry={false}` to leave this provider's runtime uninstrumented. Multiple
providers for the same Concierge object in one document share one runtime, so
React StrictMode does not inflate the active-instance count. See the
[telemetry privacy contract](https://github.com/fullselfbrowsing/Concierge/blob/main/docs/privacy.md)
for the exact payload and origin-wide opt-out API.

## Optional action visuals

`ConciergeActivityOverlay` is opt-in, pointer-transparent UI chrome driven only
by `onDispatch`. It keeps overlapping parent and child dispatches active
independently, removes itself after the final terminal event, and never enters
dispatch control flow.

```tsx
<ConciergeProvider concierge={concierge}>
  <ConciergeActivityOverlay
    glow={{
      color: "#ff6b35",
      secondaryColor: "#635bff",
      intensity: 0.72,
    }}
    poweredByFSB
  />
  <App />
</ConciergeProvider>
```

Rendering the component enables the glow by default. Set `glow={false}` to
disable it. The `poweredByFSB` badge defaults to `false` and appears only while
an action is active. When enabled, its position defaults to `bottom-left`; pass
an object with `position`, `color`, `backgroundColor`, and `borderColor` to
override its presentation. Both layers use fixed positioning, ignore pointer
input, and accept a shared `zIndex`.

For application-owned visuals, `useConciergeActivity()` exposes the same
concurrency-safe active boolean without rendering anything.

## Lifecycle guarantees

- `ConciergeProvider` subscribes once through `onDispatch` before descendant
  layout effects and shares its activity state with every
  `useConciergeActivity` consumer. Activity is keyed by `dispatchId`, so
  repeated lifecycle phases do not inflate activity and one terminal child
  cannot hide an active parent.
- `useConciergeBridge` calls `registry.register(bridge)` only from
  `useEffect` and returns that exact registration unsubscriber as cleanup.
- React StrictMode's development sequence—setup, cleanup, setup—therefore
  leaves the current registration live. The core registry's monotonic token
  makes a retained stale cleanup an idempotent no-op, while final unmount
  removes the live registration.
- `useConciergeValue` mirrors the plain value after commit and returns one
  stable getter. Reads through a registered bridge observe the latest committed
  render, not the value captured when the bridge was first created.
- Passive effects do not execute during server rendering. Importing the
  server-safe root or rendering the client binding on the server performs zero
  bridge registrations and needs no `window` or `document` branch.

## Ownership and security boundary

Before client registration, the hook invokes core's singleton guard and checks
the adapter's embedded contract-version literal. Those checks are client
compatibility and integrity defenses: they catch a duplicate core module graph
or an adapter/core contract mismatch before registration can split bridge,
deduplication, or consent state.

They are not identity checks and do not provide server authorization. Treat
every client-originated action, consent assertion, receipt, and result as
untrusted at the server boundary. A relying server must independently
authenticate the current principal and authorize the exact action and payload
under current server policy immediately before any protected effect.

The React adapter owns context propagation, committed-value mirroring,
effect-scoped bridge registration, and optional observer-driven action chrome.
Application and core code continue to own action declarations, catalogs,
dispatch, sessions, consent, transports, scheduling, and results.

## License

MIT © Full Self Browsing
