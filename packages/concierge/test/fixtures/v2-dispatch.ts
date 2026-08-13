/**
 * Test-side request builders for suites that exercise the public v2 runtime.
 * They keep catalog admission and complete invocation identity explicit without
 * duplicating envelope construction in every security regression.
 */
export function dispatchV2(concierge, context, name, input, meta = {}) {
  const catalog = concierge.resolveCatalog(context);
  let callId;
  let responseId;
  let userTurnId;
  let outputIndex;
  let signal;
  let deferUntilDelivered;
  let invalid = false;
  try {
    if (typeof meta !== "object" || meta === null) invalid = true;
    else {
      callId = meta.callId;
      responseId = meta.responseId;
      userTurnId = meta.userTurnId;
      outputIndex = meta.outputIndex;
      signal = meta.signal;
      deferUntilDelivered = meta.deferUntilDelivered;
      invalid =
        (callId !== undefined && typeof callId !== "string") ||
        (responseId !== undefined && typeof responseId !== "string") ||
        (userTurnId !== undefined && typeof userTurnId !== "string") ||
        (outputIndex !== undefined &&
          (typeof outputIndex !== "number" || !Number.isSafeInteger(outputIndex) || outputIndex < 0)) ||
        (signal !== undefined &&
          (typeof signal !== "object" || signal === null ||
            typeof signal.aborted !== "boolean" ||
            typeof signal.addEventListener !== "function" ||
            typeof signal.removeEventListener !== "function")) ||
        (deferUntilDelivered !== undefined && typeof deferUntilDelivered !== "function");
    }
  } catch {
    invalid = true;
  }

  if (invalid) {
    return concierge.dispatch(context, {
      name,
      input,
      catalogRevision: catalog.revision,
      identity: null,
    });
  }

  const identity = typeof callId === "string"
    ? {
        sessionId: meta.sessionId ?? "test-session",
        responseId: responseId ?? "test-response",
        callId,
        userTurnId: userTurnId ?? "test-turn",
        outputIndex: outputIndex ?? 0,
      }
    : undefined;

  return concierge.dispatch(context, {
    name,
    input,
    catalogRevision: catalog.revision,
    identity,
    signal,
    deferUntilDelivered,
  });
}

export function batchV2(concierge, context, calls, extra = {}) {
  const catalog = concierge.resolveCatalog(context);
  return {
    sessionId: extra.sessionId ?? "test-session",
    responseId: extra.responseId ?? "test-response",
    userTurnId: extra.userTurnId ?? "test-turn",
    catalogRevision: extra.catalogRevision ?? catalog.revision,
    calls,
    signal: extra.signal,
    deferUntilDelivered: extra.deferUntilDelivered,
  };
}

export function dispatchRowsV2(concierge, context, batch) {
  const catalog = concierge.resolveCatalog(context);
  const envelope = {
    sessionId: "test-session",
    responseId: "test-response",
    userTurnId: "test-turn",
    catalogRevision: catalog.revision,
    calls: [],
  };
  const defaults = {
    sessionId: "test-session",
    responseId: "test-response",
    userTurnId: "test-turn",
    catalogRevision: catalog.revision,
    calls: [],
  };
  for (const key of [
    "sessionId",
    "responseId",
    "userTurnId",
    "catalogRevision",
    "calls",
    "signal",
    "deferUntilDelivered",
  ]) {
    let descriptor;
    try {
      descriptor = Object.getOwnPropertyDescriptor(batch, key);
    } catch {
      Object.defineProperty(envelope, key, {
        configurable: true,
        enumerable: true,
        get() {
          throw new Error("unreadable test batch metadata");
        },
      });
      continue;
    }
    if (descriptor !== undefined) Object.defineProperty(envelope, key, descriptor);
    else if (Object.hasOwn(defaults, key)) envelope[key] = defaults[key];
  }
  return concierge.dispatchBatch(context, envelope).then((outcome) => outcome.rows);
}
