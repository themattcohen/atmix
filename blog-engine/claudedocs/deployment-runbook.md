# Blog Engine — Deployment Runbook

## Server

| Field | Value |
|-------|-------|
| Provider | Hetzner Cloud CAX11 |
| IP | 89.167.72.220 |
| OS | Ubuntu 24.04.3 LTS (aarch64/ARM) |
| CPU | 2 ARM vCPU |
| RAM | 3.7 GB |
| Disk | 38 GB NVMe SSD |
| SSH Key | `~/.ssh/blog-engine` (ed25519, comment: blog-engine-hetzner) |
| SSH | `ssh -i ~/.ssh/blog-engine root@89.167.72.220` |
| URL | `https://blog-engine.89-167-72-220.sslip.io` |
| Cost | ~€4.50/mo |

## Architecture

The server is **not a git repository**. Code is deployed by copying files from the local machine using SCP.

```
/opt/blog-engine/
├── app.py
├── writer-guide.md
├── anti-slop-rules.json
├── requirements.txt
├── .env                    # Never overwrite
├── .venv/
├── configs/
│   ├── _template.json
│   ├── ofcpa.json
│   └── tax-general.json
├── lib/
│   ├── __init__.py
│   ├── pipeline.py
│   ├── db.py
│   ├── writer.py
│   ├── nlp_parser.py
│   ├── auto_review.py
│   ├── gap_analysis.py
│   ├── scorer.py
│   ├── costs.py
│   ├── crosslinks.py
│   └── imagen.py
├── ui/
│   ├── __init__.py
│   ├── components.py
│   ├── step_nlp_input.py
│   ├── step_research.py
│   ├── step_write.py
│   └── step_review.py
├── scripts/
│   └── validate-article.mjs
├── output/                 # Per-slug artifacts
└── data/
    └── pipeline.db         # Never overwrite
```

### Module Reference

**lib/**

| Module | Purpose |
|--------|---------|
| `pipeline.py` | Pipeline state machine: step definitions, slug generation, config loading, step advancement |
| `db.py` | SQLite state management for pipeline runs and steps (CRUD, migrations, WAL mode) |
| `writer.py` | Claude API integration for research brief generation, article writing, and feedback-driven rewrites |
| `nlp_parser.py` | NLP term extraction from Surfer SEO screenshots (Claude Vision) and pasted text, with verification |
| `auto_review.py` | Local article analysis against Surfer NLP targets — term frequency counting, heading checks (zero API cost) |
| `gap_analysis.py` | Builds structured rewrite feedback from Surfer screenshot data (score gaps, underused entities, missing headings) |
| `scorer.py` | Markdown-to-HTML conversion for Surfer injection and local article validation via Node.js script |
| `costs.py` | Cost calculation and formatting for Claude and Imagen API calls |
| `crosslinks.py` | Scrapes blog index pages to discover articles for internal cross-linking |
| `imagen.py` | Hero image generation using Google Imagen 4 (prompt building, async generation, selection) |

**ui/**

| Module | Purpose |
|--------|---------|
| `components.py` | Shared Streamlit UI primitives: progress bar, step header, approve controls, async helper, data persistence |
| `step_nlp_input.py` | Step 0 UI — multi-slot Surfer NLP input (screenshots + pasted text), OCR extraction, term review editor |
| `step_research.py` | Step 1 UI — research brief generation, completeness checking, auto-completion, edit mode |
| `step_write.py` | Step 2 UI — article writing with auto-optimization against NLP targets, local validation, HTML export |
| `step_review.py` | Step 3 UI — feedback/rewrite loop, Surfer screenshot analysis, hero image generation, final approval |

Caddy listens on ports 80/443 and reverse-proxies HTTPS traffic to Streamlit on `localhost:8501`.

### Required System Packages

The following system packages must be present on the server:

- `tesseract-ocr` — OCR engine for PDF/image text extraction
- `tesseract-ocr-eng` — English language data for Tesseract
- `python3.12` — Runtime (system-installed)

To install if missing:

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "apt install -y tesseract-ocr tesseract-ocr-eng"
```

## Services

| Service | Port | Process |
|---------|------|---------|
| Streamlit | 8501 (internal) | systemd `blog-engine.service` |
| Caddy | 80/443 (public) | systemd `caddy.service` |

## Environment Variables

Located at `/opt/blog-engine/.env` on the server. Loaded by `dotenv` at app startup.

| Var | Description |
|-----|-------------|
| ANTHROPIC_API_KEY | Claude API key (required) |
| GEMINI_API_KEY | Google AI Studio / Imagen (required for hero images) |

**Never overwrite `.env` via SCP.** Edit it directly on the server if keys need updating:

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "nano /opt/blog-engine/.env"
```

---

## Deploy — Quick Reference

Most deployments involve copying a few changed files and restarting the service. Run from the local project root.

SCP does not create subdirectories automatically, so list destination paths explicitly for `lib/` and `ui/`:

```bash
scp -i ~/.ssh/blog-engine blog-engine/app.py root@89.167.72.220:/opt/blog-engine/
scp -i ~/.ssh/blog-engine blog-engine/lib/*.py root@89.167.72.220:/opt/blog-engine/lib/
scp -i ~/.ssh/blog-engine blog-engine/ui/*.py root@89.167.72.220:/opt/blog-engine/ui/
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "systemctl restart blog-engine"
```

Verify the service came back up:

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "systemctl status blog-engine"
```

---

## Deploy — Changed Files

### Step 1: Copy changed files

Copy only the files that changed. Use the appropriate path for each module:

```bash
# Single file example
scp -i ~/.ssh/blog-engine blog-engine/app.py root@89.167.72.220:/opt/blog-engine/

# Library module
scp -i ~/.ssh/blog-engine blog-engine/lib/db.py root@89.167.72.220:/opt/blog-engine/lib/

# UI step module
scp -i ~/.ssh/blog-engine blog-engine/ui/step_nlp_input.py root@89.167.72.220:/opt/blog-engine/ui/
```

### Step 2: Install new dependencies (if `requirements.txt` changed)

```bash
scp -i ~/.ssh/blog-engine blog-engine/requirements.txt root@89.167.72.220:/opt/blog-engine/
ssh -i ~/.ssh/blog-engine root@89.167.72.220 ".venv/bin/pip install -r /opt/blog-engine/requirements.txt"
```

### Step 3: Restart the service

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "systemctl restart blog-engine"
```

### Step 4: Verify

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "journalctl -u blog-engine -n 50 --no-pager"
```

The app should log Streamlit startup messages. Open the URL to confirm:
`https://blog-engine.89-167-72-220.sslip.io`

---

## Deploy — Full Rebuild

Use this when making large structural changes or when the server state is uncertain. This replaces all application files and reinstalls the virtualenv dependencies.

```bash
scp -r -i ~/.ssh/blog-engine blog-engine/ root@89.167.72.220:/opt/blog-engine/
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "cd /opt/blog-engine && .venv/bin/pip install -r requirements.txt && systemctl restart blog-engine"
```

Note: `scp -r` copies the directory contents. The `.env` file and `data/` directory are not overwritten as long as they are not present in the local `blog-engine/` folder being copied.

**Verify the database and `.env` are intact after a full rebuild:**

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "ls /opt/blog-engine/.env /opt/blog-engine/data/pipeline.db"
```

---

## Rollback

Before any risky deploy, take a backup of the current application files:

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 \
  "cp -r /opt/blog-engine /opt/blog-engine-backup-$(date +%Y%m%d)"
```

To revert:

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 \
  "rm -rf /opt/blog-engine && mv /opt/blog-engine-backup-YYYYMMDD /opt/blog-engine && systemctl restart blog-engine"
```

Remove old backups when no longer needed to avoid filling disk:

```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "rm -rf /opt/blog-engine-backup-YYYYMMDD"
```

---

## Logs and Debugging

```bash
# Streamlit logs (live tail)
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "journalctl -u blog-engine -f"

# Streamlit logs (last 100 lines)
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "journalctl -u blog-engine -n 100 --no-pager"

# Caddy logs (live tail)
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "journalctl -u caddy -f"

# Check service status
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "systemctl status blog-engine caddy"
```

---

## Database

The SQLite database stores pipeline state and persists across deploys. Do not overwrite it.

| Detail | Value |
|--------|-------|
| Location | `/opt/blog-engine/data/pipeline.db` |
| Managed by | `lib/db.py` |
| Persists across | All deploys |

### Backup the database

```bash
scp -i ~/.ssh/blog-engine root@89.167.72.220:/opt/blog-engine/data/pipeline.db ./pipeline-backup.db
```

### Inspect the database

```bash
# List tables
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "sqlite3 /opt/blog-engine/data/pipeline.db '.tables'"

# Row counts
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "sqlite3 /opt/blog-engine/data/pipeline.db 'SELECT COUNT(*) FROM runs;'"
```

---

## Common Issues

**Caddy 502 Bad Gateway**
Streamlit has crashed or is not running. Restart the service and check logs:
```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "systemctl restart blog-engine && journalctl -u blog-engine -n 50 --no-pager"
```

**Streamlit won't start**
Check logs for errors. Common causes: missing dependency, syntax error in a changed file, or port already in use:
```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "journalctl -u blog-engine -e --no-pager"
```

**Tesseract missing**
If OCR extraction fails with a `tesseract` not found error:
```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "apt install -y tesseract-ocr tesseract-ocr-eng"
```

**Permission denied on files**
Ensure the application directory is owned by root:
```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "chown -R root:root /opt/blog-engine"
```

**Database locked**
Only one Streamlit instance should be running. Multiple instances cause SQLite lock contention. Check for duplicate processes:
```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "systemctl status blog-engine"
```

**SCP permission denied**
Verify the SSH key path is correct: `~/.ssh/blog-engine`. Test the connection first:
```bash
ssh -i ~/.ssh/blog-engine root@89.167.72.220 "echo connected"
```
