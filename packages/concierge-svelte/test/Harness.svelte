<script lang="ts">
  import type {
    Bridge,
    BridgeRegistry,
    Concierge,
  } from "@fullselfbrowsing/concierge";

  import {
    provideConcierge,
    svelteSnapshotNormalizer,
    useConcierge,
    useConciergeBridge,
  } from "../src/client.svelte.js";

  type SnapshotValue = {
    nested: {
      count: number;
    };
  };

  type SnapshotProbe = {
    readonly live: SnapshotValue;
    readonly detached: SnapshotValue;
    readonly setCount: (count: number) => void;
  };

  type Props = {
    readonly concierge: Concierge;
    readonly registry: BridgeRegistry;
    readonly bridge: Bridge;
    readonly provide?: boolean;
    readonly onContext?: (concierge: Concierge) => void;
    readonly onInitialize?: (registered: boolean) => void;
    readonly onSnapshot?: (probe: SnapshotProbe) => void;
  };

  let props: Props = $props();
  const getConcierge = (): Concierge => props.concierge;
  const getRegistry = (): BridgeRegistry => props.registry;
  const getBridge = (): Bridge => props.bridge;
  const getProvide = (): boolean => props.provide ?? true;
  const getOnContext = (): Props["onContext"] => props.onContext;
  const getOnInitialize = (): Props["onInitialize"] => props.onInitialize;
  const getOnSnapshot = (): Props["onSnapshot"] => props.onSnapshot;

  if (getProvide()) {
    provideConcierge(getConcierge());
  }

  const observed: Concierge = useConcierge();
  getOnContext()?.(observed);

  useConciergeBridge(getRegistry, getBridge);
  getOnInitialize()?.(getRegistry().read() !== null);

  const live: SnapshotValue = $state({ nested: { count: 1 } });
  const detached: SnapshotValue = svelteSnapshotNormalizer(live);

  getOnSnapshot()?.({
    live,
    detached,
    setCount: (count: number): void => {
      live.nested.count = count;
    },
  });
</script>
