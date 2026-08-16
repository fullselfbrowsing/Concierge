import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  Context,
  PropsWithChildren,
  ReactElement,
} from "react";
import type { Concierge, DispatchEvent } from "@full-self-browsing/concierge";
import { mountConciergeTelemetry } from "@full-self-browsing/concierge/telemetry";

const ConciergeContext: Context<Concierge | null> =
  createContext<Concierge | null>(null);
const ConciergeActivityContext: Context<ConciergeActivityStore | null> =
  createContext<ConciergeActivityStore | null>(null);
const useBrowserLayoutEffect: typeof useLayoutEffect =
  "window" in globalThis ? useLayoutEffect : useEffect;

interface ConciergeActivityStore {
  readonly getSnapshot: () => boolean;
  readonly observe: (event: DispatchEvent) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

export type ConciergeBadgePosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ConciergeGlowOptions {
  readonly color?: string | undefined;
  readonly secondaryColor?: string | undefined;
  readonly intensity?: number | undefined;
}

export interface ConciergePoweredByFSBOptions {
  readonly position?: ConciergeBadgePosition | undefined;
  readonly color?: string | undefined;
  readonly backgroundColor?: string | undefined;
  readonly borderColor?: string | undefined;
}

export interface ConciergeActivityOverlayProps {
  readonly glow?: boolean | ConciergeGlowOptions | undefined;
  readonly poweredByFSB?: boolean | ConciergePoweredByFSBOptions | undefined;
  readonly zIndex?: number | undefined;
}

export interface ConciergeProviderProps {
  readonly concierge: Concierge;
  readonly telemetry?: boolean | undefined;
}

function clampIntensity(value: number | undefined): number {
  if (value === undefined || Number.isNaN(value)) return 0.72;
  return Math.min(1, Math.max(0, value));
}

function isTerminalDispatchPhase(phase: DispatchEvent["phase"]): boolean {
  switch (phase) {
    case "accepted":
    case "waiting":
    case "executing":
      return false;
    case "succeeded":
    case "failed":
    case "cancelled":
      return true;
  }
}

function createConciergeActivityStore(): ConciergeActivityStore {
  const activeDispatches: Set<string> = new Set<string>();
  const listeners: Set<() => void> = new Set<() => void>();

  return {
    getSnapshot: (): boolean => activeDispatches.size > 0,
    observe: (event): void => {
      const terminal: boolean = isTerminalDispatchPhase(event.phase);
      if (
        terminal
          ? !activeDispatches.has(event.dispatchId)
          : activeDispatches.has(event.dispatchId)
      ) {
        return;
      }

      const wasActive: boolean = activeDispatches.size > 0;
      if (terminal) {
        activeDispatches.delete(event.dispatchId);
      } else {
        activeDispatches.add(event.dispatchId);
      }

      if (wasActive === (activeDispatches.size > 0)) return;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe: (listener): (() => void) => {
      listeners.add(listener);
      return (): void => {
        listeners.delete(listener);
      };
    },
  };
}

function ConciergeProviderLifecycle({
  activityStore,
  concierge,
  telemetry,
}: {
  readonly activityStore: ConciergeActivityStore;
  readonly concierge: Concierge;
  readonly telemetry: boolean;
}): null {
  useBrowserLayoutEffect(
    (): (() => void) => concierge.onDispatch(activityStore.observe),
    [activityStore, concierge],
  );

  useBrowserLayoutEffect((): (() => void) | undefined => {
    if (!telemetry) return undefined;
    return mountConciergeTelemetry(concierge);
  }, [concierge, telemetry]);

  return null;
}

function badgePositionStyle(position: ConciergeBadgePosition): CSSProperties {
  switch (position) {
    case "top-left": return { top: "1rem", left: "1rem" };
    case "top-right": return { top: "1rem", right: "1rem" };
    case "bottom-left": return { bottom: "1rem", left: "1rem" };
    case "bottom-right": return { bottom: "1rem", right: "1rem" };
  }
}

export function ConciergeProvider({
  concierge,
  children,
  telemetry = true,
}: PropsWithChildren<ConciergeProviderProps>): ReactElement {
  const activityStore: ConciergeActivityStore = useMemo(
    createConciergeActivityStore,
    [concierge],
  );

  return (
    <ConciergeContext.Provider value={concierge}>
      <ConciergeActivityContext.Provider value={activityStore}>
        <ConciergeProviderLifecycle
          activityStore={activityStore}
          concierge={concierge}
          telemetry={telemetry}
        />
        {children}
      </ConciergeActivityContext.Provider>
    </ConciergeContext.Provider>
  );
}

export function useConcierge(): Concierge {
  const concierge: Concierge | null = useContext(ConciergeContext);

  if (concierge === null) {
    throw new Error(
      "@full-self-browsing/concierge-react: useConcierge must be used within " +
        "<ConciergeProvider concierge={...}>.",
    );
  }

  return concierge;
}

export function useConciergeActivity(): boolean {
  const activityStore: ConciergeActivityStore | null = useContext(
    ConciergeActivityContext,
  );

  if (activityStore === null) {
    throw new Error(
      "@full-self-browsing/concierge-react: useConciergeActivity must be used " +
        "within <ConciergeProvider concierge={...}>.",
    );
  }

  return useSyncExternalStore(
    activityStore.subscribe,
    activityStore.getSnapshot,
    activityStore.getSnapshot,
  );
}

export function ConciergeActivityOverlay({
  glow = true,
  poweredByFSB = false,
  zIndex = 2_147_483_000,
}: ConciergeActivityOverlayProps): ReactElement | null {
  const active: boolean = useConciergeActivity();

  if (!active) return null;

  const glowOptions: ConciergeGlowOptions =
    glow !== null && typeof glow === "object" ? glow : {};
  const badgeOptions: ConciergePoweredByFSBOptions =
    poweredByFSB !== null && typeof poweredByFSB === "object"
      ? poweredByFSB
      : {};
  const glowColor: string = glowOptions.color ?? "#FF6B35";
  const secondaryGlowColor: string =
    glowOptions.secondaryColor ?? "#635BFF";
  const badgePosition: ConciergeBadgePosition =
    badgeOptions.position ?? "bottom-left";

  return (
    <>
      {glow === false ? null : (
        <div
          aria-hidden="true"
          data-concierge-activity-glow=""
          style={{
            position: "fixed",
            inset: 0,
            zIndex,
            pointerEvents: "none",
            opacity: clampIntensity(glowOptions.intensity),
            boxShadow:
              `inset 0 0 2.5rem ${glowColor}, ` +
              `inset 0 0 7rem ${secondaryGlowColor}`,
          }}
        />
      )}
      {poweredByFSB === false ? null : (
        <div
          data-concierge-powered-by-fsb=""
          style={{
            position: "fixed",
            ...badgePositionStyle(badgePosition),
            zIndex: zIndex + 1,
            pointerEvents: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.45rem",
            padding: "0.45rem 0.65rem",
            border: `1px solid ${badgeOptions.borderColor ?? glowColor}`,
            borderRadius: "999px",
            background: badgeOptions.backgroundColor ?? "#000000E6",
            color: badgeOptions.color ?? "#F1F5F9",
            boxShadow: "0 0.5rem 1.5rem #00000040",
            fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
            fontSize: "0.6875rem",
            fontWeight: 700,
            letterSpacing: "0.06em",
            lineHeight: 1,
            textTransform: "uppercase",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: "0.45rem",
              height: "0.45rem",
              borderRadius: "50%",
              background: badgeOptions.borderColor ?? glowColor,
              boxShadow: `0 0 0.65rem ${badgeOptions.borderColor ?? glowColor}`,
            }}
          />
          Powered by FSB
        </div>
      )}
    </>
  );
}
