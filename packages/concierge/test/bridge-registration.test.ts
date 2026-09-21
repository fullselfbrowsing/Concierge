import { describe, expect, it, vi } from "vitest";

import { awaitRegistration, createBridge } from "../src/bridge.js";
import type { Bridge, Scheduler } from "../src/types.js";

function testBridge(): Bridge {
  return {
    actions: {},
    snapshot: {},
  };
}

function manualScheduler(): {
  readonly scheduler: Scheduler;
  advance(ms: number): void;
} {
  const timers: Array<{
    readonly at: number;
    readonly fn: () => void;
    cancelled: boolean;
  }> = [];
  let now = 0;
  return {
    scheduler: (fn, delayMs) => {
      const timer = { at: now + delayMs, fn, cancelled: false };
      timers.push(timer);
      return (): void => {
        timer.cancelled = true;
      };
    },
    advance(ms: number): void {
      now += ms;
      for (const timer of timers) {
        if (!timer.cancelled && timer.at <= now) {
          timer.cancelled = true;
          timer.fn();
        }
      }
    },
  };
}

describe("createBridge subscribe/drain and awaitRegistration", () => {
  it("emits registered after the bind is committed", () => {
    const registry = createBridge("tray");
    const seen: string[] = [];
    registry.subscribe((event) => {
      expect(registry.read()).not.toBeNull();
      seen.push(event.type);
    });
    registry.register(testBridge());
    expect(seen).toEqual(["registered"]);
  });

  it("does not emit unregistered on overwrite", () => {
    const registry = createBridge("tray");
    const types: string[] = [];
    registry.subscribe((event) => {
      types.push(event.type);
    });
    registry.register(testBridge());
    registry.register(testBridge());
    expect(types).toEqual(["registered", "registered"]);
  });

  it("drain emits without clearing the slot", () => {
    const registry = createBridge("tray");
    const types: string[] = [];
    registry.subscribe((event) => {
      types.push(event.type);
    });
    const bridge = testBridge();
    registry.register(bridge);
    registry.drain();
    expect(types).toEqual(["registered", "drained"]);
    expect(registry.read()).toBe(bridge);
  });

  it("resolves awaitRegistration only after a matching bind", async () => {
    const registry = createBridge("tray");
    const clock = manualScheduler();
    const pending = awaitRegistration(registry, {
      timeoutMs: 2_000,
      scheduler: clock.scheduler,
    });
    registry.register(testBridge());
    await expect(pending).resolves.toMatchObject({ status: "ready" });
  });

  it("fails closed when neither timeout nor signal is supplied", async () => {
    const registry = createBridge("tray");
    await expect(awaitRegistration(registry, {})).resolves.toEqual({
      status: "unavailable",
    });
  });

  it("times out through the injected scheduler", async () => {
    const registry = createBridge("tray");
    const clock = manualScheduler();
    const pending = awaitRegistration(registry, {
      timeoutMs: 10,
      scheduler: clock.scheduler,
    });
    clock.advance(10);
    await expect(pending).resolves.toEqual({ status: "timed-out" });
  });

  it("aborts when the signal is already aborted", async () => {
    const registry = createBridge("tray");
    await expect(
      awaitRegistration(registry, {
        timeoutMs: 10,
        scheduler: manualScheduler().scheduler,
        signal: AbortSignal.abort(),
      }),
    ).resolves.toEqual({ status: "aborted" });
  });

  it("contains a throwing subscriber", () => {
    const registry = createBridge("tray");
    const seen: string[] = [];
    registry.subscribe(() => {
      throw new Error("boom");
    });
    registry.subscribe((event) => {
      seen.push(event.type);
    });
    expect(() => registry.register(testBridge())).not.toThrow();
    expect(seen).toEqual(["registered"]);
  });

  it("warns once when listener capacity is exceeded", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const registry = createBridge("tray");
    const stops: Array<() => void> = [];
    for (let i = 0; i < 65; i += 1) {
      stops.push(registry.subscribe(() => undefined));
    }
    expect(warn.mock.calls.some((call) => String(call[0]).includes("bridge_listener_leak"))).toBe(
      true,
    );
    for (const stop of stops) {
      stop();
    }
    warn.mockRestore();
  });
});
