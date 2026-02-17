import { Resend } from "resend"

let _resend: Resend | null = null

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function getResend(): Resend | null {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — email sending disabled")
      return null
    }
    _resend = new Resend(process.env.RESEND_API_KEY)
  }
  return _resend
}

const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@fbarautomator.com"

export async function sendPasswordResetEmail(
  email: string,
  name: string,
  resetUrl: string
): Promise<void> {
  const resend = getResend()
  if (!resend) return

  const firstName = name.split(" ")[0] || "there"

  await resend.emails.send({
    from: fromEmail,
    to: email,
    subject: "Reset your FBAR Automator password",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1e40af; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Automator</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #1e40af;">Reset Your Password</h2>
          <p>Hi ${escapeHtml(firstName)},</p>
          <p>We received a request to reset your password. Click the button below to choose a new password:</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${escapeHtml(resetUrl)}" style="background: #1e40af; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>&copy; FBAR Automator</p>
        </div>
      </div>
    `,
  })
}
