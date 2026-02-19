# Gap #21: X-XSS-Protection Header Deprecated

**Severity:** Low
**Effort:** S (< 1 hour)
**Depends on:** None

## Problem

`Caddyfile.prod` line 87 sets `X-XSS-Protection "1; mode=block"` in the D2C domain's security header block. This header was removed from the W3C specification and is no longer processed by any modern browser. Chrome removed support in version 78 (2019), Firefox never implemented it, and Edge removed it in version 111 (2023). Safari and its WebKit derivatives dropped it as well.

The meaningful concern beyond obsolescence: the `X-XSS-Protection` header's original intent was to enable browser-native XSS auditors. Those auditors contained their own vulnerabilities — they could be weaponized by an attacker to suppress rendering of legitimate page content and trigger partial XSS. The OWASP Security Headers Project and the Mozilla Observatory both explicitly recommend removing this header rather than setting it to any value, because `1; mode=block` can actively introduce reflected XSS on pages loaded in older IE/Edge Legacy browsers that still honor the header.

The net effect: the header provides zero protection on any current browser while maintaining a theoretical attack surface for legacy clients. It should be deleted.

Note that this issue only affects the D2C domain block (lines 82-166). The B2B domain block (lines 11-72) does not include `X-XSS-Protection` and is not affected.

## Current State

**`Caddyfile.prod` — lines 82-93 (D2C domain header block)**

```caddy
{$D2C_DOMAIN} {
	# Security headers (CSP managed by Next.js app — see d2c/next.config.js)
	header {
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		X-XSS-Protection "1; mode=block"    # <-- line 87: deprecated
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		Strict-Transport-Security "max-age=63072000; includeSubDomains"
		X-DNS-Prefetch-Control "off"
		-Server
	}
```

The B2B domain block (lines 11-21) does not contain `X-XSS-Protection`:

```caddy
{$B2B_DOMAIN} {
	header {
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		X-DNS-Prefetch-Control "off"
		Strict-Transport-Security "max-age=63072000; includeSubDomains"
		-Server
	}
```

The D2C app's CSP is set by the Next.js app itself (`d2c/next.config.js` line 38), not by Caddy. Modern CSP (`Content-Security-Policy`) is the correct and supported mechanism for XSS mitigation. It is already in place.

## Implementation Plan

### Step 1: Delete line 87 from `Caddyfile.prod`

Remove the single line containing `X-XSS-Protection`:

**Before (lines 84-93):**
```caddy
	header {
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		X-XSS-Protection "1; mode=block"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		Strict-Transport-Security "max-age=63072000; includeSubDomains"
		X-DNS-Prefetch-Control "off"
		-Server
	}
```

**After:**
```caddy
	header {
		X-Frame-Options "DENY"
		X-Content-Type-Options "nosniff"
		Referrer-Policy "strict-origin-when-cross-origin"
		Permissions-Policy "camera=(), microphone=(), geolocation=()"
		Strict-Transport-Security "max-age=63072000; includeSubDomains"
		X-DNS-Prefetch-Control "off"
		-Server
	}
```

No other changes to the file are needed.

### Step 2: Reload Caddy on the production server

Caddy configuration changes do not require a container rebuild or restart. Caddy supports graceful config reload:

```bash
ssh root@178.156.250.116
cd /opt/fbar-automator   # or wherever docker-compose.prod.yml lives
docker compose -f docker-compose.prod.yml exec caddy caddy reload --config /etc/caddy/Caddyfile
```

If the volume mount is not live-reloadable (i.e., Caddy read the file at startup only), a force-recreate is needed instead:

```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate caddy
```

Per the ops runbook (`claudedocs/B2B-OPS-RUNBOOK.md`), Caddyfile changes require `--force-recreate` on the Caddy service because the config is mounted read-only and Caddy reads it at startup. The most recent commit message (`0e925f1`: "docs: update runbook - force-recreate needed for Caddy config changes") confirms this.

## Files to Modify

| File | Change |
|---|---|
| `Caddyfile.prod` | Delete line 87: `X-XSS-Protection "1; mode=block"` |

## Environment / Config Changes

None. This is a pure Caddyfile line deletion. No environment variables, Docker images, or application code are affected.

The Caddy container does not need to be rebuilt — only recreated so it picks up the updated `Caddyfile.prod` from the bind mount.

## Testing

**Verify header is absent after reload:**
```bash
curl -sI https://fbardirect.com | grep -i "x-xss"
# Expected: no output (header absent)
```

**Verify remaining headers are intact:**
```bash
curl -sI https://fbardirect.com | grep -iE "x-frame|x-content|referrer|permissions|strict-transport|x-dns"
# Expected: all 6 headers present with correct values
```

**Mozilla Observatory scan:**

Run a scan at https://observatory.mozilla.org/analyze/fbardirect.com after the change. The `X-XSS-Protection` header previously caused a warning/deduction in Observatory scores. Its removal should improve or maintain the score. The existing CSP (managed by Next.js `next.config.js`) provides the correct modern XSS protection.

**Browser DevTools check:**

In Chrome DevTools > Network > any page request > Response Headers, confirm `x-xss-protection` is absent from the response header list.

## Risks / Notes

- **Zero functional risk**: No modern browser acts on this header. Removing it cannot break anything.

- **Legacy IE/Edge Legacy**: The only environment where this header was ever meaningful is Internet Explorer 8-11 and Edge Legacy (EdgeHTML). Those browsers are not supported by this app. The HSTS header (`Strict-Transport-Security`) already prevents HTTPS downgrade attacks on these clients, and TLS 1.3 further constrains the attack surface.

- **Force-recreate vs reload**: The ops runbook explicitly notes that Caddy config changes require `--force-recreate` (not just restart or reload). This is a 3-5 second outage for the Caddy container only; the D2C and B2B app containers keep running and Caddy will resume proxying immediately on startup.

- **Explicit header suppression option**: If a security scanner or client requirement mandates an explicit `X-XSS-Protection: 0` (which disables any residual auditor behavior in IE), the line can be changed to `X-XSS-Protection "0"` instead of deleted. OWASP recommends `0` over `1; mode=block` as the least-harmful setting if the header cannot be removed entirely. For this deployment, complete deletion is preferred.

- **B2B parity**: The B2B domain block already does not include this header. This change brings the D2C block into parity with B2B.
