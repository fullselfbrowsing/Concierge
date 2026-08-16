export const CONTRACT_KEY = Symbol.for(
  "@fullselfbrowsing/concierge.contract",
);

export function resetContract(): void {
  delete (globalThis as Record<symbol, unknown>)[CONTRACT_KEY];
}

export function emittedTool(
  name: string,
  description = `Run ${name}.`,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    type: "function",
    name,
    description,
    parameters: Object.freeze({
      type: "object",
      properties: Object.freeze({
        value: Object.freeze({ type: "string" }),
      }),
      required: Object.freeze(["value"]),
      additionalProperties: false,
    }),
  });
}

export function fakeConcierge(
  resolve: (context: Record<string, unknown>) => Readonly<Record<string, unknown>>,
  dispatchBatch?: (
    context: Record<string, unknown>,
    batch: Record<string, unknown>,
  ) => Promise<Readonly<Record<string, unknown>>>,
): Record<string, unknown> {
  return {
    resolveCatalog: resolve,
    dispatch: async () => ({ ok: true, message: "Done." }),
    dispatchBatch: dispatchBatch ?? (async (_context, batch) => ({
      kind: "completed",
      rows: (batch.calls as Array<Record<string, unknown>>).map((call, index) =>
        Object.freeze({
          dispatchId: `dispatch-${index}`,
          callId: call.callId,
          name: call.name,
          outputIndex: call.outputIndex,
          result: Object.freeze({ ok: true, message: "Done." }),
        })),
    })),
    onDispatch: () => () => undefined,
  };
}

export function toggleBase64UrlByte(value: string): string {
  const first: string = value[0] ?? "";
  return `${first === "A" ? "B" : "A"}${value.slice(1)}`;
}
