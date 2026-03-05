import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { personalInfoUpdateSchema } from "@/lib/validation";
import { encrypt, safeDecrypt } from "@/lib/encryption";
import { Prisma, TINType } from "@prisma/client";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const decryptedTin = user.tin ? safeDecrypt(user.tin) : null;

    return NextResponse.json({
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        suffix: user.suffix,
        hasTin: !!user.tin,
        tinLast4: decryptedTin ? decryptedTin.slice(-4) : null,
        tinType: user.tinType,
        dateOfBirth: user.dateOfBirth?.toISOString().split("T")[0] || null,
        usAddress: user.usAddress as { street: string; street2?: string; city: string; state: string; zip: string } | null,
        phone: user.phone,
        mfaEnabled: user.mfaEnabled,
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("User get error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = personalInfoUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { firstName, lastName, middleName, suffix, tin, tinType, dateOfBirth, usAddress, phone } = parsed.data;

    // Build update data — only overwrite TIN if a new one was provided
    const tinUpdate = tin && tin.length > 0
      ? { tin: encrypt(tin.replace(/-/g, "")), tinType: tinType as TINType }
      : {};

    // Use updateMany with userId filter for defense-in-depth
    const result = await prisma.user.updateMany({
      where: { id: session.user.id },
      data: {
        firstName,
        lastName,
        middleName: middleName || null,
        suffix: suffix || null,
        ...tinUpdate,
        dateOfBirth: new Date(dateOfBirth + "T12:00:00Z"),
        usAddress: usAddress as unknown as Prisma.InputJsonValue,
        phone: phone || null,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        firstName,
        lastName,
        ...(tin && tin.length > 0 ? { tinLast4: tin.replace(/-/g, "").slice(-4), tinType } : {}),
      },
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error("User update error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
