# U.S. Mobile Labs -- Website Architecture

Comprehensive architecture plan for the website mockup page. See the Plan agent output for full details.

## Files

| File | Action |
|------|--------|
| `src/pages/USMobileLabs.tsx` | CREATE (~1050 lines) |
| `tailwind.config.js` | EDIT (add usml colors, jakarta font, pulseGlow animation) |
| `src/index.css` | EDIT (add Plus Jakarta Sans to Google Fonts) |
| `src/App.tsx` | EDIT (add route) |
| `vite.config.ts` | EDIT (add to spaRoutes) |

## Color Tokens (usml namespace)

| Token | Hex | Usage |
|-------|-----|-------|
| usml-navy | #1B4D6E | Primary, headers, buttons |
| usml-coral | #E07A5F | CTAs, accents (large text only) |
| usml-sage | #5B8C6F | Health signals, tertiary |
| usml-gold | #D4A574 | Decorative only |
| usml-cream | #F7F5F2 | Section backgrounds |
| usml-dark | #0A1F2E | Dark hero/sections |
| usml-charcoal | #2D2D2D | Body text |

## Route: `/us-mobile-labs`

## Password: `david` (sessionStorage key: `usml-mockup-unlocked`)

## 10 Sections

1. HeroSection -- dark, gradient glow, H1, CTAs, trust bar
2. ProblemSection -- "Skip the Waiting Room", comparison cards
3. ServicesSection -- 3 service cards
4. HowItWorksSection -- 4-step flow with connecting line
5. WhyChooseUsSection -- 6 differentiator cards
6. PricingSection -- 3 tiers on dark bg
7. ServiceAreasSection -- city pills
8. TestimonialsSection -- 3 quotes
9. FAQSection -- 7 accordion items
10. CTASection + FooterSection
