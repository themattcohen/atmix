import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email: rawEmail, password, firstName, lastName } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Always hash password to prevent timing-based enumeration
    const passwordHash = await bcrypt.hash(password, 12);

    try {
      await prisma.user.create({
        data: { email, passwordHash, firstName, lastName },
      });
    } catch (err: unknown) {
      // Unique constraint = email exists. Fall through to return same response
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        // Intentionally swallowed — anti-enumeration
      } else {
        throw err; // Re-throw unexpected errors to be caught by outer catch
      }
    }

    // Always return identical response regardless of whether user was created or already existed
    return NextResponse.json(
      { message: "Check your email to continue." },
      { status: 201 }
    );
  } catch (error) {
    console.error("Signup error:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
