import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

const VALID_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "REVIEWED",
  "SIGNED",
  "PAID",
  "SUBMITTING",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { session, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const existing = await prisma.filingYear.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Filing not found" }, { status: 404 });
    }

    const oldStatus = existing.status;

    const updated = await prisma.filingYear.update({
      where: { id: params.id },
      data: { status },
    });

    log("warn", "admin_status_override", {
      filingId: params.id,
      oldStatus,
      newStatus: status,
      adminId: session.user.id,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    log("error", "admin_status_override_error", { error: String(err), filingId: params.id });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
