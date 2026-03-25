import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const secret = process.env.E2E_TEST_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (req.headers.get("x-e2e-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { filingId, status, bsaId, rejectionReason, submittedAt } = body;

  if (!filingId || !status) {
    return NextResponse.json(
      { error: "filingId and status required" },
      { status: 400 }
    );
  }

  await prisma.filingYear.update({
    where: { id: filingId },
    data: {
      status,
      ...(bsaId !== undefined && { bsaId }),
      ...(rejectionReason !== undefined && { rejectionReason }),
      ...(submittedAt !== undefined && { submittedAt: new Date(submittedAt) }),
    },
  });

  return NextResponse.json({ ok: true });
}
