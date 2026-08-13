import { act, render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { createBridge } from "@fullselfbrowsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
} from "@fullselfbrowsing/concierge";

import Harness from "./Harness.svelte";

type SnapshotProbe = {
  readonly live: { nested: { count: number } };
  readonly detached: { nested: { count: number } };
  readonly setCount: (count: number) => void;
};

type TestBridge = Bridge<
  { readonly identify: () => string },
  { readonly current: () => Readonly<{ label: string }> }
>;

function conciergeStub(): Concierge {
  const revision = Symbol("svelte-test-catalog") as ReturnType<Concierge["resolveCatalog"]>["revision"];
  return {
    dispatch: async () => ({ ok: true, message: "Done." }),
    dispatchBatch: async () => ({ kind: "completed", rows: [] }),
    resolveCatalog: () => ({ stage: null, tools: [], revision }),
    onDispatch: () => () => undefined,
    explain: () => ({ stage: null, stages: [], catalog: [] }),
  };
}

function makeBridge(label: string): TestBridge {
  return {
    actions: { identify: () => label },
    snapshot: { current: () => ({ label }) },
  };
}

function requireProbe(probe: SnapshotProbe | null): SnapshotProbe {
  if (probe === null) {
    throw new Error("Svelte snapshot probe was not initialized.");
  }

  return probe;
}

function trackedRegistry(registry: BridgeRegistry): {
  readonly registry: BridgeRegistry;
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
      register: (bridge: Bridge): (() => void) => {
        events.push("setup");
        const unregisterCore: () => void = registry.register(bridge);
        const unregister: () => void = (): void => {
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

describe("@fullselfbrowsing/concierge-svelte svelte-lifecycle", () => {
  it("preserves the exact Concierge context reference and names the missing provider remedy", () => {
    const concierge: Concierge = conciergeStub();
    const registry: BridgeRegistry = createBridge("svelte-context");
    const bridge: TestBridge = makeBridge("context");
    let observed: Concierge | null = null;

    const mounted = render(Harness, {
      concierge,
      registry,
      bridge,
      onContext: (value: Concierge): void => {
        observed = value;
      },
    });

    expect(observed).toBe(concierge);
    mounted.unmount();

    expect(() =>
      render(Harness, {
        concierge,
        registry,
        bridge,
        provide: false,
      }),
    ).toThrow(
      "@fullselfbrowsing/concierge-svelte: useConcierge requires an ancestor " +
        "component to call provideConcierge(concierge) during initialization.",
    );
  });

  it("T03/S1 detaches a real rune-backed nested value with the exported normalizer", async () => {
    const concierge: Concierge = conciergeStub();
    const registry: BridgeRegistry = createBridge("svelte-snapshot");
    let probe: SnapshotProbe | null = null;

    const mounted = render(Harness, {
      concierge,
      registry,
      bridge: makeBridge("snapshot"),
      onSnapshot: (value: SnapshotProbe): void => {
        probe = value;
      },
    });

    const captured: SnapshotProbe = requireProbe(probe);
    expect(captured.live).not.toBe(captured.detached);
    expect(captured.live.nested.count).toBe(1);
    expect(captured.detached.nested.count).toBe(1);

    await act(() => {
      captured.setCount(2);
    });

    expect(captured.live.nested.count).toBe(2);
    expect(captured.detached.nested.count).toBe(1);

    mounted.unmount();
  });

  it("T04 rerenders one component through replacement, stale cleanup, and final null", async () => {
    const concierge: Concierge = conciergeStub();
    const firstCoreRegistry: BridgeRegistry = createBridge("svelte-registration-a");
    const secondCoreRegistry: BridgeRegistry = createBridge("svelte-registration-b");
    const firstTracked = trackedRegistry(firstCoreRegistry);
    const secondTracked = trackedRegistry(secondCoreRegistry);
    const firstBridge: TestBridge = makeBridge("first");
    const secondBridge: TestBridge = makeBridge("second");
    const thirdBridge: TestBridge = makeBridge("third");
    const initializationStates: boolean[] = [];

    expect(firstCoreRegistry.read()).toBeNull();
    expect(secondCoreRegistry.read()).toBeNull();
    expect(firstTracked.events).toEqual([]);

    const mounted = render(Harness, {
      concierge,
      registry: firstTracked.registry,
      bridge: firstBridge,
      onInitialize: (registered: boolean): void => {
        initializationStates.push(registered);
      },
    });

    expect(initializationStates).toEqual([false]);
    expect(firstTracked.events).toEqual(["setup"]);
    expect(firstCoreRegistry.read()).toBe(firstBridge);

    await mounted.rerender({
      concierge,
      registry: firstTracked.registry,
      bridge: secondBridge,
      onInitialize: (registered: boolean): void => {
        initializationStates.push(registered);
      },
    });

    expect(initializationStates).toEqual([false]);
    expect(firstTracked.events).toEqual(["setup", "cleanup", "setup"]);
    expect(firstTracked.cleanupCalls).toEqual([firstTracked.cleanups[0]]);
    expect(firstCoreRegistry.read()).toBe(secondBridge);
    expect(firstTracked.cleanups).toHaveLength(2);

    firstTracked.cleanups[0]?.();
    expect(firstTracked.cleanupCalls).toEqual([
      firstTracked.cleanups[0],
      firstTracked.cleanups[0],
    ]);
    expect(firstCoreRegistry.read()).toBe(secondBridge);

    await mounted.rerender({
      concierge,
      registry: secondTracked.registry,
      bridge: thirdBridge,
    });

    expect(firstCoreRegistry.read()).toBeNull();
    expect(secondCoreRegistry.read()).toBe(thirdBridge);
    expect(firstTracked.cleanupCalls).toEqual([
      firstTracked.cleanups[0],
      firstTracked.cleanups[0],
      firstTracked.cleanups[1],
    ]);
    expect(secondTracked.events).toEqual(["setup"]);

    firstTracked.cleanups[1]?.();
    expect(firstCoreRegistry.read()).toBeNull();
    expect(secondCoreRegistry.read()).toBe(thirdBridge);

    mounted.unmount();
    expect(secondTracked.cleanupCalls).toEqual([secondTracked.cleanups[0]]);
    expect(secondCoreRegistry.read()).toBeNull();
  });
});
