import { StrictMode, useLayoutEffect, useMemo } from "react";

import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBridge } from "@full-self-browsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  CatalogRevision,
  Concierge,
  DispatchEvent,
  DispatchListener,
} from "@full-self-browsing/concierge";

const telemetryMount = vi.hoisted(() => vi.fn());

vi.mock("@full-self-browsing/concierge/telemetry", () => ({
  mountConciergeTelemetry: telemetryMount,
}));

import {
  ConciergeActivityOverlay,
  ConciergeProvider,
  useConcierge,
  useConciergeActivity,
  useConciergeBridge,
  useConciergeValue,
} from "../src/client.js";

beforeEach(() => {
  telemetryMount.mockImplementation(() => (): void => undefined);
});

afterEach(() => {
  cleanup();
  telemetryMount.mockReset();
});

type Sentinel = Readonly<{
  revision: string;
  nested: Readonly<{ count: number }>;
}>;

type TestBridge = Bridge<
  { readRevision: () => string },
  { current: () => Sentinel }
>;

function conciergeStub(): Concierge {
  const revision = Symbol("react-test-catalog") as ReturnType<Concierge["resolveCatalog"]>["revision"];
  return {
    dispatch: async () => ({ ok: true, message: "Done." }),
    dispatchBatch: async () => ({ kind: "completed", rows: [] }),
    resolveCatalog: () => ({ stage: null, tools: [], revision }),
    onDispatch: () => () => undefined,
    explain: () => ({ stage: null, stages: [], catalog: [], actions: [] }),
  };
}

function activityConciergeStub(): {
  readonly concierge: Concierge;
  readonly emit: (event: DispatchEvent) => void;
  readonly listenerCount: () => number;
} {
  const listeners: Set<DispatchListener> = new Set();
  const revision = Symbol("react-activity-catalog") as CatalogRevision;
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
    explain: () => ({ stage: null, stages: [], catalog: [], actions: [] }),
  };

  return {
    concierge,
    emit: (event): void => {
      for (const listener of listeners) void listener(event);
    },
    listenerCount: (): number => listeners.size,
  };
}

function dispatchEvent(
  dispatchId: string,
  phase: "accepted" | "succeeded",
): DispatchEvent {
  const base = {
    dispatchId,
    name: "openProject",
    stage: "portfolio",
    catalogRevision: Symbol("event-catalog") as CatalogRevision,
    identity: null,
    lineage: {
      rootDispatchId: "dispatch-parent",
      depth: dispatchId === "dispatch-parent" ? 0 : 1,
    },
    input: { kind: "dropped" as const },
    terminalAction: false,
    terminalEntered: false,
  };

  return phase === "accepted"
    ? { ...base, phase }
    : {
        ...base,
        phase,
        result: { ok: true, message: "Opened project." },
      };
}

function trackedRegistry<B extends Bridge>(registry: BridgeRegistry<B>): {
  readonly registry: BridgeRegistry<B>;
  readonly events: string[];
  readonly cleanups: Array<() => void>;
  readonly cleanupCalls: Array<() => void>;
} {
  const events: string[] = [];
  const cleanups: Array<() => void> = [];
  const cleanupCalls: Array<() => void> = [];

  return {
    registry: {
      id: registry.id,
      read: registry.read,
      register: (bridge: B): (() => void) => {
        events.push("setup");
        const unregisterCore = registry.register(bridge);
        const unregister = (): void => {
          events.push("cleanup");
          cleanupCalls.push(unregister);
          unregisterCore();
        };
        cleanups.push(unregister);
        return unregister;
      },
    },
    events,
    cleanups,
    cleanupCalls,
  };
}

function BridgeHarness({
  registry,
  value,
}: {
  readonly registry: BridgeRegistry<TestBridge>;
  readonly value: Sentinel;
}) {
  const readValue = useConciergeValue(value);
  const bridge = useMemo<TestBridge>(
    () => ({
      actions: {
        readRevision: () => readValue().revision,
      },
      snapshot: {
        current: readValue,
      },
    }),
    [readValue],
  );

  useConciergeBridge(registry, bridge);
  return null;
}

function LayoutDispatch({ emit }: { readonly emit: () => void }) {
  useLayoutEffect((): void => emit(), [emit]);
  return null;
}

function ActivityState() {
  const active: boolean = useConciergeActivity();
  return <output data-concierge-activity-state="">{String(active)}</output>;
}

describe("@full-self-browsing/concierge-react lifecycle", () => {
  it("mounts telemetry by default, cleans up through StrictMode, and honors false", () => {
    const concierge = conciergeStub();
    const cleanups: Array<ReturnType<typeof vi.fn>> = [];
    telemetryMount.mockImplementation(() => {
      const release = vi.fn();
      cleanups.push(release);
      return release;
    });

    const mounted = render(
      <StrictMode>
        <ConciergeProvider concierge={concierge}>content</ConciergeProvider>
      </StrictMode>,
    );
    expect(telemetryMount).toHaveBeenCalledTimes(2);
    expect(telemetryMount).toHaveBeenNthCalledWith(1, concierge);
    expect(telemetryMount).toHaveBeenNthCalledWith(2, concierge);
    expect(cleanups[0]).toHaveBeenCalledTimes(1);
    expect(cleanups[1]).not.toHaveBeenCalled();
    mounted.unmount();
    expect(cleanups[1]).toHaveBeenCalledTimes(1);

    telemetryMount.mockClear();
    const disabled = render(
      <ConciergeProvider concierge={concierge} telemetry={false}>
        content
      </ConciergeProvider>,
    );
    expect(telemetryMount).not.toHaveBeenCalled();
    disabled.unmount();
  });

  it("subscribes telemetry before a descendant layout effect dispatches", () => {
    const activity = activityConciergeStub();
    const observedDispatches: string[] = [];
    telemetryMount.mockImplementation((concierge: Concierge) =>
      concierge.onDispatch((event): void => {
        observedDispatches.push(event.dispatchId);
      }),
    );

    const mounted = render(
      <ConciergeProvider concierge={activity.concierge}>
        <LayoutDispatch
          emit={() => activity.emit(dispatchEvent("initial", "accepted"))}
        />
      </ConciergeProvider>,
    );

    expect(observedDispatches).toEqual(["initial"]);
    expect(activity.listenerCount()).toBe(2);

    mounted.unmount();
    expect(activity.listenerCount()).toBe(0);
  });

  it("preserves the exact Concierge reference and names the missing provider remedy", () => {
    const concierge = conciergeStub();
    let observed: Concierge | null = null;

    function Reader() {
      observed = useConcierge();
      return null;
    }

    render(
      <ConciergeProvider concierge={concierge}>
        <Reader />
      </ConciergeProvider>,
    );

    expect(observed).toBe(concierge);

    expect(() => render(<Reader />)).toThrow(
      "@full-self-browsing/concierge-react: useConcierge must be used within " +
        "<ConciergeProvider concierge={...}>.",
    );
  });

  it("T01/R1 observes setup-cleanup-setup, refuses stale same-object cleanup, and ends at null", () => {
    const coreRegistry = createBridge<TestBridge>("react-test");
    const tracked = trackedRegistry(coreRegistry);
    const value: Sentinel = { revision: "first", nested: { count: 1 } };

    const mounted = render(
      <StrictMode>
        <BridgeHarness registry={tracked.registry} value={value} />
      </StrictMode>,
    );

    expect(tracked.events).toEqual(["setup", "cleanup", "setup"]);
    expect(tracked.cleanups).toHaveLength(2);
    expect(tracked.cleanupCalls).toEqual([tracked.cleanups[0]]);

    const liveBridge = coreRegistry.read();
    expect(liveBridge).not.toBeNull();

    tracked.cleanups[0]?.();

    expect(tracked.cleanupCalls).toEqual([
      tracked.cleanups[0],
      tracked.cleanups[0],
    ]);
    expect(coreRegistry.read()).toBe(liveBridge);

    mounted.unmount();

    expect(tracked.cleanupCalls).toEqual([
      tracked.cleanups[0],
      tracked.cleanups[0],
      tracked.cleanups[1],
    ]);
    expect(coreRegistry.read()).toBeNull();
  });

  it("T02/R2 reads the latest committed plain nested value through the existing core bridge", async () => {
    const coreRegistry = createBridge<TestBridge>("react-value-test");
    const tracked = trackedRegistry(coreRegistry);
    const first: Sentinel = { revision: "first", nested: { count: 1 } };
    const second: Sentinel = { revision: "second", nested: { count: 2 } };

    const mounted = render(
      <StrictMode>
        <BridgeHarness registry={tracked.registry} value={first} />
      </StrictMode>,
    );

    const registered = coreRegistry.read();
    expect(registered?.snapshot.current()).toBe(first);
    expect(registered?.actions.readRevision()).toBe("first");
    expect(tracked.cleanups).toHaveLength(2);

    mounted.rerender(
      <StrictMode>
        <BridgeHarness registry={tracked.registry} value={second} />
      </StrictMode>,
    );

    await waitFor(() => {
      expect(registered?.snapshot.current()).toBe(second);
      expect(registered?.snapshot.current().nested.count).toBe(2);
      expect(registered?.actions.readRevision()).toBe("second");
    });

    expect(coreRegistry.read()).toBe(registered);
    expect(tracked.cleanups).toHaveLength(2);

    mounted.unmount();
    expect(coreRegistry.read()).toBeNull();
  });

  it("renders configurable action chrome until every concurrent dispatch is terminal", () => {
    const activity = activityConciergeStub();
    const mounted = render(
      <StrictMode>
        <ConciergeProvider concierge={activity.concierge}>
          <ConciergeActivityOverlay
            glow={{
              color: "#123456",
              secondaryColor: "rgb(1, 2, 3)",
              intensity: 0.45,
            }}
            poweredByFSB={{
              position: "top-left",
              color: "#fafafa",
              backgroundColor: "#101010",
              borderColor: "#abcdef",
            }}
            zIndex={700}
          />
        </ConciergeProvider>
      </StrictMode>,
    );

    expect(activity.listenerCount()).toBe(1);
    expect(
      mounted.container.querySelector("[data-concierge-activity-glow]"),
    ).toBeNull();
    expect(mounted.queryByText("Powered by FSB")).toBeNull();

    act(() => activity.emit(dispatchEvent("dispatch-parent", "accepted")));

    const glow = mounted.container.querySelector<HTMLElement>(
      "[data-concierge-activity-glow]",
    );
    expect(glow?.style.boxShadow).toContain("#123456");
    expect(glow?.style.boxShadow).toContain("rgb(1, 2, 3)");
    expect(glow?.style.opacity).toBe("0.45");
    expect(glow?.style.pointerEvents).toBe("none");
    expect(glow?.style.zIndex).toBe("700");

    const badge = mounted.getByText("Powered by FSB");
    expect(badge.style.top).toBe("1rem");
    expect(badge.style.left).toBe("1rem");
    expect(badge.style.background).toBe("rgb(16, 16, 16)");
    expect(badge.style.color).toBe("rgb(250, 250, 250)");
    expect(badge.style.zIndex).toBe("701");

    act(() => activity.emit(dispatchEvent("dispatch-child", "accepted")));
    act(() => activity.emit(dispatchEvent("dispatch-parent", "succeeded")));
    expect(mounted.getByText("Powered by FSB")).toBeTruthy();

    act(() => activity.emit(dispatchEvent("dispatch-child", "succeeded")));
    expect(
      mounted.container.querySelector("[data-concierge-activity-glow]"),
    ).toBeNull();
    expect(mounted.queryByText("Powered by FSB")).toBeNull();

    mounted.unmount();
    expect(activity.listenerCount()).toBe(0);
  });

  it("captures an initial layout dispatch before activity consumers subscribe", () => {
    const activity = activityConciergeStub();
    const mounted = render(
      <ConciergeProvider concierge={activity.concierge} telemetry={false}>
        <LayoutDispatch
          emit={() => activity.emit(dispatchEvent("initial", "accepted"))}
        />
        <ConciergeActivityOverlay poweredByFSB />
        <ActivityState />
      </ConciergeProvider>,
    );

    expect(activity.listenerCount()).toBe(1);
    expect(mounted.getByText("Powered by FSB")).toBeTruthy();
    expect(
      mounted.container.querySelector("[data-concierge-activity-state]")
        ?.textContent,
    ).toBe("true");

    act(() => activity.emit(dispatchEvent("initial", "succeeded")));

    expect(mounted.queryByText("Powered by FSB")).toBeNull();
    expect(
      mounted.container.querySelector("[data-concierge-activity-state]")
        ?.textContent,
    ).toBe("false");

    mounted.unmount();
    expect(activity.listenerCount()).toBe(0);
  });

  it("keeps the glow and the Powered by FSB badge independently optional", () => {
    const activity = activityConciergeStub();
    const mounted = render(
      <ConciergeProvider concierge={activity.concierge}>
        <ConciergeActivityOverlay glow={false} poweredByFSB />
      </ConciergeProvider>,
    );

    act(() => activity.emit(dispatchEvent("dispatch-parent", "accepted")));

    expect(
      mounted.container.querySelector("[data-concierge-activity-glow]"),
    ).toBeNull();
    const badge = mounted.getByText("Powered by FSB");
    expect(badge.style.bottom).toBe("1rem");
    expect(badge.style.left).toBe("1rem");
    expect(badge.style.right).toBe("");
  });
});
