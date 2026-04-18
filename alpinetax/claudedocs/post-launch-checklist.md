# Alpine Tax — Post-Launch Checklist (ATM-28)

> Completed: 2026-03-10

## Site Audit Results

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | JSON-LD schema (homepage) | ✅ Pass | ProfessionalService, full PostalAddress, pulls from siteConfig |
| 2 | JSON-LD (area pages) | ✅ Pass | Localized per city (11 area pages) |
| 3 | JSON-LD (pricing) | ✅ Pass | Product + Offer objects for each service |
| 4 | Meta tags (OG, Twitter) | ✅ Pass | Set in layout.tsx, per-page overrides |
| 5 | Google Search Console | ✅ Pass | Verification ID in layout.tsx metadata |
| 6 | Sitemap | ✅ Pass | 43 entries, correct priorities/frequencies |
| 7 | robots.txt | ✅ Pass | Allow all, sitemap URL present |
| 8 | /clients noindex | ✅ Pass | `robots: { index: false }` set |
| 9 | Credential language | ✅ Clean | Zero CPA/attorney violations site-wide |
| 10 | Favicons | ✅ Pass | svg, png (16/32), ico, apple-touch-icon |
| 11 | Analytics (GTM) | ✅ Pass | GA4 (G-L2N53TJPJE) + FB Pixel (282429905966327) via GTM |
| 12 | 301 redirects | ✅ Pass | 5 permanent redirects in next.config.mjs |
| 13 | NAP address consistency | ✅ Fixed | Updated site-config.ts to BLDG 1-2000 #1113 (2026-03-10) |
| 14 | NAP email consistency | ✅ Fixed | nap-master.md email → contact@alpinetax.co (2026-03-10) |

## Redirect Inventory (next.config.mjs)

| Old Path | New Path | Type |
|----------|----------|------|
| `/services-%26-fees` | `/pricing` | 301 |
| `/schedule-a-meeting` | `/schedule` | 301 |
| `/m/account` | `/client-portal` | 301 |
| `/m/bookings` | `/schedule` | 301 |
| `/m/create-account` | `/client-portal` | 301 |

## Outstanding Items

- [ ] BrightLocal citation submissions (ATM-38) — pending, not in scope for this checklist
- [x] Google review link — `https://g.page/r/CYoD7jRr4DSwEBM/review` wired into `site-config.ts` (2026-04-17)
- [ ] Resolve duplicate GBP — unmanaged listing `/g/11ltp7mx1t` holds Vinnie's 2 legacy reviews; file merge request with Google Business Profile Support
