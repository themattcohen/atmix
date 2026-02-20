import { Resend } from "resend";

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
  await getResend().emails.send({
    from: fromEmail,
    to,
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
            <p style="margin: 0; font-weight: bold; color: #b71c1c;">Reason:</p>
            <p style="margin: 8px 0 0;">${escapeHtml(data.reason)}</p>
          </div>
          <p>Our team will review your filing and contact you with next steps. In most cases, we can resolve the issue and resubmit at no additional charge.</p>
          <p>If you have questions, reply to this email.</p>
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

export async function sendWelcomeEmail(
  to: string,
  data: { firstName: string }
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to,
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

function isPermanentError(err: unknown): boolean {
  const status = (err as Record<string, unknown>)?.status;
  return typeof status === "number" && status >= 400 && status < 500;
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
