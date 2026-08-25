"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@full-self-browsing/concierge";
import type { Bridge, BridgeRegistry } from "@full-self-browsing/concierge";

export {
  ConciergeActivityOverlay,
  ConciergeProvider,
  useConcierge,
  useConciergeActivity,
} from "../overlay/activity.js";
export type {
  ConciergeActivityOverlayProps,
  ConciergeBadgePosition,
  ConciergeGlowOptions,
  ConciergePoweredByFSBOptions,
  ConciergeProviderProps,
} from "../overlay/activity.js";

const EXPECTED_CONTRACT_VERSION: number = 3;

export function useConciergeValue<T>(value: T): () => T {
  const valueRef = useRef<T>(value);

  useEffect((): void => {
    valueRef.current = value;
  }, [value]);

  return useCallback((): T => valueRef.current, []);
}

export function useConciergeBridge<B extends Bridge>(
  registry: BridgeRegistry<B>,
  bridge: B,
): void {
  useEffect((): (() => void) => {
    assertSingleInstance();

    if (CONTRACT_VERSION !== EXPECTED_CONTRACT_VERSION) {
      throw new Error(
        `@full-self-browsing/concierge-react expected core contract v${EXPECTED_CONTRACT_VERSION} ` +
          `but found v${CONTRACT_VERSION}; upgrade or reinstall ` +
          `@full-self-browsing/concierge-react and @full-self-browsing/concierge together.`,
      );
    }

    const unregister: () => void = registry.register(bridge);
    return unregister;
  }, [registry, bridge]);
}
