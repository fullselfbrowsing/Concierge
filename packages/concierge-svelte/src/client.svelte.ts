import { getContext, onDestroy, setContext } from "svelte";

import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@full-self-browsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
  SnapshotNormalizer,
} from "@full-self-browsing/concierge";
import { mountConciergeTelemetry } from "@full-self-browsing/concierge/telemetry";

const EXPECTED_CONTRACT_VERSION: number = 2;
const CONCIERGE_CONTEXT: symbol = Symbol(
  "@full-self-browsing/concierge-svelte.context",
);

export interface ProvideConciergeOptions {
  readonly telemetry?: boolean | undefined;
}

export function provideConcierge(
  concierge: Concierge,
  options: ProvideConciergeOptions = {},
): Concierge {
  const provided: Concierge = setContext(CONCIERGE_CONTEXT, concierge);
  if (options.telemetry !== false) {
    const unmountTelemetry: () => void = mountConciergeTelemetry(concierge);
    onDestroy(unmountTelemetry);
  }
  return provided;
}

export function useConcierge(): Concierge {
  const concierge: Concierge | undefined =
    getContext<Concierge | undefined>(CONCIERGE_CONTEXT);

  if (concierge === undefined) {
    throw new Error(
      "@full-self-browsing/concierge-svelte: useConcierge requires an ancestor " +
        "component to call provideConcierge(concierge) during initialization.",
    );
  }

  return concierge;
}

export function useConciergeBridge<B extends Bridge>(
  getRegistry: () => BridgeRegistry<B>,
  getBridge: () => B,
): void {
  $effect((): (() => void) => {
    const registry: BridgeRegistry<B> = getRegistry();
    const bridge: B = getBridge();

    assertSingleInstance();

    if (CONTRACT_VERSION !== EXPECTED_CONTRACT_VERSION) {
      throw new Error(
        `@full-self-browsing/concierge-svelte expected core contract v${EXPECTED_CONTRACT_VERSION} ` +
          `but found v${CONTRACT_VERSION}; upgrade or reinstall ` +
          `@full-self-browsing/concierge-svelte and @full-self-browsing/concierge together.`,
      );
    }

    return registry.register(bridge);
  });
}

export function svelteSnapshotNormalizer<T>(value: T): T;
export function svelteSnapshotNormalizer(value: unknown): unknown {
  return $state.snapshot(value);
}

const _normalizerContract: SnapshotNormalizer = svelteSnapshotNormalizer;
