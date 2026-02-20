import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { signupSchema } from "@/lib/validation";
import { sendWelcomeEmail, sendEmailWithRetry } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Trim and normalize email before Zod validation so whitespace-padded emails pass
    if (body && typeof body.email === "string") {
      body.email = body.email.trim();
    }
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email: rawEmail, password, firstName, lastName, utmSource, utmMedium, utmCampaign, utmContent, utmTerm } = parsed.data;
    const email = rawEmail.toLowerCase().trim();

    // Always hash password to prevent timing-based enumeration
    const passwordHash = await bcrypt.hash(password, 12);

    let userCreated = false;
    try {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          utmContent: utmContent || null,
          utmTerm: utmTerm || null,
        },
      });
      userCreated = true;
    } catch (err: unknown) {
      // Unique constraint = email exists. Fall through to return same response
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        // Intentionally swallowed — anti-enumeration
      } else {
        throw err; // Re-throw unexpected errors to be caught by outer catch
      }
    }

    // Fire-and-forget welcome email — non-blocking, signup succeeds even if email fails
    if (userCreated && process.env.RESEND_API_KEY) {
      sendEmailWithRetry(
        () => sendWelcomeEmail(email, { firstName }),
        { maxRetries: 2, backoffMs: 500 }
      ).catch((err) => {
        console.error("Welcome email failed:", err instanceof Error ? err.message : "Unknown error");
      });
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
