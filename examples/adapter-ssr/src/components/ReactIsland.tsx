import {
  ConciergeProvider,
  useConcierge,
  useConciergeBridge,
  useConciergeValue,
} from "@full-self-browsing/concierge-react/client";

import type { AdapterSsrSide } from "../shared/catalog.js";

function ReactEvidence({
  concierge,
  registry,
  bridge,
  identity,
}: AdapterSsrSide) {
  const exactConcierge = useConcierge() === concierge;
  const readIdentity = useConciergeValue(identity);
  useConciergeBridge(registry, bridge);

  const evidence = JSON.stringify({
    adapter: "react",
    entry: "@full-self-browsing/concierge-react/client",
    exactConcierge,
    identity: readIdentity(),
    registry: registry.read() === null ? null : "registered",
  });

  return (
    <data
      data-adapter-evidence="react"
      data-concierge="exact"
      data-entry="@full-self-browsing/concierge-react/client"
      data-registry="null"
      value={readIdentity()}
    >
      {evidence}
    </data>
  );
}

export default function ReactIsland(side: AdapterSsrSide) {
  return (
    <ConciergeProvider concierge={side.concierge}>
      <ReactEvidence {...side} />
    </ConciergeProvider>
  );
}
