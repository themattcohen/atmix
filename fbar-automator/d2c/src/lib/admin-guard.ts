import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id)
    return { session: null as never, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as any).role !== "ADMIN")
    return { session: null as never, error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { session, error: null };
}
