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

    const recoveryCode = await prisma.mfaRecoveryCode.findFirst({
      where: { userId: session.user.id, codeHash },
    });

    if (!recoveryCode) {
      return NextResponse.json({ error: "Invalid recovery code" }, { status: 400 });
    }

    if (recoveryCode.used) {
      return NextResponse.json({ error: "Recovery code already used" }, { status: 400 });
    }

    // Mark code as used
    await prisma.mfaRecoveryCode.update({
      where: { id: recoveryCode.id },
      data: { used: true, usedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA recovery error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
