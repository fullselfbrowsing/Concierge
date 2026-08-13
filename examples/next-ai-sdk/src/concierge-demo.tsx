"use client";

import { useChat } from "@ai-sdk/react";
import { ConciergeProvider, useConciergeBridge } from "@fullselfbrowsing/concierge-react/client";
import {
  createIndexedDBReplayStore,
  createSignedBrowserBridge,
} from "@fullselfbrowsing/concierge/ai-sdk/browser";
import type {
  SignedBrowserBridge,
} from "@fullselfbrowsing/concierge/ai-sdk/browser";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import type { DataUIPart, UIMessage } from "ai";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";

import {
  applyBrowserBatchReport,
  applyServerCatalogRetry,
} from "./client-flow";
import {
  createPortfolioConcierge,
} from "./portfolio-concierge";
import type {
  PortfolioBridge,
  PortfolioContext,
} from "./portfolio-concierge";
import type {
  BootstrapResponse,
  ConciergeUIData,
} from "./protocol";

type DemoMessage = UIMessage<unknown, ConciergeUIData>;

function messageText(message: DemoMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function eventLabel(event: {
  readonly phase: string;
  readonly name: string | null;
}): string {
  const action = event.name ?? "Rejected action";
  switch (event.phase) {
    case "accepted": return `${action} accepted`;
    case "waiting": return `${action} waiting for its commit window`;
    case "executing": return `${action} executing`;
    case "succeeded": return `${action} succeeded`;
    case "cancelled": return `${action} cancelled`;
    default: return `${action} failed`;
  }
}

export function ConciergeDemo() {
  const runtime = useMemo(() => createPortfolioConcierge(), []);
  const [pathname, setPathname] = useState<PortfolioContext["pathname"]>("/");
  const [browserOpen, setBrowserOpen] = useState(false);
  const [previewScrollable, setPreviewScrollable] = useState(false);
  const [voiceActive, setVoiceActive] = useState(true);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [overlay, setOverlay] = useState("No Concierge action is active.");
  const [notice, setNotice] = useState<string | null>(null);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [input, setInput] = useState("");

  const context: PortfolioContext = useMemo(() => ({
    pathname,
    browserOpen,
    previewScrollable,
    voiceActive,
  }), [pathname, browserOpen, previewScrollable, voiceActive]);
  const contextRef = useRef(context);
  contextRef.current = context;

  const pathnameRef = useRef(pathname);
  const browserOpenRef = useRef(browserOpen);
  const previewScrollableRef = useRef(previewScrollable);
  const voiceActiveRef = useRef(voiceActive);
  pathnameRef.current = pathname;
  browserOpenRef.current = browserOpen;
  previewScrollableRef.current = previewScrollable;
  voiceActiveRef.current = voiceActive;

  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const bridge: PortfolioBridge = useMemo(() => ({
    actions: {
      navigate(nextPathname) {
        setPathname(nextPathname);
      },
      openProject(nextProjectId) {
        setPathname("/portfolio");
        setProjectId(nextProjectId);
        setBrowserOpen(true);
        setPreviewScrollable(true);
      },
      closeBrowser() {
        setBrowserOpen(false);
        setPreviewScrollable(false);
        setProjectId(null);
      },
      scrollPreview(direction) {
        setNotice(`Application scrolled the preview ${direction}.`);
      },
      switchToText() {
        setVoiceActive(false);
      },
      endCall() {
        setVoiceActive(false);
      },
      async announce(text, signal) {
        if (!("speechSynthesis" in globalThis)) return;
        await new Promise<void>((resolve) => {
          let settled = false;
          const finish = (): void => {
            if (settled) return;
            settled = true;
            signal.removeEventListener("abort", abort);
            resolve();
          };
          const abort = (): void => {
            speechSynthesis.cancel();
            finish();
          };
          if (signal.aborted) {
            abort();
            return;
          }
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = finish;
          utterance.onerror = finish;
          speechRef.current = utterance;
          signal.addEventListener("abort", abort);
          speechSynthesis.speak(utterance);
        });
      },
      stopAnnouncement() {
        speechRef.current = null;
        if ("speechSynthesis" in globalThis) speechSynthesis.cancel();
      },
    },
    snapshot: {
      pathname: () => pathnameRef.current,
      browserOpen: () => browserOpenRef.current,
      previewScrollable: () => previewScrollableRef.current,
      voiceActive: () => voiceActiveRef.current,
    },
  }), []);
  useConciergeBridge(runtime.bridge, bridge);

  const signedBridgeRef = useRef<SignedBrowserBridge | null>(null);
  const addToolOutputRef = useRef<((row: {
    name: string;
    callId: string;
    result: unknown;
  }) => void) | null>(null);
  const stopChatRef = useRef<(() => Promise<void>) | null>(null);
  const recoverCatalogRef = useRef<(() => Promise<void>) | null>(null);
  const deliveryCompleteRef = useRef(false);
  const pendingDeliveryRef = useRef(new Set<(completed: boolean) => void>());
  const turnAbortRef = useRef(new AbortController());
  const turnIdRef = useRef(crypto.randomUUID());

  useEffect(() => runtime.concierge.onDispatch((event) => {
    setOverlay(eventLabel(event));
  }), [runtime]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/bootstrap", {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Bootstrap failed (${response.status}).`);
      return response.json() as Promise<BootstrapResponse>;
    }).then(setBootstrap).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        setBootstrapError(error instanceof Error ? error.message : "Bootstrap failed.");
      }
    });
    return (): void => controller.abort();
  }, []);

  useEffect(() => {
    if (bootstrap === null) return;
    const browserBridge = createSignedBrowserBridge({
      concierge: runtime.concierge,
      audience: bootstrap.audience,
      sessionId: bootstrap.sessionId,
      publicKeys: new Map([["example-es256", {
        format: "spki-pem",
        data: bootstrap.publicKeyPem,
      }]]),
      replayStore: createIndexedDBReplayStore({
        databaseName: "concierge-next-ai-sdk-example",
      }),
      presentOutcome: async (outcome) => {
        setNotice(outcome.failures
          .map((failure) => `${failure.callId}: ${failure.message}`)
          .join(" "));
        // Resolve only after React has had a frame to put the app-authored
        // failure in front of the user. The bridge withholds model output
        // until this presentation report completes.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return { outcome: "completed" };
      },
      deliveryFor: (identity) => (effect) => {
        const complete = (delivered: boolean): void => effect({
          responseId: identity.responseId,
          outcome: delivered ? "completed" : "interrupted",
        });
        if (deliveryCompleteRef.current) {
          queueMicrotask(() => complete(true));
        } else {
          pendingDeliveryRef.current.add(complete);
        }
      },
      initialContext: contextRef.current,
      onDiagnostic: (diagnostic) => setNotice(`Bridge rejected a batch: ${diagnostic.code}.`),
    });
    signedBridgeRef.current = browserBridge;
    return (): void => {
      signedBridgeRef.current = null;
      void browserBridge.stop();
    };
  }, [bootstrap, runtime]);

  useEffect(() => {
    signedBridgeRef.current?.setContext(context);
  }, [context]);

  const acceptEnvelope = useCallback((dataPart: DataUIPart<ConciergeUIData>): void => {
    if (dataPart.type === "data-concierge-retry") {
      void applyServerCatalogRetry(dataPart.data.reason, {
        notice: setNotice,
        recoverCatalog: async () => {
          await recoverCatalogRef.current?.();
        },
      }).catch(() => {
        setNotice("The stale assistant step could not be regenerated.");
        void stopChatRef.current?.();
      });
      return;
    }
    if (dataPart.type !== "data-concierge-envelope") return;
    const signedBridge = signedBridgeRef.current;
    if (signedBridge === null) {
      setNotice("The signed browser bridge is not ready.");
      return;
    }
    void signedBridge.accept(dataPart.data.envelope, {
      signal: turnAbortRef.current.signal,
    }).then(async (report) => {
      await applyBrowserBatchReport(report, {
        addToolOutput: ({ tool, toolCallId, output }) => {
          addToolOutputRef.current?.({
            name: tool,
            callId: toolCallId,
            result: output,
          });
        },
        recoverCatalog: async () => {
          await recoverCatalogRef.current?.();
        },
        stop: async () => {
          await stopChatRef.current?.();
        },
        notice: setNotice,
      });
    }).catch(() => {
      setNotice("The signed action batch could not be processed.");
    });
  }, []);

  const transport = useMemo(() => new DefaultChatTransport<DemoMessage>({
    api: "/api/chat",
    credentials: "same-origin",
    prepareSendMessagesRequest: ({ messages }) => ({
      body: (() => {
        deliveryCompleteRef.current = false;
        return {
          messages,
          context: contextRef.current,
          userTurnId: turnIdRef.current,
        };
      })(),
    }),
  }), []);

  const chat = useChat<DemoMessage>({
    transport,
    onData: acceptEnvelope,
    // Raw AI SDK calls are intentionally display-only. Only the separately
    // signed envelope above may enter Concierge.
    onToolCall: () => undefined,
    onFinish: ({ isAbort, isDisconnect, isError }) => {
      deliveryCompleteRef.current = !(isAbort || isDisconnect || isError);
      const pending = [...pendingDeliveryRef.current];
      pendingDeliveryRef.current.clear();
      for (const complete of pending) complete(deliveryCompleteRef.current);
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });
  stopChatRef.current = chat.stop;
  addToolOutputRef.current = ({ name, callId, result }): void => {
    void chat.addToolOutput({
      tool: name,
      toolCallId: callId,
      output: result,
    });
  };
  recoverCatalogRef.current = async (): Promise<void> => {
    await chat.stop();
    // AI SDK atomically removes its current assistant message (or reuses the
    // latest user message if the assistant was not committed yet), then sends
    // the untouched prefix with the freshly resolved request context.
    await chat.regenerate();
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const text = input.trim();
    if (text.length === 0 || bootstrap === null) return;
    turnAbortRef.current.abort();
    turnAbortRef.current = new AbortController();
    turnIdRef.current = crypto.randomUUID();
    setInput("");
    void chat.sendMessage({ text });
  };

  return (
    <ConciergeProvider concierge={runtime.concierge}>
      <main className="shell">
        <section className="portfolio">
          <p className="status">Stage: {pathname} · Voice: {voiceActive ? "active" : "inactive"}</p>
          <h1>Signed split-runtime portfolio</h1>
          <p>The application owns navigation, speech, viewer state, and tour content.</p>
          <div className="toolbar">
            <button onClick={() => setPathname("/")}>Home</button>
            <button onClick={() => setPathname("/portfolio")}>Portfolio</button>
            <button onClick={() => bridge.actions.openProject("manual")}>Open preview</button>
            <button onClick={() => bridge.actions.closeBrowser()}>Close preview</button>
          </div>
          <div className="preview">
            {browserOpen
              ? <p>Embedded preview: {projectId}. Scrolling is {previewScrollable ? "available" : "unavailable"}.</p>
              : <p>No project preview is open.</p>}
          </div>
        </section>

        <section className="chat">
          <h2>AI SDK + OpenRouter</h2>
          <div className="overlay" aria-live="polite">{overlay}</div>
          {notice === null ? null : <p className="notice" role="status">{notice}</p>}
          {bootstrapError === null ? null : <p role="alert">{bootstrapError}</p>}
          <div className="messages">
            {chat.messages.map((message) => (
              <article className="message" key={message.id}>
                <strong>{message.role}</strong>
                <div>{messageText(message)}</div>
                {message.parts.map((part, index) =>
                  part.type.startsWith("tool-") || part.type === "dynamic-tool"
                    ? <code key={`${message.id}:tool:${index}`}>{part.type}</code>
                    : null,
                )}
              </article>
            ))}
          </div>
          <form className="composer" onSubmit={submit}>
            <input
              aria-label="Message"
              value={input}
              onChange={(event) => setInput(event.currentTarget.value)}
              placeholder="Ask to open a project or start the tour"
            />
            <button disabled={bootstrap === null || chat.status !== "ready"}>Send</button>
            <button type="button" onClick={() => {
              turnAbortRef.current.abort();
              void chat.stop();
            }}>Cancel</button>
          </form>
        </section>
      </main>
    </ConciergeProvider>
  );
}
