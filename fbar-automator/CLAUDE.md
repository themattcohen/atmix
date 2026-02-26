# FBAR Automator — Project Guide

## Production

Both apps are deployed on a single Hetzner VPS. **Read the ops runbook before touching prod:**

**`claudedocs/B2B-OPS-RUNBOOK.md`** — SSH access, URLs, deploy commands, migrations, logs, backups, troubleshooting.

| App | URL | Domain Registrar |
|-----|-----|-----------------|
| B2B (preparer) | `https://b2b.178-156-250-116.sslip.io` | sslip.io (free) |
| D2C (direct filing) | `https://fbardirect.com` | Namecheap |

## Codebase

| Path | What |
|------|------|
| `src/` | B2B app (Next.js 14, Node 20) |
| `d2c/` | D2C app (Next.js 14, Node 22) |
| `docker-compose.prod.yml` | Unified production compose (both apps) |
| `d2c/docker-compose.yml` | D2C local dev (postgres + minio only) |
| `claudedocs/` | Operations docs, roadmaps, plans |
| `claudedocs/archive/` | Archived/superseded docs |

## Key Constraints

- **Server has 1.9 GB RAM + 2 GB swap** (`/swapfile`, persisted in fstab). Still build Docker images ONE AT A TIME to avoid excessive swapping.
- D2C Stripe, email (Resend), and FinCEN SFTP are placeholder/sandbox — not yet configured for production.
- Both apps share one Postgres instance but use separate databases (`fbar_automator` for B2B, `fbar_direct` for D2C).
