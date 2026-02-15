# FBAR Direct - Landing Page Redesign Spec

**Date**: 2026-02-15
**Status**: Approved for implementation
**Direction**: Near-governmental authority, full content rethink

---

## Design Rationale

The current landing page reads like a modern SaaS startup (navy + gold, Inter font, flashy CTAs, competitor comparison table). The target audience is individual expat filers who need to trust this service with their SSN, foreign account numbers, and financial data. Governmental design language signals institutional authority and trustworthiness.

**Reference sites**: IRS.gov, FinCEN.gov, BSA E-Filing portal
**Anti-reference**: Modern SaaS landing pages, fintech startups

---

## Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `gov-blue` | `#1a4480` | Primary - buttons, headings, nav |
| `gov-blue-dark` | `#0b2d5b` | Secondary - footer, hover states |
| `gov-blue-light` | `#2e6bb0` | Links, interactive elements |
| `text-primary` | `#1b1b1b` | Body text |
| `text-secondary` | `#5c5c5c` | Secondary text, descriptions |
| `bg-white` | `#ffffff` | Primary backgrounds |
| `bg-gray` | `#f0f0f0` | Alternating section backgrounds |
| `bg-light` | `#f5f7fa` | Hero, subtle backgrounds |
| `border` | `#d9d9d9` | Section dividers, card borders |
| `alert-bg` | `#fef3cd` | Warning/notice backgrounds |
| `alert-border` | `#b58b00` | Warning left-border accent |
| `trust-green` | `#2e7d32` | Security icons, checkmarks |

**Removed**: All gold (`gold-500`, `gold-600`), all `navy-*` custom tokens.

---

## Typography

| Element | Font | Weight | Size | Notes |
|---------|------|--------|------|-------|
| H1 | Merriweather (serif) | 700 | 32px | Governmental authority signal |
| H2 | Merriweather (serif) | 700 | 26px | Section headings |
| H3 | Merriweather (serif) | 700 | 20px | Sub-headings |
| Body | Source Sans Pro / system sans | 400 | 16px | Line-height 1.65 |
| Nav links | System sans-serif | 400 | 15px | No decoration, underline on hover |
| Small text | System sans-serif | 400 | 13px | Disclaimers, citations |
| Buttons | System sans-serif | 600 | 16px | Uppercase not used |

**Key change**: Inter (sans-serif) replaced with Merriweather (serif) for all headings. This is the single biggest psychological shift from "startup" to "institution."

---

## Component Design Rules

- **Border radius**: 0px or 2px max. No rounded corners.
- **Shadows**: None. Use 1px borders instead.
- **Buttons**: Square, navy bg, white text. No gold, no pills.
- **Icons**: Line-style shields and locks only. No colorful filled icons.
- **Cards**: White bg, 1px gray border, no shadow, no rounded corners.
- **Notice boxes**: Pale yellow bg (#fef3cd), 2px left border in gold (#b58b00).
- **Section dividers**: 1px solid #d9d9d9, not background color blocks.
- **Max content width**: 960px (narrower = more document-like).

---

## Information Architecture

### Current (SaaS startup)
1. Hero ("File Your FBAR in 10 Minutes")
2. TrustBar
3. HowItWorks
4. WhoNeedsToFile
5. PricingComparison (attacks competitors)
6. FAQ
7. CTAFooter

### New (governmental authority)
1. **DeadlineBanner** (NEW - sticky top alert)
2. **Header/Nav** (redesigned - institutional)
3. **Hero** (rewritten - official title-first)
4. **TrustBar** (restyled - security notice feel)
5. **WhoNeedsToFile** (MOVED UP - lead with substance)
6. **WhatYouNeed** (NEW - filing requirements)
7. **HowItWorks** (restyled - understated steps)
8. **Pricing** (rewritten - single box, no comparison)
9. **FAQ** (restyled - accordion with thin borders)
10. **Footer** (redesigned - regulatory disclaimers + resource links)

---

## Section Specifications

### 1. DeadlineBanner (NEW)
- Sticky top, full-width
- Background: `#fef3cd`, 2px left border `#b58b00`
- Text: "FBAR Filing Deadline: April 15, 2026 -- Automatic extension to October 15, 2026"
- Dismiss "x" button on right
- Stays until dismissed (localStorage)

### 2. Header / Navigation
- White background, thin gray bottom border
- Left: "FBAR Direct" in Merriweather serif, 20px, navy
- Sub-text (12px, gray): "FinCEN-Registered BSA E-Filing Institution"
- Right nav: "Who Must File" | "How to File" | "Pricing" | "FAQ" | "Log In"
- Far right: "Begin Filing" button (navy, square)
- Nav links: plain text, navy, underline on hover only

### 3. Hero
- White or `#f5f7fa` background, NO image/gradient
- H1 (serif, 32px): "Report of Foreign Bank and Financial Accounts"
- Subtitle (sans, 18px, gray): "FinCEN Form 114 | Secure Electronic Filing Service"
- Paragraph (16px, max-w 640px): "File your FBAR electronically through our FinCEN-registered BSA E-Filing system. Your data is encrypted end-to-end and submitted directly to FinCEN."
- Button: "Begin Filing" (navy, square)
- Sub-button text: "No account required to check if you need to file."

### 4. TrustBar
- Light gray bg, top/bottom 1px borders
- Three items centered: Shield + "FinCEN-Registered BSA E-Filer" | Lock + "256-bit SSL Encryption" | Shield + "Direct FinCEN Submission"
- Dark green icons, navy text, 14px, font-weight 600

### 5. WhoNeedsToFile
- White background
- H2: "Who must file an FBAR?"
- Opening paragraph, then styled requirement list with left-border callout boxes
- Notice box (penalty warning) in pale yellow with regulatory citation (31 USC 5321)
- "United States person" definition section

### 6. WhatYouNeed (NEW)
- Light gray background
- H2: "What you will need to file"
- Two-column grid: personal info, account details, max values, account types
- Bottom note: "You do not need to upload bank statements."

### 7. HowItWorks
- White background
- H2: "How to file with FBAR Direct"
- Three steps in clean grid, plain navy numbers (no colored circles)
- Step 1: Enter your information (5-10 min)
- Step 2: Review and sign (Form 114a)
- Step 3: We submit to FinCEN (BSA tracking ID)

### 8. Pricing
- Light gray background
- H2: "Filing fee"
- Single centered box: white bg, thin gray border, no shadow
- "$59" large, "per filing" subtitle, three plain features, button
- NO comparison table, NO competitor mentions
- Sub-box note: "Covers one FinCEN Form 114 for one calendar year."

### 9. FAQ
- White background
- H2: "Frequently asked questions"
- Accordion with thin borders, plus/minus toggle
- 6 questions covering: what is FBAR, deadline, government affiliation, data protection, previous years, rejection handling

### 10. Footer
- Navy (#0b2d5b) background
- Three columns: brand info, site links, external resources (FinCEN.gov, IRS, BSA E-Filing)
- Regulatory disclaimer in 13px
- Copyright line

---

## File Mapping

| Component | File | Status |
|-----------|------|--------|
| DeadlineBanner | `src/components/landing/DeadlineBanner.tsx` | NEW |
| WhatYouNeed | `src/components/landing/WhatYouNeed.tsx` | NEW |
| Hero | `src/components/landing/Hero.tsx` | REWRITE |
| TrustBar | `src/components/landing/TrustBar.tsx` | REWRITE |
| HowItWorks | `src/components/landing/HowItWorks.tsx` | REWRITE |
| WhoNeedsToFile | `src/components/landing/WhoNeedsToFile.tsx` | REWRITE |
| PricingComparison | `src/components/landing/PricingComparison.tsx` | REWRITE (rename to Pricing) |
| FAQ | `src/components/landing/FAQ.tsx` | REWRITE |
| CTAFooter | `src/components/landing/CTAFooter.tsx` | REMOVE (footer moves to layout) |
| Page | `src/app/(marketing)/page.tsx` | REWRITE (new section order) |
| Layout | `src/app/(marketing)/layout.tsx` | REWRITE (new header/footer) |
| Root Layout | `src/app/layout.tsx` | UPDATE (fonts) |
| Tailwind Config | `tailwind.config.ts` | UPDATE (colors) |
| Global CSS | `src/app/globals.css` | UPDATE (if needed) |
