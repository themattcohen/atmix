# TaxDome Review Request Automation — Setup Guide

## Overview

TaxDome can automatically send review request emails to clients after an engagement is completed. This guide walks through configuring the automation so clients get a Google review link at the right moment.

**Prerequisites**: Google Business Profile must be live first (Sprint 3) to generate the Google review link.

---

## Step 1: Get Your Google Review Link

Once GBP is verified:

1. Go to [Google Business Profile Manager](https://business.google.com/)
2. Select **Alpine Tax & Consulting**
3. Click **Home** → scroll to **Get more reviews**
4. Copy the short review link (format: `https://g.page/r/...`)
5. Save this — you'll paste it into the TaxDome email template

---

## Step 2: Create a Review Request Email Template in TaxDome

1. Log into TaxDome admin: `https://alpinetax.taxdome.com`
2. Go to **Templates** → **Email templates**
3. Click **+ Create template**
4. Name: `Review Request — Post-Filing`
5. Subject: `Quick favor, {{client_first_name}}? (30 seconds)`
6. Body — paste and customize:

```
Hi {{client_first_name}},

Thank you for trusting Alpine Tax & Consulting with your {{tax_year}} filing. It was a pleasure working with you.

If you had a good experience, would you mind leaving a quick Google review? It takes about 30 seconds and makes a big difference for a small practice like ours.

👉 [Leave a Google Review](YOUR_GOOGLE_REVIEW_LINK_HERE)

If anything wasn't right, I'd love to hear about it directly — just reply to this email.

Thank you,
Vinnie Boettcher
Alpine Tax & Consulting
(720) 915-4051
```

6. Save the template

---

## Step 3: Set Up Automation (Pipeline Trigger)

TaxDome automates emails via **Pipelines**. When a job moves to a "Completed" stage, the review email fires.

1. Go to **Automations** → **Pipelines**
2. Open the pipeline used for tax return preparation (e.g., "Individual Tax Return" or "Tax Preparation")
3. Find or create the **final stage** (e.g., "Completed" or "Filed & Delivered")
4. Click the stage → **Automations** tab
5. Add automation: **Send email**
   - Template: `Review Request — Post-Filing`
   - Delay: **3 days** (gives client time to review their return before asking)
   - Send to: Client
6. Save

### Optional: Follow-Up Reminder

If no review after 7 days:
1. Add a second automation on the same stage
2. Template: Create a shorter follow-up (e.g., "Just a gentle reminder...")
3. Delay: **10 days** (7 days after the first email)
4. Save

---

## Step 4: Test the Flow

1. Create a test client (or use your own account)
2. Move them through the pipeline to the "Completed" stage
3. Verify the email arrives after the configured delay
4. Click the review link to confirm it opens the Google review form

---

## Step 5: Monitor

- **TaxDome**: Check **Automations** → **Email log** to see sent review requests
- **Google**: Check GBP dashboard for new reviews
- **Response templates**: Use the templates in `review-response-templates.md` to respond to all reviews (positive and negative) within 24 hours

---

## Timeline

| Step | When | Who |
|------|------|-----|
| Google review link | After GBP verified (Sprint 3) | Matt |
| Email template | Same day as GBP | Matt/Vinnie (TaxDome admin, 2FA) |
| Pipeline automation | Same session | Matt/Vinnie |
| Test | Immediately after setup | Matt |
| Go live | Next completed engagement | Automatic |

---

## Notes

- TaxDome's built-in email has good deliverability — no need for external email tools
- The 3-day delay is intentional: asking immediately after filing feels transactional; waiting gives the client time to appreciate the work
- If TaxDome doesn't have pipeline automations on your plan tier, you can send review requests manually using the email template (Templates → Email → select template → send to client)
- Keep the Google review link updated in the template if it ever changes
