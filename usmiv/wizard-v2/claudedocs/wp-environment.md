# usmobileiv.com WordPress Environment Fingerprint

Captured 2026-05-04 at the start of the Wizard of IV migration.

## Hosting + edge

- **Host:** Rocket.net managed WordPress. `www.usmobileiv.com` CNAME → `jf0xjoqh5d.onrocket.site`.
- **CDN/edge:** Cloudflare in front. `wp-login.php` returns Cloudflare Turnstile challenge for any non-browser client; automated curl is blocked there.
- **WP REST API:** open at `/wp-json/`, accepts Application Password Basic auth.

## Theme + builder

- **Active theme:** Bricks 2.3.4 (`stylesheet=bricks`, `template=bricks`)
- Companion plugins: BricksExtras 1.6.9, Bricksfusion 1.3.72, Next Bricks 2.3.1, Automatic.css 3.3.6
- Implication: every published page is rendered by the Bricks builder. Pages created with `content` HTML via REST will render that HTML inside whatever Bricks shell the site applies, but won't have Bricks-styled blocks. Decision (user-confirmed): author one Bricks template, replicate via Bricks API for the 27 Learn More pages.

## Active plugins of interest

| Plugin | Version | Concern |
|---|---|---|
| Wordfence Security | 8.2.0 | May block REST writes; verify after first POST |
| WP Rocket | 3.21.2 | Page caching; will not affect REST or wp-admin; flush after page creation |
| SEOPress + SEOPress PRO | 9.7.4 / 9.7.3 | Used for per-page SEO; meta fields available via REST |
| JetEngine | 3.8.8.2 | Custom post types / dynamic content; check it doesn't claim `/treatments/` |
| MainWP Child | 6.0.10 | Site management plugin; harmless |
| UpdraftPlus | 1.26.3 | Backups; harmless |
| MonsterInsights Pro | 10.1.3 | GA4 tracking |
| Site Kit by Google | 1.177.0 | GSC + GA |
| Admin and Site Enhancements (ASE) Pro | 8.7.2 | UI customization |
| FluentSMTP | 2.2.95 | Outbound email |
| Widgets for Google Reviews | 13.2.9 | Frontend widgets |

## Credentials (in Doppler `prd_usmiv`)

| Key | Purpose |
|---|---|
| `WP_ADMIN_URL` | `https://usmobileiv.com/wp-admin/` |
| `WP_USER` | `matt` (administrator, role includes `bricks_full_access`, `bricks_execute_code`) |
| `WP_PASS` | wp-login password (used only for browser login + App Password generation) |
| `WP_APP_PASSWORD` | REST API Application Password named `claude-code` |
| `RKT_SFTP_HOST` | `172.241.31.227` |
| `RKT_SFTP_USER` | `claude-deploy@usmobileiv.com` |
| `RKT_SFTP_PASS` | (FTPS auth) |
| `RKT_SFTP_PATH` | `/` |
| `RKT_FTP_PROTOCOL` | `FTPS` (NOT SFTP/SSH — files only, no shell, no WP-CLI) |

REST API auth verified working with Application Password (returns `id=7`, role `administrator`).

## Existing page hierarchy (relevant to migration)

- **No `wizard-of-iv` page exists.**
- **`/treatments/` page already exists** (id=891, parent=0, slug=`treatments`, no children).
- **Top-level pages on the site:** home, about, blog, contact, iv-therapy, iv-drips, weight-loss-services, nad, injections, treatments, service-areas, events, partners, recover-faster, winter-wellness, at-home-hydration, thank-you, sitemap, privacy-policy, terms-of-service, disclaimer.
- **None of the 27 catalog treatment IDs** (`hydration`, `myers`, `myersGold`, etc.) collide with existing top-level slugs.
- **No `find-my-treatment` page yet** — clean slug for the wizard embed landing.

## Architecture decision: parent for the 27 Learn More pages

**Use existing `/treatments/` (id=891) as the parent**, NOT a new `/wizard-of-iv/treatments/` hierarchy.

- URLs become `/treatments/<treatment-id>/` (e.g., `/treatments/myers/`, `/treatments/hydration/`).
- Cleaner SEO and shorter URLs.
- One less parent page to create.
- The existing landing-style `/treatments/` page stays untouched as the index/landing.

**This changes the catalog `pageUrl` value format** from the originally-planned `/wizard-of-iv/treatments/<id>/` to **`/treatments/<id>/`**. The plugin's path-prefix detection in `wizard-of-iv.php` matches `^/treatments/[^/]+/?(\?|$)` accordingly.

## Pre-existing wizard state

- KV at `wizard-config.shiny-field-7198.workers.dev/config` has all 27 treatments populated (snapshot saved to `claudedocs/kv-snapshot-pre.json`, 46KB).
- No v1 wizard embedded anywhere on usmobileiv.com (`/wizard-of-iv/treatments/?slug=hydration` returns 404).
- Greenfield migration confirmed.

## Deployment paths available

| Path | Use |
|---|---|
| FTPS (`172.241.31.227:21`) via curl with `--ssl-reqd` | Upload plugin folder to `wp-content/plugins/wizard-of-iv/`. (Note: native curl SNI verification fails against the IP; use `-k` or correct hostname.) |
| WP REST `/wp-json/wp/v2/plugins` POST | Activate plugin via REST after files are present |
| WP REST `/wp-json/wp/v2/pages` POST | Bulk-create the 27 child pages (idempotent script at Step 8) |
| WP REST `/wp-json/wizard-of-iv/v1/config` POST (after Step 6) | Migrate KV → wp_option (Step 5) |

No SSH / no WP-CLI access available. Activation must go through REST or the wp-admin UI.
