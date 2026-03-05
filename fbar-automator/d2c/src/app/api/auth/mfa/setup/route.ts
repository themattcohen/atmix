import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateSecret, generateQrCode, generateRecoveryCodes, hashRecoveryCode } from "@/lib/mfa";
import { encrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json({ error: "MFA is already enabled" }, { status: 400 });
    }

    if (user.mfaSecret && !user.mfaEnabled) {
      return NextResponse.json({ error: "MFA setup already in progress. Complete verification or start over." }, { status: 409 });
    }

    let secret: string;
    let otpauthUri: string;
    if (process.env.NODE_ENV !== "production" && process.env.MFA_TEST_SECRET_OVERRIDE) {
      secret = process.env.MFA_TEST_SECRET_OVERRIDE;
      otpauthUri = `otpauth://totp/FBAR%20Direct:${encodeURIComponent(user.email)}?secret=${secret}&issuer=FBAR%20Direct&algorithm=SHA1&digits=6&period=30`;
    } else {
      ({ secret, otpauthUri } = generateSecret(user.email));
    }
    const qrCode = await generateQrCode(otpauthUri);
    const recoveryCodes = generateRecoveryCodes(10);

    // Store the secret (MFA not enabled until verify step)
    await prisma.user.update({
      where: { id: session.user.id },
      data: { mfaSecret: encrypt(secret), mfaEnabled: false },
    });

    // Store hashed recovery codes
    await prisma.mfaRecoveryCode.deleteMany({ where: { userId: session.user.id } });
    await prisma.mfaRecoveryCode.createMany({
      data: recoveryCodes.map((code) => ({
        userId: session.user.id,
        codeHash: hashRecoveryCode(code),
      })),
    });

    return NextResponse.json({
      otpauthUri,
      qrCode,
      recoveryCodes,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("MFA setup error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
