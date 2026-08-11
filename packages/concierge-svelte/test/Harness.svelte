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

  let {
    concierge,
    registry,
    bridge,
    provide = true,
    onContext,
    onInitialize,
    onSnapshot,
  }: Props = $props();

  // svelte-ignore state_referenced_locally
  if (provide) {
    // svelte-ignore state_referenced_locally
    provideConcierge(concierge);
  }

  const observed: Concierge = useConcierge();
  // svelte-ignore state_referenced_locally
  onContext?.(observed);

  // svelte-ignore state_referenced_locally
  useConciergeBridge(registry, bridge);
  // svelte-ignore state_referenced_locally
  onInitialize?.(registry.read() !== null);

  const live: SnapshotValue = $state({ nested: { count: 1 } });
  const detached: SnapshotValue = svelteSnapshotNormalizer(live);

  // svelte-ignore state_referenced_locally
  onSnapshot?.({
    live,
    detached,
    setCount: (count: number): void => {
      live.nested.count = count;
    },
  });
</script>
