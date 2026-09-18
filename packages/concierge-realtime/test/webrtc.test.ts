import { describe, expect, it } from "vitest";

import { createLocalAbortController } from "../src/host.js";
import { createWebRTCRealtimeChannel } from "../src/webrtc/index.js";

function createFakeTrack(enabled = true) {
  return {
    enabled,
    kind: "audio",
    stop() {},
  };
}

function createFakeStream(tracks = [createFakeTrack()]) {
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks,
  };
}

function createFakeDataChannel(readyState = "open") {
  const listeners = new Map();
  return {
    readyState,
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
      this.readyState = "closed";
    },
    open() {
      this.readyState = "open";
      for (const listener of listeners.get("open") ?? []) listener();
    },
    emitMessage(data) {
      for (const listener of listeners.get("message") ?? []) {
        listener({ data });
      }
    },
  };
}

function createFakePeer(dataChannel) {
  const listeners = new Map();
  let connectionState = "new";
  return {
    connectionState,
    localDescription: { sdp: "offer-sdp" },
    addEventListener(type, listener) {
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener);
      listeners.set(type, bucket);
    },
    addTrack() {},
    createDataChannel() {
      return dataChannel;
    },
    async createOffer() {
      return { sdp: "offer-sdp", type: "offer" };
    },
    async setLocalDescription() {},
    async setRemoteDescription() {},
    close() {
      connectionState = "closed";
      this.connectionState = "closed";
    },
    emit(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    setConnectionState(next) {
      connectionState = next;
      this.connectionState = next;
      this.emit("connectionstatechange");
    },
  };
}

function createFakeAudio() {
  return {
    autoplay: false,
    srcObject: null,
    play: async () => {},
    pause() {},
  };
}

describe("createWebRTCRealtimeChannel", () => {
  it("opens through injected peer, mic, and audio factories without querying the document", async () => {
    const dataChannel = createFakeDataChannel();
    const peer = createFakePeer(dataChannel);
    const audio = createFakeAudio();
    const local = createFakeStream();
    const remote = createFakeStream();
    const negotiated = [];
    const events = [];
    const channel = createWebRTCRealtimeChannel({
      negotiate: async (request) => {
        negotiated.push(request.sdp);
        return { sdp: "answer-sdp" };
      },
      peerConnectionFactory: () => peer,
      requestMicrophone: async () => local,
      audioElementFactory: () => audio,
    });
    channel.onEvent((event) => events.push(event));

    const abort = createLocalAbortController();
    await channel.open(abort.signal);

    expect(channel.state).toBe("open");
    expect(negotiated).toEqual(["offer-sdp"]);
    expect(channel.media.localStream()).toBe(local);
    peer.emit("track", { streams: [remote] });
    expect(channel.media.remoteStream()).toBe(remote);
    expect(audio.srcObject).toBe(remote);
    expect(audio.autoplay).toBe(true);

    expect(channel.send({ type: "ping" })).toBe(true);
    dataChannel.emitMessage(JSON.stringify({ type: "pong" }));
    expect(events).toEqual([{ type: "pong" }]);

    channel.media.setMicrophoneEnabled(false);
    expect(channel.media.microphoneEnabled()).toBe(false);
    expect(local.getAudioTracks()[0]?.enabled).toBe(false);

    channel.close();
    expect(channel.state).toBe("closed");
  });

  it("abandons the handshake when the signal aborts", async () => {
    const dataChannel = createFakeDataChannel();
    const peer = createFakePeer(dataChannel);
    let releaseMic;
    const mic = new Promise((resolve) => {
      releaseMic = resolve;
    });
    const channel = createWebRTCRealtimeChannel({
      negotiate: async () => ({ sdp: "answer-sdp" }),
      peerConnectionFactory: () => peer,
      requestMicrophone: () => mic,
      audioElementFactory: () => createFakeAudio(),
    });
    const abort = createLocalAbortController();
    const opening = channel.open(abort.signal);
    abort.abort();
    releaseMic?.(createFakeStream());
    await expect(opening).rejects.toThrow("aborted");
    expect(channel.state).toBe("closed");
  });

  it("does not contain a document query in the webrtc source contract", () => {
    expect(createWebRTCRealtimeChannel.toString()).not.toMatch(
      /querySelector|getElementById|document\./,
    );
  });
});
