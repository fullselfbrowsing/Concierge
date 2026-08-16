# Anonymous usage telemetry

Concierge's browser telemetry is enabled by default when a React
`ConciergeProvider` or Svelte `provideConcierge` runtime is mounted. Vanilla
browser integrations opt in to mounting the runtime by calling
`mountConciergeTelemetry`. The framework-neutral package root performs no
storage, timer, DOM, or network work; all telemetry code is isolated in
`@full-self-browsing/concierge/telemetry`.

## What is sent

After a 30-second installation grace period and then approximately every five
minutes, Concierge sends events to FSB's anonymous statistics collector. Each
event contains exactly these ten fields:

| Field | Concierge value |
| --- | --- |
| `event_id` | A fresh random UUIDv4 |
| `install_uuid` | A random identity scoped to this browser and web origin |
| `ts_minute` | The current time floored to one-minute precision |
| `mcp_client` | `Concierge` |
| `model` | `unknown` |
| `tokens_in` | A fixed estimate of 100 per accepted dispatch |
| `tokens_out` | A fixed estimate of 200 per accepted dispatch |
| `active_agent_count` | Mounted app runtimes across this origin's tabs, at most 64 |
| `event_type` | `install_announce` or `periodic` |
| `active_count_version` | `2` |

Idle and installation heartbeats carry zero token estimates. Accepted root and
child dispatches count whether they later succeed, fail, or are cancelled. An
exact core-deduplicated retry emits no second accepted occurrence and therefore
adds no second estimate.

Concierge never reads or sends action names, arguments, results, schemas,
stages, session or account identifiers, page URLs, DOM content, deployment
names, or app names. The fixed 100/200 estimate deliberately does not depend on
argument or result length. It is an activity estimate, not measured model
usage.

Browsers normally attach a transient HTTP `Origin` header to cross-origin
requests even when `referrerPolicy: "no-referrer"` is used. JavaScript cannot
remove that browser-controlled header. FSB does not log or persist `Origin` or
`Referer`. The server derives a coarse region from the connection IP for
k-anonymous aggregate region totals, then discards the plaintext IP; neither
the raw IP nor a per-install region profile is retained.

## Local coordination and retention

The installation identity, pending fixed estimates, event queue, runtime
leases, one-tab flush lease, and server-deletion retries live in origin-scoped
IndexedDB. The only local-storage value is the shared opt-out marker, allowing
every open tab to stop before starting asynchronous work. Separate origins get
separate identities, and clearing site data creates a new identity.

Each event request also receives a renewable IndexedDB in-flight lease before
network I/O begins. Opt-out waits to forget the installation until every live
request lease for that identity has settled across the origin's tabs. A lease
from a crashed or permanently suspended tab expires after ten minutes, matching
the runtime crash window, so it cannot block deletion indefinitely.

Hidden tabs remain active while the browser lets them renew their lease each minute.
An abandoned or suspended runtime expires after ten minutes. Events expire
locally after 24 hours, are capped at 200, and are tried at most five times.
Requests contain at most 50 events and 30 KiB, and each request attempt has a
30-second hard deadline. Timed-out events stay in the bounded queue, while
timed-out server deletion requests stay in the durable retry schedule. Server
raw-event and per-installation retention matches FSB's published policy: raw
events are kept for 7 days, daily per-installation rollups for 365 days, and
global daily aggregates indefinitely. Public global aggregates contain only
combined counts and totals.

## Stop collection and erase attributable data

Use the browser-only API from an origin's privacy controls:

```ts
import {
  getConciergeTelemetryStatus,
  onConciergeTelemetryStatusChange,
  setConciergeTelemetryEnabled,
} from "@full-self-browsing/concierge/telemetry";

await setConciergeTelemetryEnabled(false);
const status = await getConciergeTelemetryStatus();
const unsubscribe = onConciergeTelemetryStatusChange(renderTelemetryStatus);
```

Opting out sets the cross-tab stop marker first, removes runtime leases, and
purges pending usage and events. The old UUID is retained only in a
deletion-retry queue and sent to `/api/telemetry/forget`; retries continue on
later visits while collection is off. Re-enabling creates a fresh identity and
never uploads activity from the disabled period. Global Privacy Control is
enforced the same way and cannot be overridden while it is active. If browser
storage is unavailable, telemetry fails closed without affecting dispatch.

The forget operation erases attributable raw and per-installation server data.
Already-created global aggregates cannot be reversed because they no longer
contain an installation identity.

An individual integration can set `telemetry={false}` on React's provider or
pass `{ telemetry: false }` to Svelte's `provideConcierge` to leave that mount
uninstrumented without changing the origin-wide preference.
