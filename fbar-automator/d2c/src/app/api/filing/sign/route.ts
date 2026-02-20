import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { signatureSchema } from "@/lib/validation";
import { generateForm114a } from "@/lib/form114a";
import { encrypt, decrypt } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = signatureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { filingYearId, fullName, signatureData, signatureType } = parsed.data;

    // Verify filing belongs to user
    const filingYear = await prisma.filingYear.findFirst({
      where: { id: filingYearId, userId: session.user.id },
    });

    if (!filingYear) {
      return NextResponse.json({ error: "Filing year not found" }, { status: 404 });
    }

    if (filingYear.status !== "REVIEWED") {
      return NextResponse.json(
        { error: "Filing must be in REVIEWED status before signing" },
        { status: 400 }
      );
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.firstName || !user.lastName) {
      return NextResponse.json(
        { error: "Please complete your personal information first" },
        { status: 400 }
      );
    }

    // Verify name matches
    const expectedParts = [user.firstName, user.middleName, user.lastName].filter(Boolean);
    const expectedName = expectedParts.join(" ").trim().toLowerCase();
    if (fullName.trim().toLowerCase() !== expectedName) {
      return NextResponse.json(
        { error: "Signature name must match your registered name" },
        { status: 400 }
      );
    }

    // Get account count
    const accountCount = await prisma.foreignAccount.count({
      where: { userId: session.user.id, calendarYear: filingYear.calendarYear },
    });

    // Get client IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || req.headers.get("x-real-ip")
      || "unknown";

    // Generate Form 114a PDF
    let tinLast4 = "0000";
    if (user.tin) {
      try {
        tinLast4 = decrypt(user.tin).slice(-4);
        if (!tinLast4 || tinLast4.length < 4) {
          return NextResponse.json({ error: "Unable to retrieve your TIN" }, { status: 422 });
        }
      } catch {
        return NextResponse.json({ error: "Unable to process your TIN" }, { status: 500 });
      }
    }
    const { key: form114aUrl } = await generateForm114a({
      userId: session.user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      tinLast4,
      calendarYear: filingYear.calendarYear,
      accountCount,
      signatureData,
      signatureType: signatureType as "typed" | "drawn",
      signedAt: new Date(),
      signatureIp: ip,
    });

    // Encrypt signature data at rest
    const encryptedSignature = encrypt(signatureData);

    // Update filing year with userId defense-in-depth
    const updated = await prisma.filingYear.updateMany({
      where: { id: filingYearId, userId: session.user.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signatureIp: ip,
        signatureData: { type: signatureType, value: encryptedSignature },
        form114aUrl,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json(
        { error: "Filing could not be updated" },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, data: { form114aUrl } });
  } catch (error) {
    console.error("Sign error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
