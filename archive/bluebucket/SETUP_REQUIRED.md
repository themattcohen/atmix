# Blue Bucket - Setup Requirements

**Everything you need to get the system running in production.**

**Last Updated**: 2025-01-17
**Version**: 1.1.0

---

## Quick Start (Local Testing)

```bash
cd server
npm install
cp .env.test .env
npm run dev
```

The server will start but external integrations (Jobber, Redis) won't work without real credentials.

---

## Required Credentials

### 1. Upstash Redis (FREE)

**URL**: https://console.upstash.com/

**Steps**:
1. Create account at Upstash
2. Click "Create Database"
3. Settings:
   - **Name**: `bluebucket-prod`
   - **Region**: `us-west-1` (or closest to Denver)
   - **Type**: Regional (free tier)
4. Copy credentials:

```env
UPSTASH_REDIS_REST_URL=https://xxx-xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Free Tier Limits**: 10,000 commands/day, 256MB storage

---

### 2. Jobber Developer App

**URL**: https://developer.getjobber.com/

**Steps**:
1. Log in with your Jobber account
2. Click "Create New App"
3. Fill in:
   - **App Name**: Blue Bucket Voice Agent
   - **Description**: AI voice agent for lead qualification and booking
   - **Redirect URI**:
     - Local: `http://localhost:3000/oauth/callback`
     - Production: `https://bluebucket-server.fly.dev/oauth/callback`
4. Copy credentials:

```env
JOBBER_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
JOBBER_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Required Scopes**: `read_clients write_clients read_jobs write_jobs read_schedule read_requests`

---

### 3. Retell AI Configuration

**URL**: https://www.retellai.com

**Steps**:
1. Create account at Retell AI
2. Go to **Settings** → **API Keys**
3. Create a new API key and copy it
4. Create your AI Agent and copy the Agent ID

**Configure in Retell Dashboard**:
1. Go to Agent → Settings → Webhooks
2. Set URL: `https://bluebucket-server.fly.dev/webhook/retell`
3. Add header: `X-Retell-Signature` with your webhook secret

**Generate webhook secret**:
```bash
openssl rand -hex 32
```

```env
RETELL_API_KEY=key_XXXXXXXXXXXXXXXXXXXXXXXX
RETELL_AGENT_ID=agent_XXXXXXXXXXXXXXXXXXXXXXXX
RETELL_WEBHOOK_SECRET=your_generated_secret_here
```

---

### 4. Twilio Configuration

**URL**: https://www.twilio.com/console

**Steps**:
1. Create Twilio account
2. Get your Account SID and Auth Token from the dashboard
3. Buy a phone number (or use an existing one)
4. Note the phone number in E.164 format

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+17201234567
```

**Important**: The Twilio phone number is used as the caller ID for outbound calls to leads.

---

### 5. CEO Phone Number

The phone number for call transfers when escalation is needed.

```env
CEO_PHONE=+13035551234
```

---

### 6. Fly.io Account (FREE)

**URL**: https://fly.io/

**Steps**:
1. Install flyctl: https://fly.io/docs/hands-on/install-flyctl/
2. Sign up/login: `fly auth login`
3. Deploy:
```bash
cd server
fly launch --no-deploy
fly secrets set JOBBER_CLIENT_ID="your_id"
fly secrets set JOBBER_CLIENT_SECRET="your_secret"
fly secrets set UPSTASH_REDIS_REST_URL="your_url"
fly secrets set UPSTASH_REDIS_REST_TOKEN="your_token"
fly secrets set RETELL_API_KEY="your_retell_api_key"
fly secrets set RETELL_AGENT_ID="your_agent_id"
fly secrets set RETELL_WEBHOOK_SECRET="your_secret"
fly secrets set TWILIO_ACCOUNT_SID="your_sid"
fly secrets set TWILIO_AUTH_TOKEN="your_token"
fly secrets set TWILIO_PHONE_NUMBER="+17201234567"
fly secrets set WEBHOOK_URL="https://bluebucket-server.fly.dev"
fly secrets set CEO_PHONE="+13035551234"
fly deploy
```

**Free Tier**: 3 shared VMs, 160GB outbound transfer/month

---

## Complete .env Template

```env
# ===========================================
# BLUE BUCKET SERVER - PRODUCTION CONFIG
# ===========================================

# Server
PORT=3000
NODE_ENV=production
BUSINESS_TZ=America/Denver

# Jobber OAuth
JOBBER_CLIENT_ID=                    # FROM: developer.getjobber.com
JOBBER_CLIENT_SECRET=                # FROM: developer.getjobber.com
JOBBER_REDIRECT_URI=https://bluebucket-server.fly.dev/oauth/callback
JOBBER_API_URL=https://api.getjobber.com/api/graphql

# Upstash Redis
UPSTASH_REDIS_REST_URL=              # FROM: console.upstash.com
UPSTASH_REDIS_REST_TOKEN=            # FROM: console.upstash.com

# Retell AI (for voice agent and outbound calls)
RETELL_API_KEY=                      # FROM: retellai.com/dashboard/api-keys
RETELL_AGENT_ID=                     # FROM: retellai.com/dashboard/agents
RETELL_WEBHOOK_SECRET=               # GENERATE: openssl rand -hex 32
RETELL_SIP_DOMAIN=5t4n6j0wnrl.sip.livekit.cloud

# Twilio (for phone calls)
TWILIO_ACCOUNT_SID=                  # FROM: twilio.com/console
TWILIO_AUTH_TOKEN=                   # FROM: twilio.com/console
TWILIO_PHONE_NUMBER=                 # E.164 format: +17201234567

# Webhook URL (your server's public URL)
WEBHOOK_URL=https://bluebucket-server.fly.dev

# Outbound Calling
OUTBOUND_CALLING_ENABLED=true
OUTBOUND_CALL_DELAY=30               # Seconds to wait before calling lead
MAX_CALLS_PER_HOUR=50                # Rate limit
OUTBOUND_MAX_RETRIES=2               # Retry attempts for failed calls
OUTBOUND_RETRY_DELAY=300             # Seconds between retries (5 min)
OUTBOUND_START_HOUR=9                # Don't call before 9 AM
OUTBOUND_END_HOUR=20                 # Don't call after 8 PM

# Business
CEO_PHONE=                           # E.164 format: +13035551234
TEAM_CAPACITY=2
BUSINESS_HOURS_START=08:00
BUSINESS_HOURS_END=18:00
WORK_DAYS=1,2,3,4,5                  # Mon-Fri (1=Mon, 7=Sun)
SLOT_TIMES=09:00,13:00               # Available appointment times

# Pricing Configuration (optional - defaults provided)
PRICE_PER_BEDROOM=35
PRICE_PER_BATHROOM=25
PRICE_SQFT_RATE=0.05
PRICE_MINIMUM=100
RECURRING_DISCOUNT=0.10

# Add-on Pricing (optional - defaults provided)
ADDON_DEEP_CLEAN=75
ADDON_INSIDE_OVEN=35
ADDON_INSIDE_FRIDGE=25
ADDON_INSIDE_CABINETS=50
ADDON_WINDOWS=5                      # Per window
ADDON_LAUNDRY=25
ADDON_GARAGE=40
ADDON_PATIO=30
ADDON_MOVE_IN_OUT=100

# Cache TTL Settings (optional - defaults provided)
PHONE_MAPPING_TTL=7776000            # 90 days in seconds
TOKEN_TTL=3500                       # ~58 minutes for hourly tokens
```

---

## Webhook URLs to Configure

### Retell Dashboard
```
URL: https://bluebucket-server.fly.dev/webhook/retell
Method: POST
Header: X-Retell-Signature: <your_secret>
```

### Jobber Developer Portal
```
URL: https://bluebucket-server.fly.dev/webhook/jobber
Events: REQUEST_CREATE
```

---

## Post-Deployment Steps

### 1. Authorize Jobber
After deployment, visit:
```
https://bluebucket-server.fly.dev/oauth/authorize
```
Log in to Jobber and approve the app. Tokens will be stored in Redis.

### 2. Verify Health
```bash
curl https://bluebucket-server.fly.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "services": {
    "redis": "connected",
    "jobber_token": "valid"
  }
}
```

### 3. Test Function Call
```bash
curl -X POST https://bluebucket-server.fly.dev/webhook/retell \
  -H "Content-Type: application/json" \
  -H "X-Retell-Signature: your_secret" \
  -d '{
    "call_id": "test123",
    "function_name": "calculate_quote",
    "arguments": {
      "bedrooms": 3,
      "bathrooms": 2,
      "square_feet": 1800,
      "frequency": "one-time"
    }
  }'
```

---

## Checklist

### Accounts Needed

| Service | URL | Plan Required |
|---------|-----|---------------|
| Upstash | https://upstash.com | Free tier |
| Jobber | https://getjobber.com | Connect or Grow (API access) |
| Retell AI | https://retellai.com | Paid plan |
| Twilio | https://twilio.com | Pay-as-you-go |
| Fly.io | https://fly.io | Free tier |

- [ ] Upstash account created
- [ ] Jobber account with API access (Connect or Grow plan)
- [ ] Retell AI account created
- [ ] Twilio account created
- [ ] Fly.io account created

### Credentials to Gather

#### Upstash Redis
- [ ] `UPSTASH_REDIS_REST_URL` - From Upstash console → Database → REST API
- [ ] `UPSTASH_REDIS_REST_TOKEN` - From Upstash console → Database → REST API

#### Jobber OAuth
- [ ] `JOBBER_CLIENT_ID` - From developer.getjobber.com → Your App
- [ ] `JOBBER_CLIENT_SECRET` - From developer.getjobber.com → Your App

#### Retell AI
- [ ] `RETELL_API_KEY` - From retellai.com → Settings → API Keys
- [ ] `RETELL_AGENT_ID` - From retellai.com → Agents → Your Agent
- [ ] `RETELL_WEBHOOK_SECRET` - Generate: `openssl rand -hex 32`

#### Twilio
- [ ] `TWILIO_ACCOUNT_SID` - From twilio.com/console (Account Info section)
- [ ] `TWILIO_AUTH_TOKEN` - From twilio.com/console (Account Info section)
- [ ] `TWILIO_PHONE_NUMBER` - From twilio.com/console → Phone Numbers

#### Business Configuration
- [ ] `CEO_PHONE` - Your phone number in E.164 format (+1XXXXXXXXXX)
- [ ] `WEBHOOK_URL` - Your production server URL

### Configuration Steps (In Order)

**Phase 1: Account Setup**
1. [ ] Create Upstash account and Redis database
2. [ ] Create Jobber Developer app with correct redirect URIs
3. [ ] Create Retell AI account, agent, and API key
4. [ ] Create Twilio account and purchase phone number
5. [ ] Create Fly.io account and install flyctl CLI

**Phase 2: Credential Collection**
6. [ ] Copy Upstash REST URL and Token
7. [ ] Copy Jobber Client ID and Secret
8. [ ] Copy Retell API Key and Agent ID
9. [ ] Generate Retell webhook secret
10. [ ] Copy Twilio Account SID, Auth Token, and Phone Number
11. [ ] Determine CEO phone number for transfers

**Phase 3: Deployment**
12. [ ] Run `fly launch --no-deploy` in server directory
13. [ ] Set all Fly.io secrets (see Section 6 above)
14. [ ] Run `fly deploy`
15. [ ] Verify deployment: `fly status`

**Phase 4: Webhook Configuration**
16. [ ] Configure Retell webhook URL in Retell dashboard
17. [ ] Configure Jobber webhook URL in Jobber developer portal
18. [ ] Complete Jobber OAuth flow by visiting /oauth/authorize

**Phase 5: Verification**
19. [ ] Verify health endpoint returns healthy
20. [ ] Test calculate_quote function via webhook
21. [ ] Submit test Angi lead to verify outbound calling

---

## Quick Verify

Test each service works after deployment. Run these commands to validate your setup.

### 1. Server Health Check
```bash
# Check server is running and Redis is connected
curl -s https://bluebucket-server.fly.dev/health | jq .

# Expected: {"status":"healthy","services":{"redis":"connected","jobber_token":"valid"}}
```

### 2. Redis Connection Test
```bash
# Test Redis via Upstash REST API directly
curl -s "https://YOUR_REDIS_URL/get/test" \
  -H "Authorization: Bearer YOUR_REDIS_TOKEN"

# Expected: {"result":null} (empty is fine, means connected)
```

### 3. Jobber Token Verification
```bash
# Check if Jobber OAuth token exists
curl -s https://bluebucket-server.fly.dev/health | jq '.services.jobber_token'

# Expected: "valid"
# If "missing", visit: https://bluebucket-server.fly.dev/oauth/authorize
```

### 4. Retell Webhook Test
```bash
# Test webhook signature validation
curl -s -X POST https://bluebucket-server.fly.dev/webhook/retell \
  -H "Content-Type: application/json" \
  -H "X-Retell-Signature: YOUR_WEBHOOK_SECRET" \
  -d '{"call_id":"test","function_name":"calculate_quote","arguments":{"bedrooms":3,"bathrooms":2,"square_feet":1500,"frequency":"one-time"}}'

# Expected: {"success":true,"quote":...} or similar response
```

### 5. Twilio Credentials Test
```bash
# Verify Twilio credentials (replace with your values)
curl -s -X GET "https://api.twilio.com/2010-04-01/Accounts/YOUR_ACCOUNT_SID.json" \
  -u "YOUR_ACCOUNT_SID:YOUR_AUTH_TOKEN" | jq '.status'

# Expected: "active"
```

### 6. Retell API Test
```bash
# Verify Retell API key works
curl -s -X GET "https://api.retellai.com/v2/agent/YOUR_AGENT_ID" \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY" | jq '.agent_name'

# Expected: Your agent name
```

### 7. End-to-End Test
```bash
# Simulate incoming Angi lead (via Jobber webhook)
# This should trigger outbound call scheduling
curl -s -X POST https://bluebucket-server.fly.dev/webhook/jobber \
  -H "Content-Type: application/json" \
  -d '{
    "event": "REQUEST_CREATE",
    "data": {
      "id": "test-123",
      "client": {
        "firstName": "Test",
        "lastName": "User",
        "phone": "+13031234567"
      },
      "title": "Test cleaning request"
    }
  }'

# Expected: {"success":true} and call scheduled in logs
```

### Quick Diagnostic Script
Save as `verify-setup.sh`:
```bash
#!/bin/bash
SERVER_URL="${1:-https://bluebucket-server.fly.dev}"

echo "=== Blue Bucket Setup Verification ==="
echo "Server: $SERVER_URL"
echo ""

echo "1. Health Check..."
HEALTH=$(curl -s "$SERVER_URL/health")
echo "   Response: $HEALTH"
echo ""

echo "2. Redis Status..."
REDIS=$(echo $HEALTH | jq -r '.services.redis // "unknown"')
echo "   Redis: $REDIS"
if [ "$REDIS" != "connected" ]; then
  echo "   ERROR: Redis not connected. Check UPSTASH_* credentials."
fi
echo ""

echo "3. Jobber Token..."
JOBBER=$(echo $HEALTH | jq -r '.services.jobber_token // "unknown"')
echo "   Token: $JOBBER"
if [ "$JOBBER" != "valid" ]; then
  echo "   WARNING: Complete OAuth at $SERVER_URL/oauth/authorize"
fi
echo ""

echo "=== Verification Complete ==="
```

Usage:
```bash
chmod +x verify-setup.sh
./verify-setup.sh https://bluebucket-server.fly.dev
```

---

## Support

- **Upstash Docs**: https://upstash.com/docs/redis/overall/getstarted
- **Jobber API**: https://developer.getjobber.com/docs
- **Fly.io Docs**: https://fly.io/docs/
- **Retell AI**: https://docs.retellai.com/
- **Twilio Docs**: https://www.twilio.com/docs

---

## File Locations

| File | Purpose |
|------|---------|
| `server/.env` | Your production credentials (git-ignored) |
| `server/.env.example` | Template with all variables |
| `server/.env.test` | Placeholder values for local testing |
| `SETUP_REQUIRED.md` | This file - setup guide |

---

## Environment Variables Reference

### Required Variables (Must Set)

| Variable | Source | Description |
|----------|--------|-------------|
| `UPSTASH_REDIS_REST_URL` | Upstash Console | Redis REST API URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Console | Redis authentication token |
| `JOBBER_CLIENT_ID` | Jobber Developer Portal | OAuth client ID |
| `JOBBER_CLIENT_SECRET` | Jobber Developer Portal | OAuth client secret |
| `RETELL_API_KEY` | Retell Dashboard | API authentication key |
| `RETELL_AGENT_ID` | Retell Dashboard | Voice agent identifier |
| `RETELL_WEBHOOK_SECRET` | Self-generated | Webhook signature verification |
| `TWILIO_ACCOUNT_SID` | Twilio Console | Account identifier |
| `TWILIO_AUTH_TOKEN` | Twilio Console | API authentication token |
| `TWILIO_PHONE_NUMBER` | Twilio Console | Outbound caller ID (E.164) |
| `WEBHOOK_URL` | Your deployment | Public server URL |
| `CEO_PHONE` | Business config | Transfer destination (E.164) |

### Optional Variables (Have Defaults)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |
| `BUSINESS_TZ` | America/Denver | Timezone for scheduling |
| `JOBBER_REDIRECT_URI` | localhost callback | OAuth redirect URI |
| `JOBBER_API_URL` | api.getjobber.com | Jobber GraphQL endpoint |
| `RETELL_SIP_DOMAIN` | livekit.cloud | SIP trunk domain |
| `OUTBOUND_CALLING_ENABLED` | true | Enable outbound calls |
| `OUTBOUND_CALL_DELAY` | 30 | Seconds before calling |
| `MAX_CALLS_PER_HOUR` | 50 | Rate limit |
| `OUTBOUND_MAX_RETRIES` | 2 | Retry attempts |
| `OUTBOUND_RETRY_DELAY` | 300 | Seconds between retries |
| `OUTBOUND_START_HOUR` | 9 | Earliest call time |
| `OUTBOUND_END_HOUR` | 20 | Latest call time |
| `TEAM_CAPACITY` | 2 | Number of cleaning teams |
| `BUSINESS_HOURS_START` | 08:00 | Business open time |
| `BUSINESS_HOURS_END` | 18:00 | Business close time |
| `WORK_DAYS` | 1,2,3,4,5 | Working days (Mon-Fri) |
| `SLOT_TIMES` | 09:00,13:00 | Appointment slots |
| `PRICE_PER_BEDROOM` | 35 | Quote pricing |
| `PRICE_PER_BATHROOM` | 25 | Quote pricing |
| `PRICE_SQFT_RATE` | 0.05 | Quote pricing |
| `PRICE_MINIMUM` | 100 | Minimum quote |
| `RECURRING_DISCOUNT` | 0.10 | Recurring service discount |
| `PHONE_MAPPING_TTL` | 7776000 | Phone cache (90 days) |
| `TOKEN_TTL` | 3500 | Token cache (~58 min) |
