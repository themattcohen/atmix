# D2C Customer Support System — 2026-02-28

## Architecture Overview

```
User ──► Chat Widget (floating bubble)
         │  Claude Haiku 4.5 via Vercel AI SDK v6
         │  19KB knowledge base system prompt
         │  Streaming responses, markdown rendering
         └──► /api/chat (POST, streaming)

User ──► Contact Form (/contact page)
         │  Cloudflare Turnstile spam protection
         │  Server-side token verification
         └──► /api/contact (POST)
              └──► Resend email → support@fbardirect.com
                   (Zoho Mail free plan — full mailbox)
```

## What Was Built

### New Files (8)

| File | Purpose |
|------|---------|
| `d2c/src/components/chat/ChatWidget.tsx` | Floating chat bubble + message panel |
| `d2c/src/components/chat/ChatMessage.tsx` | Message bubble component (user/assistant) |
| `d2c/src/app/api/chat/route.ts` | Streaming AI endpoint (Claude Haiku 4.5) |
| `d2c/src/lib/knowledge-base.ts` | 19KB system prompt with FBAR domain knowledge |
| `d2c/src/components/contact/ContactForm.tsx` | Contact form with Turnstile CAPTCHA |
| `d2c/src/app/api/contact/route.ts` | Contact form handler → Resend email |
| `d2c/src/app/(marketing)/contact/page.tsx` | /contact marketing page |
| `d2c/src/components/analytics/CookieConsent.tsx` | Cookie consent banner |

### Modified Files (10)

| File | Change |
|------|--------|
| `d2c/src/lib/faq-data.ts` | Expanded 8 → 26 Q&A pairs |
| `d2c/src/middleware.ts` | CSP updates, auth/CSRF exemptions for chat, rate limit on /api/chat |
| `d2c/src/app/layout.tsx` | Dynamic ChatWidget import |
| `d2c/src/app/(marketing)/layout.tsx` | Contact link in footer |
| `d2c/src/components/nav/MarketingHeader.tsx` | Contact link in desktop nav |
| `d2c/src/components/nav/MobileMenu.tsx` | Contact link in mobile menu |
| `d2c/src/app/(app)/layout.tsx` | Help link in authenticated app nav |
| `d2c/src/app/sitemap.ts` | /contact added to sitemap |
| `d2c/.env.example` | Turnstile env vars added |
| `d2c/package.json` | New dependencies added |

### Packages Added

| Package | Purpose |
|---------|---------|
| `ai` | Vercel AI SDK v6 core |
| `@ai-sdk/anthropic` | Claude provider for AI SDK |
| `@ai-sdk/react` | React hooks (`useChat`) |
| `@marsidev/react-turnstile` | Cloudflare Turnstile React component |

### Nav Updates

- **Marketing site**: "Contact" link added to desktop header, mobile menu, and footer
- **App (authenticated)**: "Help" link in app sidebar/nav
- **Sitemap**: `/contact` included

---

## Manual Setup Required

### 1. Namecheap Email Forwarding (FREE)

Sets up `support@fbardirect.com` without needing a mailbox.

1. Log in to Namecheap → Domain List → `fbardirect.com`
2. Go to **Email Forwarding** tab
3. Add alias: `support` → your personal email address
4. **Test**: Send an email to `support@fbardirect.com`, confirm it arrives in your inbox

> This is free with Namecheap domain registration. No DNS changes needed — Namecheap handles MX records automatically for forwarding.

### 2. Cloudflare Turnstile (FREE, no DNS migration)

Turnstile works without migrating DNS to Cloudflare.

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → **Turnstile** (left sidebar)
2. Click **Add widget**
3. Widget name: `FBAR Direct Contact`
4. Hostnames: `fbardirect.com` and `localhost` (for dev)
5. Widget mode: **Managed** (recommended)
6. Copy the **Site Key** and **Secret Key**

### 3. VPS Environment Variables

Add to the D2C `.env` on Hetzner:

```bash
TURNSTILE_SECRET_KEY=0x...      # Server-side verification
NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...  # Client-side widget (baked into Docker at build)
```

### 4. Twilio Toll-Free Number (~$2–3/mo, voicemail only)

Professional phone number for CA Civil Code 1789.3 compliance and trust signals.

1. Log in to Twilio console → **Buy a Number** → Toll-Free (1-800/888)
2. Create a **TwiML Bin** with voicemail greeting:
   ```xml
   <Response>
     <Say>You've reached FBAR Direct. Please leave a message after the tone.</Say>
     <Record maxLength="120" transcribe="true" transcribeCallback="YOUR_EMAIL_WEBHOOK"/>
   </Response>
   ```
3. Assign the TwiML Bin as the **Voice** handler for the number
4. Voicemail transcriptions are emailed automatically — no server needed
5. Add the number to the contact page footer and `/contact` page
6. Update `knowledge-base.ts` system prompt with the phone number

> Cost: $2.15/mo for the number + $0.0085/min inbound (voicemail recording only — pennies). No outbound calls needed.

### 5. Zoho Mail (FREE, reply-as support@) — LIVE 2026-03-03

Replaces Namecheap forwarding with a full mailbox. Recipients never see your personal email.

- **Plan**: Zoho Mail free plan
- **Primary mailbox**: `support@fbardirect.com`
- **Aliases**: admin@, noreply@, info@, billing@, postmaster@, abuse@, security@, hello@, dmca@
- **MX records**: Point to zoho.com
- **SPF**: Includes zoho.com + amazonses.com
- **Replaces**: Namecheap email forwarding (decommissioned)

> Note: Resend continues handling transactional email (`noreply@fbardirect.com`). Zoho Mail handles human support correspondence (`support@fbardirect.com`). No conflict — different purposes.

### 6. Deploy

Since `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is baked at build time:

```bash
# Trigger CI/CD build (push to main) or manually:
# 1. Docker image builds with NEXT_PUBLIC_ vars
# 2. Push to GHCR
# 3. On VPS: docker compose pull d2c-app && docker compose up -d d2c-app
```

---

## Cost Analysis

| Component | Monthly Cost |
|-----------|-------------|
| Claude Haiku 4.5 (AI chat) | ~$0.10–$1.50 (pay-per-token, ~$0.25/1M input, $1.25/1M output) |
| Cloudflare Turnstile | Free |
| Zoho Mail (support mailbox) | Free (Zoho Mail free plan) |
| Resend (contact form emails) | Free tier (100 emails/day) |
| Twilio toll-free + voicemail | ~$2–3 (number + pennies for recordings) |
| **Total** | **~$2–5/mo** |

Assuming ~50–200 chat conversations/month at launch volume.

---

## Implementation Details

### AI Chat Widget

- **Model**: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **SDK**: Vercel AI SDK v6 (`ai` + `@ai-sdk/anthropic` + `@ai-sdk/react`)
- **Streaming**: Server-sent events via `toUIMessageStreamResponse()`
- **System prompt**: 19KB knowledge base in `lib/knowledge-base.ts` covering FBAR rules, filing process, pricing, security, and 26 FAQ answers
- **Rate limiting**: Middleware-level rate limit on `/api/chat`
- **CSP**: `connect-src` updated to allow streaming responses

### AI SDK v6 Gotchas

| Issue | Correct Pattern |
|-------|----------------|
| `useChat` import | `@ai-sdk/react` (NOT `ai/react`) |
| Token limit param | `maxOutputTokens` (NOT `maxTokens`) |
| Stream response | `toUIMessageStreamResponse()` |
| Message conversion | `convertToModelMessages()` |

### Contact Form

- **Spam protection**: Cloudflare Turnstile (invisible CAPTCHA)
- **Server verification**: `/api/contact` verifies Turnstile token server-side before sending email
- **Email delivery**: Resend API → `support@fbardirect.com`
- **Sender**: `noreply@fbardirect.com` (already configured Resend domain)

### Middleware Changes

- `/api/chat` exempted from CSRF token requirement (public streaming endpoint)
- `/api/contact` exempted from auth requirement (public form)
- CSP `connect-src` updated for chat streaming
- Rate limiting applied to `/api/chat` to prevent abuse

---

## What's NOT Included

- No ticket/case tracking system
- No live phone support (voicemail-only via Twilio toll-free — planned)
- No CRM integration
- No live agent handoff
- No conversation persistence (chat resets on page reload)
- No admin dashboard for viewing chat/contact submissions
- Contact form emails go to a forwarded inbox, not a helpdesk tool

These can be added later as volume justifies the complexity.

---

## Status

- **Code**: Complete and deployed (build passes: tsc, lint, next build)
- **All manual setup COMPLETE** as of 2026-03-03
- **Turnstile**: LIVE (site key baked at build, secret key in server .env)
- **Phone**: LIVE — `(888) 863-5518` toll-free voicemail via Twilio Serverless
- **Email**: LIVE — Zoho Mail free plan, `support@fbardirect.com` with 9 aliases, MX → zoho.com

---

*Created: 2026-02-28. Part of post-launch D2C additions.*
