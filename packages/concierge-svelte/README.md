<div align="center">

<img src="https://raw.githubusercontent.com/fullselfbrowsing/Concierge/main/assets/concierge-wordmark-horizontal.svg" alt="Concierge" width="280">

# `@fullselfbrowsing/concierge-svelte`

</div>

Svelte 5 context, lifecycle, and snapshot bindings for an existing
[`@fullselfbrowsing/concierge`](https://github.com/fullselfbrowsing/Concierge)
instance and bridge registry.

Version 0.2 is a public preview of contract 2. It supports Svelte 5, requires
Node 22.12 or newer for server rendering, and does not support Edge runtimes in
the 0.2 line.

## Entry points

The package root is server-safe and type-only. It forwards the public core
`Bridge`, `BridgeRegistry`, `Concierge`, and `SnapshotNormalizer` types:

```ts
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
  SnapshotNormalizer,
} from "@fullselfbrowsing/concierge-svelte";
```

Import compiled runtime bindings from the rune-aware client entry:

```ts
import {
  provideConcierge,
  svelteSnapshotNormalizer,
  useConcierge,
  useConciergeBridge,
} from "@fullselfbrowsing/concierge-svelte/client.svelte";
```

## Construct core in application setup

The Svelte package does not call or wrap `createConcierge`. Application setup
constructs the public core objects and explicitly supplies the exported real
snapshot normalizer when core captures its configuration.

```ts
// concierge.svelte.ts
import {
  createBridge,
  createConcierge,
} from "@fullselfbrowsing/concierge";
import type { Bridge } from "@fullselfbrowsing/concierge";
import {
  svelteSnapshotNormalizer,
} from "@fullselfbrowsing/concierge-svelte/client.svelte";

import { bookingActions } from "./actions.js";

export type BookingBridge = Bridge<
  {
    readonly commitBooking: () => void;
  },
  {
    readonly booking: () => {
      readonly traveler: { readonly name: string };
      readonly nights: number;
    };
  }
>;

export const bookingRegistry =
  createBridge<BookingBridge>("booking");

export const concierge = createConcierge({
  stages: [
    {
      id: "booking",
      match: (context) => context.pathname === "/booking",
      actions: bookingActions,
      bridge: bookingRegistry,
    },
  ],
  normalizeSnapshot: svelteSnapshotNormalizer,
});
```

`bookingActions` is the application's existing set of core action
declarations. The adapter does not create those actions or their catalog.

## Provide and register during component initialization

Call `provideConcierge` and `useConciergeBridge` during Svelte component
initialization. `provideConcierge` places the exact supplied object in native
Svelte context; descendants call `useConcierge` to read that same reference.

```svelte
<!-- BookingRoute.svelte -->
<script lang="ts">
  import {
    provideConcierge,
    useConcierge,
    useConciergeBridge,
  } from "@fullselfbrowsing/concierge-svelte/client.svelte";

  import {
    bookingRegistry,
    concierge,
  } from "./concierge.svelte.js";
  import type { BookingBridge } from "./concierge.svelte.js";

  let booking = $state({
    traveler: { name: "Ada" },
    nights: 2,
  });

  const bridge: BookingBridge = {
    actions: {
      commitBooking: () => {
        // Call the application's existing booking function.
      },
    },
    snapshot: {
      booking: () => booking,
    },
  };

  provideConcierge(concierge);
  const currentConcierge = useConcierge();
  useConciergeBridge(() => bookingRegistry, () => bridge);

  if (currentConcierge !== concierge) {
    throw new Error("Unexpected Concierge context.");
  }
</script>
```

The bridge is an ordinary public core `Bridge`, and `bookingRegistry` is the
existing registry returned by public `createBridge`. The snapshot member stays
a getter: after `booking.traveler.name = "Grace"`, a registry read observes
`"Grace"` without a store-shaped wrapper or subscription loop.

## Why the snapshot normalizer is required

Svelte's `$state` returns a deeply reactive proxy. Storing that proxy as the
reviewed consent snapshot would store a live view: later nested mutations would
move both the current value and the supposed historical value, making drift
invisible.

`svelteSnapshotNormalizer` delegates directly to `$state.snapshot`. With
`normalizeSnapshot: svelteSnapshotNormalizer` configured at `createConcierge`
time, core stores a detached review-time value while the bridge getter remains
live. If nested `$state` data changes after review, confirmation returns the
exact `consent_stale` failure and the consequential handler is not entered.

Do not replace this seam with identity, `structuredClone`, JSON serialization,
or a hand-written clone. The normalizer is intentionally exported from
`.svelte.ts` source so the consumer's Svelte compiler owns the rune transform.

## Lifecycle guarantees

- `provideConcierge` and `useConcierge` use native `setContext`/`getContext` and
  carry the supplied `Concierge` reference without a store or copied state.
- `useConciergeBridge` accepts registry and bridge getters and owns one native
  `$effect`. After mount and whenever either getter's reactive value changes, it
  reads the current objects, runs the package guards, calls
  `registry.register(bridge)`, and returns that exact unsubscriber as teardown.
- Svelte runs the teardown before the effect re-executes and when the component
  is destroyed. The core registry's monotonic token prevents an old teardown
  from removing a newer registration.
- `$effect` does not execute during server rendering, so SSR performs zero
  registrations without a browser-global branch.

## Ownership and security boundary

Before client registration, the effect invokes core's singleton guard and
checks the adapter's embedded contract-version literal. These are client
compatibility and integrity defenses against duplicate core copies and
adapter/core skew.

They do not authenticate anyone and do not provide server authorization. A
server must treat client actions, consent assertions, receipts, and results as
untrusted, independently authenticate the current principal, and authorize the
exact action and payload under current server policy immediately before any
protected effect.

The Svelte adapter owns only native context, effect-scoped registration, and
the real snapshot normalizer. Application and core code retain ownership of
action declarations, catalogs, dispatch, sessions, consent, transports,
scheduling, and results.

## License

MIT © Full Self Browsing
