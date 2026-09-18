import type { AbortSignalLike } from "@full-self-browsing/concierge";
import { invokeHost, isAbortLike } from "../host.js";
import type {
  RealtimeChannel,
  RealtimeChannelFault,
  RealtimeChannelState,
  RealtimeWireEvent,
} from "../types.js";

export interface WebSocketRealtimeChannelOptions {
  /** Resolved per attempt so a short-lived credential can be refreshed. */
  readonly url: () => Promise<string> | string;
  readonly protocols?: ReadonlyArray<string> | undefined;
  readonly socketFactory?:
    | ((url: string, protocols: ReadonlyArray<string>) => WebSocket)
    | undefined;
}

function waitForAbort(signal: AbortSignalLike, onAbort: () => void): () => void {
  if (signal.aborted) {
    onAbort();
    return (): void => {};
  }
  const listener = (): void => {
    onAbort();
  };
  signal.addEventListener("abort", listener);
  return (): void => {
    try {
      signal.removeEventListener("abort", listener);
    } catch {
      // Best-effort unsubscribe.
    }
  };
}

/**
 * Browser WebSocket JSON event channel. The runtime never inspects media.
 */
export function createWebSocketRealtimeChannel(
  options: WebSocketRealtimeChannelOptions,
): RealtimeChannel {
  const protocols: ReadonlyArray<string> = options.protocols ?? [];
  let state: RealtimeChannelState = "idle";
  let socket: WebSocket | null = null;
  let closedByUs: boolean = false;
  let generation: number = 0;

  const eventListeners: Set<(event: unknown) => void> = new Set();
  const stateListeners: Set<
    (state: RealtimeChannelState, fault?: RealtimeChannelFault) => void
  > = new Set();

  const emitState = (
    next: RealtimeChannelState,
    fault?: RealtimeChannelFault,
  ): void => {
    if (state === next && fault === undefined) return;
    state = next;
    for (const listener of [...stateListeners]) {
      invokeHost(() => {
        listener(next, fault);
      });
    }
  };

  const abandon = (): void => {
    try {
      socket?.close();
    } catch {
      // Socket close is best effort.
    }
    socket = null;
  };

  const fail = (fault: RealtimeChannelFault): void => {
    if (state === "closed") return;
    abandon();
    emitState("closed", fault);
  };

  const channel: RealtimeChannel = {
    get state(): RealtimeChannelState {
      return state;
    },
    async open(signal: AbortSignalLike): Promise<void> {
      if (state === "open") return;
      if (state === "opening") {
        throw new Error("A WebSocket channel open is already in progress.");
      }
      closedByUs = false;
      generation += 1;
      const attempt: number = generation;
      emitState("opening");
      let released: boolean = false;
      const releaseAbort: () => void = waitForAbort(signal, () => {
        if (released || attempt !== generation) return;
        abandon();
        emitState("closed");
      });
      try {
        if (signal.aborted) throw new Error("The WebSocket handshake was aborted.");
        const resolved: string = await options.url();
        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebSocket handshake was aborted.");
        }
        if (typeof resolved !== "string" || resolved.length === 0) {
          throw new Error("The WebSocket URL was empty.");
        }
        const createSocket:
          | ((url: string, protocols: ReadonlyArray<string>) => WebSocket)
          | undefined = options.socketFactory;
        const nextSocket: WebSocket =
          createSocket === undefined
            ? new WebSocket(resolved, [...protocols])
            : createSocket(resolved, protocols);
        if (attempt !== generation || signal.aborted) {
          nextSocket.close();
          throw new Error("The WebSocket handshake was aborted.");
        }
        socket = nextSocket;

        if (nextSocket.readyState !== WebSocket.OPEN) {
          await new Promise<void>((resolve, reject) => {
            const onOpen = (): void => {
              cleanup();
              resolve();
            };
            const onFail = (): void => {
              cleanup();
              reject(new Error("The WebSocket handshake failed."));
            };
            const cleanup = (): void => {
              nextSocket.removeEventListener("open", onOpen);
              nextSocket.removeEventListener("error", onFail);
              nextSocket.removeEventListener("close", onFail);
              releaseOpenAbort();
            };
            const releaseOpenAbort: () => void = waitForAbort(signal, () => {
              cleanup();
              nextSocket.close();
              reject(new Error("The WebSocket handshake was aborted."));
            });
            if (nextSocket.readyState === WebSocket.OPEN) {
              cleanup();
              resolve();
              return;
            }
            nextSocket.addEventListener("open", onOpen);
            nextSocket.addEventListener("error", onFail);
            nextSocket.addEventListener("close", onFail);
          });
        }

        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebSocket handshake was aborted.");
        }

        nextSocket.addEventListener("message", (message: MessageEvent) => {
          if (attempt !== generation) return;
          let parsed: unknown = message.data;
          if (typeof message.data === "string") {
            try {
              parsed = JSON.parse(message.data) as unknown;
            } catch {
              return;
            }
          }
          for (const listener of [...eventListeners]) {
            invokeHost(() => {
              listener(parsed);
            });
          }
        });
        nextSocket.addEventListener("close", () => {
          if (attempt !== generation || closedByUs) return;
          fail(
            Object.freeze({
              code: "closed-by-peer",
              message: "The WebSocket closed.",
            }),
          );
        });
        nextSocket.addEventListener("error", () => {
          if (attempt !== generation || closedByUs) return;
          fail(
            Object.freeze({
              code: "dropped",
              message: "The WebSocket failed.",
            }),
          );
        });
        emitState("open");
      } catch (error) {
        if (attempt === generation) {
          abandon();
          emitState(
            "closed",
            isAbortLike(error) ||
              (error instanceof Error && error.message.includes("aborted"))
              ? undefined
              : Object.freeze({
                  code: "unreachable",
                  message: "The WebSocket handshake failed.",
                }),
          );
        }
        throw error instanceof Error
          ? error
          : new Error("The WebSocket handshake failed.");
      } finally {
        released = true;
        releaseAbort();
      }
    },
    send(event: RealtimeWireEvent): boolean {
      if (state !== "open" || socket === null || socket.readyState !== WebSocket.OPEN) {
        return false;
      }
      try {
        socket.send(JSON.stringify(event));
        return true;
      } catch {
        return false;
      }
    },
    onEvent(cb: (event: unknown) => void): () => void {
      eventListeners.add(cb);
      return (): void => {
        eventListeners.delete(cb);
      };
    },
    onStateChange(
      cb: (state: RealtimeChannelState, fault?: RealtimeChannelFault) => void,
    ): () => void {
      stateListeners.add(cb);
      return (): void => {
        stateListeners.delete(cb);
      };
    },
    close(): void {
      if (state === "closed") return;
      closedByUs = true;
      generation += 1;
      abandon();
      emitState("closed");
    },
  };
  return channel;
}
