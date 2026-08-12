import {
  createBridge,
  createConcierge,
  defineAction,
} from "@fullselfbrowsing/concierge";
import { svelteSnapshotNormalizer } from "@fullselfbrowsing/concierge-svelte/client.svelte";
import type {
  AnyActionDefinition,
  Bridge,
  BridgeRegistry,
  Concierge,
  EmittedTool,
  StageDefinition,
  StandardSchemaV1,
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

const EMPTY_OBJECT_SCHEMA: StandardSchemaV1 = Object.freeze({
  "~standard": Object.freeze({
    version: 1,
    vendor: "concierge-adapter-ssr",
    validate(value: unknown) {
      return typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
        ? { value }
        : { issues: [{ message: "Expected an empty object." }] };
    },
  }),
});

const INSPECT_SERVER_RENDER: AnyActionDefinition<AdapterSsrBridge> = Object.freeze(
  defineAction({
    name: "inspectServerRender",
    description: "Report whether the adapter server-render harness is active.",
    schema: EMPTY_OBJECT_SCHEMA,
    jsonSchema: Object.freeze({
      type: "object" as const,
      properties: Object.freeze({}),
      additionalProperties: false,
    }),
    redact: "drop",
    effects: Object.freeze({ readOnly: true }),
    handler: () =>
      Object.freeze({
        ok: true,
        message: "The adapter server-render harness is active.",
      }),
  }),
);

const SHARED_ACTIONS: ReadonlyArray<AnyActionDefinition<AdapterSsrBridge>> =
  Object.freeze([INSPECT_SERVER_RENDER]);
const SHARED_STAGE: Omit<StageDefinition<AdapterSsrBridge>, "bridge"> = Object.freeze({
  id: "adapter-ssr",
  match: (): boolean => true,
  actions: SHARED_ACTIONS,
});

function createSide(adapter: AdapterName, renderId: string): AdapterSsrSide {
  const identity = `${renderId}:${adapter}`;
  const registry = createBridge<AdapterSsrBridge>(`${identity}:registry`);
  const bridge: AdapterSsrBridge = Object.freeze({
    actions: Object.freeze({
      identify: (): string => identity,
    }),
    snapshot: Object.freeze({
      adapter: (): AdapterName => adapter,
      identity: (): string => identity,
    }),
  });
  const stages: ReadonlyArray<StageDefinition<AdapterSsrBridge>> = [
    Object.freeze({ ...SHARED_STAGE, bridge: registry }),
  ];
  const concierge = createConcierge(
    adapter === "svelte"
      ? { stages, normalizeSnapshot: svelteSnapshotNormalizer }
      : { stages },
  );

  return Object.freeze({
    adapter,
    identity,
    concierge,
    registry,
    bridge,
    catalog: concierge.catalogFor({ pathname: "/adapter-ssr" }),
    preRegistry: registry.read(),
  });
}

export function createRequestHarness(renderId: string): RequestHarness {
  return Object.freeze({
    renderId,
    react: createSide("react", renderId),
    svelte: createSide("svelte", renderId),
  });
}
