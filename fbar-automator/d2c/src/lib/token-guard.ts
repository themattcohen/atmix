import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * Validates that the session's tokenVersion matches the current DB value.
 * Used on high-security routes (sign, checkout) to detect revoked sessions.
 * Returns null if valid, or a 401 NextResponse if revoked.
 */
export async function validateTokenVersion(): Promise<NextResponse | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { tokenVersion: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionTokenVersion = (session as any).tokenVersion;
  if (sessionTokenVersion !== undefined && sessionTokenVersion !== user.tokenVersion) {
    return NextResponse.json({ error: "Session revoked. Please sign in again." }, { status: 401 });
  }

  return null; // Valid
}
