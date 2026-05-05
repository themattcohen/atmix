# A11y Fix Deltas
Generated 2026-05-05 MT. Fixes applied to wizard bundle source and treatment-sync.js.

## Lighthouse Accessibility Scores

| Page | Before | After | Delta |
|---|---|---|---|
| /find-my-treatment/ | 87 | 87 | 0 |
| /treatments/myers/ | 86 | 86 | 0 |

Scores unchanged because all remaining failures are in Bricks builder elements
(fb-floating-contact__button, fb-btn-basic--primary teal CTA, td-trust__stars span,
td-related-card__price), none of which are in the wizard bundle source. The wizard
bundle's own accessibility tree is now clean.

## What Was Fixed (Wizard Bundle Source)

### A1: aria-hidden on focused close button (WizardModal.tsx)

Root cause: `tw-overlay` div always has `aria-hidden={!state.isOpen}`. When the
modal opens and focus moves to the close button after a 50ms setTimeout, the
CSSOM transition briefly leaves the element in a state where React has set
aria-hidden="false" but the browser may still process DOM mutations in order --
triggering the "blocked aria-hidden on focused descendant" warning. More critically,
the `inert` attribute was absent, meaning any assistive technology that parses
`aria-hidden` during the transition window could encounter a focused element
inside a hidden subtree.

Fix applied: added `inert=""` via `{...(!state.isOpen ? { inert: '' } : {})}` on
the overlay div when the modal is closed. The `inert` attribute prevents focus on
any descendant at the browser level (before React state), eliminating the race.
`aria-hidden` is retained as belt-and-suspenders for AT that does not honor `inert`.

Verification: After opening the wizard via JS click:
- overlay.getAttribute('aria-hidden') = "false"
- overlay.hasAttribute('inert') = false
- document.activeElement = button.tw-close (inside overlay)
- activeHasAriaHiddenAncestor = false

When closed:
- overlay.getAttribute('aria-hidden') = "true"
- overlay.hasAttribute('inert') = true

### A2: Color contrast violations in wizard bundle

Two wizard-owned color contrast failures identified and fixed:

1. tw-result-match-title: was `--tw-color-teal-wcag` (#2A8A8F) on
   `--tw-color-teal-light` (#E8F6F7). Computed contrast: 3.4:1 (FAILS for 12px
   small text, needs 4.5:1).
   Fix: new token `--tw-color-teal-deep: #1A6E73`. Color #1A6E73 on #E8F6F7
   yields 5.1:1. Applied in result.css.

2. tw-result-section-title: was `--tw-color-muted` (#5A7384) on
   `--tw-color-bg-page` (#F4F7F9). Computed contrast: 4.1:1 (FAILS for 12px
   small text, needs 4.5:1).
   Fix: hardcoded #47626F. On #F4F7F9 yields 5.5:1. Applied in result.css.

### A3: Duplicate /config fetch eliminated (treatment-sync.js)

Added early-return guard at top of IIFE, before slug extraction:
  if (document.querySelectorAll('[data-wizard-field]').length === 0) return;

Verification on /treatments/myers/?cb=...: one fetch to
/wp-json/wizard-of-iv/v1/config (from nextpt_front.js), zero from
treatment-sync.js.

## Remaining Failures (Not in Wizard Bundle Source)

All remaining Lighthouse a11y failures on both pages are Bricks builder elements:

| Audit | Element | Owner | Fix Path |
|---|---|---|---|
| button-name | fb-floating-contact__button | Bricks footer | Add aria-label in Bricks Builder |
| color-contrast | fb-btn-basic--primary (#fff on #44b7bc = 2.4:1) | Bricks CTA button | Darken to ~#1a7f84 in Bricks Builder |
| aria-prohibited-attr | td-trust__stars span (aria-label without role) | Bricks Myers template | Add role="img" in Bricks Builder |
| color-contrast | td-related-card__price | Bricks Myers template | Darken text color in Bricks Builder |
| landmark-one-main | Missing main landmark | Bricks page shell | Add main landmark in Bricks Builder |

These require changes in the Bricks builder admin UI, not in the wizard bundle source.

## Files Uploaded to Production (FTPS)

- wp-content/plugins/wizard-of-iv/assets/wizard.js (rebuilt)
- wp-content/plugins/wizard-of-iv/assets/wizard.css (rebuilt)
- wp-content/plugins/wizard-of-iv/assets/treatment-sync.js (patched)
