import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPresignedUrl } from "@/lib/s3";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Filing ID required" }, { status: 400 });
  }

  const filing = await prisma.filingYear.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!filing?.form114aUrl) {
    return NextResponse.json({ error: "Form 114a not found" }, { status: 404 });
  }

  const url = await getPresignedUrl(filing.form114aUrl);
  return NextResponse.redirect(url);
}
