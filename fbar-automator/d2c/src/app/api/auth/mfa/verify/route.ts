import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotp } from "@/lib/mfa";

const verifySchema = z.object({
  token: z.string().min(1).max(10),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.mfaSecret) {
      return NextResponse.json({ error: "MFA setup not started" }, { status: 400 });
    }

    const isValid = verifyTotp(user.mfaSecret, parsed.data.token);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid TOTP token" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaEnabled: true, mfaVerifiedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MFA verify error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
