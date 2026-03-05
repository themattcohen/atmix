# E2E Production Testing Runbook

Autonomous testing workflow for Claude Code to test the D2C filing flow on production (fbardirect.com) using the E2E setup endpoint + Chrome DevTools MCP.

## Prerequisites

- `E2E_TEST_SECRET` set in Hetzner `.env` and container restarted
- Chrome DevTools MCP connected to a browser

## Endpoint Reference

**URL**: `https://fbardirect.com/api/internal/e2e-setup`
**Auth**: `x-e2e-secret: <E2E_TEST_SECRET>`
**Safety**: Email must match `e2e-test-*@test.fbardirect.com`

### Actions

| Action | Purpose |
|--------|---------|
| `setup` | Create verified test user + optional FilingYear |
| `cleanup` | Delete test user + all cascading data |
| `reset` | Wipe filings/accounts, create fresh FilingYear |
| `set-status` | Set FilingYear status (bypass Stripe) |

## Full Test Flow

### Step 1: Create Test User

```bash
curl -s -X POST https://fbardirect.com/api/internal/e2e-setup \
  -H "Content-Type: application/json" \
  -H "x-e2e-secret: $E2E_SECRET" \
  -d '{"action":"setup","email":"e2e-test-run@test.fbardirect.com","password":"TestPass123!","calendarYear":2025}'
```

Expected: 201 with `userId`, `email`, `password`, `filingYearId`.

### Step 2: Login via Chrome DevTools

1. Navigate to `https://fbardirect.com/login`
2. Fill email + password fields
3. Click "Sign In"
4. Verify redirect to `/threshold`

### Step 3: Walk Through Filing Flow

#### Threshold Page (`/threshold`)
- Select "Yes" for $10,000+ threshold
- Click Continue
- Verify redirect to `/personal`

#### Personal Info Page (`/personal`)
- Fill: first name, last name, date of birth, SSN, address fields
- Click Continue
- Verify redirect to `/accounts`

#### Accounts Page (`/accounts`)
- Click "Add Account"
- Fill: institution name, country, account type, account number, max value
- Save account
- Click Continue
- Verify redirect to `/review`

#### Review Page (`/review`)
- Verify all entered data displayed
- Click Continue
- Verify redirect to `/sign`

#### Sign Page (`/sign`)
- Check consent checkbox
- Enter signature (full name)
- Click Sign
- Verify redirect to `/payment`

### Step 4: Skip Payment (Set Status to PAID)

```bash
curl -s -X POST https://fbardirect.com/api/internal/e2e-setup \
  -H "Content-Type: application/json" \
  -H "x-e2e-secret: $E2E_SECRET" \
  -d '{"action":"set-status","email":"e2e-test-run@test.fbardirect.com","status":"PAID"}'
```

Then navigate to `/confirmation` in the browser.

### Step 5: Verify Confirmation

- Navigate to `https://fbardirect.com/confirmation`
- Verify confirmation page renders with filing details
- Check for BSA tracking info or "pending submission" message

### Step 6: Cleanup

```bash
curl -s -X POST https://fbardirect.com/api/internal/e2e-setup \
  -H "Content-Type: application/json" \
  -H "x-e2e-secret: $E2E_SECRET" \
  -d '{"action":"cleanup","email":"e2e-test-run@test.fbardirect.com"}'
```

## Fix & Rebuild Cycle

When a bug is found during testing:

```bash
# 1. Fix the code locally, commit, and push
git add <files> && git commit -m "fix(d2c): <description>" && git push

# 2. SSH to Hetzner — pull and rebuild
ssh -i ~/.ssh/hetzner_claude -o BatchMode=yes root@178.156.250.116 "
  cd /opt/fbar && git pull origin main &&
  cd fbar-automator &&
  docker compose -f docker-compose.prod.yml stop d2c-app &&
  docker build -t ghcr.io/themattcohen/fbar-d2c:latest -f d2c/Dockerfile d2c/ &&
  docker compose -f docker-compose.prod.yml up -d d2c-app
"

# 3. Wait for health check (~40s) then retest
```

## Reset Between Test Runs

```bash
curl -s -X POST https://fbardirect.com/api/internal/e2e-setup \
  -H "Content-Type: application/json" \
  -H "x-e2e-secret: $E2E_SECRET" \
  -d '{"action":"reset","email":"e2e-test-run@test.fbardirect.com","calendarYear":2025}'
```

## Troubleshooting

### Ghost session (redirect loop after cleanup)
The login page now detects ghost sessions automatically. If a deleted user's JWT cookie is present, it calls `signOut()` to clear it and shows the login form.

### Rate limiting
If testing triggers rate limits (429), wait 60 seconds for the window to reset. Auth routes have a 5 req/min limit per IP in production.

### CSRF errors on internal endpoint
The `/api/internal/` path is CSRF-exempt. If you still get 403, verify the `x-e2e-secret` header matches the server's `E2E_TEST_SECRET`.

### Endpoint returns 404
Either `E2E_TEST_SECRET` is not set in the container env, or the secret doesn't match. Check:
```bash
ssh root@178.156.250.116 "cd /opt/fbar/fbar-automator && docker compose -f docker-compose.prod.yml exec d2c-app env | grep E2E"
```
