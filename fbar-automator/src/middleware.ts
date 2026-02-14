import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rate-limit"

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

  // ---------------------------------------------------------------------------
  // 1. Route protection: Check authentication for protected routes
  // ---------------------------------------------------------------------------

  const protectedRoutes = ["/dashboard", "/clients", "/settings"]
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (isProtectedRoute) {
    // Check for NextAuth session token cookie
    const sessionToken =
      request.cookies.get("next-auth.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value

    if (!sessionToken) {
      // Redirect unauthenticated users to login
      const loginUrl = new URL("/login", request.url)
      return NextResponse.redirect(loginUrl)
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
    }

    // Get IP address from x-forwarded-for header or fallback to localhost
    const forwardedFor = request.headers.get("x-forwarded-for")
    const ip = forwardedFor?.split(",")[0]?.trim() || "127.0.0.1"

    // Check rate limit
    const { allowed, retryAfter } = checkRateLimit(ip, tier)

    if (!allowed) {
      // Rate limit exceeded
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
    "/dashboard/:path*",
    "/clients/:path*",
    "/settings/:path*",
    "/api/:path*",
  ],
}
