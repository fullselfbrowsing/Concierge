import { describe, expect, it } from "vitest";

import { resolveValue } from "../src/resolve-value.js";

interface Item {
  readonly id: string;
  readonly label: string;
}

describe("resolveValue", () => {
  it("matches GitHub-style and Linear-style labels under the default config", () => {
    const items: readonly Item[] = [
      { id: "1", label: "org/repo" },
      { id: "2", label: "PROJ:123" },
    ];
    const config = { getLabel: (item: Item) => item.label };
    expect(resolveValue("org/repo", items, config).ok).toBe(true);
    expect(resolveValue("PROJ:123", items, config).ok).toBe(true);
  });

  it("returns the list item by identity, never a constructed stand-in", () => {
    const alpha: Item = { id: "a", label: "Alpha" };
    const items: readonly Item[] = [alpha];
    const result = resolveValue("alpha", items, {
      getLabel: (item) => item.label,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.is(result.match, alpha)).toBe(true);
    }
  });

  it("rejects a caller allowlist that forbids ':'", () => {
    const result = resolveValue("PROJ:123", [{ id: "1", label: "PROJ:123" }], {
      getLabel: (item) => item.label,
      allowed: (raw) => /^[\p{L}\p{N}\s,.'&\-]+$/u.test(raw),
    });
    expect(result).toEqual({ ok: false, reason: "rejected" });
  });

  it("returns ambiguous for a unique-substring collision", () => {
    const items: readonly Item[] = [
      { id: "1", label: "Four Seasons Archive Foo" },
      { id: "2", label: "Four Seasons Archive Bar" },
    ];
    const result = resolveValue("four seasons", items, {
      getLabel: (item) => item.label,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ambiguous");
      expect(result.candidates).toHaveLength(2);
    }
  });

  it("matches a unique substring", () => {
    const archive: Item = { id: "1", label: "Four Seasons Archive Foo" };
    const result = resolveValue("four seasons", [archive], {
      getLabel: (item) => item.label,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.is(result.match, archive)).toBe(true);
    }
  });

  it("treats two exact labels with different identities as ambiguous", () => {
    const result = resolveValue(
      "Inbox",
      [
        { id: "a", label: "Inbox" },
        { id: "b", label: "Inbox" },
      ],
      {
        getLabel: (item) => item.label,
        getIdentity: (item) => item.id,
      },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("ambiguous");
    }
  });

  it("returns no-match for an empty candidate list", () => {
    expect(
      resolveValue("alpha", [], { getLabel: (item: Item) => item.label }),
    ).toEqual({ ok: false, reason: "no-match" });
  });

  it("skips a throwing getLabel and does not leak the exception", () => {
    const result = resolveValue(
      "alpha",
      [{ id: "1", label: "Alpha" }],
      {
        getLabel: (): string => {
          throw new Error("boom");
        },
      },
    );
    expect(result).toEqual({ ok: false, reason: "no-match" });
  });
});
