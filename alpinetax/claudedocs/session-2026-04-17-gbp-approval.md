# Session — GBP Approval Follow-Up (2026-04-17)

## What was done

### Verified GBP approval
- Confirmed live via Google search: "You manage this Business Profile" panel visible for Matt's Google account (`1mattcohen@gmail.com`).
- Managed profile: Knowledge Graph ID `/g/11z10fh99t`, CID `0xb034e06b34ee038a`, ludocid `12697020000518407050`.
- Business shows Services, SAB (serves Denver + nearby), phone `(719) 402-1571`, website `alpinetax.co`, hours `9 AM – 5 PM`.
- Profile Strength: "Complete Info" pending; 43 profile views in 2026, 3 customer interactions, 0 reviews.
- Screenshot: `alpinetax/claudedocs/gbp-status-2026-04-17.png`.

### Extracted and wired the real Google review link
- Captured from GBP Manager → "Ask for reviews" → Copy link: `https://g.page/r/CYoD7jRr4DSwEBM/review`.
- Verified via curl: redirects to Google Maps review form for the managed CID.
- Replaced placeholder in `alpinetax/site/src/lib/site-config.ts:71`.
- Both `/reviews` page CTAs (`src/app/reviews/page.tsx` lines 53, 67) now auto-use the real link.

### Deployed to production
- Vercel CLI was outdated (47.0.5), upgraded to latest, then deployed.
- `cd alpinetax/site && npm run build && vercel deploy --prod`.
- Deployment ID: `dpl_5HFjJs7QTJtuViPe3Z7xzU4ia3H6`.
- Verified `curl https://alpinetax.co/reviews` → 200 and both anchors point at `g.page/r/CYoD7jRr4DSwEBM/review`.

### Surfaced a critical duplicate-listing problem
Two separate Alpine Tax & Consulting LLC listings exist on Google, with the same name, phone, and website:

| Attribute | Managed profile | Unmanaged duplicate |
|---|---|---|
| Knowledge Graph ID | `/g/11z10fh99t` | `/g/11ltp7mx1t` |
| CID (hex) | `0xb034e06b34ee038a` | `0x4648ac710f1c1ea2` |
| CID (decimal) | `12697020000518407050` | `5064487382562905762` |
| Address | SAB (Vinnie's home, hidden) | **None** — fallback coords at (46.42, -129.94), Pacific Ocean |
| Reviews | 0 | **2 × 5-star**, both praise Vinnie by name |
| Reviewers | — | Melissa Peterson (1 mo ago); Phillip Ganey (Local Guide, 6 days ago) |
| Who manages | Matt (`1mattcohen@gmail.com`) | Nobody — unclaimed |

The unmanaged listing has no real address and fallback map coordinates, which is a strong "data cluster artifact" signal — should be merge-eligible.

Screenshot of both reviews: `alpinetax/claudedocs/duplicate-gbp-reviews-2026-04-17.png`.

### Attempted claim path — dead-ended
- No "Claim this business" button on the duplicate (Google already detects the overlap with the managed profile).
- Maps "Suggest an edit" dialog has no "This is a duplicate" option anymore. Only options are field edits + "Place is closed or not here" — the latter risks removing the listing AND the 2 reviews.

### Pre-filled GBP Support ticket
- Navigated to `https://support.google.com/business/gethelp`.
- Step 1 filled: business = Alpine Tax & Consulting LLC (Verified), short description = "Remove duplicate listing and preserve its 2 client reviews" (58/100 chars).
- Full case body drafted at `alpinetax/claudedocs/gbp-duplicate-merge-case.md` — paste into Step 3 textarea when user reaches it. Includes both KGMIDs, both CIDs, Pacific-Ocean-coordinates evidence, reviewer names, and three escalating asks (merge → preserve reviews → transfer ownership as fallback).
- **Not yet submitted** — stopped for user review.

### Skipped
- **Linear check**: `1mattcohen@gmail.com` isn't a member of the `atmix` Linear workspace (that's under `matt@atmix.org`). Linear prompted to create a new workspace instead of showing ATM team. Local docs (`post-launch-checklist.md`, `citation-tracker.md`) were authoritative enough for the session.

## What's still pending

1. **Submit the GBP Support ticket** — user needs to click Next through Step 2, paste case body on Step 3, submit. Log the case number in `nap-master.md` change log when received.
2. **TaxDome review-request automation** — `taxdome-review-setup-guide.md` describes the flow. Requires TaxDome admin login + 2FA.
3. **First GBP post** — use opening template from `gbp-posting-templates.md`. Publish from Manager UI → Posts → Add update.
4. **Update Linear manually** (user-side, from `matt@atmix.org`): mark relevant ATM-28 / ATM-38 items reflecting this progress; add a new ticket for "GBP duplicate merge — Google Support case".
5. **GBP hours setting**: profile still shows `9 AM – 5 PM`; March commit `67ec9bc` removed hours from the website. Confirm with Vinnie whether GBP hours should match the website.

## Files changed this session

```
M alpinetax/claudedocs/citation-tracker.md      — marked Phase 1 #1 GBP as Live
M alpinetax/claudedocs/nap-master.md            — recorded review link, added change-log row
M alpinetax/claudedocs/post-launch-checklist.md — checked off review link, added duplicate-GBP item
M alpinetax/site/src/lib/site-config.ts         — replaced placeholder with real review URL
```

New docs and evidence:
```
alpinetax/claudedocs/gbp-status-2026-04-17.png
alpinetax/claudedocs/duplicate-gbp-reviews-2026-04-17.png
alpinetax/claudedocs/gbp-duplicate-merge-case.md
alpinetax/claudedocs/session-2026-04-17-gbp-approval.md   — this file
```
