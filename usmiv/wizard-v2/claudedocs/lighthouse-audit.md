# Lighthouse Audit
Generated 2026-05-05. Target environment: production usmobileiv.com.

Tool note: `mcp__chrome-devtools__lighthouse_audit` is available but excludes
the Performance category (by design -- the tool's own description says
"this excludes performance"). Performance scores and Core Web Vitals are from
`performance_start_trace` + `performance_analyze_insight` runs. Accessibility,
SEO, and Best Practices scores are from the Lighthouse snapshot. No simulated
throttling was applied (unthrottled desktop Chrome); real-user field data is
absent from CrUX for both pages, so all metrics are lab values.

---

## /find-my-treatment/

### Scores (Lighthouse snapshot, desktop, unthrottled)
| Category | Cold load | Warm load |
|---|---|---|
| Performance | n/a (perf excluded from tool) | n/a |
| Accessibility | 87 / 100 | 87 / 100 |
| SEO | 100 / 100 | 100 / 100 |
| Best Practices | 100 / 100 | 100 / 100 |

### Core Web Vitals (performance trace, unthrottled desktop)
| Metric | Cold | Warm | Threshold |
|---|---|---|---|
| LCP | 233 ms | 200 ms | good < 2,500 ms |
| CLS | 0.01 | 0.01 | good < 0.10 |
| INP / FID | not captured in trace | -- | good < 200 ms |
| TTFB | 22 ms | 26 ms | good < 800 ms |

All Core Web Vitals pass the "good" threshold on desktop unthrottled. The LCP
element is an H1 text node (no image fetch required), which is why it lands
at 233 ms cold even with ~60 render-blocking JS files in the waterfall.

### LCP breakdown (cold)
- TTFB: 22 ms (9%)
- Element render delay: 212 ms (91%) -- blocked by the render-blocking JS/CSS
  waterfall resolving before first paint

### Accessibility failures (4 failing audits)
1. `button-name` (score 0) -- one or more buttons have no accessible name.
2. `color-contrast` (score 0) -- failing element not identified in snapshot
   (wizard embed likely; the same audit fails on Myers with a known teal
   CTA button).
3. `landmark-one-main` (score 0) -- no `<main>` landmark in the page HTML.
   WP Rocket excludes and delays the wizard embed, so the rendered DOM at
   snapshot time may lack sufficient landmark structure.
4. `agent-accessibility-tree` (score 0) -- cascades from the two above.

### Top opportunities (find-my-treatment)

1. Third-party script payload: 4.0 MB transferred across GTM (2.4 MB),
   Facebook pixel (831.6 kB), Google Ads (722.9 kB), Clarity (75.6 kB).
   Main-thread cost: GTM 206 ms, Facebook 99 ms, Ads 53 ms, Clarity 42 ms.
   Est. savings: deferring FB + Ads until after interactive would recover
   ~150 ms main-thread time and remove 1.5 MB from the critical network window.

2. Render-blocking asset count: 62 resources (23 JS, 39 CSS) from the
   NextBricks plugin are loaded synchronously before first paint. All have
   max-age=31536000 cache headers so they are fast on repeat visits, but
   they block paint on cold loads by forcing the browser to parse them in
   sequence. The NextBricks element scripts (bc_bubbles, bc_typed, bc_drawer,
   etc.) are not used on this page -- only the wizard embed is here. Est.
   savings: removing or conditionally deferring unused NextBricks element
   scripts would reduce render-blocking by ~18 files and ~50-70 ms of
   main-thread parse time.

3. Forced reflow from Bricks + NextBricks: `eachElement` in
   `bricks.min.js:0:167341` caused 29 ms of synchronous forced reflow.
   `bc_scrolltrigger.min.js` (`enable`, `Yb`, `_getBounds`) contributed a
   further ~2 ms. Total forced-reflow budget: 30 ms cold. This is a Bricks
   theme issue; mitigation is to batch DOM reads before writes.

---

## /treatments/myers/

### Scores (Lighthouse snapshot, desktop, unthrottled)
| Category | Cold load | Warm load |
|---|---|---|
| Performance | n/a (perf excluded from tool) | n/a |
| Accessibility | 86 / 100 | 86 / 100 |
| SEO | 100 / 100 | 100 / 100 |
| Best Practices | 100 / 100 | 100 / 100 |

### Core Web Vitals (performance trace, unthrottled desktop)
| Metric | Cold | Warm | Threshold |
|---|---|---|---|
| LCP | 2,022 ms | 321 ms | good < 2,500 ms |
| CLS | 0.00 | 0.00 | good < 0.10 |
| INP / FID | not captured | -- | good < 200 ms |
| TTFB | 29 ms | 32 ms | good < 800 ms |

**The cold LCP of 2,022 ms is the single most critical finding across both
pages.** It is 19 ms under the "needs improvement" boundary (2,500 ms) in the
lab, but that is unthrottled desktop. On a throttled mobile connection it will
cross 2,500 ms. It passes "good" only on warm loads (321 ms).

The LCP element is a `<p class="td-why__text">` text node -- again, no image
involved. The entire 1,993 ms render delay is caused by the browser waiting
for JavaScript that holds up the DOM before that element can be painted.

### LCP breakdown (cold)
- TTFB: 29 ms (1%)
- Element render delay: 1,993 ms (99%) -- driven by the critical path chain

### Critical path chain (cold, from NetworkDependencyTree insight)
Max critical path latency: **1,937 ms**

Chain:
```
HTML document (48 ms)
  nextpt_front.js (184 ms)
    /wp-json/wizard-of-iv/v1/config  <-- 1,937 ms  <-- BOTTLENECK
    treatments-detail.json (364 ms)
  treatment-sync.js (168 ms)
    /wp-json/wizard-of-iv/v1/config  <-- 1,111 ms  <-- duplicate fetch
```

Both `nextpt_front.js` (NextBricks) and `treatment-sync.js` (wizard plugin)
independently fetch `/wp-json/wizard-of-iv/v1/config` on page load. The config
REST endpoint responds with `Cache-Control: no-cache, no-store, must-revalidate`
(set at line 550 of `wizard-of-iv.php`). This means every cold page load issues
two uncacheable REST round-trips to the WP REST API. The slowest one (1,937 ms)
sits entirely on the critical path that gates the LCP element paint.

On warm loads the browser cache does not help because the headers forbid it.
The warm LCP improves to 321 ms only because the static assets (fonts, CSS, JS)
are served from the browser disk cache.

### Accessibility failures (4 failing audits)
1. `aria-prohibited-attr` (score 0) -- `<span class="td-trust__stars"
   aria-label="5.0 out of 5 stars">` uses `aria-label` on a `<span>` with no
   valid role. The span is in the trust section on the Myers page template.
   Fix: add `role="img"` to the stars span, or convert to a proper `<img>` with
   `alt`.
2. `button-name` (score 0) -- `<button class="fb-floating-contact__button">` in
   the Bricks footer has no accessible name. The button has `aria-haspopup` and
   `aria-expanded` but no `aria-label`. Fix: add `aria-label="Contact us"` (or
   equivalent) to that Bricks element in the builder.
3. `color-contrast` (score 0) -- two failures:
   - CTA button in nav: `#ffffff` text on `#44b7bc` background, contrast 2.4:1
     (needs 4.5:1 for normal text). Fix: darken the teal to approximately
     `#1a7f84` to achieve 4.5:1.
   - Related card price text: `#2a8a8f` on `#ffffff` at 14px bold, contrast
     4.09:1 (needs 4.5:1). Fix: darken the price color to `#1e7a7f` or
     increase font weight/size.
4. `agent-accessibility-tree` (score 0) -- cascades from audits 1 and 2.

### Top opportunities (myers)

1. `/wp-json/wizard-of-iv/v1/config` critical-path fetch -- est. savings ~1,700 ms LCP.
   The `wizard_of_iv_get_config` handler (`wizard-of-iv.php` line 549) forces
   `no-cache` headers. This makes sense for the admin editor but not for
   anonymous front-end reads. The fix is a short-lived transient (60 seconds)
   on the GET handler, combined with a `Cache-Control: public, max-age=60,
   stale-while-revalidate=300` response header for unauthenticated requests.
   Additionally, `treatment-sync.js` should only fetch the config if the page
   actually contains `[data-wizard-field]` elements, avoiding the fetch on pages
   where no fields are present (the fetch happens unconditionally today --
   line 30 of `treatment-sync.js`).

2. Third-party payload identical to /find-my-treatment/: GTM 2.4 MB, Facebook
   831.6 kB, Google Ads 727.2 kB, Clarity 75.8 kB. Main-thread cost: GTM
   199 ms, FB 78 ms, Ads 68 ms, Clarity 44 ms. On Myers, Google Fonts are also
   loaded (102.1 kB) despite locally hosted OpenSans and Montserrat woff2 files
   being present. This double-loads fonts. Est. savings: removing the Google
   Fonts request (`fonts.googleapis.com/css2?family=Montserrat...`) and relying
   solely on the self-hosted woff2 files already in
   `wp-content/uploads/` would save ~100 kB and one extra DNS lookup.

3. Preconnect to `scripts.clarity.ms`: the network tree shows Clarity JS loads
   without a preconnect hint. Adding `<link rel="preconnect"
   href="https://www.clarity.ms">` would save 139 ms. This is the one
   preconnect candidate flagged by the tool (fonts.googleapis.com and
   fonts.gstatic.com are already preconnected).

---

## Recommended punch list (ranked by impact)

- [ ] **Add server-side transient + public Cache-Control to the /config REST
  endpoint for unauthenticated GET requests.** (est: ~1,700 ms LCP improvement
  on Myers cold load, ~1,100 ms on warm-cold transition). Change in
  `usmiv/wizard-v2/wordpress/wizard-of-iv.php` function
  `wizard_of_iv_get_config` around line 549. Add `get_transient` / `set_transient`
  with a 60s TTL, and replace `no-cache` headers with
  `Cache-Control: public, max-age=60, stale-while-revalidate=300` for
  non-authenticated callers. Do not cache for logged-in users
  (`is_user_logged_in()` guard).

- [ ] **Guard the treatment-sync.js config fetch against pages with no
  data-wizard-field elements.** (est: eliminates one of the two /config fetches
  on every Myers load). In `usmiv/wizard-v2/wordpress/treatment-sync.js`, move
  the `fetch(configUrl...)` call inside a check:
  `if (!document.querySelector('[data-wizard-field]')) return;` before line 30.
  This removes the redundant fetch on pages where NextBricks is already fetching
  the config via another path.

- [ ] **Defer or conditionally load GTM-driven Facebook and Google Ads tags
  until after user interaction or a 3-second delay.** (est: ~150 ms
  main-thread, 1.5 MB network on cold load). This is a GTM configuration
  change, not a code change. In GTM: add a custom trigger that fires on
  `Window Loaded` or `Timer (3000 ms)` instead of `All Pages` for the Facebook
  pixel and Google Ads global site tag. WP Rocket's "Delay JS" feature cannot
  do this for GTM-injected tags -- it must be done in GTM itself.

- [ ] **Remove the Google Fonts stylesheet on treatment pages** (only on Myers;
  verify other treatment pages). Self-hosted woff2 files for Montserrat and
  OpenSans are already in `wp-content/uploads/`. The `fonts.googleapis.com`
  request is redundant and adds a cross-origin round-trip. Remove the Google
  Fonts preconnect and the `@import` or `<link>` that loads from
  `fonts.googleapis.com`. This is a Bricks builder change (user must do this in
  Bricks Builder, Settings > Custom Code, or in the Myers template directly).

- [ ] **Add `aria-label="Contact us"` to the floating contact button in the
  Bricks footer.** (Accessibility, both pages). The button is
  `<button class="fb-floating-contact__button">` in the Bricks footer block.
  User must do this in Bricks Builder: select the floating button element,
  add Aria Label = "Contact us" (or similar) in the element's Attributes panel.

- [ ] **Fix `<span class="td-trust__stars">` to add `role="img"`.** (Accessibility,
  Myers). The stars span uses `aria-label` without a valid role. In Bricks
  Builder, add a custom attribute `role="img"` to the stars span element on the
  Myers (and all treatment) page templates.

- [ ] **Darken the `#44b7bc` teal on the "BOOK TODAY" CTA button to ~`#1a7f84`.**
  (Accessibility, Myers + likely all pages). Contrast 2.4:1 fails WCAG AA.
  User must do this in Bricks Builder: update the button background color in
  the global style or that specific button element.

- [ ] **Add `<link rel="preconnect" href="https://www.clarity.ms">` to the
  `<head>`.** (est: 139 ms savings on both pages). Add via WP Rocket Settings >
  Preload > Prefetch DNS Requests, or via the Bricks Builder site-wide `<head>`
  code block.

- [ ] **Audit NextBricks element JS files loaded on /find-my-treatment/.** The
  page loads 18 NextBricks element scripts (bc_typed, bc_drawer, bc_bubbles,
  bc_morphing_menu, etc.) that appear unused on the wizard landing page. If
  NextBricks has a per-page asset loading option, enable it. Otherwise, disable
  unused NextBricks elements globally to reduce the render-blocking file count
  by ~15 files. This is a NextBricks plugin setting (user must configure in
  NextBricks plugin settings panel).
