# Realtime session package

`@full-self-browsing/concierge-realtime` opens a bidirectional event channel,
hands core a `Transport` with `acknowledgesCatalog: true`, and owns delivery
evidence, turn identity, and interruption. It declares no actions.

The core `@full-self-browsing/concierge/openai-realtime` entry remains a
protocol codec only. The realtime package consumes that codec; it does not fork
it.

```ts
import { createRealtimeSession } from "@full-self-browsing/concierge-realtime";
import { createOpenAIRealtimeProvider } from "@full-self-browsing/concierge-realtime/openai";
import { createWebRTCRealtimeChannel } from "@full-self-browsing/concierge-realtime/webrtc";

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

Tests should drive the session through a stub channel rather than a live peer
connection. A WebRTC path still needs an application-owned `negotiate` that
posts SDP and returns the remote answer. The package never fetches credentials
or inspects transcripts.

CI does not yet run Vitest browser mode or Playwright against a live
`RTCPeerConnection`. `./webrtc` and `./websocket` ship a fake-peer unit suite
instead; that is the current release gate for those subpaths.

See [openai-realtime.md](./openai-realtime.md) for the codec-only contract.
