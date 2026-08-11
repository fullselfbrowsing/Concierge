<script lang="ts">
  import {
    provideConcierge,
    useConcierge,
    useConciergeBridge,
  } from "@fullselfbrowsing/concierge-svelte/client.svelte";

  import type { AdapterSsrSide } from "../shared/catalog.js";

  let {
    concierge,
    registry,
    bridge,
    identity,
  }: AdapterSsrSide = $props();

  provideConcierge(concierge);
  const exactConcierge = useConcierge() === concierge;
  useConciergeBridge(registry, bridge);

  const evidence = JSON.stringify({
    adapter: "svelte",
    entry: "@fullselfbrowsing/concierge-svelte/client.svelte",
    exactConcierge,
    identity,
    registry: registry.read() === null ? null : "registered",
  });
</script>

<data data-adapter-evidence="svelte" value={identity}>{evidence}</data>
