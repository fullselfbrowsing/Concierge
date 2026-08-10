"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  assertSingleInstance,
  CONTRACT_VERSION,
} from "@fullselfbrowsing/concierge";
import type {
  Bridge,
  BridgeRegistry,
  Concierge,
} from "@fullselfbrowsing/concierge";
import type {
  Context,
  PropsWithChildren,
  ReactElement,
} from "react";

const EXPECTED_CONTRACT_VERSION: number = 1;
const ConciergeContext: Context<Concierge | null> =
  createContext<Concierge | null>(null);

export function ConciergeProvider({
  concierge,
  children,
}: PropsWithChildren<{ readonly concierge: Concierge }>): ReactElement {
  return (
    <ConciergeContext.Provider value={concierge}>
      {children}
    </ConciergeContext.Provider>
  );
}

export function useConcierge(): Concierge {
  const concierge: Concierge | null = useContext(ConciergeContext);

  if (concierge === null) {
    throw new Error(
      "@fullselfbrowsing/concierge-react: useConcierge must be used within " +
        "<ConciergeProvider concierge={...}>.",
    );
  }

  return concierge;
}

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
        `@fullselfbrowsing/concierge-react expected core contract v${EXPECTED_CONTRACT_VERSION} ` +
          `but found v${CONTRACT_VERSION}; upgrade or reinstall ` +
          `@fullselfbrowsing/concierge-react and @fullselfbrowsing/concierge together.`,
      );
    }

    const unregister: () => void = registry.register(bridge);
    return unregister;
  }, [registry, bridge]);
}
