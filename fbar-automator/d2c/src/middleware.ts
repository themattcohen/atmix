import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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
];

const authRequiredPrefixes = [
  "/dashboard",
  "/personal",
  "/accounts",
  "/review",
  "/sign",
  "/payment",
  "/confirmation",
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

export default auth((req) => {
  const request = req as unknown as NextRequest;

  // ------------------------------------------------------------------
  // Fix 2: Dot-segment path bypass prevention
  // Normalize pathname to prevent traversal (e.g. /api/health/../auth/signup)
  // ------------------------------------------------------------------
  const normalizedPath = new URL(request.url).pathname.replace(/\/\.+\//g, "/");

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
  const authRateLimit = process.env.NODE_ENV === "production" ? 5 : 100;
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
  // Exempt: /api/auth/callback (NextAuth), /api/stripe/webhook (Stripe-signed)
  // ------------------------------------------------------------------
  const method = request.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const isExempt =
      normalizedPath.startsWith("/api/auth/") ||
      normalizedPath.startsWith("/api/stripe/webhook") ||
      normalizedPath === "/api/health";
    if (!isExempt && normalizedPath.startsWith("/api/") && !request.headers.get("x-requested-with")) {
      return NextResponse.json({ error: "Missing CSRF header" }, { status: 403 });
    }
  }

  // ------------------------------------------------------------------
  // Auth check: blocklist approach — only specified prefixes require auth
  // Everything else (marketing, blog, country pages, etc.) is public
  // ------------------------------------------------------------------

  // Allow API auth routes, Stripe webhooks, and health
  if (
    normalizedPath.startsWith("/api/auth/") ||
    normalizedPath === "/api/stripe/webhook" ||
    normalizedPath === "/api/health"
  ) {
    return NextResponse.next();
  }

  // API routes require auth (except the exempted ones above)
  if (normalizedPath.startsWith("/api/")) {
    if (!req.auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Page routes: check if auth is required
  // Use exact match or prefix+slash to prevent "/sign" from matching "/signup"
  const requiresAuth = authRequiredPrefixes.some(
    (p) => normalizedPath === p || normalizedPath.startsWith(p + "/")
  );
  if (!requiresAuth) return NextResponse.next();

  // Auth required but not authenticated — redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", normalizedPath);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
