import { getContext, setContext } from "svelte";

import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@fullselfbrowsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
  SnapshotNormalizer,
} from "@fullselfbrowsing/concierge";

const EXPECTED_CONTRACT_VERSION: number = 2;
const CONCIERGE_CONTEXT: symbol = Symbol(
  "@fullselfbrowsing/concierge-svelte.context",
);

export function provideConcierge(concierge: Concierge): Concierge {
  return setContext(CONCIERGE_CONTEXT, concierge);
}

export function useConcierge(): Concierge {
  const concierge: Concierge | undefined =
    getContext<Concierge | undefined>(CONCIERGE_CONTEXT);

  if (concierge === undefined) {
    throw new Error(
      "@fullselfbrowsing/concierge-svelte: useConcierge requires an ancestor " +
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
        `@fullselfbrowsing/concierge-svelte expected core contract v${EXPECTED_CONTRACT_VERSION} ` +
          `but found v${CONTRACT_VERSION}; upgrade or reinstall ` +
          `@fullselfbrowsing/concierge-svelte and @fullselfbrowsing/concierge together.`,
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
