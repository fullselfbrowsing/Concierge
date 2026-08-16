import { createElement } from "react";
import type { ComponentProps, ReactElement } from "react";

import type {
  Bridge,
  BridgeRegistry,
  Concierge,
} from "@full-self-browsing/concierge";
import {
  ConciergeActivityOverlay,
  ConciergeProvider,
  useConcierge,
  useConciergeActivity,
  useConciergeBridge,
  useConciergeValue,
} from "@full-self-browsing/concierge-react/client";
import type {
  ConciergeActivityOverlayProps,
  ConciergeBadgePosition,
  ConciergeGlowOptions,
  ConciergePoweredByFSBOptions,
} from "@full-self-browsing/concierge-react/client";

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2)
    ? true
    : false;
type Expect<T extends true> = T;

type ProviderProps = ComponentProps<typeof ConciergeProvider>;
type _providerCarriesExactConcierge = Expect<
  Equal<ProviderProps["concierge"], Concierge>
>;
type _activityPropsRemainPublic = Expect<
  Equal<ComponentProps<typeof ConciergeActivityOverlay>, ConciergeActivityOverlayProps>
>;

const _consumerSignature: () => Concierge = useConcierge;
const _activitySignature: () => boolean = useConciergeActivity;
const _valueSignature: <T>(value: T) => () => T = useConciergeValue;
const _bridgeSignature: <B extends Bridge>(
  registry: BridgeRegistry<B>,
  bridge: B,
) => void = useConciergeBridge;

declare const concierge: Concierge;
const _providerElement: ReactElement = createElement(ConciergeProvider, {
  concierge,
  telemetry: false,
});
const _activityElement: ReactElement = createElement(ConciergeActivityOverlay, {
  glow: {
    color: "oklch(70% 0.2 35)",
    secondaryColor: "var(--concierge-accent)",
    intensity: 0.8,
  } satisfies ConciergeGlowOptions,
  poweredByFSB: {
    position: "bottom-left" satisfies ConciergeBadgePosition,
    color: "white",
    backgroundColor: "black",
    borderColor: "orange",
  } satisfies ConciergePoweredByFSBOptions,
  zIndex: 100,
});

const plainValue = {
  status: "ready",
  nested: { count: 1 },
} as const;
const readPlainValue = useConciergeValue(plainValue);
type _plainValueIsPreserved = Expect<
  Equal<ReturnType<typeof readPlainValue>, typeof plainValue>
>;

type BookingBridge = Bridge<
  { submit: (id: string) => Promise<boolean> },
  { booking: () => Readonly<{ id: string }> }
>;
type OtherBridge = Bridge<
  { cancel: () => void },
  { booking: () => Readonly<{ id: string }> }
>;

declare const bookingRegistry: BridgeRegistry<BookingBridge>;
declare const bookingBridge: BookingBridge;
declare const otherBridge: OtherBridge;

const _bridgeReturn: void = useConciergeBridge(
  bookingRegistry,
  bookingBridge,
);

// @ts-expect-error -- the provider requires a constructed Concierge.
createElement(ConciergeProvider, {});

// @ts-expect-error -- structurally unrelated values are not Concierge handles.
createElement(ConciergeProvider, { concierge: { dispatch: "not-callable" } });

// @ts-expect-error -- the per-provider telemetry setting is boolean.
createElement(ConciergeProvider, { concierge, telemetry: "off" });

// @ts-expect-error -- useConcierge accepts no arguments.
useConcierge("unexpected");

// @ts-expect-error -- useConciergeActivity accepts no arguments.
useConciergeActivity("unexpected");

// @ts-expect-error -- badge positions are a closed layout union.
createElement(ConciergeActivityOverlay, { poweredByFSB: { position: "center" } });

// @ts-expect-error -- glow intensity is numeric.
createElement(ConciergeActivityOverlay, { glow: { intensity: "strong" } });

// @ts-expect-error -- a current plain value is required.
useConciergeValue();

// @ts-expect-error -- the bridge argument is required.
useConciergeBridge(bookingRegistry);

// @ts-expect-error -- an explicitly preserved registry generic rejects another bridge.
useConciergeBridge<BookingBridge>(bookingRegistry, otherBridge);
