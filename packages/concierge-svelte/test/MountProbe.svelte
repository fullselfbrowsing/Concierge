<script lang="ts">
  import { onMount } from "svelte";

  let { onMounted }: { readonly onMounted: () => void } = $props();

  onMount((): void => onMounted());
</script>
