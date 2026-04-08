import { Resend } from "resend";
import { parseRejectionReason, getRejectionSummary } from "@/lib/rejection-parser";
import type { AbandonmentEmailCopy } from "@/lib/abandonment-emails";

let _resend: Resend | null = null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

export async function sendSubmissionEmail(
  to: string,
  data: { firstName: string; calendarYear: number }
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to,
    replyTo: "support@fbardirect.com",
    subject: `Your ${data.calendarYear} FBAR has been submitted to FinCEN`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Your FBAR Has Been Submitted</h2>
          <p>Hi ${escapeHtml(data.firstName)},</p>
          <p>Your ${data.calendarYear} Report of Foreign Bank and Financial Accounts (FBAR) has been submitted to FinCEN via the BSA E-Filing System.</p>
          <p>Processing typically takes 1-2 business days. We'll email you your BSA tracking ID as soon as it's available.</p>
          <p style="color: #666; font-size: 14px;">If you have questions, reply to this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendConfirmationEmail(
  to: string,
  data: { firstName: string; calendarYear: number; bsaId: string }
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to,
    replyTo: "support@fbardirect.com",
    subject: `Your FBAR has been filed — BSA ID: ${data.bsaId}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Your FBAR Has Been Filed Successfully</h2>
          <p>Hi ${escapeHtml(data.firstName)},</p>
          <p>Your ${data.calendarYear} FBAR has been accepted by FinCEN.</p>
          <div style="background: #e8f5e9; border: 1px solid #4caf50; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
            <p style="margin: 0; font-size: 14px; color: #666;">BSA Tracking ID</p>
            <p style="margin: 8px 0 0; font-size: 28px; font-weight: bold; color: #112e51;">${escapeHtml(data.bsaId)}</p>
          </div>
          <p><strong>Save this BSA tracking ID for your records.</strong> You can use it to verify your filing on the FinCEN BSA E-Filing System.</p>
          <p style="color: #666; font-size: 14px;">Your signed Form 114a is available in your FBAR Direct account.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendRejectionEmail(
  to: string,
  data: { firstName: string; calendarYear: number; reason: string }
): Promise<void> {
  const errors = parseRejectionReason(data.reason);
  const summary = getRejectionSummary(errors);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://fbardirect.com";

  await getResend().emails.send({
    from: fromEmail,
    to,
    replyTo: "support@fbardirect.com",
    subject: `Action Required: Your ${data.calendarYear} FBAR submission needs attention`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #b71c1c;">Your FBAR Submission Needs Attention</h2>
          <p>Hi ${escapeHtml(data.firstName)},</p>
          <p>FinCEN was unable to process your ${data.calendarYear} FBAR submission.</p>
          <div style="background: #fce4ec; border: 1px solid #ef5350; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="margin: 0; font-weight: bold; color: #b71c1c;">What needs to be fixed:</p>
            <p style="margin: 8px 0 0;">${escapeHtml(summary)}</p>
          </div>
          <p>You can fix the issue and resubmit directly from your account — no additional charge.</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${escapeHtml(appUrl)}/confirmation" style="background: #112e51; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Log In to Fix &amp; Resubmit</a>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 24px;">Raw FinCEN response: ${escapeHtml(data.reason)}</p>
          <p style="color: #666; font-size: 14px;">If you need help, reply to this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to: email,
    replyTo: "support@fbardirect.com",
    subject: "Reset your FBAR Direct password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Reset Your Password</h2>
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${escapeHtml(resetUrl)}" style="background: #112e51; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendPaymentReceiptEmail(
  to: string,
  data: { firstName: string; calendarYear: number; amountDollars: number; tier: string }
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to,
    replyTo: "support@fbardirect.com",
    subject: `Payment confirmed - Your ${data.calendarYear} FBAR is being filed`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Payment Confirmed</h2>
          <p>Hi ${escapeHtml(data.firstName)},</p>
          <p>We received your payment of <strong>$${data.amountDollars}.00</strong> for your
             ${data.calendarYear} FBAR filing (${escapeHtml(data.tier)} plan).</p>
          <p>We are now submitting your FBAR to FinCEN. You will receive another email with
             your BSA tracking ID within 1-2 business days.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(
  to: string,
  data: { firstName: string }
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to,
    replyTo: "support@fbardirect.com",
    subject: "Welcome to FBAR Direct",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Welcome, ${escapeHtml(data.firstName)}!</h2>
          <p>Your FBAR Direct account has been created. You can now file your Report of Foreign Bank and Financial Accounts (FBAR) with FinCEN.</p>
          <p><strong>What's next?</strong></p>
          <ol>
            <li>Complete your personal information</li>
            <li>Add your foreign accounts</li>
            <li>Review and sign your filing</li>
          </ol>
          <p style="color: #666; font-size: 14px;">Questions? Reply to this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendVerificationEmail(
  email: string,
  firstName: string,
  verifyUrl: string
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to: email,
    replyTo: "support@fbardirect.com",
    subject: "FBAR Direct — Confirm your account",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Verify Your Email</h2>
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>Please verify your email address to access your FBAR Direct account.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${escapeHtml(verifyUrl)}" style="background: #112e51; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Verify Email</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
          <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}

export async function sendAdminAckNotification(data: {
  filingId: string;
  userEmail: string;
  calendarYear: number;
  status: "accepted" | "rejected";
  bsaId?: string;
  rejectionReason?: string;
}): Promise<void> {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@fbardirect.com";
  await getResend().emails.send({
    from: fromEmail,
    to: adminEmail,
    subject: `[FBAR Direct] Filing ${data.status.toUpperCase()}: ${data.userEmail} (${data.calendarYear})`,
    html: `<p>Filing <strong>${escapeHtml(data.filingId)}</strong> for ${escapeHtml(data.userEmail)} (${data.calendarYear}) has been <strong>${data.status}</strong>.</p>
${data.bsaId ? `<p>BSA ID: <strong>${escapeHtml(data.bsaId)}</strong></p>` : ""}
${data.rejectionReason ? `<p>Reason: ${escapeHtml(data.rejectionReason)}</p>` : ""}`,
  });
}

function isPermanentError(err: unknown): boolean {
  const status = (err as Record<string, unknown>)?.status;
  return typeof status === "number" && status >= 400 && status < 500 && status !== 429;
}

export async function sendEmailWithRetry(
  fn: () => Promise<void>,
  options?: { maxRetries?: number; backoffMs?: number }
): Promise<void> {
  const maxRetries = options?.maxRetries ?? 3;
  const backoffMs = options?.backoffMs ?? 1000;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastError = err;

      // Permanent error (4xx) — don't retry
      if (isPermanentError(err)) {
        throw err;
      }

      // Last attempt — throw without waiting
      if (attempt === maxRetries) {
        throw err;
      }

      // Exponential backoff before next retry
      const delay = backoffMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export async function sendAbandonmentEmail(
  to: string,
  copy: AbandonmentEmailCopy,
  deepLink: string,
  unsubscribeUrl: string
): Promise<void> {
  await sendEmailWithRetry(async () => {
    await getResend().emails.send({
      from: `Matt at FBAR Direct <${fromEmail}>`,
      to,
      replyTo: "support@fbardirect.com",
      subject: copy.subject,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <div style="background-color: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-family: Arial, Helvetica, sans-serif;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px; font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: #333333;">
          <h2 style="color: #112e51; font-size: 20px; margin-top: 0; margin-bottom: 16px;">${escapeHtml(copy.headline)}</h2>
          ${copy.body}
          <div style="text-align: center; margin: 32px 0;">
            <a href="${escapeHtml(deepLink)}" style="background-color: #205493; border: 1px solid #205493; color: #ffffff; display: inline-block; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: 600; line-height: 48px; padding: 0 36px; text-align: center; text-decoration: none; mso-padding-alt: 14px 36px;">${escapeHtml(copy.cta)}</a>
          </div>
        </div>
        <div style="background-color: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666666; text-align: center; font-family: Arial, Helvetica, sans-serif;">
          <p style="margin: 0 0 8px 0;">You're receiving this because you have an in-progress FBAR filing on <a href="https://fbardirect.com" style="color: #666666; text-decoration: underline;">fbardirect.com</a>.</p>
          <p style="margin: 0 0 8px 0;"><a href="${escapeHtml(unsubscribeUrl)}" style="color: #666666; text-decoration: underline;">Unsubscribe</a></p>
          <p style="margin: 0;">FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
    });
  });
}
