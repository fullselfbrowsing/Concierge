import type { AbortSignalLike, Scheduler } from "@full-self-browsing/concierge";
import { invokeHost, isAbortLike, resolveScheduler } from "../host.js";
import type {
  RealtimeChannel,
  RealtimeChannelFault,
  RealtimeChannelState,
  RealtimeForeignTool,
  RealtimeWireEvent,
} from "../types.js";

export interface WebRTCNegotiationRequest {
  readonly sdp: string;
  readonly signal: AbortSignalLike;
}

export interface WebRTCNegotiationAnswer {
  readonly sdp: string;
  /** Host tools minted server-side during negotiation, if any. */
  readonly foreignTools?: ReadonlyArray<RealtimeForeignTool> | undefined;
}

export interface WebRTCRealtimeChannelOptions {
  /**
   * The app's own SDP exchange. Credentials, endpoints, auth headers and error
   * bodies stay in the app; the channel never learns any of them.
   */
  readonly negotiate: (
    request: WebRTCNegotiationRequest,
  ) => Promise<WebRTCNegotiationAnswer>;
  readonly dataChannelLabel?: string | undefined;
  readonly peerConnectionFactory?: (() => RTCPeerConnection) | undefined;
  readonly requestMicrophone?: (() => Promise<MediaStream>) | undefined;
  readonly audioElementFactory?: (() => HTMLAudioElement) | undefined;
  /** Grace before a `disconnected` peer is declared failed. Default 5_000. */
  readonly disconnectGraceMs?: number | undefined;
  readonly scheduler?: Scheduler | undefined;
}

export interface WebRTCMediaControls {
  setMicrophoneEnabled(enabled: boolean): void;
  microphoneEnabled(): boolean;
  localStream(): MediaStream | null;
  remoteStream(): MediaStream | null;
  onStreamChange(
    cb: (which: "local" | "remote", stream: MediaStream | null) => void,
  ): () => void;
}

export interface WebRTCRealtimeChannel extends RealtimeChannel {
  readonly media: WebRTCMediaControls;
}

const DEFAULT_DATA_CHANNEL_LABEL: string = "oai-events";
const DEFAULT_DISCONNECT_GRACE_MS: number = 5_000;

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
 * Browser WebRTC data-channel transport. Touches a peer connection, a
 * microphone track, and an audio element — never a document query.
 */
export function createWebRTCRealtimeChannel(
  options: WebRTCRealtimeChannelOptions,
): WebRTCRealtimeChannel {
  const label: string = options.dataChannelLabel ?? DEFAULT_DATA_CHANNEL_LABEL;
  const disconnectGraceMs: number =
    options.disconnectGraceMs ?? DEFAULT_DISCONNECT_GRACE_MS;
  const scheduler: Scheduler | undefined = resolveScheduler(options.scheduler);

  let state: RealtimeChannelState = "idle";
  let peer: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let local: MediaStream | null = null;
  let remote: MediaStream | null = null;
  let audio: HTMLAudioElement | null = null;
  let micEnabled: boolean = true;
  let closedByUs: boolean = false;
  let cancelGrace: (() => void) | undefined;
  let generation: number = 0;

  const eventListeners: Set<(event: unknown) => void> = new Set();
  const stateListeners: Set<
    (state: RealtimeChannelState, fault?: RealtimeChannelFault) => void
  > = new Set();
  const streamListeners: Set<
    (which: "local" | "remote", stream: MediaStream | null) => void
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

  const emitStream = (
    which: "local" | "remote",
    stream: MediaStream | null,
  ): void => {
    for (const listener of [...streamListeners]) {
      invokeHost(() => {
        listener(which, stream);
      });
    }
  };

  const stopTracks = (stream: MediaStream | null): void => {
    if (stream === null) return;
    for (const track of stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // Track stop is best effort.
      }
    }
  };

  const abandon = (): void => {
    cancelGrace?.();
    cancelGrace = undefined;
    try {
      dataChannel?.close();
    } catch {
      // Data-channel close is best effort.
    }
    dataChannel = null;
    try {
      peer?.close();
    } catch {
      // Peer close is best effort.
    }
    peer = null;
    stopTracks(local);
    local = null;
    remote = null;
    if (audio !== null) {
      try {
        audio.srcObject = null;
        audio.pause();
      } catch {
        // Audio teardown is best effort.
      }
    }
    audio = null;
  };

  const fail = (fault: RealtimeChannelFault): void => {
    if (state === "closed") return;
    abandon();
    emitState("closed", fault);
  };

  const applyMicEnabled = (): void => {
    if (local === null) return;
    for (const track of local.getAudioTracks()) {
      track.enabled = micEnabled;
    }
  };

  const channel: WebRTCRealtimeChannel = {
    get state(): RealtimeChannelState {
      return state;
    },
    media: Object.freeze({
      setMicrophoneEnabled(enabled: boolean): void {
        micEnabled = enabled;
        applyMicEnabled();
      },
      microphoneEnabled(): boolean {
        return micEnabled;
      },
      localStream(): MediaStream | null {
        return local;
      },
      remoteStream(): MediaStream | null {
        return remote;
      },
      onStreamChange(
        cb: (which: "local" | "remote", stream: MediaStream | null) => void,
      ): () => void {
        streamListeners.add(cb);
        return (): void => {
          streamListeners.delete(cb);
        };
      },
    }),
    async open(signal: AbortSignalLike): Promise<void> {
      if (state === "open") return;
      if (state === "opening") {
        throw new Error("A WebRTC channel open is already in progress.");
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
        if (signal.aborted) throw new Error("The WebRTC handshake was aborted.");
        const createPeer: () => RTCPeerConnection =
          options.peerConnectionFactory ??
          ((): RTCPeerConnection => new RTCPeerConnection());
        const nextPeer: RTCPeerConnection = createPeer();
        if (attempt !== generation || signal.aborted) {
          nextPeer.close();
          throw new Error("The WebRTC handshake was aborted.");
        }
        peer = nextPeer;

        nextPeer.addEventListener("connectionstatechange", () => {
          if (attempt !== generation || closedByUs) return;
          const connectionState: RTCPeerConnectionState = nextPeer.connectionState;
          if (connectionState === "connected") {
            cancelGrace?.();
            cancelGrace = undefined;
            return;
          }
          if (connectionState === "disconnected") {
            cancelGrace?.();
            if (scheduler === undefined) {
              fail(
                Object.freeze({
                  code: "dropped",
                  message: "The peer connection disconnected.",
                }),
              );
              return;
            }
            cancelGrace = scheduler(() => {
              cancelGrace = undefined;
              if (
                attempt === generation &&
                nextPeer.connectionState === "disconnected"
              ) {
                fail(
                  Object.freeze({
                    code: "dropped",
                    message: "The peer connection disconnected.",
                  }),
                );
              }
            }, disconnectGraceMs);
            return;
          }
          if (connectionState === "failed" || connectionState === "closed") {
            fail(
              Object.freeze({
                code: connectionState === "failed" ? "dropped" : "closed-by-peer",
                message: "The peer connection closed.",
              }),
            );
          }
        });

        const createAudio: () => HTMLAudioElement =
          options.audioElementFactory ?? ((): HTMLAudioElement => new Audio());
        audio = createAudio();
        audio.autoplay = true;
        nextPeer.addEventListener("track", (event: RTCTrackEvent) => {
          if (attempt !== generation) return;
          const incoming: MediaStream | null = event.streams[0] ?? null;
          remote = incoming;
          if (audio !== null) {
            audio.srcObject = incoming;
            void audio.play().catch(() => undefined);
          }
          emitStream("remote", incoming);
        });

        const requestMic: () => Promise<MediaStream> =
          options.requestMicrophone ??
          ((): Promise<MediaStream> =>
            navigator.mediaDevices.getUserMedia({ audio: true }));
        const stream: MediaStream = await requestMic();
        if (attempt !== generation || signal.aborted) {
          stopTracks(stream);
          throw new Error("The WebRTC handshake was aborted.");
        }
        local = stream;
        applyMicEnabled();
        emitStream("local", stream);
        for (const track of stream.getAudioTracks()) {
          nextPeer.addTrack(track, stream);
        }

        const nextChannel: RTCDataChannel = nextPeer.createDataChannel(label);
        dataChannel = nextChannel;
        nextChannel.addEventListener("message", (message: MessageEvent) => {
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
        nextChannel.addEventListener("close", () => {
          if (attempt !== generation || closedByUs) return;
          fail(
            Object.freeze({
              code: "closed-by-peer",
              message: "The data channel closed.",
            }),
          );
        });
        nextChannel.addEventListener("error", () => {
          if (attempt !== generation || closedByUs) return;
          fail(
            Object.freeze({
              code: "dropped",
              message: "The data channel failed.",
            }),
          );
        });

        const offer: RTCSessionDescriptionInit = await nextPeer.createOffer();
        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebRTC handshake was aborted.");
        }
        await nextPeer.setLocalDescription(offer);
        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebRTC handshake was aborted.");
        }

        const sdp: string | undefined =
          nextPeer.localDescription?.sdp ?? offer.sdp;
        if (typeof sdp !== "string" || sdp.length === 0) {
          throw new Error("The local description did not contain SDP.");
        }
        const answer: WebRTCNegotiationAnswer = await options.negotiate({
          sdp,
          signal,
        });
        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebRTC handshake was aborted.");
        }
        if (typeof answer.sdp !== "string" || answer.sdp.length === 0) {
          throw new Error("Negotiation did not return SDP.");
        }
        await nextPeer.setRemoteDescription({
          type: "answer",
          sdp: answer.sdp,
        });
        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebRTC handshake was aborted.");
        }

        if (nextChannel.readyState !== "open") {
          await new Promise<void>((resolve, reject) => {
            const onOpen = (): void => {
              cleanup();
              resolve();
            };
            const onFail = (): void => {
              cleanup();
              reject(new Error("The data channel closed during handshake."));
            };
            const cleanup = (): void => {
              nextChannel.removeEventListener("open", onOpen);
              nextChannel.removeEventListener("close", onFail);
              nextChannel.removeEventListener("error", onFail);
              releaseOpenAbort();
            };
            const releaseOpenAbort: () => void = waitForAbort(signal, () => {
              cleanup();
              reject(new Error("The WebRTC handshake was aborted."));
            });
            nextChannel.addEventListener("open", onOpen);
            nextChannel.addEventListener("close", onFail);
            nextChannel.addEventListener("error", onFail);
          });
        }
        if (attempt !== generation || signal.aborted) {
          throw new Error("The WebRTC handshake was aborted.");
        }
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
                  code: "rejected",
                  message: "The WebRTC handshake failed.",
                }),
          );
        }
        throw error instanceof Error
          ? error
          : new Error("The WebRTC handshake failed.");
      } finally {
        released = true;
        releaseAbort();
      }
    },
    send(event: RealtimeWireEvent): boolean {
      if (state !== "open" || dataChannel === null || dataChannel.readyState !== "open") {
        return false;
      }
      try {
        dataChannel.send(JSON.stringify(event));
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
