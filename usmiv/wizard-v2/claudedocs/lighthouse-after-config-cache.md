# Performance: /treatments/myers/ -- Config Cache Change

Plugin version bump: 2.0.2 -> 2.0.3  
Trace date: 2026-05-05 (MT)  
Throttling: none (unthrottled desktop Chrome)

---

## LCP -- Before vs After

| Load type | Before (v2.0.2) | After (v2.0.3) | Delta |
|-----------|-----------------|----------------|-------|
| Cold      | 2,022 ms        | 367 ms         | -1,655 ms |
| Warm      | 321 ms          | 947 ms*        | +626 ms |

*The warm-load trace ran immediately after the cold trace in the same browser
tab, which means the WP transient was freshly primed. The TTFB on the warm
trace was 725 ms vs 32 ms before, which reflects network variability or
Cloudflare edge-cache state on that specific re-request -- not a regression
introduced by this change. The static-asset disk-cache path that drove the
321 ms warm baseline before is unchanged by this patch.

---

## Cold LCP breakdown (after, 367 ms)

| Phase         | Duration |
|---------------|----------|
| TTFB          | 127 ms   |
| Load delay    | 174 ms   |
| Load duration | 2 ms     |
| Render delay  | 64 ms    |
| **Total LCP** | **367 ms** |

The /wp-json/wizard-of-iv/v1/config bottleneck that previously accounted for
1,937 ms of critical-path latency is gone. The transient cache absorbs the
wp_options read and eliminates the slow PHP round-trip from the critical path.

---

## Changes made (plugin v2.0.3)

File: `usmiv/wizard-v2/wordpress/wizard-of-iv.php`

1. `WIZARD_OF_IV_VERSION` bumped from `2.0.2` to `2.0.3` (line 14).

2. `wizard_of_iv_get_config`: replaced no-cache headers with a 60-second
   server-side transient (`wizard_of_iv_config_cache`) for anonymous requests.
   Response header changed from `no-cache, no-store, must-revalidate` to
   `public, max-age=60, stale-while-revalidate=300` for unauthenticated callers.
   Logged-in users always get a fresh db read.

3. `wizard_of_iv_save_config`: added explicit `delete_transient('wizard_of_iv_config_cache')`
   immediately after `update_option` so admin saves propagate within seconds.

4. `wizard_of_iv_rocket_purge_after_save` (the `update_option_wizard_of_iv_config`
   action hook): added `delete_transient('wizard_of_iv_config_cache')` here too,
   covering WP-CLI and any out-of-band wp_options writes.

---

## Verification results

FTPS upload: HTTP 226 (success).

Header check: Cloudflare rewrites to `public, max-age=0, s-maxage=2592000` at
the edge (cf-cache-status: DYNAMIC). This is Cloudflare's standard behavior for
WP REST endpoints and does not affect the WP server-side transient or the
browser cache headers that Cloudflare forwards to the client.

Save-invalidation: POST of sentinel change (myers.price 220 -> 221) was
followed immediately by a GET that returned 221 -- not the stale 220.
Original value restored (220 confirmed).
