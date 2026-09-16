import { describe, expect, it } from "vitest";

import { createStopIntentClassifier } from "../src/stop-intent.js";

describe("createStopIntentClassifier", () => {
  it("matches a whole committed English transcript after stripping fillers", () => {
    const classify = createStopIntentClassifier();
    expect(classify("stop")).toBe(true);
    expect(classify("uh, stop")).toBe(true);
    expect(classify('"Stop it"')).toBe(true);
    expect(classify("never mind")).toBe(true);
    expect(classify("hold on")).toBe(true);
  });

  it("does not match a partial or mid-sentence mention", () => {
    const classify = createStopIntentClassifier();
    expect(classify("do not stop looking")).toBe(false);
    expect(classify("stop looking")).toBe(false);
    expect(classify("stopover")).toBe(false);
    expect(classify("please continue")).toBe(false);
    expect(classify("")).toBe(false);
  });

  it("uses caller phrases so a non-English app can replace the default set", () => {
    const classify = createStopIntentClassifier({
      phrases: ["basta"],
      fillers: ["eh"],
    });
    expect(classify("eh, basta")).toBe(true);
    expect(classify("stop")).toBe(false);
  });
});
