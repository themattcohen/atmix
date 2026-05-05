# WordPress MCP Tooling Recommendation
**Scope:** usmobileiv.com (Rocket.net managed WP, Cloudflare, Bricks builder)
**Date:** 2026-05-04

---

## What We Used During the Migration

### What Worked

- **WP Application Passwords + curl**: Reliable for REST CRUD (pages, posts, media). Low friction once credentials are in Doppler. Bespoke but transparent.
- **FTPS**: Uploaded plugin zip files directly to the server. Required per-session setup and path knowledge.
- **chrome-devtools MCP**: Handled anything that required the WP admin UI (Bricks builder edits, JetEngine field config, plugin activation). Irreplaceable for UI-only operations.
- **REST API for bulk operations**: Looping page creation, setting custom fields, publishing pages in batches. This is fast and scriptable.

### What Was Painful

- Every curl command required manually constructing the right endpoint path, field names, and auth header. No tool discovery.
- Media uploads via REST are verbose. Required multipart form encoding.
- No structured way to inspect what REST fields SEOPress or JetEngine exposed without reading docs separately.
- No schema/AEO tooling. Schema markup and FAQ blocks were all done manually through the WP admin.
- No draft-to-publish workflow automation. Each post/page transition was a separate curl call.

---

## WordPress MCP Servers Surveyed

| Name | Repo | Last Commit | Tools | Auth | Install | Verdict |
|------|------|-------------|-------|------|---------|---------|
| mcp-wordpress (docdyhr) | github.com/docdyhr/mcp-wordpress | 2026-05-04 (v3.3.1, active) | 71 (posts, pages, media, users, comments, cats/tags, site settings, SEO toolkit, perf monitoring, auth mgmt) | Application Password (recommended), JWT, Basic, API Key | `npm install -g mcp-wordpress` then node wrapper (Windows ESM bug in .cmd) | **SELECTED. Most maintained, most tools, Application Password native, Windows confirmed.** |
| WordPress/mcp-adapter (official Automattic) | github.com/WordPress/mcp-adapter | 2026-04-15 (v0.5.0) | 3 default (discover-abilities, get-ability-info, execute-ability) + custom abilities if plugins expose them | WP user session or Application Password (HTTP transport) | Composer plugin installed on the WP site; requires WP 6.8+ | Not viable yet. Requires server-side plugin install (need hosting access), only 3 default tools, WP 6.9 needed for Abilities API in core. Architecture is right long-term but immature. |
| Automattic/wordpress-mcp | github.com/Automattic/wordpress-mcp | Archived 2026-01-19 | Unknown | Unknown | N/A | Dead. Superseded by mcp-adapter. |
| mcp-wp/mcp-server | github.com/mcp-wp/mcp-server | Archived 2025-12-07 | Unknown (PHP plugin, Streamable HTTP) | Unknown | WP-CLI install | Dead. Archived. No tests, transport incomplete at archival. |
| InstaWP/mcp-wp | github.com/InstaWP/mcp-wp | Active (43 commits) | 40+ (unified content types, taxonomies, media, users, comments, plugins, SQL query) | Application Password | `npx @instawp/mcp-wp` | Viable backup. Multi-site support good. Fewer tools than docdyhr. SQL query tool is interesting but a security risk on shared hosting. |
| claudeus-wp-mcp | github.com/deus-h/claudeus-wp-mcp | 32 commits (maintenance unclear) | 145 (includes Full Site Editing, Astra Pro, WooCommerce, menus) | Application Password / JWT | `npm install -g claudeus-wp-mcp` | Not selected. 32 commits, low star count (137), unclear long-term maintenance. Tool count is bloated by FSE/Astra-specific tools not applicable to Bricks. |
| rnaga/wp-mcp | github.com/rnaga/wp-mcp | 13 commits | Posts, comments, users, terms, metadata, settings, options | Application Password + OAuth2 | `npx @rnaga/wp-mcp` | Not selected. 8 stars, 13 commits. Too new, unproven. |
| jpollock/wordpress-mcp | github.com/jpollock/wordpress-mcp | Unknown | Unknown | Unknown | Unknown | Not investigated. No meaningful signal in search results. |

### Why mcp-wordpress (docdyhr) wins

- Actively maintained: daily commits, released v3.3.1 on 2026-05-04 (same day as this survey).
- 71 tools covering every REST endpoint we used manually during migration, plus an SEO toolkit (wp_seo_analyze_content, wp_seo_generate_metadata, wp_seo_bulk_update_metadata, wp_seo_generate_schema, wp_seo_validate_schema, wp_seo_suggest_internal_links, wp_seo_site_audit, wp_seo_track_serp, wp_seo_keyword_research).
- Media upload via wp_upload_media (multipart handled internally).
- Application Password auth, exactly what we already have.
- Confirmed working on Windows Node 22 after wrapper fix (see below).
- The npm package's `.cmd` wrapper has a Windows ESM path bug; the fix is a one-line wrapper calling `node` directly with a `file://` URL. Already implemented.

---

## AEO and Content Tooling Surveyed

| Tool | Type | AEO Relevance | Programmatic API? | Notes |
|------|------|---------------|-------------------|-------|
| SEOPress PRO (already installed) | WP plugin | High. Supports FAQ schema, Article schema, breadcrumbs, JSON-LD. Has AI content tools (Claude Sonnet 4 supported as model choice). | Partial. REST API enhanced in v8.8. Meta fields writable via custom post meta endpoints. No dedicated AEO REST endpoint. | Already installed. Use wp_seo_generate_metadata from mcp-wordpress to push SEO title/desc. For JSON-LD schema, write to post meta via wp_update_post with meta fields. SEOPress stores most settings in `_seopress_analysis` and `_seopress_titles` post meta keys. |
| RankMath | WP plugin | High. llms.txt support added 2026. AI search traffic tracker. REST API for metadata via community plugin (Devora-AS/rank-math-api-manager). | Yes, via separate plugin. | Not installed on usmobileiv.com. Would need to replace or run alongside SEOPress. Overkill given SEOPress PRO is already paid. |
| Schema Pro | WP plugin | High. Dedicated schema markup UI for 35+ schema types. | UI-only. No REST API. | Not programmatic. Rules it out for Claude Code workflows. |
| Yoast SEO | WP plugin | Medium. Standard schema support. | REST API via `yoast_head_json` field on WP REST responses. Read-only via standard REST. | Not installed. Not relevant given SEOPress PRO. |
| AnswerSEO (wordpress.org/plugins/answer-engine-optimization-aeo-audit) | WP plugin (free) | Direct. Generates llms.txt, AEO audit, Allow-AI/Disallow-AI rules. | Unknown (not tested). | Worth installing on usmobileiv.com for the llms.txt auto-generation. No REST API exposure found. |
| WEO LLMs AI Crawler Guide | WP plugin | Direct. Auto-generates clean categorized llms.txt for AI crawlers. | Unknown. | Alternative to AnswerSEO for llms.txt. |
| AIOMatic / Aimogen | WP plugin (CodeCanyon) | Low. Bulk AI post creation, not schema/AEO. | UI-driven. No REST API. | Not applicable for Claude Code workflows. Claude Code is already a better content engine. |
| AI Engine (meowapps) | WP plugin | Low-medium. AI chatbot + content generation. Has an API. | Yes, has a REST-accessible AI endpoint. | Interesting for adding AI chat to the site, not for our editorial workflow. |
| claude-seo (AgriciDaniel) | Claude Code skill | High. 19 sub-skills, schema detection, JSON-LD generation, AEO/GEO, DataForSEO MCP, Firecrawl MCP. | Native Claude Code. | Relevant for future SEO audit work. Install as a Claude Code skill, not a WP plugin. |

### AEO workflow conclusion

The right approach for usmobileiv.com is:

1. Use mcp-wordpress `wp_seo_generate_schema` and `wp_seo_bulk_update_metadata` to push structured data programmatically.
2. SEOPress PRO already handles JSON-LD rendering; write the schema data via post meta using `wp_update_post` with `meta` field.
3. Install AnswerSEO plugin on the WP site for automatic llms.txt generation (this is a WP-admin one-time install, not a Claude Code task).
4. For content audits and AEO scoring, use the claude-seo skill or a direct DataForSEO MCP setup.

---

## The Recommendation: What to Install Today

### Already done in this session

**mcp-wordpress v3.3.1** installed globally:
```
npm install -g mcp-wordpress
```

**Windows ESM wrapper** created at `~/.claude/hooks/wp-mcp-usmiv.sh`. This bypasses the broken `.cmd` wrapper by calling `node` directly with a `file://` URL and pulling credentials from Doppler at startup.

**Claude Code MCP entry** added to `~/.claude/settings.json`:
```json
"wordpress-usmiv": {
  "command": "bash",
  "args": ["C:/Users/1matt/.claude/hooks/wp-mcp-usmiv.sh"]
}
```

Credentials flow: Doppler (`prd_usmiv`) -> `WP_USER` + `WP_APP_PASSWORD` + `WP_ADMIN_URL` -> remapped to `WORDPRESS_USERNAME` / `WORDPRESS_APP_PASSWORD` / `WORDPRESS_SITE_URL` inside the wrapper.

**Verified working in this session:**
- Server initializes: mcp-wordpress 3.3.1 responds to MCP protocol.
- `wp_get_page` id=11335 (Hydration IV): returned title, status, and link correctly.
- `wp_create_post` draft titled "MCP test draft": created with id=11428, status=draft.
- `wp_delete_post` id=11428 force=true: permanently deleted.

### What still needs doing (one-time, low effort)

- **Install AnswerSEO plugin on usmobileiv.com** for llms.txt auto-generation. One WP admin click.
- **Verify SEOPress post meta key names** (`_seopress_titles_title`, `_seopress_titles_desc`, `_seopress_social_fb_title`, etc.) so the `wp_update_post` meta write path is confirmed before bulk use. Test on one post first.
- **Add a second MCP entry for any other WP site** when needed. The pattern is: copy the wrapper script, change the Doppler config name, add a new `mcpServers` entry.

### What to NOT install

- **WordPress/mcp-adapter**: Requires a PHP plugin on the server, WP 6.9, and only exposes 3 default tools. Not worth it given mcp-wordpress covers the same ground via REST.
- **claudeus-wp-mcp**: Too many FSE/Astra tools irrelevant to Bricks. Maintenance unclear.
- **Any AI-content WordPress plugin** (AIOMatic, BotWriter, etc.): Claude Code is already doing this work better. Adding a WP plugin that calls a separate AI model introduces cost duplication and lock-in.

---

## What Max Should Install

Max needs the same mcp-wordpress setup but configured for whatever WP site he is targeting. Checklist:

**Prerequisites**
- [ ] Node.js 18+ installed (`node --version`)
- [ ] npm 9+ installed (`npm --version`)
- [ ] Doppler CLI installed and authenticated (`doppler --version`, `doppler login`)
- [ ] Access to the Doppler `atmix` project and the relevant config (e.g., `prd_usmiv`)

**Install mcp-wordpress**
- [ ] Run: `npm install -g mcp-wordpress`
- [ ] Confirm the global package exists: `ls $(npm root -g)/mcp-wordpress/dist/index.js`

**Create the Windows wrapper (if on Windows)**
- [ ] Create `~/.claude/hooks/wp-mcp-usmiv.sh` with this content (adjust Doppler config name if different):

```bash
#!/usr/bin/env bash
exec doppler run --project atmix --config prd_usmiv -- \
  bash -c '
    export WORDPRESS_SITE_URL="${WP_ADMIN_URL%/wp-admin/}"
    export WORDPRESS_USERNAME="$WP_USER"
    export WORDPRESS_APP_PASSWORD="$WP_APP_PASSWORD"
    exec node -e "import(\"file:///$(npm root -g | sed s,\\\\,/,g)/mcp-wordpress/dist/index.js\")"
  '
```

- [ ] Make it executable: `chmod +x ~/.claude/hooks/wp-mcp-usmiv.sh`

**Add MCP entry to Claude Code settings**
- [ ] Open `~/.claude/settings.json` (create if absent)
- [ ] Add to `mcpServers`:
```json
"wordpress-usmiv": {
  "command": "bash",
  "args": ["/path/to/.claude/hooks/wp-mcp-usmiv.sh"]
}
```
- [ ] Restart Claude Code session to pick up the new server.

**On macOS/Linux (no Windows ESM bug)**
- [ ] The wrapper simplifies to:
```bash
#!/usr/bin/env bash
exec doppler run --project atmix --config prd_usmiv -- \
  bash -c '
    export WORDPRESS_SITE_URL="${WP_ADMIN_URL%/wp-admin/}"
    export WORDPRESS_USERNAME="$WP_USER"
    export WORDPRESS_APP_PASSWORD="$WP_APP_PASSWORD"
    exec npx -y mcp-wordpress
  '
```

**Verify it works**
- [ ] In a Claude Code session with the MCP active, ask: "Use wordpress-usmiv to list the 5 most recent pages on the site"
- [ ] Confirm you see real page slugs from usmobileiv.com

**WP Application Password** (if Max needs his own)
- [ ] Log into usmobileiv.com WP admin
- [ ] Go to Users > Profile > Application Passwords
- [ ] Create a new password named "Max-ClaudeCode"
- [ ] Store it in Doppler: `doppler secrets set WP_APP_PASSWORD_MAX="xxxx xxxx xxxx xxxx xxxx xxxx" --project atmix --config prd_usmiv`

---

## What We Considered and Rejected

| Option | Reason Rejected |
|--------|-----------------|
| WordPress/mcp-adapter (official) | Requires installing a PHP plugin on the live WP site (Rocket.net managed hosting complicates this), only 3 built-in tools, WP 6.9 required for Abilities API in core. Architectural direction is good but not production-ready for our use case today. Revisit when WP 6.9 ships widely. |
| mcp-wp/mcp-server (PHP plugin) | Archived December 2025. Transport unfinished at archival. Dead. |
| claudeus-wp-mcp (145 tools) | 32 commits, unclear long-term maintenance. FSE and Astra Pro tools are irrelevant for Bricks. Tool count is marketing, not signal. |
| InstaWP/mcp-wp | Viable backup but fewer tools than docdyhr and includes a SQL query tool (security risk on shared/managed hosting). |
| WP-CLI MCP bridge (mcp-wp/ai-command) | Requires WP-CLI access to the server, which Rocket.net managed hosting does not provide via standard SFTP/FTPS. Relevant only for self-hosted or local dev installs. |
| AI content WordPress plugins | Claude Code outperforms all of them for our editorial workflow. Adding a WP plugin that calls its own AI model creates cost duplication, output inconsistency, and vendor lock-in. |
| Vanilla REST + curl (status quo) | Works, but requires manually constructing every endpoint, field name, and auth header. An MCP server gives the same REST calls with tool discovery, consistent error handling, and no context switching. The MCP server is a net win for iterative work. |

---

## Gap Analysis vs Existing MCP Stack

| Capability | Before | After |
|-----------|--------|-------|
| WP page/post CRUD | Manual curl | wp_create_post, wp_update_post, wp_delete_post, wp_list_posts |
| WP media upload | Manual multipart curl | wp_upload_media |
| WP user management | Admin UI only | wp_list_users, wp_create_user |
| SEO metadata bulk write | Manual wp-admin | wp_seo_bulk_update_metadata, wp_seo_generate_metadata |
| Schema/JSON-LD generation | Manual | wp_seo_generate_schema, wp_seo_validate_schema |
| SERP tracking | External tool | wp_seo_track_serp, wp_seo_keyword_research (via GSC OAuth) |
| Internal link suggestions | Manual | wp_seo_suggest_internal_links |
| Site performance monitoring | External | wp_performance_stats, wp_performance_alerts |
| llms.txt | None | AnswerSEO plugin (one-time install) |
| Bricks builder template edits | chrome-devtools MCP | Still chrome-devtools (no MCP for Bricks visual layer) |
| JetEngine custom field schema | Admin UI only | Still admin UI (JetEngine has no REST exposure for field definitions) |
