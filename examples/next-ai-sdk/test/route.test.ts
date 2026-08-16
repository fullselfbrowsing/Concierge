import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TEST_PRIVATE_KEY_PEM } from "./fixtures/signing-keys";

const cookieState = vi.hoisted(() => ({
  value: "deterministic-session" as string | undefined,
  set: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "concierge_example_session" && cookieState.value !== undefined
        ? { name, value: cookieState.value }
        : undefined,
    set: cookieState.set,
  }),
}));

describe("POST /api/chat", () => {
  beforeEach(() => {
    cookieState.value = "deterministic-session";
    cookieState.set.mockClear();
    process.env.CONCIERGE_DETERMINISTIC_TEST = "1";
    process.env.CONCIERGE_ES256_PRIVATE_KEY_PEM = TEST_PRIVATE_KEY_PEM;
  });

  afterEach(() => {
    vi.doUnmock("@full-self-browsing/concierge/ai-sdk/server");
    vi.resetModules();
    vi.unstubAllEnvs();
    delete process.env.CONCIERGE_DETERMINISTIC_TEST;
    delete process.env.CONCIERGE_ALLOW_INSECURE_TEST_COOKIE;
    delete process.env.CONCIERGE_ES256_PRIVATE_KEY_PEM;
    delete process.env.CONCIERGE_ES256_PUBLIC_KEY_PEM;
  });

  it("streams a display-only call and a separately signed batch", async () => {
    const { POST } = await import("../app/api/chat/route");
    const response = await POST(new Request("http://example.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          id: "user-1",
          role: "user",
          parts: [{ type: "text", text: "Show the portfolio." }],
        }],
        context: {
          pathname: "/",
          browserOpen: false,
          previewScrollable: false,
          voiceActive: true,
        },
        userTurnId: "turn-1",
      }),
    }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const stream = await response.text();
    expect(stream).toContain("deterministic-navigate-1");
    expect(stream).toContain("data-concierge-envelope");
    expect(stream).toContain("signature");
  });

  it("signals regeneration instead of silently dropping a server-stale catalog", async () => {
    vi.resetModules();
    vi.doMock("@full-self-browsing/concierge/ai-sdk/server", async () => {
      const actual = await vi.importActual<
        typeof import("@full-self-browsing/concierge/ai-sdk/server")
      >("@full-self-browsing/concierge/ai-sdk/server");
      return {
        ...actual,
        createSignedBatchIssuer: () => ({
          issue: async () => ({ kind: "stale-catalog" as const }),
        }),
      };
    });
    const { POST } = await import("../app/api/chat/route");
    const response = await POST(new Request("http://example.test/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{
          id: "user-stale",
          role: "user",
          parts: [{ type: "text", text: "Show the portfolio." }],
        }],
        context: {
          pathname: "/",
          browserOpen: false,
          previewScrollable: false,
          voiceActive: true,
        },
        userTurnId: "turn-stale",
      }),
    }));

    const stream = await response.text();
    expect(stream).toContain("data-concierge-retry");
    expect(stream).toContain("catalog-stale");
    expect(stream).not.toContain("data-concierge-envelope");
  });
});

describe("GET /api/bootstrap", () => {
  beforeEach(() => {
    cookieState.value = undefined;
    cookieState.set.mockClear();
    vi.stubEnv("NODE_ENV", "production");
    process.env.CONCIERGE_ES256_PUBLIC_KEY_PEM = "test-public-key";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete process.env.CONCIERGE_DETERMINISTIC_TEST;
    delete process.env.CONCIERGE_ALLOW_INSECURE_TEST_COOKIE;
    delete process.env.CONCIERGE_ES256_PUBLIC_KEY_PEM;
  });

  it("keeps the session cookie secure unless both HTTP test gates are enabled", async () => {
    const { GET } = await import("../app/api/bootstrap/route");

    process.env.CONCIERGE_DETERMINISTIC_TEST = "1";
    await GET();
    expect(cookieState.set).toHaveBeenLastCalledWith(
      "concierge_example_session",
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );

    cookieState.set.mockClear();
    delete process.env.CONCIERGE_DETERMINISTIC_TEST;
    process.env.CONCIERGE_ALLOW_INSECURE_TEST_COOKIE = "1";
    await GET();
    expect(cookieState.set).toHaveBeenLastCalledWith(
      "concierge_example_session",
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );

    cookieState.set.mockClear();
    process.env.CONCIERGE_DETERMINISTIC_TEST = "1";
    await GET();
    expect(cookieState.set).toHaveBeenLastCalledWith(
      "concierge_example_session",
      expect.any(String),
      expect.objectContaining({ secure: false }),
    );
  });
});
