# Incident Response Plan — FBAR Direct (fbardirect.com)

**Operator**: All Solutions Consulting (ASC) / Matt Cohen
**Service**: D2C FinCEN FBAR filing SaaS
**Last Updated**: 2026-02-28
**Version**: 1.0

---

## 1. What Constitutes a Security Incident

Any event that threatens the confidentiality, integrity, or availability of FBAR Direct systems or user data:

- **Data breach** — unauthorized access to PII (SSNs, bank account numbers, financial data)
- **Credential compromise** — database passwords, API keys, NextAuth secrets, Stripe keys, MinIO credentials exposed
- **Service compromise** — unauthorized code execution, container escape, Caddy/VPS root access obtained by third party
- **Account takeover** — user or admin account accessed without authorization
- **Anomalous activity** — unexpected data exports, unusual login patterns, spike in failed auth attempts
- **Third-party breach** — Stripe, Hetzner, MinIO, Sentry, or Resend reports a breach affecting FBAR Direct data
- **Physical/logical data loss** — accidental deletion of production database or S3 buckets

---

## 2. Severity Levels

| Level | Definition | Example | Response Window |
|-------|-----------|---------|----------------|
| **Critical (P0)** | Active breach, PII exposure, ongoing unauthorized access | DB dump exfiltrated, attacker in VPS | Immediate — within 1 hour |
| **High (P1)** | Credential compromise, service fully down, ransomware | API key leaked to GitHub, VPS unreachable | Within 4 hours |
| **Medium (P2)** | Failed attack attempts, suspicious activity, partial outage | Repeated SQLi attempts, single service down | Within 24 hours |
| **Low (P3)** | Policy violations, minor misconfigs, informational alerts | Misconfigured CORS, expired cert warning | Within 72 hours |

---

## 3. Immediate Response Steps (0–4 Hours)

### Step 1: Identify (0–30 min)
- Confirm the incident via Sentry alerts, Docker logs, Caddy access logs, or user reports
- Determine: What systems are affected? What data may be exposed? Is the attacker still active?
- Assign Incident Commander (default: Matt Cohen)
- Open an incident log (private doc or local file) — timestamp every action

### Step 2: Contain (30 min–2 hours)
- **If active breach**: Immediately isolate affected containers (see Section 7)
- Block attacker IP at Hetzner firewall or Caddy level
- Revoke compromised credentials immediately (see Section 7 — credential rotation)
- Enable maintenance mode if needed: stop `d2c-app` container to prevent further data access
- Preserve system state before further changes (snapshot, logs)

### Step 3: Preserve Evidence (parallel with containment)
- Export Docker logs before restarting containers: `docker logs d2c-app > /tmp/incident-$(date +%Y%m%d).log`
- Capture Sentry error timeline (export if possible)
- Screenshot Hetzner firewall logs, Caddy access logs
- Do NOT delete or overwrite any logs — evidence chain matters for insurance and legal

### Step 4: Assess Scope
- Query database for anomalous access patterns (unexpected exports, new admin users)
- Audit MinIO bucket access logs (`mc admin trace`)
- Check Stripe dashboard for unauthorized API calls or payout changes
- Determine: which users are affected, what data was accessed, time window of exposure

---

## 4. Notification Timeline

| Recipient | Trigger | Timeline |
|-----------|---------|---------|
| Internal (self/team) | Any P0/P1 incident | Immediate |
| Legal counsel | Any PII exposure or breach | Within 24 hours |
| Insurance carrier | Any P0/P1 incident | Within 24–48 hours |
| **Affected users** | Confirmed PII exposure | As soon as practicable; most states require "without unreasonable delay" |
| **State AGs** | Breach of residents' PII | Varies by state: 30 days (CA, FL, NY, TX common), up to 90 days; default target: 30 days |
| **FinCEN** | Breach of FBAR filing data | Contact FinCEN helpline; no fixed statutory deadline but notify promptly |
| FBI Internet Crime Center (IC3) | Cybercrime, ransomware | File report at ic3.gov within 72 hours of discovery |
| Hetzner | VPS compromise, infra issue | As needed for infrastructure response |

**State breach notification laws vary significantly.** Consult legal counsel before sending any regulatory notifications. California (CCPA), New York (SHIELD Act), and Texas (TBIA) are among the strictest. Most require notification to the state AG if >500 residents affected.

---

## 5. Contact List

| Role | Name | Contact | Notes |
|------|------|---------|-------|
| CEO / Incident Commander | Matt Cohen | TBD | Primary decision-maker |
| Legal Counsel | TBD | TBD | Data breach / privacy attorney |
| Cyber Insurance Carrier | TBD | TBD | Policy number: TBD |
| Hetzner Support | Hetzner Online | https://www.hetzner.com/support | Server ID / project in Hetzner console |
| FBI IC3 (Cybercrime) | Internet Crime Complaint Center | ic3.gov | File online report |
| FinCEN Help Desk | Financial Crimes Enforcement Network | 1-800-767-2825 | fincen.gov/contact |
| Stripe Security | security@stripe.com | security@stripe.com | Report compromised Stripe keys |
| Sentry Security | security@sentry.io | security@sentry.io | If Sentry account compromised |

---

## 6. Communication Templates

### Affected User Notification (Draft)

> **Subject**: Important Security Notice Regarding Your FBAR Direct Account
>
> Dear [Name],
>
> We are writing to inform you of a security incident that may have affected your account on FBAR Direct (fbardirect.com), operated by All Solutions Consulting.
>
> **What happened**: [Brief, factual description]
> **What information was involved**: [Specific data types — e.g., name, SSN, bank account numbers]
> **What we are doing**: We have [contained the incident / rotated credentials / notified authorities] and are conducting a full investigation.
> **What you should do**: [Monitor your accounts / place a credit freeze / contact us]
>
> We take the security of your financial information extremely seriously. If you have questions, contact us at [support email].
>
> Sincerely,
> Matt Cohen, All Solutions Consulting

### Regulatory Notification (Draft — adapt per state requirements)

> **To**: [State Attorney General Office / FinCEN]
> **Re**: Security Breach Notification — All Solutions Consulting d/b/a FBAR Direct
>
> We are notifying your office pursuant to [state statute] of a security incident affecting residents of [state].
>
> - **Date of discovery**: [Date]
> - **Estimated date of breach**: [Date or range]
> - **Number of residents affected**: [Number or estimate]
> - **Information involved**: [Data types]
> - **Steps taken**: [Containment, remediation actions]
> - **Consumer notification date**: [Date or planned date]
>
> Contact: Matt Cohen, [email], [phone]

---

## 7. Technical Response Procedures

### Docker Container Isolation
```bash
# Stop the app without removing data
docker compose stop d2c-app

# Preserve logs before any restart
docker logs d2c-app > /tmp/incident-$(date +%Y%m%d-%H%M).log 2>&1
docker logs d2c-postgres >> /tmp/incident-$(date +%Y%m%d-%H%M).log 2>&1

# Snapshot the postgres volume before any changes
docker exec d2c-postgres pg_dump -U postgres fbar > /tmp/pre-incident-snapshot-$(date +%Y%m%d).sql
```

### Log Preservation
```bash
# Caddy access logs (if configured)
docker logs caddy > /tmp/caddy-incident.log 2>&1

# System auth logs (VPS level)
journalctl -u ssh --since "24 hours ago" > /tmp/ssh-audit.log

# Copy all logs off-server to safe storage immediately
scp root@<vps-ip>:/tmp/incident-*.log ./incident-evidence/
```

### Credential Rotation Checklist
- [ ] Rotate `NEXTAUTH_SECRET` → redeploy d2c-app
- [ ] Rotate `DATABASE_URL` password → update Postgres + env + redeploy
- [ ] Rotate Stripe `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` → update Stripe dashboard + env
- [ ] Rotate MinIO `MINIO_ROOT_PASSWORD` → update MinIO + env
- [ ] Rotate `ANTHROPIC_API_KEY`
- [ ] Rotate Resend API key
- [ ] Rotate Sentry DSN (invalidate old)
- [ ] Rotate Hetzner API token
- [ ] Invalidate all active NextAuth sessions (change secret forces re-login)
- [ ] Rotate SSH keys on VPS if server-level access suspected

### MinIO Bucket Audit
```bash
# List all objects in fbar-direct bucket
mc ls local/fbar-direct --recursive > /tmp/minio-audit.txt

# Check access logs (if audit logging enabled)
mc admin trace local > /tmp/minio-trace.log

# If bucket compromised, lock it immediately
mc policy set none local/fbar-direct
```

### Database Snapshot & Audit
```bash
# Full dump
docker exec d2c-postgres pg_dump -U postgres fbar > /tmp/db-snapshot.sql

# Check for unexpected admin users
docker exec d2c-postgres psql -U postgres fbar -c "SELECT id, email, role, createdAt FROM User WHERE role='ADMIN' ORDER BY createdAt DESC;"

# Check recent FilingYear / Statement access
docker exec d2c-postgres psql -U postgres fbar -c "SELECT * FROM FilingYear ORDER BY updatedAt DESC LIMIT 50;"
```

---

## 8. Post-Incident Review

Complete within 2 weeks of incident closure:

### Root Cause Analysis
- Timeline of events (detection → containment → resolution)
- How the attacker gained access / what vulnerability was exploited
- Why detection took as long as it did
- What controls failed or were missing

### Remediation Tracking
| Item | Owner | Target Date | Status |
|------|-------|-------------|--------|
| Patch exploited vulnerability | Matt Cohen | [Date] | Pending |
| Add/improve monitoring | Matt Cohen | [Date] | Pending |
| Update runbooks | Matt Cohen | [Date] | Pending |
| Insurance claim filing | Matt Cohen | [Date] | Pending |

### Documentation Updates
- Update this incident response plan based on lessons learned
- Update `claudedocs/` with any new security findings
- Review and update `known-gaps/` if incident revealed unaddressed issues

### Insurance Claim
- Notify carrier within policy window (check policy — often 30–60 days)
- Provide: incident timeline, evidence log, remediation steps, estimated losses
- Keep all incident documentation for at least 3 years

### Metrics to Track
- **Time to detect** (TTD)
- **Time to contain** (TTC)
- **Time to recover** (TTR)
- **Users affected**
- **Data records exposed**

---

*This document is confidential and intended for internal operational use. Review annually or after any significant incident.*
