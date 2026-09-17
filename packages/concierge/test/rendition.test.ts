import { describe, expect, it } from "vitest";

import { createRenditionBinder } from "../src/rendition.js";
import type { DeliveryReport } from "../src/types.js";

describe("createRenditionBinder", () => {
  it("reports the cause id, not the voicing rendition", () => {
    const reports: DeliveryReport[] = [];
    const binder = createRenditionBinder();
    binder.deferralsFor("N")((report) => {
      reports.push(report);
    });
    binder.bindRendition({ cause: "N", rendition: "N+1" });
    binder.renditionStarted("N+1");
    binder.settle("N+1", { outcome: "completed" });
    expect(reports).toHaveLength(1);
    expect(reports[0]?.responseId).toBe("N");
    expect(reports[0]?.outcome).toBe("completed");
    expect(binder.pendingCauses()).toEqual([]);
  });

  it("fails closed under explicit evidence when generation ends without start", () => {
    const reports: DeliveryReport[] = [];
    const binder = createRenditionBinder({ renditionEvidence: "explicit" });
    binder.deferralsFor("cause")((report) => {
      reports.push(report);
    });
    binder.bindRendition({ cause: "cause", rendition: "voice" });
    binder.generationEnded("voice");
    expect(reports[0]?.outcome).toBe("interrupted");
  });

  it("settles completed on generation end under generation-end evidence", () => {
    const reports: DeliveryReport[] = [];
    const binder = createRenditionBinder({
      renditionEvidence: "generation-end",
    });
    binder.deferralsFor("cause")((report) => {
      reports.push(report);
    });
    binder.bindRendition({ cause: "cause", rendition: "voice" });
    binder.generationEnded("voice");
    expect(reports[0]?.outcome).toBe("completed");
  });

  it("invokes a late deferral immediately as interrupted", () => {
    const reports: DeliveryReport[] = [];
    const issues: string[] = [];
    const binder = createRenditionBinder({
      onIssue: (issue) => {
        issues.push(issue.code);
      },
    });
    binder.deferralsFor("cause")(() => undefined);
    binder.bindRendition({ cause: "cause", rendition: "voice" });
    binder.settle("voice", { outcome: "completed" });
    binder.deferralsFor("cause")((report) => {
      reports.push(report);
    });
    expect(reports[0]?.outcome).toBe("interrupted");
    expect(issues).toContain("late_deferral");
  });

  it("contains a throwing effect and still runs the rest", () => {
    const seen: string[] = [];
    const issues: string[] = [];
    const binder = createRenditionBinder({
      onIssue: (issue) => {
        issues.push(issue.code);
      },
    });
    binder.deferralsFor("cause")(() => {
      throw new Error("boom");
    });
    binder.deferralsFor("cause")(() => {
      seen.push("second");
    });
    binder.bindRendition({ cause: "cause", rendition: "voice" });
    binder.settle("voice", { outcome: "completed" });
    expect(seen).toEqual(["second"]);
    expect(issues).toContain("effect_threw");
  });

  it("evicts the oldest pending cause when over capacity", () => {
    const reports: DeliveryReport[] = [];
    const issues: string[] = [];
    const binder = createRenditionBinder({
      maxPendingCauses: 1,
      onIssue: (issue) => {
        issues.push(issue.code);
      },
    });
    binder.deferralsFor("old")((report) => {
      reports.push(report);
    });
    binder.deferralsFor("new")(() => undefined);
    expect(reports[0]?.responseId).toBe("old");
    expect(reports[0]?.outcome).toBe("interrupted");
    expect(issues).toContain("capacity_evicted");
    expect(binder.pendingCauses()).toEqual(["new"]);
  });
});

describe("settlement bookkeeping", () => {
  it("distinguishes a second settlement from one that never had a cause", () => {
    const issues = [];
    const binder = createRenditionBinder({ onIssue: (issue) => issues.push(issue) });
    const reports = [];
    binder.deferralsFor("cause-1")((report) => reports.push(report));
    binder.bindRendition({ cause: "cause-1", rendition: "voice-1" });

    binder.settle("voice-1", { outcome: "completed" });
    expect(reports).toHaveLength(1);
    expect(issues).toEqual([]);

    // The bindings are gone now, so the shape is identical to a rendition
    // that never had a cause — but the code must say which one it is.
    binder.settle("voice-1", { outcome: "completed" });
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("duplicate_settlement");

    binder.settle("never-bound", { outcome: "completed" });
    expect(issues).toHaveLength(2);
    expect(issues[1].code).toBe("unbound_rendition");

    expect(reports).toHaveLength(1);
  });
});

describe("bounded started bookkeeping", () => {
  it("forgets the oldest started rendition past the cap", () => {
    // `settle` only dropped a rendition from `started` once it had a bound
    // cause, so every playback with nothing deferred against it left its id
    // behind for the life of the binder. The cap is what stops that; this
    // asserts the cap exists by reaching past it.
    const reports: DeliveryReport[] = [];
    const binder = createRenditionBinder({ onIssue: () => {} });
    binder.deferralsFor("cause-0")((report) => {
      reports.push(report);
    });
    binder.bindRendition({ cause: "cause-0", rendition: "rendition-0" });
    binder.renditionStarted("rendition-0");

    for (let index = 1; index <= 512; index += 1) {
      binder.renditionStarted(`filler-${index}`);
    }

    // Evicted from `started`, so it now reads as never started.
    binder.abandonUnstarted();
    expect(reports).toEqual([
      expect.objectContaining({ responseId: "cause-0", outcome: "interrupted" }),
    ]);
  });

  it("keeps a started rendition live well inside the cap", () => {
    const reports: DeliveryReport[] = [];
    const binder = createRenditionBinder({ onIssue: () => {} });
    binder.deferralsFor("cause-0")((report) => {
      reports.push(report);
    });
    binder.bindRendition({ cause: "cause-0", rendition: "rendition-0" });
    binder.renditionStarted("rendition-0");

    for (let index = 1; index <= 100; index += 1) {
      binder.renditionStarted(`filler-${index}`);
    }

    binder.abandonUnstarted();
    expect(reports).toEqual([]);
  });
});
