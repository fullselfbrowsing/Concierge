import "fake-indexeddb/auto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CatalogRevision,
  Concierge,
  DispatchEvent,
  DispatchListener,
  WorkflowControls,
} from "../../src/index.js";
import { createConcierge } from "../../src/index.js";
import {
  getConciergeTelemetryStatus,
  mountConciergeTelemetry,
  onConciergeTelemetryStatusChange,
  setConciergeTelemetryEnabled,
} from "../../src/telemetry/index.js";
import {
  __flushConciergeTelemetryForTests,
  __putInFlightEventPostForTests,
  __putRuntimeLeaseForTests,
  __resetConciergeTelemetryForTests,
  __removeInFlightEventPostForTests,
  __renewInFlightEventPostForTests,
  __retryServerDeletionsForTests,
  __setFlushLeaseForTests,
  __setPendingTokensForTests,
  __setTelemetryRequestTimeoutForTests,
  __telemetrySnapshotForTests,
} from "../../src/telemetry/runtime.js";

const EVENT_KEYS = [
  "active_agent_count",
  "active_count_version",
  "event_id",
  "event_type",
  "install_uuid",
  "mcp_client",
  "model",
  "tokens_in",
  "tokens_out",
  "ts_minute",
] as const;

function runtimeStub(): {
  readonly concierge: Concierge;
  readonly emitAccepted: (dispatchId: string) => void;
  readonly listeners: () => number;
} {
  const listeners = new Set<DispatchListener>();
  const revision = Symbol("telemetry-test") as CatalogRevision;
  const concierge: Concierge = {
    dispatch: async () => ({ ok: true, message: "Done." }),
    dispatchBatch: async () => ({ kind: "completed", rows: [] }),
    resolveCatalog: () => ({ stage: null, tools: [], revision }),
    onDispatch: (listener): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
    explain: () => ({ stage: null, stages: [], catalog: [] }),
  };
  return {
    concierge,
    listeners: (): number => listeners.size,
    emitAccepted: (dispatchId): void => {
      const event: DispatchEvent = {
        dispatchId,
        phase: "accepted",
        name: "sensitive-action-name",
        stage: "sensitive-stage",
        catalogRevision: revision,
        identity: null,
        lineage: { rootDispatchId: dispatchId, depth: 0 },
        input: { kind: "included", value: { secret: "must-not-leak" } },
        terminalAction: false,
        terminalEntered: false,
      };
      for (const listener of listeners) void listener(event);
    },
  };
}

function response(status = 204): Response {
  return new Response(null, { status });
}

async function settleStorage(): Promise<void> {
  await new Promise<void>((resolve): void => setTimeout(resolve, 0));
  await new Promise<void>((resolve): void => setTimeout(resolve, 0));
}

async function createVersionOneDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject): void => {
    const request: IDBOpenDBRequest = indexedDB.open(
      "fullselfbrowsing-concierge-telemetry",
      1,
    );
    request.onupgradeneeded = (): void => {
      const database: IDBDatabase = request.result;
      const stateStore: IDBObjectStore = database.createObjectStore("state", {
        keyPath: "key",
      });
      database.createObjectStore("events", { keyPath: "event_id" });
      database.createObjectStore("runtime-leases", { keyPath: "runtimeId" });
      database.createObjectStore("deletion-retries", {
        keyPath: "installUuid",
      });
      stateStore.put({
        key: "singleton",
        installUuid: "00000000-0000-4000-8000-000000000001",
        installAnnounced: true,
        tokensIn: 300,
        tokensOut: 600,
        flushOwner: null,
        flushExpiresAt: 0,
        nextQueueOrder: 7,
      });
    };
    request.onsuccess = (): void => {
      request.result.close();
      resolve();
    };
    request.onerror = (): void => reject(
      request.error ?? new Error("failed to create the v1 telemetry fixture"),
    );
  });
}

describe("Concierge browser telemetry", () => {
  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn(async (): Promise<Response> => response()));
    await __resetConciergeTelemetryForTests();
  });

  afterEach(async () => {
    await __resetConciergeTelemetryForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ships only the documented browser-subpath runtime exports", async () => {
    const artifact = await import("../../dist/telemetry/index.js");
    expect(Object.keys(artifact).sort()).toEqual([
      "getConciergeTelemetryStatus",
      "mountConciergeTelemetry",
      "onConciergeTelemetryStatusChange",
      "setConciergeTelemetryEnabled",
    ]);
  });

  it("upgrades a v1 database in place without losing telemetry state", async () => {
    await createVersionOneDatabase();

    const snapshot = await __telemetrySnapshotForTests();

    expect(snapshot.state).toMatchObject({
      installUuid: "00000000-0000-4000-8000-000000000001",
      installAnnounced: true,
      tokensIn: 300,
      tokensOut: 600,
      nextQueueOrder: 7,
    });
    expect(snapshot.events).toEqual([]);
    expect(snapshot.leases).toEqual([]);
    expect(snapshot.inFlightPosts).toEqual([]);
  });

  it("reopens IndexedDB after a versionchange close instead of failing closed", async () => {
    await __telemetrySnapshotForTests();

    await new Promise<void>((resolve, reject): void => {
      const request: IDBOpenDBRequest = indexedDB.deleteDatabase(
        "fullselfbrowsing-concierge-telemetry",
      );
      request.onsuccess = (): void => resolve();
      request.onerror = (): void => reject(
        request.error ?? new Error("failed to delete the telemetry database"),
      );
      request.onblocked = (): void => resolve();
    });
    await settleStorage();

    const snapshot = await __telemetrySnapshotForTests();
    const status = await getConciergeTelemetryStatus();
    expect(snapshot.state.key).toBe("singleton");
    expect(status.reason).not.toBe("storage_unavailable");
  });

  it("projects exactly ten fields and uses fixed estimates without content flow", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("one");
    runtime.emitAccepted("two");
    await settleStorage();

    await __flushConciergeTelemetryForTests("periodic");

    const calls = vi.mocked(fetch).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0]).toBe("https://full-selfbrowsing.com/api/telemetry/events");
    expect(calls[0]?.[1]).toMatchObject({
      credentials: "omit",
      referrerPolicy: "no-referrer",
      keepalive: true,
    });
    const body = JSON.parse(String(calls[0]?.[1]?.body));
    expect(body.events).toHaveLength(1);
    const event = body.events[0];
    expect(Object.keys(event).sort()).toEqual(EVENT_KEYS);
    expect(event).toMatchObject({
      mcp_client: "Concierge",
      model: "unknown",
      tokens_in: 200,
      tokens_out: 400,
      active_agent_count: 1,
      event_type: "periodic",
      active_count_version: 2,
    });
    expect(JSON.stringify(body)).not.toContain("sensitive");
    expect(JSON.stringify(body)).not.toContain("must-not-leak");
    unmount();
  });

  it("counts failed, cancelled, root, and child occurrences while core retries stay deduplicated", async () => {
    const standardSchema = {
      "~standard": {
        version: 1 as const,
        vendor: "telemetry-test",
        validate: (value: unknown) => ({ value }),
      },
    };
    const child = {
      name: "child",
      description: "Run child.",
      schema: standardSchema,
      jsonSchema: { type: "object" },
      redact: "drop" as const,
      effects: { readOnly: true },
      handler: () => ({ ok: true as const, message: "Child." }),
    };
    const parent = {
      name: "parent",
      description: "Run parent.",
      schema: standardSchema,
      jsonSchema: { type: "object" },
      redact: "drop" as const,
      effects: { readOnly: true },
      handler: async ({ workflow }: { readonly workflow: WorkflowControls }) => {
        const first = workflow.run({ stepId: "one", name: "child", input: {} });
        const retry = workflow.run({ stepId: "one", name: "child", input: {} });
        expect(retry).toBe(first);
        return first;
      },
    };
    const failed = {
      ...child,
      name: "failed",
      handler: () => ({ ok: false as const, reason: "handler_error" as const, message: "Failed." }),
    };
    const cancelled = {
      ...child,
      name: "cancelled",
      handler: () => ({ ok: false as const, reason: "aborted" as const, message: "Cancelled." }),
    };
    const concierge = createConcierge({
      stages: [{
        id: "active",
        match: (context): boolean => context.pathname === "/",
        actions: [child, parent, failed, cancelled],
      }],
    });
    const unmount = mountConciergeTelemetry(concierge);
    const catalog = concierge.resolveCatalog({ pathname: "/" });
    const request = {
      name: "parent",
      input: {},
      catalogRevision: catalog.revision,
      identity: {
        sessionId: "private-session",
        responseId: "private-response",
        callId: "parent-call",
        userTurnId: "private-turn",
        outputIndex: 0,
      },
    } as const;
    const first = concierge.dispatch({ pathname: "/" }, request);
    const retry = concierge.dispatch({ pathname: "/" }, request);
    expect(retry).toBe(first);
    await first;
    await concierge.dispatch({ pathname: "/" }, {
      ...request,
      name: "failed",
      identity: { ...request.identity, callId: "failed-call" },
    });
    await concierge.dispatch({ pathname: "/" }, {
      ...request,
      name: "cancelled",
      identity: { ...request.identity, callId: "cancelled-call" },
    });
    await settleStorage();

    const snapshot = await __telemetrySnapshotForTests();
    expect(snapshot.state.tokensIn).toBe(400);
    expect(snapshot.state.tokensOut).toBe(800);
    unmount();
  });

  it("deduplicates same-object mounts and counts different runtimes", async () => {
    const first = runtimeStub();
    const second = runtimeStub();
    const stopFirst = mountConciergeTelemetry(first.concierge);
    const stopDuplicate = mountConciergeTelemetry(first.concierge);
    const stopSecond = mountConciergeTelemetry(second.concierge);
    await settleStorage();

    const snapshot = await __telemetrySnapshotForTests();
    expect(snapshot.leases).toHaveLength(2);
    expect(first.listeners()).toBe(1);
    expect(second.listeners()).toBe(1);

    stopDuplicate();
    expect(first.listeners()).toBe(1);
    stopFirst();
    stopSecond();
    await settleStorage();
    expect((await __telemetrySnapshotForTests()).leases).toHaveLength(0);

    const remount = mountConciergeTelemetry(first.concierge);
    await settleStorage();
    expect((await __telemetrySnapshotForTests()).leases).toHaveLength(1);
    expect(first.listeners()).toBe(1);
    remount();
  });

  it("aggregates live cross-tab leases, expires crashes, and keeps hidden mounts", async () => {
    const now = Date.now();
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    await __putRuntimeLeaseForTests("other-tab-live", now + 60_000);
    await __putRuntimeLeaseForTests("other-tab-crashed", now - 1);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });

    await __flushConciergeTelemetryForTests("periodic");
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.events[0].active_agent_count).toBe(2);
    expect((await __telemetrySnapshotForTests()).leases).toHaveLength(2);
    unmount();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("allows only the IndexedDB flush-lease owner to send", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    await __setFlushLeaseForTests("competing-tab", Date.now() + 60_000);

    await __flushConciergeTelemetryForTests("periodic");
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await __setFlushLeaseForTests("competing-tab", Date.now() - 1);
    await __flushConciergeTelemetryForTests("periodic");
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    const owned = (await __telemetrySnapshotForTests()).state;
    expect(owned.flushOwner).not.toBeNull();
    expect(owned.flushExpiresAt).toBeGreaterThan(Date.now() + 5 * 60 * 1000);
    unmount();
  });

  it("sends one zero-token installation announcement, releases a later no-op grace leader, and sends idle heartbeats", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();

    await __flushConciergeTelemetryForTests("install");
    await __flushConciergeTelemetryForTests("install");
    expect((await __telemetrySnapshotForTests()).state.flushOwner).toBeNull();
    await __flushConciergeTelemetryForTests("periodic");

    const payloads = vi.mocked(fetch).mock.calls.map((call) =>
      JSON.parse(String(call[1]?.body)).events[0],
    );
    expect(payloads.map((event) => event.event_type)).toEqual([
      "install_announce",
      "periodic",
    ]);
    expect(payloads.every((event) => event.tokens_in === 0 && event.tokens_out === 0)).toBe(true);
    unmount();
  });

  it("uses the 30-second grace, five-minute jitter window, and one-minute lease renewal", async () => {
    const timeout = vi.spyOn(globalThis, "setTimeout");
    const interval = vi.spyOn(globalThis, "setInterval");
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await vi.waitFor(() => {
      expect(interval.mock.calls.some((call) => call[1] === 60_000)).toBe(true);
      expect(timeout.mock.calls.some((call) => call[1] === 30_000)).toBe(true);
      expect(timeout.mock.calls.some((call) =>
        typeof call[1] === "number" && call[1] >= 300_000 && call[1] <= 330_000,
      )).toBe(true);
    });
    unmount();
  });

  it("clamps cross-tab runtime totals to 64", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    for (let index = 0; index < 70; index += 1) {
      await __putRuntimeLeaseForTests(`other-tab-${index}`, Date.now() + 60_000);
    }

    await __flushConciergeTelemetryForTests("periodic");
    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(body.events[0].active_agent_count).toBe(64);
    unmount();
  });

  it("chunks totals at ten million and caps the persistent queue at 200", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    await __setPendingTokensForTests(10_000_100, 20_000_200);
    await __flushConciergeTelemetryForTests("periodic");

    const firstBody = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body));
    expect(firstBody.events).toHaveLength(3);
    expect(firstBody.events.reduce((sum: number, event: { tokens_in: number }) => sum + event.tokens_in, 0)).toBe(10_000_100);
    expect(firstBody.events.reduce((sum: number, event: { tokens_out: number }) => sum + event.tokens_out, 0)).toBe(20_000_200);
    expect(firstBody.events.every((event: { tokens_in: number; tokens_out: number }) =>
      event.tokens_in <= 10_000_000 && event.tokens_out <= 10_000_000,
    )).toBe(true);

    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(response(503));
    await __setPendingTokensForTests(2_010_000_000, 0);
    await __flushConciergeTelemetryForTests("periodic");
    const snapshot = await __telemetrySnapshotForTests();
    expect(snapshot.events).toHaveLength(200);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1);
    const cappedBody = String(vi.mocked(fetch).mock.calls[0]?.[1]?.body);
    expect(JSON.parse(cappedBody).events).toHaveLength(50);
    expect(new TextEncoder().encode(cappedBody).byteLength).toBeLessThanOrEqual(30 * 1024);
    unmount();
  });

  it("drops an event after five failed attempts", async () => {
    vi.mocked(fetch).mockResolvedValue(response(503));
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    await __flushConciergeTelemetryForTests("periodic");
    const firstId = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)).events[0].event_id;
    for (let attempt = 1; attempt < 5; attempt += 1) {
      await __flushConciergeTelemetryForTests("periodic");
    }
    expect(
      (await __telemetrySnapshotForTests()).events.find((event) => event.event_id === firstId)?.attempts,
    ).toBe(5);

    await __flushConciergeTelemetryForTests("periodic");
    expect(
      (await __telemetrySnapshotForTests()).events.some((event) => event.event_id === firstId),
    ).toBe(false);
    unmount();
  });

  it("drops queued events after 24 hours", async () => {
    vi.mocked(fetch).mockResolvedValue(response(503));
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    await __flushConciergeTelemetryForTests("periodic");
    const firstId = (await __telemetrySnapshotForTests()).events[0]?.event_id;
    expect(firstId).toBeDefined();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 24 * 60 * 60 * 1000 + 1);
    await __flushConciergeTelemetryForTests("periodic");
    expect(
      (await __telemetrySnapshotForTests()).events.some((event) => event.event_id === firstId),
    ).toBe(false);
    unmount();
  });

  it("honors Global Privacy Control even when enable is requested", async () => {
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("gpc-blocked");
    await settleStorage();

    expect(await setConciergeTelemetryEnabled(true)).toMatchObject({
      enabled: false,
      reason: "global_privacy_control",
    });
    expect((await __telemetrySnapshotForTests()).state.tokensIn).toBe(0);
    expect(vi.mocked(fetch)).not.toHaveBeenCalledWith(
      "https://full-selfbrowsing.com/api/telemetry/events",
      expect.anything(),
    );
    unmount();
    Reflect.deleteProperty(navigator, "globalPrivacyControl");
  });

  it("notifies status listeners when another tab writes the shared opt-out marker", async () => {
    const statuses: Array<Awaited<ReturnType<typeof getConciergeTelemetryStatus>>> = [];
    const unsubscribe = onConciergeTelemetryStatusChange((status): void => {
      statuses.push(status);
    });
    await vi.waitFor(() => expect(statuses.at(-1)).toMatchObject({
      enabled: true,
      reason: "enabled",
    }));

    localStorage.setItem("fullselfbrowsing.concierge.telemetry.disabled", "1");
    window.dispatchEvent(new StorageEvent("storage", {
      key: "fullselfbrowsing.concierge.telemetry.disabled",
      newValue: "1",
    }));
    await vi.waitFor(() => expect(statuses.at(-1)).toMatchObject({
      enabled: false,
      reason: "user_opt_out",
    }));
    unsubscribe();
  });

  it("fails closed when browser storage is unavailable", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    expect(runtime.listeners()).toBe(0);
    await expect(runtime.concierge.dispatch({ pathname: "/" }, {
      name: "anything",
      input: {},
      catalogRevision: Symbol("unused") as CatalogRevision,
    })).resolves.toEqual({ ok: true, message: "Done." });
    expect(await getConciergeTelemetryStatus()).toMatchObject({
      enabled: false,
      reason: "storage_unavailable",
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    unmount();
  });

  it("fails closed after a later IndexedDB transaction error without affecting dispatch", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    const transaction = vi.spyOn(IDBDatabase.prototype, "transaction")
      .mockImplementation((): IDBTransaction => {
        throw new Error("transaction unavailable");
      });

    runtime.emitAccepted("storage-failure");
    await settleStorage();
    await expect(runtime.concierge.dispatch({ pathname: "/" }, {
      name: "anything",
      input: {},
      catalogRevision: Symbol("unused") as CatalogRevision,
    })).resolves.toEqual({ ok: true, message: "Done." });
    expect(await getConciergeTelemetryStatus()).toMatchObject({
      enabled: false,
      reason: "storage_unavailable",
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    transaction.mockRestore();
    unmount();
  });

  it("does not send when the durable in-flight POST record cannot be written", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    await settleStorage();
    await __setPendingTokensForTests(100, 200);
    const originalPut = IDBObjectStore.prototype.put;
    const put = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(
      function (this: IDBObjectStore, value: unknown, key?: IDBValidKey) {
        if (this.name === "in-flight-posts") {
          throw new Error("in-flight POST storage unavailable");
        }
        return key === undefined
          ? originalPut.call(this, value)
          : originalPut.call(this, value, key);
      },
    );

    await __flushConciergeTelemetryForTests("periodic");

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(await getConciergeTelemetryStatus()).toMatchObject({
      enabled: false,
      reason: "storage_unavailable",
    });
    put.mockRestore();
    unmount();
  });

  it("aborts a hung event POST and leaves the event retryable", async () => {
    __setTelemetryRequestTimeoutForTests(1);
    const requestSignals: AbortSignal[] = [];
    const intervals = vi.spyOn(globalThis, "setInterval");
    const clearedIntervals = vi.spyOn(globalThis, "clearInterval");
    vi.mocked(fetch).mockImplementation(async (_input, init): Promise<Response> => {
      const signal = init?.signal;
      if (signal === null || signal === undefined) {
        throw new Error("expected an abort signal");
      }
      requestSignals.push(signal);
      return new Promise<Response>((_resolve, reject): void => {
        signal.addEventListener(
          "abort",
          (): void => reject(new Error("request aborted")),
          { once: true },
        );
      });
    });
    await __setPendingTokensForTests(100, 200);

    await __flushConciergeTelemetryForTests("periodic");

    expect(requestSignals).toHaveLength(1);
    expect(requestSignals[0]?.aborted).toBe(true);
    const snapshot = await __telemetrySnapshotForTests();
    expect(snapshot.events).toHaveLength(1);
    expect(snapshot.events[0]?.attempts).toBe(1);
    expect(snapshot.inFlightPosts).toEqual([]);
    const renewalIndex = intervals.mock.calls.findIndex((call) => call[1] === 60_000);
    expect(renewalIndex).toBeGreaterThanOrEqual(0);
    expect(clearedIntervals).toHaveBeenCalledWith(
      intervals.mock.results[renewalIndex]?.value,
    );
  });

  it("waits for an already-started event POST before forgetting the old identity", async () => {
    const order: string[] = [];
    let finishEventPost: (() => void) | undefined;
    const interval = vi.spyOn(globalThis, "setInterval");
    vi.mocked(fetch).mockImplementation(async (input): Promise<Response> => {
      if (String(input).endsWith("/events")) {
        return new Promise<Response>((resolve): void => {
          finishEventPost = (): void => {
            order.push("events-complete");
            resolve(response());
          };
        });
      }
      order.push("forget");
      return response();
    });
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("before-opt-out");
    await settleStorage();

    const flushing = __flushConciergeTelemetryForTests("periodic");
    await vi.waitFor(() => expect(finishEventPost).toBeTypeOf("function"));
    const beforeRenewal = await __telemetrySnapshotForTests();
    expect(beforeRenewal.inFlightPosts).toHaveLength(1);
    expect(
      interval.mock.calls.filter((call) => call[1] === 60_000),
    ).toHaveLength(2);
    const post = beforeRenewal.inFlightPosts[0];
    expect(post).toBeDefined();
    const renewedAt = Date.now() + 60_000;
    vi.spyOn(Date, "now").mockReturnValue(renewedAt);
    await __renewInFlightEventPostForTests(post?.postId ?? "missing-post");
    expect((await __telemetrySnapshotForTests()).inFlightPosts[0]?.expiresAt)
      .toBe(renewedAt + 10 * 60 * 1000);

    const disabling = setConciergeTelemetryEnabled(false);
    await settleStorage();
    expect(order).toEqual([]);

    finishEventPost?.();
    await Promise.all([flushing, disabling]);
    expect(order).toEqual(["events-complete", "forget"]);
    expect((await __telemetrySnapshotForTests()).inFlightPosts).toEqual([]);
    unmount();
  });

  it("defers forgetting until another tab's live event POST settles", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("foreign-tab-pending");
    await settleStorage();
    const installUuid = (await __telemetrySnapshotForTests()).state.installUuid;
    expect(installUuid).not.toBeNull();
    await __putInFlightEventPostForTests(
      "foreign-tab-post",
      installUuid ?? "missing-install",
      Date.now() + 10 * 60 * 1000,
    );

    const disabled = await setConciergeTelemetryEnabled(false);

    expect(disabled.serverDeletionPending).toBe(true);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await __removeInFlightEventPostForTests("foreign-tab-post");
    await __retryServerDeletionsForTests();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      "https://full-selfbrowsing.com/api/telemetry/forget",
    );
    expect((await getConciergeTelemetryStatus()).serverDeletionPending).toBe(false);
    unmount();
  });

  it("keeps the deletion retry when a live POST appears during forget", async () => {
    let finishFirstForget: (() => void) | undefined;
    vi.mocked(fetch).mockImplementation(async (input): Promise<Response> => {
      if (String(input).endsWith("/forget") && finishFirstForget === undefined) {
        return new Promise<Response>((resolve): void => {
          finishFirstForget = (): void => resolve(response());
        });
      }
      return response();
    });
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("post-appears-during-forget");
    await settleStorage();
    const installUuid = (await __telemetrySnapshotForTests()).state.installUuid;
    expect(installUuid).not.toBeNull();

    const disabling = setConciergeTelemetryEnabled(false);
    await vi.waitFor(() => expect(finishFirstForget).toBeTypeOf("function"));
    await __putInFlightEventPostForTests(
      "late-foreign-tab-post",
      installUuid ?? "missing-install",
      Date.now() + 10 * 60 * 1000,
    );
    finishFirstForget?.();

    expect((await disabling).serverDeletionPending).toBe(true);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);

    await __removeInFlightEventPostForTests("late-foreign-tab-post");
    await __retryServerDeletionsForTests();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    expect((await getConciergeTelemetryStatus()).serverDeletionPending).toBe(false);
    unmount();
  });

  it("forgets after another tab's abandoned event POST lease expires", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("foreign-tab-crashed");
    await settleStorage();
    const installUuid = (await __telemetrySnapshotForTests()).state.installUuid;
    expect(installUuid).not.toBeNull();
    const leaseStart = Date.now();
    await __putInFlightEventPostForTests(
      "crashed-tab-post",
      installUuid ?? "missing-install",
      leaseStart + 10 * 60 * 1000,
    );
    await setConciergeTelemetryEnabled(false);
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    vi.spyOn(Date, "now").mockReturnValue(leaseStart + 10 * 60 * 1000 + 1);
    await __retryServerDeletionsForTests();

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect((await __telemetrySnapshotForTests()).inFlightPosts).toEqual([]);
    expect((await getConciergeTelemetryStatus()).serverDeletionPending).toBe(false);
    unmount();
  });

  it("times out a hung forget request and preserves it for a later sweep", async () => {
    __setTelemetryRequestTimeoutForTests(1);
    const requestSignals: AbortSignal[] = [];
    let forgetAttempts = 0;
    vi.mocked(fetch).mockImplementation(async (input, init): Promise<Response> => {
      expect(String(input)).toMatch(/\/forget$/u);
      forgetAttempts += 1;
      if (forgetAttempts > 1) return response();
      const signal = init?.signal;
      if (signal === null || signal === undefined) {
        throw new Error("expected an abort signal");
      }
      requestSignals.push(signal);
      return new Promise<Response>((_resolve, reject): void => {
        signal.addEventListener(
          "abort",
          (): void => reject(new Error("request aborted")),
          { once: true },
        );
      });
    });
    await __setPendingTokensForTests(100, 200);
    const firstAttemptAt = Date.now();

    const disabled = await setConciergeTelemetryEnabled(false);

    expect(requestSignals).toHaveLength(1);
    expect(requestSignals[0]?.aborted).toBe(true);
    expect(forgetAttempts).toBe(1);
    expect(disabled.serverDeletionPending).toBe(true);
    vi.spyOn(Date, "now").mockReturnValue(firstAttemptAt + 5 * 60 * 1000);

    await __retryServerDeletionsForTests();

    expect(forgetAttempts).toBe(2);
    expect((await getConciergeTelemetryStatus()).serverDeletionPending).toBe(false);
  });

  it("stops immediately, queues offline deletion, and mints a fresh identity", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("before-opt-out");
    await settleStorage();
    const oldIdentity = (await __telemetrySnapshotForTests()).state.installUuid;
    expect(oldIdentity).toMatch(/^[0-9a-f-]{36}$/u);

    vi.mocked(fetch).mockResolvedValue(response(503));
    const disabled = await setConciergeTelemetryEnabled(false);
    expect(disabled).toMatchObject({
      enabled: false,
      reason: "user_opt_out",
      serverDeletionPending: true,
    });
    runtime.emitAccepted("while-disabled");
    await settleStorage();
    expect((await __telemetrySnapshotForTests()).state.tokensIn).toBe(0);

    vi.mocked(fetch).mockResolvedValue(response());
    const later = Date.now() + 24 * 60 * 60 * 1000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    const enabled = await setConciergeTelemetryEnabled(true);
    expect(enabled.enabled).toBe(true);
    runtime.emitAccepted("after-enable");
    await settleStorage();
    const fresh = await __telemetrySnapshotForTests();
    expect(fresh.state.installUuid).not.toBe(oldIdentity);
    expect(fresh.state.tokensIn).toBe(100);
    expect((await getConciergeTelemetryStatus()).serverDeletionPending).toBe(false);
    unmount();
  });

  it("retries server deletion on a later mount while collection stays off", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("before-offline-opt-out");
    await vi.waitFor(async () => {
      expect((await __telemetrySnapshotForTests()).state.installUuid).not.toBeNull();
    });

    vi.mocked(fetch).mockResolvedValue(response(503));
    expect((await setConciergeTelemetryEnabled(false)).serverDeletionPending).toBe(true);
    vi.mocked(fetch).mockClear();
    vi.mocked(fetch).mockResolvedValue(response());
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + 24 * 60 * 60 * 1000);

    const laterRuntime = runtimeStub();
    const unmountLater = mountConciergeTelemetry(laterRuntime.concierge);
    await vi.waitFor(async () => {
      expect((await getConciergeTelemetryStatus()).serverDeletionPending).toBe(false);
    });
    expect(await getConciergeTelemetryStatus()).toMatchObject({
      enabled: false,
      reason: "user_opt_out",
    });
    expect(vi.mocked(fetch).mock.calls.every((call) =>
      String(call[0]).endsWith("/forget"),
    )).toBe(true);
    unmountLater();
    unmount();
  });

  it("finishes an interrupted opt-out purge before lifting the stop marker", async () => {
    const runtime = runtimeStub();
    const unmount = mountConciergeTelemetry(runtime.concierge);
    runtime.emitAccepted("before-interruption");
    await settleStorage();
    await setConciergeTelemetryEnabled(false);

    // Recreate stale state while the synchronous opt-out marker is still set,
    // modeling a page that was terminated between those two cleanup steps.
    await __setPendingTokensForTests(900, 1_800);
    const interruptedIdentity = (await __telemetrySnapshotForTests()).state.installUuid;
    expect(interruptedIdentity).not.toBeNull();

    await setConciergeTelemetryEnabled(true);
    runtime.emitAccepted("after-interruption");
    await settleStorage();
    const fresh = await __telemetrySnapshotForTests();
    expect(fresh.state.installUuid).not.toBe(interruptedIdentity);
    expect(fresh.state.tokensIn).toBe(100);
    expect(fresh.state.tokensOut).toBe(200);
    unmount();
  });
});
