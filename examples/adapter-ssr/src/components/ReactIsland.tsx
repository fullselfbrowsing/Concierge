import {
  ConciergeProvider,
  useConcierge,
  useConciergeBridge,
  useConciergeValue,
} from "@fullselfbrowsing/concierge-react/client";

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
    entry: "@fullselfbrowsing/concierge-react/client",
    exactConcierge,
    identity: readIdentity(),
    registry: registry.read() === null ? null : "registered",
  });

  return (
    <data data-adapter-evidence="react" value={readIdentity()}>
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
