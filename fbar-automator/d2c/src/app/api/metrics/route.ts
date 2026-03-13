import { NextResponse } from "next/server";
import { metrics } from "@/lib/metrics";
import { prisma } from "@/lib/db";

export async function GET(req: Request): Promise<NextResponse> {
  const secret = req.headers.get("x-internal-secret");
  if (!secret || secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    // DB unreachable
  }

  const uptimeSeconds = Math.round((Date.now() - metrics.startedAt) / 1000);
  const errorRatePct =
    metrics.requestCount > 0
      ? Math.round((metrics.errorCount / metrics.requestCount) * 10000) / 100
      : 0;
  const avgLatencyMs =
    metrics.requestCount > 0
      ? Math.round(metrics.totalDurationMs / metrics.requestCount)
      : 0;

  return NextResponse.json({
    uptimeSeconds,
    requests: {
      total: metrics.requestCount,
      errors: metrics.errorCount,
      errorRatePct,
      avgLatencyMs,
    },
    db: { ok: dbOk },
    timestamp: new Date().toISOString(),
  });
}
