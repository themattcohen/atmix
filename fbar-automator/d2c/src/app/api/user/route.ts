import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { personalInfoSchema } from "@/lib/validation";
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
        tinLast4: decryptedTin ? decryptedTin.slice(-4) : null,
        tinType: user.tinType,
        dateOfBirth: user.dateOfBirth?.toISOString().split("T")[0] || null,
        usAddress: user.usAddress as { street: string; street2?: string; city: string; state: string; zip: string } | null,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("User get error:", error);
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
    const parsed = personalInfoSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { firstName, lastName, middleName, suffix, tin, tinType, dateOfBirth, usAddress, phone } = parsed.data;

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        firstName,
        lastName,
        middleName: middleName || null,
        suffix: suffix || null,
        tin: encrypt(tin.replace(/-/g, "")),
        tinType: tinType as TINType,
        dateOfBirth: new Date(dateOfBirth),
        usAddress: usAddress as unknown as Prisma.InputJsonValue,
        phone: phone || null,
      },
    });

    const decryptedTin = safeDecrypt(user.tin || "");

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tinLast4: decryptedTin ? decryptedTin.slice(-4) : null,
        tinType: user.tinType,
      },
    });
  } catch (error) {
    console.error("User update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
