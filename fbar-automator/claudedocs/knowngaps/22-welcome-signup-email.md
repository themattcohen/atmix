# Gap #22: No welcome/signup email sent on account creation

**Severity:** Low
**Effort:** S (< 1 hour)
**Depends on:** None (Resend integration already wired; `RESEND_API_KEY` and `RESEND_FROM_EMAIL` already used by existing email functions)

## Problem

Users create an account and receive no email. The signup API route (`d2c/src/app/api/auth/signup/route.ts`) responds with `{ message: "Check your email to continue." }` (line 49) — a message that implies email verification was sent, but nothing is actually sent. There is no email confirmation, no welcome, and no next-step guidance delivered to the new user's inbox.

The practical impact:

1. **False API contract:** The response message "Check your email to continue." tells users to check email for a step that does not exist. New users who take this literally may wait for an email that never comes, or assume the signup failed.
2. **Zero onboarding context:** Users land in a wizard with no email record that they created an account, no link back to the app, and no guidance on what FBAR filing involves.
3. **Deliverability cold-start problem:** Without transactional emails from day one, the Resend domain `fbardirect.com` builds no sending reputation before the higher-stakes submission confirmation emails (`sendSubmissionEmail`, `sendConfirmationEmail`) are sent.

This is not a security issue — password reset already verifies email ownership. It is purely a UX and trust gap.

## Current State

**`d2c/src/app/api/auth/signup/route.ts`** (the only signup endpoint, confirmed via Grep):

- Line 1-4: Imports `NextRequest`, `NextResponse`, `bcrypt`, `prisma`, `signupSchema`.
- Lines 7-9: Parses and validates request body using `signupSchema`.
- Lines 18-19: Extracts `email`, `password`, `firstName`, `lastName`, UTM fields; normalizes email to lowercase.
- Lines 22-44: Creates user via `prisma.user.create()`. Swallows `Unique constraint` errors silently (anti-enumeration — intentional). Other errors are re-thrown.
- Lines 47-51: **Always** returns `{ message: "Check your email to continue." }` with status 201 — regardless of whether the user was newly created or already existed.
- **No email is sent anywhere in this handler.**

**`d2c/src/lib/email.ts`** — existing email infrastructure:

- Lines 1-22: Lazy `Resend` client initialized on first call. Requires `RESEND_API_KEY` env var. Throws if missing.
- Line 24: `fromEmail` = `process.env.RESEND_FROM_EMAIL || "noreply@fbardirect.com"`.
- Lines 26-52: `sendSubmissionEmail(to, { firstName, calendarYear })` — sent when FBAR submitted to FinCEN.
- Lines 54-84: `sendConfirmationEmail(to, { firstName, calendarYear, bsaId })` — sent when FinCEN accepts the filing.
- Lines 86-116: `sendRejectionEmail(to, { firstName, calendarYear, reason })` — sent when FinCEN rejects.
- Lines 118-148: `sendPasswordResetEmail(email, firstName, resetUrl)` — sent on password reset request.

All existing emails share the same HTML structure: navy header (`#112e51`), white body with padding, gray disclaimer footer. The welcome email must match this pattern for brand consistency.

**Anti-enumeration consideration (important):** The signup route intentionally returns an identical response whether the email already exists or is newly created (lines 38-45 and 47-51). A welcome email must only be sent for genuinely new accounts — not for duplicate signup attempts. The current code structure (swallowing the unique constraint error and falling through) means the welcome email call must be placed inside the `try` block, after `prisma.user.create()` succeeds, before the catch block.

## Implementation Plan

### Step 1: Add `sendWelcomeEmail` to `d2c/src/lib/email.ts`

Add after line 148 (end of file):

```typescript
export async function sendWelcomeEmail(
  to: string,
  data: { firstName: string }
): Promise<void> {
  await getResend().emails.send({
    from: fromEmail,
    to,
    subject: "Welcome to FBAR Direct — let's file your FBAR",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #112e51; padding: 24px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">FBAR Direct</h1>
        </div>
        <div style="padding: 32px 24px;">
          <h2 style="color: #112e51;">Your account is ready</h2>
          <p>Hi ${escapeHtml(data.firstName)},</p>
          <p>You're set up on FBAR Direct. Most people finish filing in under 10 minutes.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${escapeHtml(process.env.NEXTAUTH_URL || 'https://fbardirect.com')}/threshold"
               style="background: #112e51; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600;">
              Start Filing
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">If you have questions, reply to this email.</p>
        </div>
        <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #666; text-align: center;">
          <p>FBAR Direct is not affiliated with the IRS, FinCEN, or any U.S. government agency.</p>
        </div>
      </div>
    `,
  });
}
```

Notes on this implementation:
- Uses `escapeHtml()` on `firstName` (already defined at lines 5-12 — in scope in the same file).
- Uses `process.env.NEXTAUTH_URL` for the CTA link so it works in both dev (`http://localhost:3001`) and production (`https://fbardirect.com`). Falls back to production URL.
- Subject line is direct — avoids filler phrases like "Welcome aboard!" or "You're all set!".
- CTA links to `/threshold` (the start of the wizard), not `/dashboard`, because new users have no filing in progress yet.
- Matches existing email HTML structure exactly (same header, footer, button style).

### Step 2: Call `sendWelcomeEmail` in `d2c/src/app/api/auth/signup/route.ts`

**Import:** Add `sendWelcomeEmail` to the existing import from `email.ts` (or add a new import line after line 4):

```typescript
import { sendWelcomeEmail } from "@/lib/email";
```

**Placement:** The call must go inside the `try` block, after `prisma.user.create()` succeeds, and must not block the response. Email delivery failure must never cause signup to fail — wrap in a fire-and-forget pattern.

Replace lines 24-45 with:

```typescript
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

      // Fire-and-forget: email failure must not block account creation or reveal enumeration info
      sendWelcomeEmail(email, { firstName }).catch((err) => {
        console.error("Welcome email failed (non-fatal):", err instanceof Error ? err.message : err);
      });

    } catch (err: unknown) {
      // Unique constraint = email exists. Fall through to return same response (anti-enumeration)
      if (err instanceof Error && err.message.includes("Unique constraint")) {
        // Intentionally swallowed
      } else {
        throw err;
      }
    }
```

Key decisions in this implementation:
- **Fire-and-forget** (`.catch()` not `await`): The response returns 201 immediately. Email delivery is async and non-blocking. A Resend API outage or misconfigured key never causes signup failures.
- **Error is logged but swallowed:** The `console.error` gives visibility in server logs without surfacing to the user.
- **Anti-enumeration preserved:** The welcome email call is inside the `try` block after `prisma.user.create()`, so it only executes for genuinely new accounts. The duplicate email path falls into the `catch` (Unique constraint) and swallows — no email is sent, no information is leaked.
- **No change to response message:** The `{ message: "Check your email to continue." }` response (line 49) now accurately describes what happened.

### Step 3: Update the response message (optional but recommended)

The current message "Check your email to continue." implies a required verification step. Since this is a welcome email (not a verification gate), a clearer message would be:

```typescript
return NextResponse.json(
  { message: "Account created. Check your email for a welcome message." },
  { status: 201 }
);
```

This is optional — the frontend signup form may display its own success state regardless of this message content. Verify in `d2c/src/app/(auth)/signup/page.tsx` or wherever the signup form handles the API response before changing.

## Files to Modify

| File | Change |
|---|---|
| `d2c/src/lib/email.ts` | Add: `sendWelcomeEmail(to, { firstName })` function after line 148 |
| `d2c/src/app/api/auth/signup/route.ts` | Add: import `sendWelcomeEmail`; add fire-and-forget call after successful `prisma.user.create()` |

## Environment / Config Changes

No new environment variables required. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are already used by existing email functions and must be configured in production.

`NEXTAUTH_URL` is used in the CTA link inside `sendWelcomeEmail`. This is already a required NextAuth environment variable and is configured in `docker-compose.prod.yml`.

**Current production status:** The CLAUDE.md notes "D2C integrations not yet configured: Stripe (placeholder keys), Resend email, FinCEN SFTP (sandbox mode)." This means `RESEND_API_KEY` is a placeholder on production. All email functions (including the new welcome email) will fail silently until Resend is configured with a live key. The fire-and-forget pattern means this does not break signup.

## Testing

**Manual test (local dev):**
1. Set `RESEND_API_KEY` to a valid Resend test key in `.env.local`
2. Sign up with a new email via `/signup`
3. Verify welcome email arrives in inbox with correct `firstName`, working CTA link, and matching HTML style
4. Sign up again with the same email (duplicate)
5. Verify no welcome email is sent for the duplicate attempt
6. Temporarily set `RESEND_API_KEY` to an invalid value, sign up with a new email — verify signup still returns 201 (email failure is non-fatal), verify error appears in server console logs

**E2E test addition:**
Existing signup tests in `d2c/tests/e2e/antagonistic/t06-signup.spec.ts` test the form flow. Email delivery cannot be verified in Playwright without a test mailbox (e.g., Mailhog, Resend test mode). Add a unit test instead:

```typescript
// In a new file: d2c/src/app/api/auth/signup/route.test.ts (vitest)
// Mock sendWelcomeEmail and verify it is called once on new signup
// Verify it is NOT called when prisma.user.create() throws Unique constraint
// Verify signup response is 201 regardless of email mock outcome
```

**Production smoke test after Resend is configured:**
1. Create a new account on `https://fbardirect.com/signup`
2. Check inbox within 2 minutes for welcome email
3. Verify CTA button links to `https://fbardirect.com/threshold`
4. Verify subject line, sender name, and disclaimer footer

## Risks / Notes

**Resend not yet live in production.** The welcome email will silently fail in production until `RESEND_API_KEY` is set to a live Resend key (see project memory: "Resend email — placeholder/sandbox — not yet configured for production"). The fire-and-forget pattern means this is safe to deploy now; the email activates automatically when Resend is configured.

**`RESEND_API_KEY` missing throws in `getResend()`.** The current `getResend()` function (email.ts lines 14-22) throws `new Error("RESEND_API_KEY is required")` if the env var is unset. With fire-and-forget, this throw is caught by the `.catch()` handler and logged — it does not surface to the user. However, if the placeholder key is the string `""` (empty string), `getResend()` would not throw (empty string is truthy check-passing in `if (!process.env.RESEND_API_KEY)`). Test with the actual production env value to confirm behavior.

**Email to existing accounts at first deploy.** This change only affects new signups going forward. Existing users who signed up before this change is deployed will never receive a retroactive welcome email. This is correct behavior — no backfill needed.

**Rate limiting.** The D2C app has a rate limiter on API routes (confirmed in middleware.ts). Verify the rate limit configuration does not throttle bulk test signups during E2E test runs. The project memory notes auth routes were exempted from the rate limiter to prevent MissingCSRF errors — the signup route may already be exempt, but confirm.
