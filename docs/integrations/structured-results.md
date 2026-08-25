# Structured action results

Concierge 0.3 lets an action return schema-controlled JSON data to the calling
agent while keeping observer exposure independent and explicit.

## Declare the output

An action may return `data` only when it declares `output.schema` and
`output.redact`. The schema is any Standard Schema validator, including Zod,
Valibot, and ArkType.

```ts
import { defineAction } from "@full-self-browsing/concierge";
import { z } from "zod";

const visibleResultsSchema = z.object({
  kind: z.literal("visible-results"),
  hotels: z.array(z.object({
    id: z.string(),
    name: z.string(),
    nightlyRate: z.number().finite(),
  })),
});

export const getVisibleResults = defineAction({
  name: "getVisibleResults",
  description: "Read the hotels visible on the current results page.",
  schema: z.object({}),
  redact: "drop",
  output: {
    schema: visibleResultsSchema,
    redact: "drop",
  },
  effects: { readOnly: true, destructive: false, idempotent: true },
  handler: ({ bridge }) => ({
    ok: true,
    message: "Read the visible hotel results.",
    data: {
      kind: "visible-results",
      hotels: bridge?.snapshot.visibleHotels() ?? [],
    },
  }),
});
```

`defineAction` infers the handler's data type from the output schema. Existing
actions without an output declaration continue to return only `ok`, `reason`,
and `message`.

## Runtime boundary

After the handler settles, Concierge:

1. reads only guarded own result properties;
2. validates `data` with the declared output schema;
3. uses the validator's transformed output;
4. rejects non-JSON values, sparse arrays, accessors, exotic instances,
   repeated aliases, and cycles;
5. detaches and recursively freezes the accepted value; and
6. enforces `ConciergeConfig.maxActionDataBytes`.

The default limit is `DEFAULT_ACTION_DATA_MAX_BYTES`, currently 262,144 UTF-8
JSON bytes. An output that fails any step becomes a bounded
`invalid_result`; rejected data is never copied into diagnostics.

`data` may accompany success or failure. Use `precondition_failed` when the
call is structurally valid but current application state blocks it, and keep
domain-specific detail inside the output schema:

```ts
return {
  ok: false,
  reason: "precondition_failed",
  message: "More than one hotel matched.",
  data: {
    kind: "domain-failure",
    code: "hotel-ambiguous",
    candidateIds: ["hotel-a", "hotel-b"],
  },
};
```

The 180-character `message` limit and closed core `ReasonCode` union remain in
place. Put long authoritative narration in validated data rather than opening
either field.

## Observer redaction

`output.redact` controls only `onDispatch` observer exposure. It never removes
validated data from the result sent back to the agent.

- `"drop"` emits `{ kind: "dropped" }`.
- `"passthrough"` emits a second detached, frozen copy.
- A projection emits only its returned JSON-safe subset.

Terminal lifecycle events expose the status under `event.result` and the
separate output decision under `event.resultData`. A throwing, unsafe, or
oversized projection fails closed to `dropped`. Built-in telemetry and
`FailureOutcome` never include structured data.

## Transport behavior

`DispatchRow.result`, ordered batches, workflow child results, AI SDK result
parts, signed browser reports, and the OpenAI Realtime codec all carry `data`
as an ordinary JSON value. Adapters must not flatten it, silently discard it,
or encode it as a nested JSON string.
