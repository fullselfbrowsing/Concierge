# `@full-self-browsing/concierge-realtime`

Realtime session runtime for
[`@full-self-browsing/concierge`](https://github.com/fullselfbrowsing/Concierge).
It opens a bidirectional event channel, hands core a `Transport` with
`acknowledgesCatalog: true`, and owns delivery evidence, turn identity, and
interruption. It declares no actions and actuates nothing.

A realtime session is a **client-authority** path. This package signs nothing
and is not server authorization. Irreversible work still needs a server-side
check.

```ts
import { createRealtimeSession } from "@full-self-browsing/concierge-realtime";
import { createOpenAIRealtimeProvider } from "@full-self-browsing/concierge-realtime/openai";
import { createWebRTCRealtimeChannel } from "@full-self-browsing/concierge-realtime/webrtc";

// Example: a CRM posts SDP from `negotiate` and calls `beginTurn` from a keypress.
const channel = createWebRTCRealtimeChannel({ negotiate });
const provider = createOpenAIRealtimeProvider({ sessionType: "realtime" });
const handle = await createRealtimeSession({
  concierge,
  channel,
  provider,
  presentOutcome,
  initialContext,
  sessionId: "session-1",
  turnSource: "explicit",
});
```

Subpaths:

- `.` — vendor-neutral runtime, ledgers, and stop-intent classifier (DOM-free)
- `./openai` — provider that consumes core's `openai-realtime` codec
- `./webrtc` — browser peer-connection channel (mic, peer, audio element only)
- `./websocket` — browser WebSocket channel

Requires Node 22.12 or newer and core contract v4.
