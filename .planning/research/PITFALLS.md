# Pitfalls Research

**Domain:** Framework-agnostic TypeScript SDK for consent-gated, in-app AI agent actuation
**Researched:** 2026-07-27
**Confidence:** HIGH on security (OWASP 2026, peer-reviewed attack papers, vendor docs); HIGH on library engineering (official specs + vendor docs); MEDIUM on adoption failure modes (industry write-ups, one direct prior-art post-mortem)

---

## How to read this document

The source system's own gotchas (root JSON Schema type, non-async dispatch, circular-ref dedup keys, identity-guarded unsubscribers, getter snapshots, user-turn binding, arm-on-delivery) are already encoded in `PROJECT.md` and `types.ts`. **They are not repeated here.** Everything below is a failure mode that system did *not* hit — because it was single-transport, single-framework, single-tenant, client-only, and never published to npm.

Ordered by **cost to fix late**. P1–P8 are contract-shaped: they change `types.ts`, the emitted catalog, or the consent state machine. Fixing them after v0.1 means a major version and every adopter rewrites. P9 onward get progressively cheaper.

**The headline finding is P1.** It is an adversarial assessment of the Core Value and it concludes that one half of the consent design is sound and the other half is theater.

---

## Critical Pitfalls

### P1: The readback never reaches the human — `consentGrade: "perceived"` measures the wrong event

**What goes wrong:**

Concierge's consent story is: `review` runs → its handler returns `{ok, message}` where `message` is the readback → the human perceives it → the human responds in a new turn → `confirm` runs. The `perceived` grade is what makes the whole thing more than a checkbox.

But trace the actual bytes. `dispatch` returns an `ActionResult`; the dispatcher hands it to `transport.respond(callId, output)`; on OpenAI Realtime that becomes a `function_call_output` conversation item; the client then sends `response.create`; and **the model generates the audio the human actually hears**. OpenAI's own docs are explicit that the model does not auto-respond to tool output — *"Once we have added the conversation item containing our function call results, we again emit the `response.create` event from the client. This will trigger a model response using the data from the function call."*

So the human perceives **the model's rendition of the readback**, not the handler's `message`. Nothing in the type surface enforces verbatim relay, because the relay *is* the model. `CONTRIBUTING.md` says `message` is "relayed to a human verbatim" — that is an aspiration about model behaviour, not an invariant the library can hold.

Concretely, `consentGrade: "perceived"` currently asserts *"some audio finished playing."* It does not assert *"the audio contained $4,180, Tuesday, non-refundable."*

This is not a hypothetical. It is **OWASP ASI09: Human-Agent Trust Exploitation** — *"compromised agents manipulate human approval through misleading summaries or framing"* — in the OWASP Top 10 for Agentic Applications 2026 (published 2025-12-09). OWASP's prescribed mitigation is, almost word for word, the thing Concierge does not do: *"forced, explicit confirmations that show the raw action rather than the agent's summary."*

And the liability is the app operator's, not the model vendor's. In *Moffatt v. Air Canada* the tribunal rejected the argument that the chatbot was *"a separate legal entity responsible for its own actions"* and held the operator liable for what its bot said. A model that paraphrases a booking readback with a wrong cancellation policy produces the operator's liability, with Concierge's consent kernel certifying that the human agreed.

**Why it happens:**

In the source system this was invisible because it worked in testing. A frontier model reading back a short structured payload paraphrases it accurately almost every time. The gap only opens under (a) indirect prompt injection steering the summary, (b) long payloads where the model compresses, (c) multilingual sessions, (d) a cheaper/faster model swapped in later. All four are post-launch events.

The deeper cause is a category error in the type surface: `ConsentGrade` is a property of `Transport`, and the transport is the pipe *to the model*, not the pipe *to the human*. The library is measuring the wrong hop.

**How to avoid:**

Split the readback off the model path entirely. At the API level:

1. Add a **readback sink** to core, separate from `Transport`. A review action returns not just `message` but a structured `readback: { payload, rendered }` that core pushes to an app-controlled channel — a confirmation card, a DOM region, a TTS call the app owns. The app renders it; the model never touches it.
2. **Only the readback sink can grant `perceived`.** A transport that can only pass the message through the model tops out at a new, strictly-weaker grade. Suggested vocabulary: `"relayed"` (went through the model — no guarantee about content) < `"delivered"` (app-rendered, human may not have read) < `"perceived"` (app-rendered *and* the app confirmed receipt: audio completion, viewport intersection, scroll-to-bottom).
3. `minGrade: "perceived"` must therefore fail at catalog build time on a bare Realtime transport with no readback sink configured. That is exactly the fail-closed behaviour the design already promises — it just has to be pointed at the right hop.
4. Bind consent to a **hash of the rendered readback**, not only to `snapshotEquality` over the payload. `ConsentAck` should carry `readbackHash`. If the app re-renders different text, consent dies.

**Warning signs:**

- The word "verbatim" appears in docs but no test asserts it.
- The consent tests all drive `dispatch` directly and never involve a model.
- `deferUntilDelivered` is wired to a transport event rather than to an app-rendered surface.
- Anyone can describe the happy path but nobody can answer "what if the model summarises the readback as 'about four thousand dollars'?"

**Phase to address:** v0.1. This changes `ConsentPolicy`, `ConsentAck`, `TransportCapabilities`, and adds a core concept. It is the single most expensive thing to retrofit — every action definition and every transport in the wild would break.

---

### P2: Barge-in simultaneously destroys perception and mints the consent token

**What goes wrong:**

The `bindTo: "userTurn"` control rests on a true and elegant claim: an agent can create a new response by itself, it cannot create a new user turn. The claim holds. The *implementation* has a hole.

On OpenAI Realtime with VAD, when the human speaks over the model: `input_audio_buffer.speech_started` fires, the in-flight response is cancelled (`response.cancelled`), and — per OpenAI's docs — WebRTC servers *"automatically truncate unplayed audio when there's a user interruption"*; WebSocket clients issue `conversation.item.truncate` with an `audio_end_ms`.

So a human who says *"yeah yeah, go ahead"* two seconds into a nine-second booking readback has:
- **truncated the audio** — they never heard the price, the date, or the non-refundable clause; and
- **created a genuinely new user turn** — which is precisely what `bindTo: "userTurn"` accepts as proof of consent.

The interruption both defeats perception and satisfies the gate. And this is not the adversarial case — it is the *most natural human behaviour in a voice UI*. Impatient users barge in constantly.

Compounding it: `InvocationMeta.deferUntilDelivered` is documented as firing when *"audio playback stopped."* Playback stops on completion **and** on truncation. Nothing in the signature distinguishes them.

**Why it happens:**

The source system shipped on one transport and presumably tuned for the cooperative case. "Audio stopped" is the event the SDK gives you; "audio finished the sentence containing the price" is not an event anyone hands you.

**How to avoid:**

1. `deferUntilDelivered` must pass a reason: `(effect: (result: { responseId: string; completion: "completed" | "interrupted" | "cancelled"; playedMs: number }) => void)`. Non-`completed` completions must **invalidate** the armed consent, not arm it.
2. Require `playedMs >= readbackDurationMs` before arming. The app knows the duration because (per P1) the app rendered the readback.
3. The consent-satisfying user turn must be **classified**, not merely counted. A turn whose transcript is `"stop"` / `"wait"` / `"no"` must not confirm. A minimum viable version: core exposes `consent.acceptTurn(turnId, classification)` and the app or transport decides; core refuses to auto-accept.
4. Add an explicit test: *review → barge-in at 20% → confirm* must fail closed.

**Warning signs:**

- No test in the suite interrupts anything.
- `deferUntilDelivered`'s callback takes only a `deliveredResponseId`.
- Voice demo videos always show a patient user.

**Phase to address:** v0.1 for the `deferUntilDelivered` signature (it is in `types.ts` today and is cheap now, expensive after publish). v0.2 for the turn-classification hook. v0.4 for the Realtime-specific wiring.

---

### P3: The catalog is a capability boundary, not a safety boundary — composition is where harm lives

**What goes wrong:**

`README.md` states: *"The catalog of actions **is** the security boundary. If you never defined a verb for it, no agent can do it — not by prompt injection, not by a clever selector, not at all."*

The first half is true and is a genuine, large improvement over generic DOM actuation. The second half overclaims. Enumeration bounds the *alphabet*; it does not bound the *sentences*.

STAC (*"When Innocent Tools Form Dangerous Chains to Jailbreak LLM Agents"*, arXiv 2509.25624) constructs multi-turn sequences in which **each individual step scores under 2% harmfulness while the composed sequence achieves over 90% attack success** against frontier agents. The parallel line of work is blunt about the property: *"the security property of the composition cannot be derived from the security properties of individual steps"* — a file-read tool plus an email-send tool *is* an exfiltration tool, though neither is.

Applied to a plausible Concierge catalog: `navigate` + `applyFilter` + `openResult` + `signIn` are all individually harmless and all sit in `crossStage`, available in every stage by construction. An injected instruction never has to reach `confirmBooking` to do damage — it can drive the user to an attacker-chosen result, clear filters that were protecting them, or (if `navigate` takes a URL string) egress data in a query parameter.

That last one is the sharpest edge. **`navigate(url: string)` in `crossStage` is an unrestricted exfiltration channel** and would be present in almost every real integration.

**Why it happens:**

Each verb is reviewed in isolation, at the moment it is written, by an author thinking about that verb's own safety. Nobody reviews the 28-choose-3 sequences. The stage-scoping design already helps a lot — it is the best mitigation in the library — but `crossStage` is the hole punched straight through it, and `crossStage` is where navigation always ends up.

**How to avoid:**

1. **`navigate` must never take a free URL.** Ship the reference example as `navigate({ route: z.enum([...routeIds]) })`. Make this a documented rule with the reasoning attached, because every adopter will otherwise write the string version.
2. Treat `crossStage` as privileged. Consider requiring an explicit `unsafeCrossStage` opt-in, or at minimum surfacing "N cross-stage actions are visible in every stage" in build output.
3. Add composition metadata to `ActionDefinition`: `maxPerTurn?: number`, `conflictsWith?: string[]`, `requiresFreshStage?: boolean`. Cheap in the type surface now; a breaking change later.
4. Add a per-session **action budget** and a **repeated-call breaker** (same name + near-identical args N times → refuse with a stable reason). The agent-loop literature converges on "if repeated 2–3 times, stop or switch strategy," and the dedup window already gives you the machinery — this is the same map with a counter.
5. Rewrite the README claim honestly: *"An agent cannot invent a capability you did not write. It can still combine the ones you did."* That sentence sells better to the security-literate audience this library is courting, and it is true.

**Warning signs:**

- `crossStage` grows past ~5 actions.
- Any action takes a URL, a path, a raw query string, or an arbitrary key/value.
- Threat modelling is done per action and never per stage.

**Phase to address:** v0.1 for the `navigate` reference shape and composition metadata in `types.ts`; v0.2 for budgets/breakers alongside the consent kernel.

---

### P4: The lethal trifecta is fully present the moment one action reads user-generated content

**What goes wrong:**

Simon Willison's lethal trifecta — **private data + untrusted content + external communication** — is often read as "that's an email-agent problem, not ours." It is exactly ours, and more completely than in most agent architectures:

- **Private data.** The whole product premise. The handler runs in-process inside the human's authenticated session. There is no scoping; the agent's reach is the user's reach.
- **Untrusted content.** Any bridge snapshot that surfaces content the app did not author: listing titles, seller descriptions, message bodies, other users' display names, uploaded filenames, CMS copy, supplier feeds. `getFiltered()` on a marketplace returns attacker-authorable strings, and those strings enter the model's context as tool output.
- **External communication.** `navigate(url)` (P3), any `search(query)` whose query lands in server logs or a third-party analytics pipe, any `share` verb, and — subtly — `ActionResult.message` itself, which is transmitted to whichever model vendor the transport talks to.

All three legs are load-bearing product features. You cannot remove any of them; you can only refuse to let them co-occur unmonitored.

**Why it happens:**

The mental model "we own this app, so the data in it is trusted" conflates *authorship of the code* with *authorship of the data*. A multi-tenant SaaS app is full of content written by parties hostile to the current user.

**How to avoid:**

1. **Adopt a taint marker on actions.** Chrome's WebMCP guidance already standardises the vocabulary: *"If a tool returns user-generated content (UGC) or externally sourced data, consider adding the `untrustedContentHint` to the tool."* Concierge should mirror it — `readsUntrusted?: boolean` on `ActionDefinition` — both because it is the right control and because it makes a future WebMCP transport a projection rather than a translation (see P18).
2. **Fail at catalog build time when a stage contains both an `readsUntrusted` action and an egress action, unless explicitly acknowledged.** This is the same fail-closed-at-build-time move the consent grade already makes, applied to a second axis. It is the highest-leverage security feature available to this library, and it is *only* possible because Concierge has a static catalog — an advantage neither MCP nor generic automation has.
3. Wrap untrusted values in delimiters when they reach the model, and never let them into a `description`.
4. Document the trifecta explicitly in the security section, framed as "here are the three legs; here is the build error that stops them meeting."

**Warning signs:**

- Any bridge snapshot getter returns a string the current user did not type.
- `description` fields are built with template literals.
- The security docs talk only about what the agent *can call*, never about what it *can read*.

**Phase to address:** v0.1 for the metadata flag on `ActionDefinition` (type-surface change). v0.2 for the build-time co-occurrence check.

---

### P5: `ActionResult.message` is an injection channel *back into the model*, and it is the one string with no policy

**What goes wrong:**

`redact` is mandatory on every action with a non-empty schema. It governs **arguments**. Nothing governs **results**.

Yet the result is the string that (a) goes straight into the model's context, (b) is the natural thing to log, and (c) is explicitly encouraged by `CONTRIBUTING.md` to interpolate app data: *"I don't see a Marriott in your current results. Want me to clear all filters?"* Interpolate a hotel name from a supplier feed and the message is attacker-authored text entering the model's instruction stream.

Tool results are the *documented primary channel* for indirect prompt injection against tool-using agents — the 2026 defence literature is organised around it (`Defense Against Indirect Prompt Injection via Tool Result Parsing`, arXiv 2601.04795; IPIGuard, arXiv 2508.15310; ARGUS, arXiv 2605.03378), and the framing is standard: *"attackers embed adversarial instructions into the results of tool calls to hijack the agent's decision-making process."* Chrome's WebMCP guidance names the same thing as *"output injection through tool return values."*

There is a second, independent problem on the same string: **PII**. `message` is transmitted to a third-party model provider on every call. `redact` protects arguments from telemetry and does nothing for the message. So the asymmetry is: the field you *chose* to be careful about is protected; the field that always crosses a vendor boundary is not.

**Why it happens:**

`message` is conceptualised as *output to a human*, so it inherits none of the paranoia applied to *input from a model*. But in this architecture it is both.

**How to avoid:**

1. Give results a policy symmetric with `redact`. Suggested: messages are either **literal** (a constant, safe by construction) or **composed** — where composed messages take a template plus a `values` map that core sanitises (strip control chars and newlines, cap length, wrap in delimiters). Interpolating raw into a template literal becomes the thing you have to opt into, not the default the docs demonstrate.
2. Cap message length in core. Chrome's WebMCP budgets are a reasonable precedent to copy outright: 30 chars for names, 500 for descriptions, 150 per parameter, ~1.5K per output.
3. `reason` must come from a **closed enum**, never from `err.name`. `err.name` leaks framework internals (`PrismaClientKnownRequestError`, `AxiosError`) to the model and to logs — a free reconnaissance channel and a covert PII path if anyone ever interpolates.
4. Apply `redact` to the message path too, or introduce `redactMessage`. Whichever — the decision must exist.

**Warning signs:**

- Any `return { ok: true, message: \`...${someAppString}...\` }` where `someAppString` is not from a closed set.
- Telemetry docs describe argument redaction and are silent on results.
- `reason` values differ between environments.

**Phase to address:** v0.1. This adds a field to `ActionDefinition` and changes what handlers return — the most expensive category of late change.

---

### P6: MCP's attack classes mostly *do* survive the move to a same-origin catalog — and one gets worse

The brief asks which MCP-in-the-wild issues apply to an in-app catalog. Answered class by class, because the intuition "same-origin, therefore safe" is wrong in a specific and important way.

| MCP attack class | Applies to Concierge? | Why |
|---|---|---|
| **Tool poisoning** (malicious instructions hidden in tool descriptions) | **Mostly NO** | Descriptions are author-written, ship in the bundle, and pass code review. This is a genuine structural win over MCP and worth stating loudly. **Exception:** any description built from runtime data — i18n strings from a CMS, feature-flag copy, tenant-configurable labels, white-label branding. That reopens it completely. Enforce descriptions as compile-time constants. |
| **Rug pull** (server redefines an approved tool later) | **YES — and worse.** | See below. |
| **Cross-server shadowing** | **YES, mutated.** | Not cross-*server*; cross-*catalog*. If the host page also exposes WebMCP tools via `document.modelContext`, or runs a CopilotKit provider, or (realistically) mounts two Concierge instances in a micro-frontend / module-federation app, the agent sees a union and one surface can shadow another's verb. Name collisions across instances are the concrete failure. |
| **Confused deputy** | **YES — and sharper than in MCP.** | See below. |
| **Token/audience confusion (`aud` claim validation)** | **N/A** | There is no token. Which is the problem, not the reassurance. |

**Rug pull, restated: Mid-Session Tool Injection.**

The 2026 WebMCP security literature names the same-origin version of this attack directly. *"WebMCP Tool Surface Poisoning: Runtime Manipulation Attacks on LLM Agents"* (arXiv 2606.06387) defines **Mid-Session Tool Injection (MSTI)**, splits it into **Tool Hijacking** (modifying the visible tool set, including *"race conditions during tool registration"*) and **Tool Framing** (altering *"tool name, description, readOnlyHint, and inputSchema"*), and identifies the attacker as **third-party scripts inside the active session**.

That is Concierge's threat model exactly. `concierge.registerHandler(name, handler)` and `bridgeRegistry.register(bridge)` are live, in-page, same-origin functions. Every analytics tag, session-replay script, chat widget, ad tag, A/B testing snippet, browser extension with content-script access, and every transitive npm dependency in your bundle runs with identical authority to your own registration code. A compromised dependency calls `registerHandler("confirmBooking", evil)` and the catalog is owned.

This is **worse than MCP rug-pull**, because in MCP there was at least an approval step to subvert. Here there is none.

The `README` line *"Adding a capability is a code change with a code review, not a prompt change"* is true of the *declaration* and false of the *runtime registry*. The library currently offers no mechanism that makes it true of both.

**Confused deputy, sharpened.**

In MCP the confused-deputy problem is about token audiences and per-client consent; the mitigations are `aud` validation, no token passthrough, exact redirect-URI matching. **None of those exist here.** The handler executes in-process, in the browser, inside the human's authenticated session, with the human's cookies attached to every fetch it makes. There is no delegated credential to scope, no audience to check, no downscoped token to mint. Every action runs with the human's **full ambient authority**, and the enumerated verb set is the only boundary in the entire system.

The corollary is the dangerous one, and it lands squarely on the v0.2 server-handlers work: **consent is currently a client-side construct.** `ConsentAck` lives in the browser. A compromised page — or simply a malicious client hitting your endpoint directly — can assert that consent was granted. If `@fullselfbrowsing/concierge-server` accepts a client-asserted consent flag, the entire kernel becomes decorative at exactly the moment it starts guarding server-side side effects.

**How to avoid:**

1. **Seal the catalog.** Build the emitted tool list from statically-declared specs only, never from the mutable runtime registry. `Object.freeze` the built catalog and the spec objects.
2. **`registerHandler` must refuse to overwrite.** Register-once semantics; a name collision throws with the offending name. Late registration after seal throws. This turns MSTI from silent into loud.
3. **Bridge ids must be unforgeable.** `BridgeRegistry.id` is a string today — guessable, and any script can register against it. Key the registry on the object identity created by `defineStage`/`createBridge`, held in module scope, not on a string.
4. **Store handlers in a `Map`, not an object literal.** A string-keyed object makes `dispatch("__proto__")`, `dispatch("constructor")`, and `dispatch("toString")` resolve to inherited members. Test those three names.
5. **Server-side consent artifact.** The review step should obtain a server-issued, signed token bound to `{userTurnId, payloadHash, readbackHash, expiry}`; `confirm` presents it; the server verifies and burns it (single-use). This is the only design in which consent survives a hostile client, and the token shape must be decided in v0.1 even if the server package ships in v0.2 — `ConsentAck` is a public type.
6. Namespace emitted tool names per instance so two Concierge instances in one page cannot shadow each other.
7. Consider a Content Security Policy recommendation in the docs. It is the only real defence against the third-party-script leg, and it is the app's job, not the library's — but the library should say so.

**Warning signs:**

- `registerHandler` is called anywhere outside a component mount or module init.
- Bridge ids are string literals typed by hand.
- The server handler trusts anything the client says about consent.
- Nobody has audited what third-party scripts run on the pages that host a stage.

**Phase to address:** v0.1 for sealing, register-once, `Map`, and the `ConsentAck` token shape. v0.2 for server-side verification.

---

### P7: Approval fatigue — the handshake is an integrity control, and it is being sold as an attention control

This is the adversarial verdict the brief asks for, stated plainly: **the fresh-turn handshake is real protection against the agent; it is close to zero protection against a habituated human.** Both halves are worth stating, and the marketing must not blur them.

**What goes wrong:**

The human stops listening. Not eventually — quickly, and measurably.

- Anderson, Kirwan et al. measured habituation to security warnings with fMRI and found *"a dramatic drop in the visual processing centers of the brain after only the **second** exposure to a warning, with further decreases with subsequent exposures."* The longitudinal follow-up (MIS Quarterly 42:2, fMRI + eye tracking + field experiment over a workweek) confirmed decline across days, with only partial overnight recovery.
- Automation complacency is the older, deeper literature: in the classic Parasuraman, Molloy & Singh experiments, *"when automation was consistently reliable, operators' detection of its failures fell sharply,"* and the 2010 Human Factors review found this *"shows up in experts as well as novices and cannot be overcome with simple practice."*
- Automation bias makes it worse in the specific way Concierge is designed: reviewers were **19 percentage points** more likely to align with an AI recommendation than controls, and *"when AI provided narrative rationales, deference increased by another 5 points."* A fluent, well-written, one-complete-sentence readback — precisely what `CONTRIBUTING.md` mandates — **increases** rubber-stamping.
- Field reports match: one HITL deployment hit *"an approval rate of 99.7%"* by day three.

Layer that on P1 (the human hears a paraphrase) and P2 (barge-in confirms without hearing), and the honest reading is: for a user on their fortieth booking, the handshake stops the *agent* from self-confirming and stops essentially nothing else.

**Is it theater?** No — but only half of it is real, and it is not the half the README emphasises:

| Control | Real? | Against whom |
|---|---|---|
| `bindTo: "userTurn"` (agent cannot mint a user turn) | **Real.** Sound, cheap, unbypassable by the model. | The agent, and injection-driven self-confirmation. This is the good idea. |
| `snapshotEquality` (drift between review and confirm kills consent) | **Real.** Deterministic, testable. | Payload substitution attacks and stale state. Also good. |
| Fail-at-build-time on grade mismatch | **Real** *once it points at the right hop* (P1). | Silent degradation across transports. |
| `minGrade: "perceived"` as currently wired | **Theater.** Measures model-pipeline audio, not human comprehension. | Nobody. |
| "The human consented" as a claim about understanding | **Theater**, and the literature says so. | Nobody. |

**How to avoid:**

1. **Do not confirm everything.** Escalate on *risk signal* (amount, irreversibility, delta from what the user last saw), not on action category. Every confirmation you spend on a low-stakes action is drawn from the same finite attention budget as the one that matters. Consider an `impact` field on `ConsentPolicy` and let the app set thresholds.
2. **Vary the readback.** Polymorphic warnings are the only intervention with published evidence of resisting habituation — the same fMRI programme that documented the decay also demonstrated that a warning which changes its appearance is *"substantially more resistant to habituation."* Concrete version: put the *number that changed* in a different position, use a different sentence frame, require a different confirmation phrase for high-impact actions.
3. **Read back the delta, not the state.** "Total is now $4,180, up $600 from the rate you saw" carries information a habituated listener still catches. "Confirming your booking for $4,180" does not.
4. **Frame it accurately in the docs.** "Structurally guaranteed that a human, not the agent, confirmed this" is a strong, true, defensible claim. "Structurally guaranteed the human consented" is not, and a security-literate reader will catch it and discount everything else.

**Warning signs:**

- Confirm-rate telemetry approaching 100% (instrument this; it is the canary).
- Median time-from-readback-to-confirm shorter than the readback itself.
- Every irreversible action uses the same readback template.

**Phase to address:** v0.2 (consent kernel) for `impact` and risk-based escalation. v0.3 (devtools) for confirm-rate and time-to-confirm instrumentation. Docs framing: immediately, v0.1.

---

### P8: Standard Schema v1 cannot emit JSON Schema — and the inlined copy is already a version behind

**What goes wrong:**

`types.ts` inlines a minimal `StandardSchemaV1` with `version`, `vendor`, `validate`, `types`. That is a faithful copy of the original spec — and the spec has moved. **Standard JSON Schema v1** now exists as a companion, adding a required `~standard.jsonSchema` member with `input(opts)` and `output(opts)` converters, targets `"draft-2020-12" | "draft-07" | "openapi-3.0"`, shipping *"starting with the next `@standard-schema/spec@1.1.0` version."* It is already implemented by **Zod v4.2+, ArkType v2.1.28+, Valibot v1.2+, Zod Mini, VineJS, Sury, stnl** — i.e. essentially the entire target audience.

Three consequences, in descending order of cost:

1. **The planned `@fullselfbrowsing/concierge-zod` bridge is probably the wrong shape.** Core can read `~standard.jsonSchema.input({target})` directly, dependency-free, for every compliant validator. A per-vendor bridge should be the *fallback* for non-compliant validators, not the primary path. Shipping the bridge as primary means a package that exists to solve a problem the ecosystem already solved, plus an API that assumes it.

2. **Input vs output is a correctness trap, not a detail.** The spec is explicit: *"A schema might accept a string as input (`"123"`) but output a number (`123`). The input and output types can differ, so their JSON Schema representations need to differ as well."* For tool calling you need the **input** schema — that is what the model must produce. Any action using `.transform()`, `.default()`, `.coerce`, or a codec and emitting the output schema tells the model the wrong contract. This fails in exactly the way the root-`type: "object"` bug failed: silently, and only in production, and only on the actions that use transforms.

3. **Unrepresentable types.** Zod throws by default on `z.date()`, `z.bigint()`, `z.symbol()`, `z.map()`, `z.set()`, `z.transform()`, `z.custom()`, `z.nan()`; setting `unrepresentable: "any"` silently degrades them to `{}` — *"the equivalent of unknown in JSON Schema."* Both outcomes are bad and the second is worse, because it looks like it worked.

**And the flagship example in `README.md` is unsound:**

```ts
schema: z.object({
  key: z.enum(["priceMax", "brand", "amenity"]),
  value: z.unknown(),          // ← emits {} — the model may send anything
}),
```

`z.unknown()` emits an empty schema. The model can pass any JSON at all, and it flows through validation untouched into `bridge.actions.applyFilter(args.key, args.value)`. This directly defeats the `CONTRIBUTING.md` non-negotiable *"Validation is enforcement, not decoration."* It is the first code a prospective adopter reads, and it teaches the anti-pattern.

**One more build-time check the catalog is missing:** OpenAI strict-mode function calling requires `additionalProperties: false` on **every** object and **all** properties listed in `required` (optionals expressed as `"type": ["string","null"]`). If the schema does not comply, *"the request will be rejected with details about the missing constraints."* That is the same class of silent-stage-wipe failure the root-type check already guards against — the check belongs in the same place.

**How to avoid:**

1. Update the inlined interface to the companion spec; prefer `~standard.jsonSchema.input()`; accept the explicit `jsonSchema` override as the escape hatch it already is; keep a vendor bridge only for stragglers.
2. `buildCatalog` should reject: non-object roots (already planned), **empty/unconstrained property schemas**, missing `additionalProperties: false`, and properties absent from `required` — each naming the offending action *and* the offending property.
3. Rewrite the README example — `value` as a discriminated union over `key`, emitted as `anyOf` **under** an object root (which satisfies the root-type rule), or three separate actions.
4. Snapshot-test the emitted JSON Schema for the reference catalog. This is the single highest-value test in the repo: it catches validator upgrades, spec drift, and transform mistakes in one assertion.

**Warning signs:**

- Any `z.unknown()`, `z.any()`, `z.record(z.unknown())` in an action schema.
- The emitted schema is never inspected in a test.
- Nobody can say whether the emitted schema is the input or output projection.

**Phase to address:** v0.1. `jsonSchema` emission is core's job and is on the critical path for every transport.

---

### P9: Module-scoped `createConcierge()` leaks state across requests and tenants

**What goes wrong:**

The constraint *"core must construct on the server with no environment guards"* is correct and valuable. But it actively invites the pattern the README itself demonstrates:

```ts
export const concierge = createConcierge({ ... });   // module scope
```

Under Next App Router, Nuxt, or SvelteKit, that module is evaluated once per process and **shared across every request**. The dedup map, the bridge registry, and any armed consent state become process-global. Concierge's own dedup design — *"a repeated call returns the same Promise by reference"* — becomes "user B's call returns user A's Promise" if a `callId` ever collides.

This is not speculative; it is the exact failure the closest prior art shipped. The CopilotKit production write-up describes a real incident: *"a customer reported that the assistant was answering questions using another tenant's documents. State bleed through a shared `useCopilotReadable` registration that wasn't scoped to the session."* And: *"There is no built-in mechanism for tenant-scoped state, conversation isolation, or per-tenant tool permissions."* TanStack Router has an equivalent open issue where a singleton `getRouter()` *"silently leaks request-scoped router state across requests"* — the reporter's specific complaint being that it *"fails catastrophically and silently under SSR with no errors in logs."*

Two properties make this the worst kind of bug: it is **invisible in development** (one developer, one tenant, one request at a time) and it only manifests under **concurrent multi-tenant traffic**, i.e. production.

**How to avoid:**

1. `createConcierge()` must be cheap enough to call per session/request, and the docs must show that, never a module-level export.
2. Core should detect it. If `dispatch` is called on an instance constructed in a server context, throw or warn loudly. "Constructs on the server" was always meant to enable SSR-safe *imports*, not server-side *dispatch* — make the distinction explicit in the type system if possible (a `ServerSafeConcierge` that has `catalogFor` but no `dispatch`).
3. Ship `AsyncLocalStorage`-based scoping guidance in `@fullselfbrowsing/concierge-server`.
4. In the browser: one instance per agent session, not per app. Two concurrent sessions in one SPA must not share a dedup map.

**Warning signs:**

- `export const concierge = createConcierge(...)` anywhere, including docs.
- No test constructs two instances and asserts isolation.
- Dedup keys are not namespaced by session.

**Phase to address:** v0.1 (instance lifecycle is core API shape). Re-verify in v0.2 when server handlers land.

---

### P10: ESM-only shipped against a Node 20 floor — internally inconsistent, and unverified

**What goes wrong:**

`packages/concierge/package.json` declares `"type": "module"` with an exports map containing only `types` and `default` — ESM-only, no `require` condition. Meanwhile `engines.node` is `">=20"`.

Those two do not fit together. `require(esm)` shipped unflagged in **Node 22.12 / 23**. A CJS consumer on Node 20 — which the package declares it supports — gets `ERR_REQUIRE_ESM`. The affected population is real: Jest without ESM configuration, CJS `next.config.js` / `tailwind.config.js` contexts, older Electron mains, and any enterprise codebase pinned to Node 20 LTS.

ESM-only is otherwise a defensible 2026 choice — dual publishing invites the dual package hazard, and the current guidance for new packages leans ESM-only. The pitfall is not the choice; it is making it implicitly and inconsistently, then discovering it from eight bug reports across eight packages.

The compounding factor is package count. The roadmap has **eight** packages. Every one needs a correct `exports` map, correct `types` condition ordering, and a Svelte-specific `svelte` condition (P11). Retrofitting that across eight published packages is the expensive version of a problem that costs nothing to solve while there is one.

**How to avoid:**

1. Decide explicitly and state it in the README: ESM-only, Node ≥ 22.12 for CJS interop. Either raise `engines.node` or document the CJS caveat.
2. Add `publint` and `@arethetypeswrong/cli` to CI **now**, before package #2 exists. They catch condition ordering, missing files, wrong `types`, and masquerading formats mechanically.
3. Add a smoke test that actually installs the tarball (`npm pack` → install into a fixture) and imports it from ESM, from CJS, and from a bundler. Publishing bugs are not visible from inside the workspace, where TS path mapping papers over everything.
4. Fix the exports map order once, then template it.

**Warning signs:**

- Exports maps written by hand and diverging between packages.
- No `pack`-and-install test.
- First bug report is "cannot use import statement outside a module."

**Phase to address:** v0.1, as CI infrastructure. This is the cheapest item on this list and the most annoying to fix late.

---

### P11: The Svelte adapter has a compiler constraint the React adapter does not — build it early, not last

**What goes wrong:**

`README.md` shows the identical getter contract across frameworks and calls it *"the single most portable idea here."* The contract is portable. The **packaging** is not.

Svelte 5 runes are compiler keywords, valid only in `.svelte`, `.svelte.js`, and `.svelte.ts` files — *"they are not values, meaning you can't assign them to a variable or pass them as arguments to a function."* And: *"State declared with `$state` in `.svelte.js` or `.svelte.ts` files can only be exported if it is not directly reassigned,"* because *"the compiler processes files individually."*

Practical consequences for `@fullselfbrowsing/concierge-svelte`:
- It must ship through `svelte-package`, expose the `svelte` export condition, and ship un-prebundled `.svelte.js` sources. Pre-bundling with tsup/esbuild strips the runes and produces an adapter that compiles and is silently non-reactive.
- Consumers' bundlers must not externalise it wrongly (Vite `optimizeDeps` interactions).
- The README's `() => filtered` example only works when the getter is created in the same compiled scope. Cross-module sharing wants the class-instance pattern instead.

`PROJECT.md` already commits to shipping a non-React adapter *with* v0.1 for exactly the right reason ("Building React-first and porting later produces a hooks-shaped core"). The addition here: **make Svelte the one**, not Vue. Vue's `() => ref.value` is trivially satisfiable and will not push back on the core design. Svelte's build constraint plus its "cannot reassign exported state" rule is the one that will surface real assumptions.

Vue has its own warning worth heeding: TanStack Table's Vue adapter required a bespoke `mergeProxy` utility *"to enable reactive tracking of nested object properties, ensuring changes propagate correctly."* Which means: **if the ~150 LOC adapter constraint forces a broken Vue adapter, the constraint is wrong, not the adapter.** Treat 150 LOC as a design smell detector, not a hard gate that ships bugs.

**Warning signs:**

- The Svelte adapter is built with the same tsup config as the React one.
- No example app actually consumes the published tarball.
- The adapter is "done" but nobody has confirmed reactivity in a running app.

**Phase to address:** v0.1, and sequence Svelte second (immediately after React), not last.

---

### P12: The React getter pattern fights React 19's compiler and its lint rules

**What goes wrong:**

The documented pattern is `() => filteredRef.current`. That requires the host app to mirror every exposed piece of state into a ref — the app writes to the ref, the getter reads through it.

React 19's compiler and the `react-hooks` lint rules now flag exactly this shape. Reported cases include *"Cannot access refs during render"* false positives and *"Updating a value used previously in JSX is not allowed"* when mutating a ref used in rendering. React's own guidance is unambiguous: *"Reading or writing `ref.current` during render breaks React's expectations. Refs might not be initialized when you try to read them, and their values can be stale or inconsistent."*

So an app on React Compiler gets lint errors from the pattern the docs prescribe. The developer's first experience is fighting their linter, which is the fastest possible route to abandoning a library.

**How to avoid:**

1. **The adapter owns the mirroring.** Ship `useLiveRef(value)` (or fold it into `useRegisterBridge`) so user code passes plain values and never touches a ref. Keeps the pattern out of the app's render path and out of the compiler's way.
2. Document the reasoning at the call site so the compiler-savvy reader does not assume the library is stale.
3. StrictMode: the identity-guarded unsubscriber is already specified, and correctly. Add the symmetric requirement — **`register` must be idempotent under double-invocation.** Test `register(A) → register(B) → cleanupA()` leaves `B` live, and `register(A) → register(A)` does not duplicate.

**Warning signs:**

- Example code in docs contains `useRef` in app-level components.
- The React example app does not enable the compiler.

**Phase to address:** v0.1 (React adapter).

---

### P13: Eight packages, three framework majors — version the *contract*, not the packages

**What goes wrong:**

The roadmap has eight packages spanning React, Vue, Svelte, six server runtimes, and OpenAI Realtime. Two failure modes, and they are opposites:

- **Lockstep versioning:** a core patch churns all eight versions; users get updates for packages that did not change; changelogs become noise.
- **Independent versioning:** users mix `concierge@0.4` with `concierge-react@0.2`, which typecheck against each other because TypeScript is structural, and then fail at runtime in a way nobody can debug.

The React 18→19 transition is the cautionary tale for peer ranges specifically: libraries that pinned `"react": "^18.0.0"` forced the entire ecosystem onto `--legacy-peer-deps`, which *"skips strict peer dependency checks, allowing incompatible versions to coexist"* — i.e. converts a clear install error into a runtime mystery.

**How to avoid:**

1. Peer ranges wide from day one: `"react": ">=18 <20"`, not `"^19.0.0"`. Same for `vue` and `svelte`.
2. Core is a **peer dependency** of every adapter, never a regular dependency (avoids two core instances with two dedup maps and two registries — the same duplicate-instance bug that plagues React itself).
3. **Export an explicit `CONTRACT_VERSION` from core** and have every adapter assert it at runtime with an actionable message: `"concierge-react@0.4 requires concierge contract v2, found v1 — upgrade @fullselfbrowsing/concierge."` This is what lets you version independently without the silent-mismatch failure. Structural typing will not save you; a runtime check will.
4. Independent versions, single changeset-driven release, one changelog per package.
5. Decide *now* what "adding a field to `ActionDefinition`" means for adapters. If adapters only ever pass definitions through opaquely (they should), core can add fields freely — which is the design property that makes P3/P4/P5's metadata additions safe later. Write it down as an invariant.

**Warning signs:**

- Adapters `dependency` on core rather than `peerDependency`.
- Any caret-pinned framework peer.
- No runtime contract assertion.

**Phase to address:** v0.1, alongside the packaging work in P10.

---

### P14: The bridge is manual instrumentation, and manual instrumentation plateaus at ~20%

**What goes wrong:**

Concierge's adoption unit is not `npm install` — it is *instrumenting every page*. An app with 40 routes needs ~40 bridges, each maintained as the page's state evolves, forever.

The analytics industry ran this experiment for a decade with a much stronger value proposition and lost. The pattern: *"Getting the SDK installed is step one, but getting it instrumented correctly across every service, every feature, and every team is the unglamorous, ongoing work that determines whether a tool delivers its promised value or sits at 20% coverage forever."* Amplitude — which advocated precision-only instrumentation for years — eventually shipped autocapture *"from watching thousands of customers."*

The failure mode is not that teams reject Concierge. It is that they instrument three pages, the agent works on those three and says "I can't do that from here" everywhere else, and the team concludes the library doesn't work. `PROJECT.md` already identifies this ("Adoption risk is the instrumentation cost of bridges") — and then places the mitigation (devtools) in **v0.3**. That ordering is the risk.

**What made comparable libraries succeed:** value at N=1. Zod, TanStack Query, and react-hook-form all pay off on the *first* call site — nobody instruments an app before getting value. Concierge's first bridge currently pays off only once a transport is wired and a stage matches.

**How to avoid:**

1. **Move the diagnostic into core, in v0.1.** Not the overlay — a function: `concierge.explain(ctx)` returning `{ matchedStage, unmatchedStages: [{name, reason}], registeredBridges, missingBridges, catalogSize }`. The single most common first-run experience will be "the agent says it can't do anything," and the answer is always one of: no stage matched, bridge not mounted, or action filtered out. A one-line answer to that question is worth more than the entire v0.3 overlay and costs a fraction as much.
2. **Make the zero-bridge path work.** Cross-stage actions with no bridge should function standalone, so `npm i` → one action → it works in five minutes. Bridges become the second lesson, not the first.
3. Ship a **codemod or generator** (`npx concierge add-stage`) before shipping the overlay.
4. Instrument coverage as a first-class metric in devtools: "12 of 40 routes have a matching stage."
5. Make the instrumentation earn its keep twice — if declaring a bridge also gives you typed access for tests or a command palette for free, teams instrument for the other reason and get agent support as a side effect.

**Warning signs:**

- The quickstart requires a transport, an API key, and a bridge before anything happens.
- Issue titles clustering on "agent says it can't do that."
- Nobody has timed the actual first-run experience with a stopwatch.

**Phase to address:** `explain()` and the zero-bridge path in **v0.1** (moved up from v0.3). Full overlay stays v0.3.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|---|---|---|---|
| `z.unknown()` / `z.any()` in an action schema | Ships an action without modelling its arguments | Emits `{}`; model may send anything; defeats "validation is enforcement"; unfixable without a breaking schema change | **Never.** Reject at catalog build. |
| `navigate({ url: z.string() })` | One action covers all routing | Unrestricted egress channel; completes the lethal trifecta on its own | **Never.** Enum of route ids. |
| Consent state lives only in the browser | Ships v0.2 without a server story | A malicious client asserts consent; kernel becomes decorative for server-side effects | Only while zero server-side side effects exist — and `ConsentAck`'s shape must already accommodate the token |
| Interpolating app data into `ActionResult.message` | Better human-facing messages | Injection channel back into the model; PII to the vendor; no redaction path | Only with a sanitising template API (P5) |
| `export const concierge = createConcierge(...)` at module scope | Simplest possible docs example | Cross-request/tenant bleed under SSR, invisible in dev | **Never in docs.** Perhaps acceptable in a pure-SPA app with one session. |
| `dedupeWindowMs` fallback key via `JSON.stringify` | Dedup works without a `callId` | Throws on circular refs (known); worse, can *merge two genuinely different calls* — a silently dropped action | **Never.** No `callId` → no dedup. A wrong dedup key is worse than none. |
| Descriptions built from runtime strings (i18n, CMS, tenant config) | Localised/white-labelled tool descriptions | Reopens MCP-style tool poisoning on a same-origin catalog | Only from a compile-time-known, reviewed message catalog |
| Lockstep versioning all 8 packages | Simple release script | Version churn, meaningless changelogs, adapters appear updated when unchanged | Acceptable pre-1.0 if `CONTRACT_VERSION` exists |
| Adapters exceed ~150 LOC (esp. Vue) | Adapter actually works | Signals logic leaked from core | Acceptable when the alternative is a broken adapter — treat 150 as a smell detector, not a gate |
| Deferring devtools/`explain()` to v0.3 | v0.1 ships sooner | First-run experience is "agent says it can't do that" with no diagnosis; churn before value | **Never** for `explain()`; fine for the visual overlay |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|---|---|---|
| **OpenAI Realtime** | Assuming the model relays `message` verbatim | It generates its own rendition; render the readback out-of-band (P1) |
| **OpenAI Realtime** | Treating "audio stopped" as "audio completed" | Distinguish completion from truncation; barge-in truncates (P2) |
| **OpenAI Realtime** | Assuming tool output auto-triggers a spoken response | Client must send `response.create` after `function_call_output` — this is also the hook where you can *suppress* the model's paraphrase |
| **OpenAI strict function calling** | Emitting schemas without `additionalProperties: false` and full `required` | Request rejected with constraint details; validate at catalog build, same place as the root-type check |
| **Zod 4 / `toJSONSchema`** | Emitting the output projection for tool params | Use `io: "input"` / `~standard.jsonSchema.input()`; transforms and defaults make them differ |
| **Zod 4 / `toJSONSchema`** | `unrepresentable: "any"` to silence errors | Silently degrades types to `{}`; fix the schema instead |
| **Standard Schema** | Assuming v1 covers JSON Schema | It does not; the companion **Standard JSON Schema v1** does, implemented by Zod 4.2+/ArkType 2.1.28+/Valibot 1.2+ |
| **Next App Router** | Module-scoped `createConcierge()` | Per-request/session instance; server-safe *import*, not server-side *dispatch* (P9) |
| **Svelte 5** | Pre-bundling the adapter with esbuild/tsup | Runes stripped; adapter compiles but is non-reactive. Use `svelte-package` + `svelte` export condition + `.svelte.js` sources |
| **Svelte 5** | Exporting reassigned `$state` across modules | Not supported by design; use the class-instance pattern |
| **Vue 3** | Assuming a plain getter tracks nested reactivity | TanStack needed a `mergeProxy`; verify nested-property propagation explicitly |
| **React 19 / Compiler** | Telling apps to maintain their own refs | Compiler lints fire; the adapter should own ref mirroring (P12) |
| **OpenTelemetry GenAI** | Emitting spans before redaction | GenAI semantic conventions place tool-call arguments on spans by default; `redact` must run first |
| **MCP executor (v0.4)** | Assuming an MCP client enforces your consent grade | It cannot. An MCP transport is `consentGrade: "none"`; `minGrade` must refuse to build the gated actions |
| **WebMCP (future)** | Treating it as a competitor to route around | Treat as a transport; align metadata vocabulary now (P18) |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|---|---|---|---|
| Unbounded dedup map | Memory growth over long voice sessions | Sweep entries past `dedupeWindowMs`; `Map` with a timer or a bounded LRU | Long sessions: hundreds to thousands of calls |
| Shared `AbortSignal` across dedup'd callers | Caller A aborts, caller B's action dies mysteriously | Compose signals — abort only when *all* dedup'd callers abort; or ignore the second caller's signal and document it | Any parallel-call transport, i.e. immediately |
| Sticky failures inside the dedup window | Transient failure cached; agent's retry returns the same failure and it looks broken | Decide explicitly: dedup in-flight + success, allow terminal failures to re-run. Document either way — it changes agent behaviour | First flaky network call in production |
| Catalog rebuilt on every stage-context change | Jank on route change; schema re-emission churn | Memoise `catalogFor(ctx)` by resolved stage name, not by `ctx` identity | Apps with high-frequency context updates (canvases, dashboards) |
| Re-render thrash under streaming | UI lag invisible locally, consistent under load | CopilotKit's reported threshold: *"~200 concurrent sessions… required memoizing the message list and a 50ms render buffer"* | Multi-user production traffic |
| No per-session action budget | Runaway agent loop burns cost and fires side effects | Action budget + repeated-call breaker (stop after 2–3 near-identical calls) | Any injection or any model that gets stuck |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---|---|---|
| Treating `consentGrade: "perceived"` as proof of human comprehension | OWASP **ASI09** Human-Agent Trust Exploitation; operator liability (*Moffatt v. Air Canada*) | Out-of-band readback sink; grant `perceived` from the app-rendered channel only (P1) |
| Accepting any new user turn as consent | Barge-in confirms without hearing; the interruption *is* the token | Require completion (not truncation) + classify the turn (P2) |
| Client-asserted consent trusted by server handlers | Consent kernel becomes decorative at exactly the moment it guards real side effects | Server-issued, signed, single-use consent token bound to turn + payload hash + readback hash (P6) |
| Mutable runtime handler/bridge registry | **Mid-Session Tool Injection** by any third-party script or transitive dependency (arXiv 2606.06387) | Seal the catalog; register-once; unforgeable bridge identity; `Map` not object (P6) |
| `navigate(url: string)` in `crossStage` | Completes the lethal trifecta; direct data egress | Enum of route ids (P3) |
| Bridge snapshots exposing UGC with no marker | Indirect prompt injection from another user's content, in the user's own authenticated session | `readsUntrusted` flag + build-time refusal to co-locate with egress actions (P4) |
| Unpoliced `ActionResult.message` | Output injection back into the model; PII to the vendor; the one unredacted string | Composed-message API with sanitisation + length cap; `redactMessage` (P5) |
| `reason` derived from `err.name` | Leaks framework internals to the model and to logs | Closed enum of reason codes |
| Composition ignored in threat modelling | STAC-class chains: <2% harmfulness per step, >90% ASR composed | Threat-model per *stage*, not per action; composition metadata; action budgets (P3) |
| Snapshot getters returning live mutable proxies | A handler (or a bug) mutates app state without going through `bridge.actions`, bypassing every invariant the app enforces there | Document snapshot returns as read-only; freeze in dev builds; consider a `readonly` type projection |
| No action ledger | EU AI Act Art. 50 transparency obligations apply **2 August 2026**; machine-readable audit logs are among the named mechanisms | Append-only, redaction-aware ledger of `{action, redactedArgs, consentArtifact, userTurnId, outcome, ts}` — in **core**, not devtools |
| `dispatch` throwing synchronously | Non-async `dispatch` means the throw escapes into the transport callback and hangs the session | One top-level `try` returning `Promise.resolve(errorResult)`; test `undefined`, circular objects, `"__proto__"`, `"constructor"`, `"toString"` |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---|---|---|
| Confirming every action | Approval fatigue; observed *"99.7% approval rate"* by day 3; habituation measurable after the **second** exposure | Escalate on risk signal (amount, irreversibility, delta), not action category |
| Identical readback template every time | Habituation; users stop processing | Polymorphic readback — vary frame, position, required phrase for high-impact actions |
| Reading back full state instead of the delta | The one changed number is buried in familiar text | "Total is now $4,180, up $600 from the rate you saw" |
| Fluent, well-written rationale in the readback | **Increases** deference by ~5pp on top of a ~19pp automation-bias baseline | Present the raw values; resist the urge to explain why the agent chose them |
| Empty catalog with no explanation | "The agent says it can't do that" and no path forward | `concierge.explain(ctx)` in v0.1 (P14) |
| Generic failure sentence for every error class | Users cannot recover; CopilotKit's documented gap: *"a dropped connection, a provider 429, a context window overflow, and a malformed tool call all look like the same thing"* | Stable `reason` enum mapped to distinct recovery hints in `message` |
| Commit window with no visible affordance | The 600ms grace exists but nobody can use it | Surface an interruptible state; interruption must map to `USER_STOPPED` |

---

## "Looks Done But Isn't" Checklist

- [ ] **Consent kernel:** often missing the *out-of-band readback* — verify a test proves the human-facing text is not model-generated (P1).
- [ ] **Consent kernel:** often missing *barge-in invalidation* — verify review → interrupt at 20% → confirm **fails** (P2).
- [ ] **Consent kernel:** often missing a *server-verifiable artifact* — verify a hostile client cannot fabricate `ConsentAck` (P6).
- [ ] **Catalog build:** often missing checks beyond the root type — verify it rejects `{}` property schemas, missing `additionalProperties: false`, and properties absent from `required` (P8).
- [ ] **JSON Schema emission:** often emitting the *output* projection — verify with a schema containing `.transform()` and `.default()` (P8).
- [ ] **Handler registry:** often mutable after build — verify a second `registerHandler("confirmBooking", ...)` **throws** (P6).
- [ ] **Handler registry:** often a plain object — verify `dispatch("__proto__")`, `dispatch("constructor")`, `dispatch("toString")` return clean failures (P6).
- [ ] **Dispatch:** often throws synchronously on hostile input — verify with `undefined`, a circular object, and a 1MB string.
- [ ] **Dedup:** often leaks and often shares signals — verify map sweeping, and verify one caller aborting does not kill the other.
- [ ] **Instance lifecycle:** often module-scoped — verify two instances are isolated and that an SSR-constructed instance refuses to dispatch (P9).
- [ ] **Adapters:** often "done" without running — verify each example app consumes the **published tarball**, not the workspace source.
- [ ] **Svelte adapter:** often non-reactive despite compiling — verify a rune-backed value actually updates through the getter (P11).
- [ ] **React adapter:** often lints clean only without the compiler — verify the example app enables React Compiler (P12).
- [ ] **Packaging:** often broken only from outside — verify `publint` + `attw` in CI and a pack-and-install smoke test (P10).
- [ ] **Redaction:** often argument-only — verify results and `reason` codes are also policed (P5).
- [ ] **Terminal actions:** often untested against the commit window — verify `terminal: true` + `deferUntilDelivered` + abort do not strand or double-fire an effect.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---|---|---|
| P1 readback through the model | **HIGH** post-publish | New `ConsentGrade` member + readback sink = breaking change to `ConsentPolicy`, `ConsentAck`, `TransportCapabilities`, and every action definition. Do it in v0.1. |
| P5 unpoliced result messages | **HIGH** post-publish | Changes what handlers return. Interim: sanitise centrally in the dispatcher and cap length — buys time without an API break. |
| P8 wrong JSON Schema projection | **MEDIUM** | Fix emission, snapshot-test the catalog. Adopters may have written schemas that depended on the wrong projection. |
| P6 mutable registry | **MEDIUM** | Adding register-once is technically breaking for anyone relying on re-registration. Ship as a warning first, then throw at 1.0. |
| P3 composition / `navigate(url)` | **MEDIUM** | Metadata fields are additive; changing the reference `navigate` shape only affects docs. Adopters who shipped the URL version need a migration note. |
| P9 module-scope singleton | **MEDIUM** | Add the SSR-dispatch guard; adopters must move construction. Loud runtime error is the whole fix. |
| P2 barge-in | **MEDIUM** | `deferUntilDelivered` signature change is breaking, but the field is new and unshipped — free now. |
| P13 contract versioning | **LOW→HIGH** | Free before publish. After eight published packages, retrofitting a runtime contract check requires a coordinated major across all of them. |
| P10 packaging | **LOW** | `publint`/`attw` are one CI job. Cost scales linearly with published package count. |
| P14 adoption plateau | **LOW technically, HIGH in reputation** | `explain()` is a small function. The cost is the cohort that already bounced. |
| P7 approval fatigue | **LOW technically, ongoing** | Risk-based escalation + polymorphic readback are additive. Instrument confirm-rate to know if it is happening. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---|---|---|
| P1 readback bypasses the model | **v0.1** (type surface) + v0.2 (kernel) | Test: `perceived` cannot be granted by a transport with no readback sink; `ConsentAck.readbackHash` mismatch fails closed |
| P2 barge-in mints consent | **v0.1** (`deferUntilDelivered` signature) + v0.4 (Realtime wiring) | Test: review → truncate at 20% → confirm fails; `completion: "interrupted"` invalidates |
| P3 composition / `navigate` | **v0.1** (metadata + reference shape) + v0.2 (budgets) | Reference catalog has no free-string egress action; repeated-call breaker fires at N=3 |
| P4 lethal trifecta | **v0.1** (`readsUntrusted`) + v0.2 (build-time check) | Build fails on a stage with both an untrusted-reading and an egress action, absent explicit opt-in |
| P5 result-message policy | **v0.1** | Interpolating a raw string requires opt-in; length cap enforced; `reason` is a closed union type |
| P6 MSTI / confused deputy | **v0.1** (seal, register-once, `Map`, token shape) + v0.2 (server verify) | Second `registerHandler` throws; `dispatch("__proto__")` clean-fails; server rejects unsigned consent |
| P7 approval fatigue | **v0.2** (`impact`, escalation) + v0.3 (telemetry) | Confirm-rate and time-to-confirm are measurable; README claims match what is enforced |
| P8 Standard JSON Schema | **v0.1** | Snapshot test of emitted schemas; build rejects `{}` properties and strict-mode violations |
| P9 SSR singleton bleed | **v0.1** (lifecycle) + v0.2 (server) | Two instances isolated; SSR-constructed instance refuses `dispatch`; no module-scoped example in docs |
| P10 ESM-only / packaging | **v0.1** (CI) | `publint` + `attw` green; pack-and-install smoke test imports from ESM, CJS, and a bundler |
| P11 Svelte compiler constraint | **v0.1** (ship Svelte second) | Example app consumes the tarball and demonstrates live reactivity |
| P12 React 19 compiler friction | **v0.1** (React adapter) | Example app builds with React Compiler enabled and zero adapter-induced lint errors |
| P13 adapter contract versioning | **v0.1** (packaging) | Mismatched core/adapter pair produces an actionable runtime error, not a silent failure |
| P14 instrumentation plateau | **v0.1** (`explain()` + zero-bridge path), v0.3 (overlay) | Timed first-run: install → one working action in under five minutes, no bridge required |
| Action ledger / EU AI Act Art. 50 | **v0.2** | Append-only ledger records redacted args + consent artifact; documented as a compliance aid |
| P18 WebMCP alignment | **v0.1** (metadata vocabulary), v0.4 (transport) | `ActionDefinition` metadata maps 1:1 onto `readOnlyHint` / `untrustedContentHint` / char budgets |

**Recommended roadmap adjustments implied by this research:**

1. **Move `concierge.explain()` and the zero-bridge path from v0.3 into v0.1.** The instrumentation plateau (P14) is the top adoption risk and `PROJECT.md` already names it; the mitigation is currently two milestones downstream of the risk.
2. **Move the consent *type surface* fully into v0.1, even though the kernel ships in v0.2.** `ConsentPolicy`, `ConsentAck`, `ConsentGrade`, `deferUntilDelivered`, and the server-token shape are public types. Getting them wrong in v0.1 and fixing them in v0.2 is a breaking change before the library has a reason to exist.
3. **Sequence Svelte immediately after React**, not last — it is the adapter with a compiler-level constraint and therefore the one that actually validates "framework-agnostic."
4. **Add a packaging/CI phase to v0.1** (`publint`, `attw`, pack-and-install, `CONTRACT_VERSION`) while there is one package instead of eight.

---

## Sources

**Security — standards and taxonomy**
- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) — published 2025-12-09; ASI01–ASI10. HIGH.
- [OWASP Top 10 for Agentic Applications 2026 explained (Cycode)](https://cycode.com/blog/owasp-top-10-agentic-applications/) — full ASI01–ASI10 list with mitigations, incl. ASI09 "forced, explicit confirmations that show the raw action rather than the agent's summary." MEDIUM (secondary source for a HIGH-confidence primary).
- [OWASP Agentic Security Initiative](https://genai.owasp.org/initiatives/agentic-security-initiative/). HIGH.
- [OWASP Top 10 for LLM Applications 2025 (PDF)](https://owasp.org/www-project-top-10-for-large-language-model-applications/assets/PDF/OWASP-Top-10-for-LLMs-v2025.pdf) — LLM01 Prompt Injection; still the current LLM-app list, now complemented by the agentic list. HIGH.

**Security — attack research**
- [The lethal trifecta for AI agents (Simon Willison, 2025-06-16)](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/). HIGH.
- [STAC: When Innocent Tools Form Dangerous Chains to Jailbreak LLM Agents (arXiv 2509.25624)](https://arxiv.org/html/2509.25624v1) — <2% per-step harmfulness, >90% composed ASR. HIGH.
- [Unsafe Only in Combination: Interaction-Barrier Shielding for Tool-Using LLM Agents (OpenReview)](https://openreview.net/forum?id=v2QHWcC0UC). MEDIUM.
- [WebMCP Tool Surface Poisoning: Runtime Manipulation Attacks on LLM Agents (arXiv 2606.06387)](https://arxiv.org/html/2606.06387) — Mid-Session Tool Injection, Tool Hijacking, Tool Framing; third-party-script threat model. HIGH.
- [MCP Security Notification: Tool Poisoning Attacks (Invariant Labs)](https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks) — original tool poisoning / rug pull / shadowing disclosure. HIGH.
- [mcp-injection-experiments (Invariant Labs)](https://github.com/invariantlabs-ai/mcp-injection-experiments). HIGH.
- [Model Context Protocol has prompt injection security problems (Simon Willison)](https://simonwillison.net/2025/Apr/9/mcp-prompt-injection/). HIGH.
- [Defense Against Indirect Prompt Injection via Tool Result Parsing (arXiv 2601.04795)](https://arxiv.org/abs/2601.04795). MEDIUM.
- [IPIGuard: Tool Dependency Graph-Based Defense (arXiv 2508.15310)](https://arxiv.org/pdf/2508.15310). MEDIUM.
- [Defeating Prompt Injections by Design — CaMeL (arXiv 2503.18813)](https://arxiv.org/pdf/2503.18813) — control/data-flow separation; capability-based egress policy. HIGH.
- [Avoiding MCP Confused Deputy (Christian Posta)](https://blog.christianposta.com/avoiding-mcp-confused-deputy-with-aauth/). MEDIUM.
- [MCP Threat Modeling: 6 Critical Attack Vectors (Aembit)](https://aembit.io/blog/mcp-threat-modeling-attack-surface-security/). MEDIUM.

**Security — human factors**
- [How Polymorphic Warnings Reduce Habituation in the Brain (CHI 2015, ACM)](https://dl.acm.org/doi/10.1145/2702123.2702322) — fMRI; drop after the second exposure. HIGH.
- [Tuning Out Security Warnings: A Longitudinal Examination of Habituation (MIS Quarterly 42:2)](https://misq.umn.edu/misq/article/42/2/355/1716/Tuning-Out-Security-Warnings-A-Longitudinal) — fMRI + eye tracking + field experiment. HIGH.
- [The HITL Rubber Stamp Problem (TianPan.co, 2026-04)](https://tianpan.co/blog/2026-04-15-human-in-the-loop-rubber-stamp) — Parasuraman/Molloy/Singh complacency; +19pp / +5pp deference figures. MEDIUM (secondary; underlying human-factors literature is HIGH).
- [Approval Fatigue: Why "Confirm Everything" Breaks HITL AI](https://getmrmr.com/blog/approval-fatigue) — 99.7%-by-day-3 field report; risk-signal escalation. LOW–MEDIUM (industry report).
- [What Air Canada Lost in 'Remarkable' Lying AI Chatbot Case (Forbes)](https://www.forbes.com/sites/marisagarcia/2024/02/19/what-air-canada-lost-in-remarkable-lying-ai-chatbot-case/) and [CBC coverage](https://www.cbc.ca/news/canada/british-columbia/air-canada-chatbot-lawsuit-1.7116416) — operator liable for model output. HIGH.

**Vendor documentation**
- [OpenAI — Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations) — `response.done`, `response.output_audio.done`, `input_audio_buffer.speech_started`, `conversation.item.truncate`, WebRTC auto-truncation on interruption, explicit `response.create` after `function_call_output`. HIGH.
- [OpenAI — Function calling](https://developers.openai.com/api/docs/guides/function-calling) — strict-mode constraints. HIGH.
- [Chrome — WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools) — `untrustedContentHint`, `readOnlyHint`, `exposedTo`, character budgets. HIGH.
- [Chrome — Agent security considerations for WebMCP](https://developer.chrome.com/docs/agents/security). HIGH.
- [Chrome — WebMCP overview](https://developer.chrome.com/docs/ai/webmcp) and [origin trial announcement](https://developer.chrome.com/blog/ai-webmcp-origin-trial). HIGH.
- [Standard Schema](https://standardschema.dev/) and [Standard JSON Schema v1 spec](https://raw.githubusercontent.com/standard-schema/standard-schema/main/packages/spec/json-schema.md) — `~standard.jsonSchema.input/output`, targets, implementer list, input≠output caveat. HIGH (via Context7 `/standard-schema/standard-schema` + source).
- [Zod — JSON Schema](https://zod.dev/json-schema) — unrepresentable types, `unrepresentable: "any"`, `io: input|output`. HIGH.
- [Svelte — `.svelte.js`/`.svelte.ts` files and `$state` across modules](https://svelte.dev/docs/svelte/$state) — runes are compiler keywords; reassigned `$state` cannot be exported. HIGH (via Context7 `/sveltejs/svelte`).
- [React — `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) and [ref lint rules](https://react.dev/reference/eslint-plugin-react-hooks/lints/refs). HIGH.

**Library engineering**
- [CopilotKit in Production: Where the Abstraction Holds and Where You're on Your Own (Ranjan Kumar)](https://ranjankumar.in/copilotkit-in-production-where-the-abstraction-holds-and-where-you-are-on-your-own) — the closest prior-art post-mortem: multi-tenant state bleed, no error taxonomy, no telemetry, ~200-concurrent-session re-render thrash. MEDIUM (single practitioner account, but highly specific and directly on-point).
- [TanStack Router #6924 — singleton `getRouter()` silently leaks request-scoped state across requests](https://github.com/TanStack/router/issues/6924). HIGH.
- [TanStack Table framework adapters (DeepWiki)](https://deepwiki.com/tanstack/table/5-framework-adapters) — core-plus-adapter pattern; Vue `mergeProxy`. MEDIUM.
- [TypeScript in 2025 with ESM and CJS npm publishing is still a mess (Liran Tal)](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing). MEDIUM.
- [Dual Publishing ESM and CJS with tsup and Are the Types Wrong? (johnnyreilly)](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong). MEDIUM.
- [tshy — TypeScript HYbridizer](https://isaacs.github.io/tshy/) — dual-package-hazard framing. MEDIUM.
- [Node.js — Peer Dependencies](https://nodejs.org/en/blog/npm/peer-dependencies). HIGH.
- [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) and [React Compiler ref issues #35625 / #29106](https://github.com/react/react/issues/35625). HIGH.
- [Autocapture vs. Manual Tracking (Amplitude)](https://amplitude.com/explore/data/autocapture-vs-manual-tracking) — the instrumentation-coverage plateau and why Amplitude reversed position. MEDIUM.

**Observability / compliance**
- [Redacting PII in LLM Traces Without Losing Debuggability](https://dev.to/gabrielanhaia/redacting-pii-in-llm-traces-without-losing-debuggability-2jll) — OpenTelemetry GenAI conventions place tool-call arguments on spans. MEDIUM.
- [EU AI Act Article 50](https://artificialintelligenceact.eu/article/50/) and [Transparency obligations FAQ (European Commission)](https://digital-strategy.ec.europa.eu/en/faqs/transparency-obligations-under-article-50-ai-act) — applies **2 August 2026**. HIGH.
- [EU AI Act Transparency Obligations: Preparing for Compliance by 2 August 2026 (Sidley)](https://datamatters.sidley.com/2026/06/24/eu-ai-act-transparency-obligations-preparing-for-compliance-by-2-august-2026/). MEDIUM.

**Ecosystem positioning**
- [The State of WebMCP: July 2026 (Spronta)](https://www.spronta.com/blog/state-of-webmcp-july-2026/) — origin trial in Chrome 149; `navigator.modelContext` deprecated in Chrome 150 in favour of `document`; W3C Web ML CG, not yet on the Standards Track; only Gemini-in-Chrome consumes tools today. MEDIUM.
- [The WebMCP Tools You Expose To Agents Can Be Used To Hijack Them (Search Engine Journal)](https://www.searchenginejournal.com/the-webmcp-tools-you-expose-to-agents-can-be-used-to-hijack-them/579204/). MEDIUM.
- [Known Security Issues With WebMCP (MCP-B wiki)](https://github.com/MiguelsPizza/WebMCP/wiki/Known-Security-Issues-With-WebMCP) — same-origin-policy bypass via agent-mediated cross-origin data flow. MEDIUM.

---

## Appendix: P18 — Positioning risk worth tracking, not a defect

**WebMCP is the same idea with a browser-native API surface**, authored by Google and Microsoft engineers in the W3C Web Machine Learning Community Group, announced 2026-02-10, in origin trial in Chrome 149. It lets a page register typed tools with JSON Schema and an execute callback. That is Concierge's premise, standardised.

It is not a reason to change course, for a specific reason: **WebMCP has no safety kernel.** Chrome's own guidance concedes *"it's impossible to guarantee safety inside of a large language model"* and offers annotation *hints* — `readOnlyHint`, `untrustedContentHint`, `exposedTo`, character budgets — plus advice. There is no consent grade, no commit window, no reference-identity dedup, no stage scoping, no build-time refusal. And the security literature has already found its runtime tool surface trivially poisonable by third-party scripts (arXiv 2606.06387).

Two concrete implications, one cheap and one free:

1. **Adopt WebMCP's metadata vocabulary in v0.1.** `readOnlyHint`, `untrustedContentHint`, and the char budgets map directly onto controls this document already recommends (P4, P5). Aligning the names costs nothing now and makes a future `@fullselfbrowsing/concierge-webmcp` a *projection* rather than a translation layer. Getting the metadata shape wrong is the expensive mistake; adding a transport later is the cheap one.
2. **Treat WebMCP as transport #3, and say so publicly.** The positioning writes itself: WebMCP is how the browser asks; Concierge is what decides whether to answer. That is a stronger story than competing with a Chrome-shipped API, and it is true.

---
*Pitfalls research for: framework-agnostic TypeScript SDK for consent-gated in-app AI agent actuation*
*Researched: 2026-07-27*
