import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hashRecoveryCode } from "@/lib/mfa";

const recoverySchema = z.object({
  code: z.string().min(1).max(20),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = recoverySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Recovery code is required" }, { status: 400 });
    }

    const codeHash = hashRecoveryCode(parsed.data.code);

    // 33-C: Atomic findFirst+update replaced with a single updateMany to prevent
    // TOCTOU race conditions where two concurrent requests could both pass the
    // "not used" check before either marks the code as used.
    const result = await prisma.mfaRecoveryCode.updateMany({
      where: { userId: session.user.id, codeHash, used: false },
      data: { used: true, usedAt: new Date() },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Invalid or already used recovery code" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA recovery error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
