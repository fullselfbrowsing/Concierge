export function schema(validate = (value) => ({ value })) {
  return {
    "~standard": {
      version: 1,
      vendor: "concierge-v2-session-test",
      validate,
    },
  };
}

export function action(name, handler, options = {}) {
  return {
    name,
    description: `Run ${name}.`,
    schema: schema(options.validate),
    jsonSchema: { type: "object" },
    redact: "drop",
    effects: { readOnly: true },
    handler,
    ...options,
    validate: undefined,
  };
}

export function conciergeFor(createConcierge, actions, options = {}) {
  return createConcierge({
    stages: [{
      id: "active",
      match: (context) => context.page === "active",
      actions,
    }],
    ...options,
  });
}

export function transportHarness(overrides = {}) {
  let status = overrides.status ?? "connected";
  let batchHandler;
  const statusHandlers = new Set();
  const ackHandlers = new Set();
  const publications = [];
  let batchUnsubscribes = 0;
  let statusUnsubscribes = 0;
  let ackUnsubscribes = 0;
  const transport = {
    capabilities: Object.freeze({
      consentGrade: "none",
      userTurnIdentity: "none",
      parallelCalls: true,
      dynamicCatalog: true,
      acknowledgesCatalog: false,
      ...overrides.capabilities,
    }),
    get status() {
      return status;
    },
    setCatalog(catalog) {
      if (overrides.setCatalog) return overrides.setCatalog(catalog);
      publications.push(catalog);
    },
    onStatusChange(handler) {
      statusHandlers.add(handler);
      return () => {
        statusUnsubscribes += 1;
        statusHandlers.delete(handler);
      };
    },
    onToolBatch(handler) {
      batchHandler = handler;
      return () => {
        batchUnsubscribes += 1;
        if (batchHandler === handler) batchHandler = undefined;
      };
    },
    onCatalogAcknowledged(handler) {
      ackHandlers.add(handler);
      return () => {
        ackUnsubscribes += 1;
        ackHandlers.delete(handler);
      };
    },
  };

  return {
    transport,
    publications,
    get batchUnsubscribes() {
      return batchUnsubscribes;
    },
    get statusUnsubscribes() {
      return statusUnsubscribes;
    },
    get ackUnsubscribes() {
      return ackUnsubscribes;
    },
    dispatch(batch) {
      if (!batchHandler) throw new Error("No batch handler is registered.");
      return batchHandler(batch);
    },
    setStatus(next) {
      status = next;
      for (const handler of [...statusHandlers]) handler(next);
    },
    acknowledge(ack) {
      for (const handler of [...ackHandlers]) handler(ack);
    },
    // The same registration `transport.onCatalogAcknowledged` performs,
    // reachable without going through the transport. Lets a test replace the
    // subscriber with a `this`-reading method and still wire up the harness.
    subscribeAck(handler) {
      ackHandlers.add(handler);
      return () => {
        ackUnsubscribes += 1;
        ackHandlers.delete(handler);
      };
    },
  };
}

export function batch(catalog, calls, overrides = {}) {
  return {
    sessionId: "session-v2",
    responseId: "response-v2",
    userTurnId: "turn-v2",
    catalogRevision: catalog.revision,
    calls,
    ...overrides,
  };
}

export function call(callId, name, outputIndex = 0, argumentsText = "{}") {
  return { callId, name, outputIndex, arguments: argumentsText };
}

export async function flush(count = 8) {
  for (let index = 0; index < count; index += 1) await Promise.resolve();
}
