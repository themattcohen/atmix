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
                   (Namecheap email forwarding → personal inbox)
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

### 4. Deploy

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
| Namecheap email forwarding | Free (included with domain) |
| Resend (contact form emails) | Free tier (100 emails/day) |
| **Total** | **~$0.20–$2.00/mo** |

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
- No phone support
- No CRM integration
- No live agent handoff
- No conversation persistence (chat resets on page reload)
- No admin dashboard for viewing chat/contact submissions
- Contact form emails go to a forwarded inbox, not a helpdesk tool

These can be added later as volume justifies the complexity.

---

## Status

- **Code**: Complete and deployed (build passes: tsc, lint, next build)
- **Manual setup**: Pending (Turnstile keys + email forwarding)
- **Functional without setup**: Chat widget works immediately (uses ANTHROPIC_API_KEY already in env). Contact form will fail without Turnstile keys. Email forwarding needed for contact form destination.

---

*Created: 2026-02-28. Part of post-launch D2C additions.*
