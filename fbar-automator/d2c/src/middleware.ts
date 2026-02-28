import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { validateMfaCookie } from "@/lib/mfa-cookie";
import { validateEmailVerificationCookie } from "@/lib/email-verification-cookie";

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
    `script-src ${scriptSrc} https://www.googletagmanager.com https://www.google-analytics.com https://www.googleadservices.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://www.google-analytics.com https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net",
    "font-src 'self' data:",
    "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://www.googleadservices.com https://googleads.g.doubleclick.net",
    "frame-src https://www.googletagmanager.com https://bid.g.doubleclick.net",
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
  "/verify-email",
];

// ---------------------------------------------------------------------------
// Helper: extract client IP
// ---------------------------------------------------------------------------
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; first entry is the client
    return forwarded.split(",")[0].trim();
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
  if (
    normalizedPath.startsWith("/_next/") ||
    normalizedPath.startsWith("/favicon") ||
    normalizedPath.includes(".")
  ) {
    return NextResponse.next();
  }

  // ------------------------------------------------------------------
  // Fix 1: Rate limiting (before auth so rate-limited requests are rejected fast)
  // ------------------------------------------------------------------
  const ip = getClientIp(request);

  // Strict rate limit on auth-sensitive routes: 5 req/min per IP (relaxed in dev for testing)
  const authRateLimit = process.env.NODE_ENV === "production" ? 5 : 1000;
  const isAuthRoute = AUTH_RATE_LIMIT_PATHS.some((p) => normalizedPath.startsWith(p));
  if (isAuthRoute) {
    if (!rateLimit(`auth:${ip}`, authRateLimit, 60_000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
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
  ];
  const method = request.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const isExempt = csrfExemptPaths.some((p) => normalizedPath.startsWith(p));
    if (!isExempt && normalizedPath.startsWith("/api/") && !request.headers.get("x-requested-with")) {
      return NextResponse.json({ error: "Missing CSRF header" }, { status: 403 });
    }
  }

  // ------------------------------------------------------------------
  // Auth check: blocklist approach — only specified prefixes require auth
  // Everything else (marketing, blog, country pages, etc.) is public
  // ------------------------------------------------------------------

  // Allow API auth routes, Stripe webhooks, health, and internal test-only endpoints
  if (
    normalizedPath.startsWith("/api/auth/") ||
    normalizedPath === "/api/stripe/webhook" ||
    normalizedPath === "/api/health" ||
    normalizedPath.startsWith("/api/internal/")
  ) {
    return NextResponse.next();
  }

  // API routes require auth (except the exempted ones above)
  if (normalizedPath.startsWith("/api/")) {
    if (!req.auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const emailBlock = await checkEmailVerificationGate(req, normalizedPath);
    if (emailBlock) return emailBlock;
    const mfaBlock = await checkMfaGate(req, normalizedPath);
    if (mfaBlock) return mfaBlock;
    return NextResponse.next();
  }

  // Page routes: check if auth is required
  // Use exact match or prefix+slash to prevent "/sign" from matching "/signup"
  const requiresAuth = authRequiredPrefixes.some(
    (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
  );
  if (!requiresAuth) return withCspHeaders(NextResponse.next(), nonce);

  // Auth required but not authenticated — redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", normalizedPath);
    return withCspHeaders(NextResponse.redirect(loginUrl), nonce);
  }

  const emailBlock = await checkEmailVerificationGate(req, normalizedPath);
  if (emailBlock) return withCspHeaders(emailBlock, nonce);

  const mfaBlock = await checkMfaGate(req, normalizedPath);
  if (mfaBlock) return withCspHeaders(mfaBlock, nonce);

  // Guard: non-MFA users should not access /mfa-verify
  if (normalizedPath === "/mfa-verify" && !req.auth?.user?.mfaEnabled) {
    return withCspHeaders(NextResponse.redirect(new URL("/threshold", req.url)), nonce);
  }

  return withCspHeaders(NextResponse.next(), nonce);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
