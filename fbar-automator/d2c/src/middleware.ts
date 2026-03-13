import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import * as Sentry from "@sentry/nextjs";
import { validateMfaCookie } from "@/lib/mfa-cookie";
import { validateEmailVerificationCookie } from "@/lib/email-verification-cookie";
import { log } from "@/lib/logger";

// ---------------------------------------------------------------------------
// CSP nonce helpers
// ---------------------------------------------------------------------------
function buildCspHeader(nonce: string): string {
  const isDev = process.env.NODE_ENV !== "production";
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    `script-src ${scriptSrc} https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://www.googleadservices.com https://googleads.g.doubleclick.net https://www.google.com",
    "frame-src https://www.googletagmanager.com https://bid.g.doubleclick.net https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
  ].join("; ");
}

function withCspHeaders(response: NextResponse, nonce: string): NextResponse {
  response.headers.set("Content-Security-Policy", buildCspHeader(nonce));
  response.headers.set("x-nonce", nonce);
  return response;
}

// ---------------------------------------------------------------------------
// Rate limit store: Map<key, { count: number, resetTime: number }>
// In-memory per-process — fine for single-instance MVP (no Redis needed)
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true; // allowed
  }

  if (entry.count >= limit) {
    return false; // rate limited
  }

  entry.count++;
  return true; // allowed
}

// Periodic cleanup to prevent memory leak (every 60s)
setInterval(() => {
  const now = Date.now();
  // Use Array.from() to avoid downlevelIteration TS target issue
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) rateLimitStore.delete(key);
  });
}, 60_000);

// ---------------------------------------------------------------------------
// Auth-sensitive routes that get strict rate limiting (5 req/min per IP)
// ---------------------------------------------------------------------------
const AUTH_RATE_LIMIT_PATHS = [
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/callback",
  "/api/auth/mfa/verify",
  "/api/auth/mfa/recovery",
  "/api/auth/mfa/setup",
  "/api/auth/mfa/disable",
  "/api/auth/mfa/login-verify",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
];

const authRequiredPrefixes = [
  "/dashboard",
  "/personal",
  "/accounts",
  "/review",
  "/sign",
  "/payment",
  "/confirmation",
  "/settings",
  "/mfa-verify",
];

// ---------------------------------------------------------------------------
// Helper: extract client IP
// ---------------------------------------------------------------------------
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Use rightmost entry — set by our reverse proxy (Caddy), not the client
    const parts = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] || request.ip || "unknown";
  }
  return request.ip ?? "unknown";
}

// ---------------------------------------------------------------------------
// Email verification gate: redirect/block unverified users
// ---------------------------------------------------------------------------
async function checkEmailVerificationGate(
  req: { auth: any; url: string },
  normalizedPath: string
): Promise<NextResponse | null> {
  // Guard: if session is empty or user missing, skip gate
  if (!req.auth?.user?.id) return null;

  // Skip if email already verified in session
  if ((req.auth?.user as any)?.emailVerified) return null;

  // Exempt paths: auth routes, health, verify-email page, MFA verify
  if (normalizedPath.startsWith("/api/auth/")) return null;
  if (normalizedPath === "/api/health") return null;
  if (normalizedPath === "/verify-email" || normalizedPath.startsWith("/verify-email/")) return null;
  if (normalizedPath === "/mfa-verify" || normalizedPath.startsWith("/mfa-verify/")) return null;

  // Check for valid email verification cookie (handles JWT not yet refreshed)
  const request = req as unknown as NextRequest;
  const cookieValue = request.cookies.get("__email_verified")?.value;
  const tokenVersion = (req.auth as any)?.tokenVersion ?? 0;
  const isValid = await validateEmailVerificationCookie(cookieValue, req.auth.user.id, tokenVersion);
  if (isValid) return null; // Email verified via cookie

  // Not verified — block or redirect
  if (normalizedPath.startsWith("/api/")) {
    return NextResponse.json({ error: "Email verification required" }, { status: 403 });
  }
  return NextResponse.redirect(new URL("/verify-email", req.url));
}

// ---------------------------------------------------------------------------
// MFA gate: redirect/block users who have MFA enabled but haven't verified
// ---------------------------------------------------------------------------
async function checkMfaGate(
  req: { auth: any; url: string },
  normalizedPath: string
): Promise<NextResponse | null> {
  // Guard: if session is empty or user missing, skip gate (symmetric with email gate)
  if (!req.auth?.user?.id) return null;
  if (!req.auth?.user?.mfaEnabled) return null; // No MFA required
  if (normalizedPath === "/mfa-verify" || normalizedPath.startsWith("/mfa-verify/")) return null; // Exempt
  if (normalizedPath.startsWith("/api/auth/")) return null; // Auth routes must be accessible
  if (normalizedPath === "/api/health") return null; // Health check exempt

  // Check for valid MFA cookie
  const request = req as unknown as NextRequest;
  const cookieValue = request.cookies.get("__mfa_verified")?.value;

  const tokenVersion = (req.auth as any)?.tokenVersion ?? 0;
  const isValid = await validateMfaCookie(cookieValue, req.auth.user.id, tokenVersion);
  if (isValid) return null; // MFA verified

  // Not verified — block or redirect
  if (normalizedPath.startsWith("/api/")) {
    return NextResponse.json({ error: "MFA verification required" }, { status: 403 });
  }
  const mfaUrl = new URL("/mfa-verify", req.url);
  mfaUrl.searchParams.set("callbackUrl", normalizedPath);
  return NextResponse.redirect(mfaUrl);
}

export default auth(async (req) => {
  const request = req as unknown as NextRequest;

  // ------------------------------------------------------------------
  // Fix 2: Dot-segment path bypass prevention
  // Normalize pathname to prevent traversal (e.g. /api/health/../auth/signup)
  // ------------------------------------------------------------------
  const normalizedPath = new URL(request.url).pathname.replace(/\/\.+\//g, "/");

  // Generate CSP nonce for this request
  const nonce = btoa(crypto.randomUUID());

  // Allow static files and Next.js internals (check early to skip security overhead)
  // Use file-extension check instead of broad .includes(".") to prevent middleware bypass
  const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt|webp|map|avif|webmanifest)$/i;
  const hasFileExtension = STATIC_EXTENSIONS.test(normalizedPath);
  if (
    normalizedPath.startsWith("/_next/") ||
    normalizedPath.startsWith("/favicon") ||
    hasFileExtension
  ) {
    return NextResponse.next();
  }

  const requestId = crypto.randomUUID();
  const start = Date.now();
  const method = request.method;
  const ip = getClientIp(request);

  log("info", "request", {
    method,
    path: normalizedPath,
    ip,
    requestId,
  });

  function finalize(response: NextResponse): NextResponse {
    response.headers.set("x-request-id", requestId);
    log("info", "response", {
      method,
      path: normalizedPath,
      status: response.status,
      duration: Date.now() - start,
      requestId,
    });
    return response;
  }

  // ------------------------------------------------------------------
  // Fix 1: Rate limiting (before auth so rate-limited requests are rejected fast)
  // ------------------------------------------------------------------

  // Strict rate limit on auth-sensitive routes: 5 req/min per IP (relaxed in dev for testing)
  const authRateLimit = process.env.NODE_ENV === "production" ? 5 : 1000;
  const isAuthRoute = AUTH_RATE_LIMIT_PATHS.some((p) => normalizedPath.startsWith(p));
  if (isAuthRoute) {
    const authRouteKey = normalizedPath.split("/").slice(0, 4).join("/");
    if (!rateLimit(`auth:${ip}:${authRouteKey}`, authRateLimit, 60_000)) {
      log("warn", "rate_limit_hit", { method, path: normalizedPath, ip, requestId });
      return finalize(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    }
  }

  // Chat rate limit: 10 messages/min per IP
  if (normalizedPath === "/api/chat") {
    if (!rateLimit(`chat:${ip}`, 10, 60_000)) {
      log("warn", "rate_limit_hit", { method, path: normalizedPath, ip, requestId });
      return finalize(NextResponse.json({ error: "Too many messages" }, { status: 429 }));
    }
  }

  // General API rate limit: 60 req/min per IP (exempt: /api/health, /api/stripe/webhook)
  if (
    normalizedPath.startsWith("/api/") &&
    normalizedPath !== "/api/health" &&
    normalizedPath !== "/api/stripe/webhook" &&
    !isAuthRoute && !normalizedPath.startsWith("/api/auth/") // auth/* has its own rate limit above
  ) {
    const generalLimit = process.env.NODE_ENV === "production" ? 60 : 600;
    if (!rateLimit(`api:${ip}`, generalLimit, 60_000)) {
      log("warn", "rate_limit_hit", { method, path: normalizedPath, ip, requestId });
      return finalize(NextResponse.json({ error: "Too many requests" }, { status: 429 }));
    }
  }

  // ------------------------------------------------------------------
  // Fix 3: CSRF header check for state-changing requests
  // POST/PUT/PATCH/DELETE to /api/* must include X-Requested-With header
  // Exempt: NextAuth internal routes + Stripe webhook (has own sig verification)
  // ------------------------------------------------------------------
  const csrfExemptPaths = [
    "/api/auth/callback/",   // NextAuth OAuth callbacks
    "/api/auth/session",     // NextAuth session endpoint
    "/api/auth/csrf",        // NextAuth CSRF token endpoint
    "/api/auth/providers",   // NextAuth providers list
    "/api/auth/signout",     // NextAuth signout
    "/api/stripe/webhook",   // Stripe (has own signature verification)
    "/api/health",           // Health check
    "/api/chat",             // Public AI chat (useChat hook doesn't send CSRF header)
    "/api/contact",          // Public contact form (Turnstile-protected)
    "/api/internal/",        // Internal endpoints (own auth via secret header)
  ];
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const isExempt = csrfExemptPaths.some((p) => normalizedPath.startsWith(p));
    if (!isExempt && normalizedPath.startsWith("/api/") && !request.headers.get("x-requested-with")) {
      log("warn", "csrf_rejected", { method, path: normalizedPath, requestId });
      return finalize(NextResponse.json({ error: "Missing CSRF header" }, { status: 403 }));
    }
  }

  // ------------------------------------------------------------------
  // Auth check: blocklist approach — only specified prefixes require auth
  // Everything else (marketing, blog, country pages, etc.) is public
  // ------------------------------------------------------------------

  // Allow API auth routes, Stripe webhooks, health, cron, and internal test-only endpoints
  if (
    normalizedPath.startsWith("/api/auth/") ||
    normalizedPath === "/api/stripe/webhook" ||
    normalizedPath === "/api/health" ||
    normalizedPath.startsWith("/api/cron/") ||
    normalizedPath.startsWith("/api/internal/") ||
    normalizedPath === "/api/chat" ||
    normalizedPath === "/api/contact"
  ) {
    return finalize(NextResponse.next());
  }

  // API routes require auth (except the exempted ones above)
  if (normalizedPath.startsWith("/api/")) {
    if (!req.auth) {
      return finalize(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    if (!req.auth?.user?.id) {
      return finalize(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    try {
      const emailBlock = await checkEmailVerificationGate(req, normalizedPath);
      if (emailBlock) return finalize(emailBlock);
    } catch (err) {
      Sentry.captureException(err, { extra: { path: normalizedPath, requestId, context: "api_email_gate" } });
      log("error", "email_gate_error", { path: normalizedPath, requestId, err });
      return finalize(NextResponse.json({ error: "Internal error" }, { status: 500 }));
    }
    try {
      const mfaBlock = await checkMfaGate(req, normalizedPath);
      if (mfaBlock) return finalize(mfaBlock);
    } catch (err) {
      Sentry.captureException(err, { extra: { path: normalizedPath, requestId, context: "api_mfa_gate" } });
      log("error", "mfa_gate_error", { path: normalizedPath, requestId, err });
      return finalize(NextResponse.json({ error: "Internal error" }, { status: 500 }));
    }
    return finalize(NextResponse.next());
  }

  // Page routes: check if auth is required
  // Use exact match or prefix+slash to prevent "/sign" from matching "/signup"
  const requiresAuth = authRequiredPrefixes.some(
    (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
  );
  if (!requiresAuth) return finalize(withCspHeaders(NextResponse.next(), nonce));

  // Auth required but not authenticated — redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", normalizedPath);
    return finalize(withCspHeaders(NextResponse.redirect(loginUrl), nonce));
  }
  if (!req.auth?.user?.id) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", normalizedPath);
    return finalize(withCspHeaders(NextResponse.redirect(loginUrl), nonce));
  }

  try {
    const emailBlock = await checkEmailVerificationGate(req, normalizedPath);
    if (emailBlock) return finalize(withCspHeaders(emailBlock, nonce));
  } catch (err) {
    Sentry.captureException(err, { extra: { path: normalizedPath, requestId, context: "page_email_gate" } });
    log("error", "email_gate_error", { path: normalizedPath, requestId, err });
    return finalize(withCspHeaders(NextResponse.json({ error: "Internal error" }, { status: 500 }), nonce));
  }

  try {
    const mfaBlock = await checkMfaGate(req, normalizedPath);
    if (mfaBlock) return finalize(withCspHeaders(mfaBlock, nonce));
  } catch (err) {
    Sentry.captureException(err, { extra: { path: normalizedPath, requestId, context: "page_mfa_gate" } });
    log("error", "mfa_gate_error", { path: normalizedPath, requestId, err });
    return finalize(withCspHeaders(NextResponse.json({ error: "Internal error" }, { status: 500 }), nonce));
  }

  // Guard: non-MFA users should not access /mfa-verify
  if (normalizedPath === "/mfa-verify" && !req.auth?.user?.mfaEnabled) {
    return finalize(withCspHeaders(NextResponse.redirect(new URL("/threshold", req.url)), nonce));
  }

  return finalize(withCspHeaders(NextResponse.next(), nonce));
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
