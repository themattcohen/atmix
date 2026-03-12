import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"
import { createLogger } from "@/lib/logger"

const log = createLogger({ module: "middleware" })

// ---------------------------------------------------------------------------
// Next.js Middleware for route protection, rate limiting, and security headers
// ---------------------------------------------------------------------------

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Apply security headers to all responses
  const response = NextResponse.next()
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )
  response.headers.set("X-DNS-Prefetch-Control", "off")
  // Allow S3/MinIO origin in CSP for PDF and image fetching
  const s3Origin = process.env.S3_PUBLIC_ENDPOINT || ""
  response.headers.set(
    "Content-Security-Policy",
    `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${s3Origin}; font-src 'self'; connect-src 'self' ${s3Origin}; worker-src 'self' blob:; frame-ancestors 'none'`
  )

  // HSTS: enforce HTTPS in production (skip for localhost development)
  const host = request.headers.get("host") || ""
  if (!host.startsWith("localhost") && !host.startsWith("127.0.0.1")) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    )
  }

  // ---------------------------------------------------------------------------
  // 1. Route protection: Check authentication for protected routes
  // ---------------------------------------------------------------------------

  const publicPaths = ["/api/auth", "/api/health", "/api/cron", "/login", "/register", "/forgot-password", "/reset-password"]
  const isPublicRoute = publicPaths.some((p) => pathname.startsWith(p))

  if (!isPublicRoute) {
    // Check for NextAuth session token cookie
    const sessionToken =
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value

    if (!sessionToken) {
      // Redirect unauthenticated users to login
      log.warn("auth_redirect", { pathname })
      const loginUrl = new URL("/login", request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  // Redirect authenticated users away from login/register pages
  if (pathname === "/login" || pathname === "/register") {
    const sessionToken =
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value

    if (sessionToken) {
      const homeUrl = new URL("/", request.url)
      return NextResponse.redirect(homeUrl)
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Rate limiting: Apply rate limits to API routes
  // ---------------------------------------------------------------------------

  if (pathname.startsWith("/api/")) {
    // Determine rate limit tier based on route
    let tier = "general"
    if (pathname.startsWith("/api/auth/")) {
      tier = "auth"
    } else if (pathname === "/api/statements/upload") {
      tier = "upload"
    } else if (pathname.startsWith("/api/statements/")) {
      tier = "status"
    }

    // WARNING: x-forwarded-for can be spoofed. In production behind a trusted
    // reverse proxy (nginx/ALB), configure the proxy to strip/overwrite this
    // header. For single-instance deployments, this is acceptable.
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "127.0.0.1"

    // Check rate limit
    const { allowed, retryAfter } = checkRateLimit(ip, tier)

    if (!allowed) {
      // Rate limit exceeded
      log.warn("rate_limit_hit", { tier, ip, pathname, retryAfter })
      const errorResponse = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
      if (retryAfter) {
        errorResponse.headers.set("Retry-After", String(retryAfter))
      }
      return errorResponse
    }
  }

  return response
}

// ---------------------------------------------------------------------------
// Matcher: Apply middleware to specific routes
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/dashboard/:path*",
    "/clients/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
}
