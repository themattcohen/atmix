import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { verifyTotp } from "@/lib/mfa";
import { decrypt } from "@/lib/encryption";
import { clearMfaCookieOptions } from "@/lib/mfa-cookie";

const disableSchema = z.object({
  token: z.string().min(1).max(10),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = disableSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.mfaEnabled) {
      return NextResponse.json({ error: "MFA is not enabled" }, { status: 400 });
    }

    if (!user.mfaSecret) {
      return NextResponse.json({ error: "MFA configuration error" }, { status: 400 });
    }

    const decryptedSecret = decrypt(user.mfaSecret);
    const isValid = verifyTotp(decryptedSecret, parsed.data.token);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid TOTP token" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaVerifiedAt: null, tokenVersion: { increment: 1 } },
    });

    // Delete all recovery codes
    await prisma.mfaRecoveryCode.deleteMany({ where: { userId: session.user.id } });

    const clearCookie = clearMfaCookieOptions();
    const response = NextResponse.json({ success: true });
    response.cookies.set(clearCookie.name, clearCookie.value, clearCookie.options as any);
    return response;
  } catch (error) {
    console.error("MFA disable error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
