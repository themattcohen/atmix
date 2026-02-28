import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

/* ---------- Resend singleton (matches pattern in lib/email.ts) ---------- */

let _resend: Resend | null = null;

function getResend(): Resend {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is required");
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@fbardirect.com";
const supportEmail = "support@fbardirect.com";

/* ---------- Validation ---------- */

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(254),
  subject: z.enum([
    "General Question",
    "Filing Help",
    "Billing",
    "Technical Issue",
    "Other",
  ]),
  message: z.string().min(10, "Message must be at least 10 characters").max(5000),
  turnstileToken: z.string().min(1, "Security verification is required"),
});

/* ---------- Turnstile verification ---------- */

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Skip verification in dev when secret is not configured
  if (!secret) {
    console.warn("[contact] TURNSTILE_SECRET_KEY not set — skipping verification");
    return true;
  }

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    }
  );

  const result = await res.json();
  return result.success === true;
}

/* ---------- HTML helpers ---------- */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildNotificationHtml(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #112e51; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct — Contact Form</h1>
      </div>
      <div style="padding: 32px 24px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; vertical-align: top; width: 100px;">Name:</td>
            <td style="padding: 8px 12px;">${escapeHtml(data.name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; vertical-align: top;">Email:</td>
            <td style="padding: 8px 12px;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; vertical-align: top;">Subject:</td>
            <td style="padding: 8px 12px;">${escapeHtml(data.subject)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; vertical-align: top;">Message:</td>
            <td style="padding: 8px 12px; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
          </tr>
        </table>
      </div>
    </div>
  `;
}

function buildAcknowledgementHtml(name: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #112e51; padding: 24px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
      </div>
      <div style="padding: 32px 24px;">
        <h2 style="color: #112e51;">We Received Your Message</h2>
        <p>Hi ${escapeHtml(name)},</p>
        <p>Thank you for reaching out. We received your message and will respond within <strong>1 business day</strong>.</p>
        <p>If your question is about an active filing, you can also check your filing status by logging into your account.</p>
        <p style="color: #666; font-size: 14px;">You don&rsquo;t need to reply to this email.</p>
      </div>
      <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
        <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
      </div>
    </div>
  `;
}

/* ---------- POST handler ---------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { name, email, subject, message, turnstileToken } = parsed.data;

    // Verify Turnstile
    const turnstileOk = await verifyTurnstile(turnstileToken);
    if (!turnstileOk) {
      return NextResponse.json(
        { error: "Security verification failed. Please try again." },
        { status: 400 }
      );
    }

    const resend = getResend();

    // Send notification to support
    await resend.emails.send({
      from: fromEmail,
      to: supportEmail,
      replyTo: email,
      subject: `[FBAR Direct Contact] ${subject} — from ${name}`,
      html: buildNotificationHtml({ name, email, subject, message }),
    });

    // Send acknowledgement to user
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "We received your message — FBAR Direct",
      html: buildAcknowledgementHtml(name),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] Error processing contact form:", err);
    return NextResponse.json(
      { error: "Unable to send your message. Please try again later." },
      { status: 500 }
    );
  }
}
