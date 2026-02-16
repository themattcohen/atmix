import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { email } = await req.json();
  await prisma.user.updateMany({
    where: { email },
    data: { failedLoginAttempts: 0, lockoutUntil: null },
  });

  return NextResponse.json({ ok: true });
}
