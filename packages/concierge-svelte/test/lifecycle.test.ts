import { act, render } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { createBridge } from "@fullselfbrowsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
} from "@fullselfbrowsing/concierge";

import Harness from "./Harness.svelte";
import type { SnapshotProbe } from "./Harness.svelte";

type TestBridge = Bridge<
  { readonly identify: () => string },
  { readonly current: () => Readonly<{ label: string }> }
>;

function conciergeStub(): Concierge {
  return {
    dispatch: async () => ({ ok: true, message: "Done." }),
    dispatchBatch: async () => [],
    catalogFor: () => [],
    stageFor: () => null,
    explain: () => ({ stage: null, stages: [], catalog: [] }),
  };
}

function makeBridge(label: string): TestBridge {
  return {
    actions: { identify: () => label },
    snapshot: { current: () => ({ label }) },
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
    const registry: BridgeRegistry<TestBridge> =
      createBridge<TestBridge>("svelte-context");
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
    const registry: BridgeRegistry<TestBridge> =
      createBridge<TestBridge>("svelte-snapshot");
    let probe: SnapshotProbe | null = null;

    const mounted = render(Harness, {
      concierge,
      registry,
      bridge: makeBridge("snapshot"),
      onSnapshot: (value: SnapshotProbe): void => {
        probe = value;
      },
    });

    expect(probe).not.toBeNull();
    expect(probe?.live).not.toBe(probe?.detached);
    expect(probe?.live.nested.count).toBe(1);
    expect(probe?.detached.nested.count).toBe(1);

    await act(() => {
      probe?.setCount(2);
    });

    expect(probe?.live.nested.count).toBe(2);
    expect(probe?.detached.nested.count).toBe(1);

    mounted.unmount();
  });

  it("T04 registers only after initialization and survives replacement, stale teardown, destroy, and remount", () => {
    const concierge: Concierge = conciergeStub();
    const coreRegistry: BridgeRegistry<TestBridge> =
      createBridge<TestBridge>("svelte-registration");
    const tracked = trackedRegistry(coreRegistry);
    const firstBridge: TestBridge = makeBridge("first");
    const secondBridge: TestBridge = makeBridge("second");
    const initializationStates: boolean[] = [];

    expect(coreRegistry.read()).toBeNull();
    expect(tracked.events).toEqual([]);

    const first = render(Harness, {
      concierge,
      registry: tracked.registry,
      bridge: firstBridge,
      onInitialize: (registered: boolean): void => {
        initializationStates.push(registered);
      },
    });

    expect(initializationStates).toEqual([false]);
    expect(tracked.events).toEqual(["setup"]);
    expect(coreRegistry.read()).toBe(firstBridge);

    const second = render(Harness, {
      concierge,
      registry: tracked.registry,
      bridge: secondBridge,
      onInitialize: (registered: boolean): void => {
        initializationStates.push(registered);
      },
    });

    expect(initializationStates).toEqual([false, true]);
    expect(tracked.events).toEqual(["setup", "setup"]);
    expect(coreRegistry.read()).toBe(secondBridge);
    expect(tracked.cleanups).toHaveLength(2);

    first.unmount();

    expect(tracked.cleanupCalls).toEqual([tracked.cleanups[0]]);
    expect(coreRegistry.read()).toBe(secondBridge);

    tracked.cleanups[0]?.();
    expect(tracked.cleanupCalls).toEqual([
      tracked.cleanups[0],
      tracked.cleanups[0],
    ]);
    expect(coreRegistry.read()).toBe(secondBridge);

    second.unmount();
    expect(tracked.cleanupCalls).toEqual([
      tracked.cleanups[0],
      tracked.cleanups[0],
      tracked.cleanups[1],
    ]);
    expect(coreRegistry.read()).toBeNull();

    const remountedBridge: TestBridge = makeBridge("remounted");
    const remounted = render(Harness, {
      concierge,
      registry: tracked.registry,
      bridge: remountedBridge,
    });

    expect(coreRegistry.read()).toBe(remountedBridge);
    remounted.unmount();
    expect(coreRegistry.read()).toBeNull();
  });
});
