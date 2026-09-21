import { describe, expect, it } from "vitest";

import { createLocalAbortController } from "../src/host.js";
import { createWebSocketRealtimeChannel } from "../src/websocket/index.js";

function createFakeSocket() {
  const listeners = new Map();
  return {
    readyState: 0,
    listeners,
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    removeEventListener(type, listener) {
      const bucket = listeners.get(type) ?? [];
      listeners.set(
        type,
        bucket.filter((current) => current !== listener),
      );
    },
    send() {},
    close() {
      this.readyState = 3;
    },
    open() {
      this.readyState = 1;
      for (const listener of listeners.get("open") ?? []) listener();
    },
    emitMessage(data) {
      for (const listener of listeners.get("message") ?? []) {
        listener({ data });
      }
    },
    emitClose() {
      this.readyState = 3;
      for (const listener of listeners.get("close") ?? []) listener();
    },
  };
}

describe("createWebSocketRealtimeChannel", () => {
  it("opens an injected socket, sends JSON, and forwards parsed events", async () => {
    const socket = createFakeSocket();
    const urls = [];
    const events = [];
    const states = [];
    const channel = createWebSocketRealtimeChannel({
      url: async () => {
        urls.push("resolved");
        return "wss://example.test/realtime";
      },
      protocols: ["realtime"],
      socketFactory: (url, protocols) => {
        expect(url).toBe("wss://example.test/realtime");
        expect(protocols).toEqual(["realtime"]);
        queueMicrotask(() => {
          socket.open();
        });
        return socket;
      },
    });
    channel.onEvent((event) => events.push(event));
    channel.onStateChange((state) => states.push(state));

    const abort = createLocalAbortController();
    await channel.open(abort.signal);
    expect(channel.state).toBe("open");
    expect(urls).toEqual(["resolved"]);
    expect(channel.send({ type: "ping" })).toBe(true);
    socket.emitMessage(JSON.stringify({ type: "pong" }));
    expect(events).toEqual([{ type: "pong" }]);

    socket.emitClose();
    expect(channel.state).toBe("closed");
    expect(states).toContain("closed");
  });

  it("abandons a mid-handshake socket when the signal aborts", async () => {
    const socket = createFakeSocket();
    const channel = createWebSocketRealtimeChannel({
      url: () => "wss://example.test/realtime",
      socketFactory: () => socket,
    });
    const abort = createLocalAbortController();
    const opening = channel.open(abort.signal);
    abort.abort();
    await expect(opening).rejects.toThrow("aborted");
    expect(channel.state).toBe("closed");
  });
});
