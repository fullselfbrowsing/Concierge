import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import {
  CONCIERGE_AUDIENCE,
  SESSION_COOKIE,
} from "../../../src/protocol";
import type { BootstrapResponse } from "../../../src/protocol";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function newSessionId(): string {
  return randomBytes(24).toString("base64url");
}

function requiresSecureCookie(): boolean {
  const deterministicHttpTest =
    process.env.CONCIERGE_DETERMINISTIC_TEST === "1" &&
    process.env.CONCIERGE_ALLOW_INSECURE_TEST_COOKIE === "1";
  return process.env.NODE_ENV === "production" && !deterministicHttpTest;
}

export async function GET(): Promise<Response> {
  const jar = await cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  const sessionId = existing ?? newSessionId();
  if (existing === undefined) {
    jar.set(SESSION_COOKIE, sessionId, {
      httpOnly: true,
      sameSite: "strict",
      secure: requiresSecureCookie(),
      path: "/",
      maxAge: 60 * 60,
    });
  }

  const publicKeyPem = process.env.CONCIERGE_ES256_PUBLIC_KEY_PEM;
  if (publicKeyPem === undefined || publicKeyPem.length === 0) {
    return Response.json(
      { error: "CONCIERGE_ES256_PUBLIC_KEY_PEM is not configured." },
      { status: 503 },
    );
  }

  const body: BootstrapResponse = {
    audience: CONCIERGE_AUDIENCE,
    sessionId,
    publicKeyPem,
  };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
