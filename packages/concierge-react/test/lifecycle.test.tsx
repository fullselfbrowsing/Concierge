import { StrictMode, useMemo } from "react";

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { createBridge } from "@fullselfbrowsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
} from "@fullselfbrowsing/concierge";

import {
  ConciergeProvider,
  useConcierge,
  useConciergeBridge,
  useConciergeValue,
} from "../src/client.js";

afterEach(() => {
  cleanup();
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
  return {
    dispatch: async () => ({ ok: true, message: "Done." }),
    dispatchBatch: async () => [],
    catalogFor: () => [],
    stageFor: () => null,
    explain: () => ({ stage: null, stages: [], catalog: [] }),
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

describe("@fullselfbrowsing/concierge-react lifecycle", () => {
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
      "@fullselfbrowsing/concierge-react: useConcierge must be used within " +
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
});
