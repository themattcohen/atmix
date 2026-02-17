import { NextResponse } from "next/server"
import { getRedisConnection } from "@/lib/redis"

export const dynamic = "force-dynamic"

export async function GET() {
  const checks: Record<string, string> = {}

  // Check Redis connectivity
  try {
    const redis = getRedisConnection()
    await redis.ping()
    checks.redis = "ok"
  } catch {
    checks.redis = "unreachable"
  }

  const allHealthy = Object.values(checks).every((v) => v === "ok")

  return NextResponse.json(
    {
      status: allHealthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: allHealthy ? 200 : 503 }
  )
}
