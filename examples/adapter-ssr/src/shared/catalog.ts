import type {
  Bridge,
  BridgeRegistry,
  Concierge,
  EmittedTool,
} from "@fullselfbrowsing/concierge";

export type AdapterName = "react" | "svelte";

export type AdapterSsrBridge = Bridge<
  { readonly identify: () => string },
  {
    readonly adapter: () => AdapterName;
    readonly identity: () => string;
  }
>;

export type AdapterSsrSide = Readonly<{
  adapter: AdapterName;
  identity: string;
  concierge: Concierge;
  registry: BridgeRegistry<AdapterSsrBridge>;
  bridge: AdapterSsrBridge;
  catalog: ReadonlyArray<EmittedTool>;
  preRegistry: AdapterSsrBridge | null;
}>;

export type RequestHarness = Readonly<{
  renderId: string;
  react: AdapterSsrSide;
  svelte: AdapterSsrSide;
}>;

export function createRequestHarness(_renderId: string): RequestHarness {
  throw new Error("Task 09-07-01 RED: createRequestHarness is not implemented.");
}
