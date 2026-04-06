import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return new NextResponse(notFoundHtml(), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { unsubscribeToken: token },
    select: { id: true },
  });

  if (!user) {
    return new NextResponse(notFoundHtml(), {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { unsubscribedFromReminders: true },
  });

  log("info", "User unsubscribed from reminders", { userId: user.id });

  return NextResponse.redirect(new URL("/unsubscribed", req.url));
}

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Not Found</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333;">
  <h1 style="color:#112e51;">Link Not Found</h1>
  <p>This unsubscribe link is invalid or has expired.</p>
  <p><a href="https://fbardirect.com" style="color:#112e51;">Return to FBAR Direct</a></p>
</body>
</html>`;
}
