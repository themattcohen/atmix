import { vi, describe, it, expect, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// P5-1: CSRF exemption narrowing tests
//
// IMPLEMENTATION NEEDED: P5-1 will modify d2c/src/middleware.ts to narrow the
// CSRF exemption from `/api/auth/` (all auth routes) to a specific allowlist:
//
//   const csrfExemptPaths = [
//     "/api/auth/callback/",  "/api/auth/session", "/api/auth/csrf",
//     "/api/auth/providers",  "/api/auth/signout",  "/api/stripe/webhook",
//   ];
//
// After P5-1, custom auth routes like /api/auth/signup, /api/auth/forgot-password,
// and /api/auth/reset-password will require the X-Requested-With CSRF header.
// ---------------------------------------------------------------------------

// We test middleware by importing it directly and calling it with crafted
// NextRequest objects. The middleware is the default export of middleware.ts,
// wrapped by the NextAuth `auth()` higher-order function.
//
// Because the middleware HOF from NextAuth injects `req.auth`, we mock the
// auth module to control authentication state.

// Mock auth before importing middleware
vi.mock("@/lib/auth", () => ({
  // IMPLEMENTATION NEEDED: The middleware default export is `auth(handler)`.
  // We mock `auth` to be a passthrough that just calls the handler with a
  // request object that has an `auth` property we control.
  auth: vi.fn((handler: Function) => {
    // Return a middleware function that calls the handler with a mocked req
    return (req: any) => {
      // Attach auth state from our mockAuthState variable
      req.auth = mockAuthState;
      return handler(req);
    };
  }),
}));

import { NextRequest, NextResponse } from "next/server";

// ---------------------------------------------------------------------------
// IMPLEMENTATION NEEDED: P5-1 modifies the default export of middleware.ts.
// After implementation, import will resolve correctly.
// For now, we import middleware and test its behavior.
//
// NOTE: Because middleware.ts exports `auth(handler)` where `auth` is mocked
// above, we need to import the actual middleware function. The mock makes
// `auth` a passthrough, so importing the default export gives us the handler.
// ---------------------------------------------------------------------------
import middleware from "@/middleware";

// Mutable auth state for test control
let mockAuthState: { user: { id: string } } | null = null;

function setAuthState(userId: string | null) {
  mockAuthState = userId ? { user: { id: userId } } : null;
}

// ---------------------------------------------------------------------------
// Helper: create a NextRequest with specified method, path, and headers
// ---------------------------------------------------------------------------
function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {}
): NextRequest {
  const url = `http://localhost:3000${path}`;
  return new NextRequest(url, {
    method,
    headers: {
      ...headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: call middleware and extract response status
// ---------------------------------------------------------------------------
async function callMiddleware(
  method: string,
  path: string,
  headers: Record<string, string> = {}
): Promise<{ status: number; body?: any; isNext: boolean }> {
  const req = makeRequest(method, path, headers);
  // @ts-expect-error — mock auth wraps middleware as single-arg function
  const response = await middleware(req as any);

  // If middleware returns NextResponse.next(), status is 200 and there is no
  // JSON body. If it returns a JSON error response, we can parse the body.
  if (!response) {
    return { status: 200, isNext: true };
  }

  // Check if it's a "next" response (passthrough)
  // NextResponse.next() produces a response with status 200 and specific headers
  const isNext =
    response.headers?.get("x-middleware-next") === "1" ||
    (response instanceof NextResponse && (response as any).headers?.get("x-middleware-next") === "1");

  if (isNext) {
    return { status: 200, isNext: true };
  }

  // It's a JSON error response
  let body: any = undefined;
  try {
    body = await response.json();
  } catch {
    // Not JSON — could be a redirect
  }

  return {
    status: response.status,
    body,
    isNext: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("P5-1: CSRF header enforcement — narrowed exemption list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: authenticated user
    setAuthState("test-user-id");
  });

  // ── Custom auth routes: MUST require CSRF header after P5-1 ──────────────

  it("P5-1: POST /api/auth/signup WITHOUT X-Requested-With header -> 403 CSRF rejection", async () => {
    const result = await callMiddleware("POST", "/api/auth/signup");
    expect(result.status).toBe(403);
    expect(result.body?.error).toMatch(/csrf/i);
  });

  it("P5-1: POST /api/auth/forgot-password WITHOUT X-Requested-With header -> 403 CSRF rejection", async () => {
    const result = await callMiddleware("POST", "/api/auth/forgot-password");
    expect(result.status).toBe(403);
    expect(result.body?.error).toMatch(/csrf/i);
  });

  it("P5-1: POST /api/auth/reset-password WITHOUT X-Requested-With header -> 403 CSRF rejection", async () => {
    const result = await callMiddleware("POST", "/api/auth/reset-password");
    expect(result.status).toBe(403);
    expect(result.body?.error).toMatch(/csrf/i);
  });

  // ── Custom auth routes: pass when CSRF header IS present ─────────────────

  it("P5-1: POST /api/auth/signup WITH X-Requested-With header -> passes CSRF check", async () => {
    const result = await callMiddleware("POST", "/api/auth/signup", {
      "x-requested-with": "XMLHttpRequest",
    });
    // Should NOT be 403. May be 200 (next) or 429 (rate limited), but not CSRF blocked.
    expect(result.status).not.toBe(403);
  });

  it("P5-1: POST /api/auth/forgot-password WITH X-Requested-With header -> passes CSRF check", async () => {
    const result = await callMiddleware("POST", "/api/auth/forgot-password", {
      "x-requested-with": "XMLHttpRequest",
    });
    expect(result.status).not.toBe(403);
  });

  it("P5-1: POST /api/auth/reset-password WITH X-Requested-With header -> passes CSRF check", async () => {
    const result = await callMiddleware("POST", "/api/auth/reset-password", {
      "x-requested-with": "XMLHttpRequest",
    });
    expect(result.status).not.toBe(403);
  });

  // ── NextAuth internal routes: MUST remain exempted ───────────────────────

  it("P5-1: POST /api/auth/callback/credentials (NextAuth) -> passes WITHOUT CSRF header (exempted)", async () => {
    const result = await callMiddleware("POST", "/api/auth/callback/credentials");
    // Should pass CSRF check — status should NOT be 403
    expect(result.status).not.toBe(403);
  });

  it("P5-1: GET /api/auth/session (NextAuth) -> passes WITHOUT CSRF header (GET not checked)", async () => {
    const result = await callMiddleware("GET", "/api/auth/session");
    // GET requests are never CSRF-checked, and /api/auth/session is exempted anyway
    expect(result.status).not.toBe(403);
  });

  it("P5-1: POST /api/auth/signout (NextAuth) -> passes WITHOUT CSRF header (exempted)", async () => {
    const result = await callMiddleware("POST", "/api/auth/signout");
    expect(result.status).not.toBe(403);
  });

  it("P5-1: GET /api/auth/csrf (NextAuth) -> passes WITHOUT CSRF header (GET + exempted)", async () => {
    const result = await callMiddleware("GET", "/api/auth/csrf");
    expect(result.status).not.toBe(403);
  });

  it("P5-1: GET /api/auth/providers (NextAuth) -> passes WITHOUT CSRF header (GET + exempted)", async () => {
    const result = await callMiddleware("GET", "/api/auth/providers");
    expect(result.status).not.toBe(403);
  });

  // ── Stripe webhook: remains exempted (has its own sig verification) ──────

  it("P5-1: POST /api/stripe/webhook -> passes WITHOUT CSRF header (exempted, own sig verification)", async () => {
    const result = await callMiddleware("POST", "/api/stripe/webhook");
    expect(result.status).not.toBe(403);
  });

  // ── Non-auth API routes: still require CSRF header ───────────────────────

  it("P5-1: POST /api/accounts WITHOUT CSRF header -> 403 (non-exempt route)", async () => {
    const result = await callMiddleware("POST", "/api/accounts");
    expect(result.status).toBe(403);
    expect(result.body?.error).toMatch(/csrf/i);
  });

  it("P5-1: POST /api/accounts WITH X-Requested-With -> passes CSRF check (still needs auth)", async () => {
    const result = await callMiddleware("POST", "/api/accounts", {
      "x-requested-with": "XMLHttpRequest",
    });
    // Should NOT be 403 — CSRF passes. May be 401 (if auth check runs after) or 200/other.
    expect(result.status).not.toBe(403);
  });

  it("P5-1: PUT /api/accounts/abc123 WITHOUT CSRF header -> 403", async () => {
    const result = await callMiddleware("PUT", "/api/accounts/abc123");
    expect(result.status).toBe(403);
  });

  it("P5-1: DELETE /api/filing/review WITHOUT CSRF header -> 403", async () => {
    const result = await callMiddleware("DELETE", "/api/filing/review");
    expect(result.status).toBe(403);
  });

  // ── GET requests: never subject to CSRF check ────────────────────────────

  it("P5-1: GET /api/accounts WITHOUT CSRF header -> not 403 (GET is exempt from CSRF)", async () => {
    const result = await callMiddleware("GET", "/api/accounts");
    expect(result.status).not.toBe(403);
  });

  // ── Health endpoint: always exempt ───────────────────────────────────────

  it("P5-1: POST /api/health -> passes without CSRF header (health always exempt)", async () => {
    const result = await callMiddleware("POST", "/api/health");
    expect(result.status).not.toBe(403);
  });

  // ── Path traversal: dot-segment bypass prevention still works ────────────

  it("P5-1: POST /api/auth/callback/../signup (path traversal) -> 403 (normalized to /api/auth/signup)", async () => {
    // The middleware normalizes paths, so this should resolve to /api/auth/signup
    // which is NOT in the exemption list after P5-1
    const result = await callMiddleware("POST", "/api/auth/callback/../signup");
    expect(result.status).toBe(403);
  });
});
