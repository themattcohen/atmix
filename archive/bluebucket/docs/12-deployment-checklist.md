# Deployment Checklist

Step-by-step checklist for deploying the Blue Bucket Voice Demo to production. Complete each section in order.

---

## Quick Reference: Deployment Stages

```
1. Prerequisites (accounts, credentials)
   └─▶ 2. Jobber Setup (OAuth, API access)
       └─▶ 3. Code Deployment (server, webhooks)
           └─▶ 4. Retell Configuration (agent, functions)
               └─▶ 5. Twilio Trust Hub (caller ID verification)
                   └─▶ 6. Final Testing (E2E verification)
                       └─▶ 7. Go Live (monitoring, handoff)
```

---

## Stage 1: Prerequisites

### Accounts Required

| Service | URL | Status |
|---------|-----|--------|
| Retell AI | https://www.retellai.com | [ ] |
| Twilio | https://www.twilio.com | [ ] |
| Jobber | https://getjobber.com | [ ] |
| Fly.io | https://fly.io | [ ] |
| Upstash Redis | https://upstash.com | [ ] |
| Docker Desktop | https://docker.com | [ ] |

### API Keys & Credentials to Gather

- [ ] **Retell API Key**: Dashboard → Settings → API Keys
- [ ] **Retell Agent ID**: After creating agent
- [ ] **Twilio Account SID**: Console → Account Info
- [ ] **Twilio Auth Token**: Console → Account Info
- [ ] **Twilio Phone Number**: Buy a number (+1 303 area preferred)
- [ ] **Jobber Client ID**: Developer Portal → App Settings
- [ ] **Jobber Client Secret**: Developer Portal → App Settings
- [ ] **CEO Phone Number**: For transfer escalations

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/bluebucket.git
cd bluebucket

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
notepad .env  # or code .env
```

### Environment Variables Template

```env
# Server
PORT=3000
NODE_ENV=development
WEBHOOK_URL=https://your-ngrok-url.ngrok.io

# Retell
RETELL_API_KEY=key_your_retell_key_here
RETELL_AGENT_ID=agent_your_agent_id_here

# Twilio
TWILIO_ACCOUNT_SID=ACyour_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+13035551234

# Jobber
JOBBER_CLIENT_ID=your_client_id_here
JOBBER_CLIENT_SECRET=your_client_secret_here
JOBBER_REDIRECT_URI=https://your-domain.com/auth/jobber/callback

# Business
CEO_PHONE_NUMBER=+13035559999
BYPASS_CALLER_ID=+1your_test_number

# Optional
LOG_LEVEL=info
```

---

## Stage 2: Jobber Setup

### 2.1 Create Jobber Developer App

- [ ] Go to: https://developer.getjobber.com/
- [ ] Click "Create App"
- [ ] Fill in details:
  - App Name: `Blue Bucket Voice Agent`
  - Description: `AI voice agent for lead qualification and booking`
  - Redirect URI: `https://your-domain.com/auth/jobber/callback`
- [ ] Note the Client ID and Client Secret
- [ ] Select required scopes:
  - `read_clients` - Look up customers
  - `write_clients` - Create new customers
  - `read_jobs` - View job details
  - `write_jobs` - Create bookings
  - `read_schedule` - Check availability

### 2.2 Complete OAuth Flow

- [ ] Start local server: `npm run dev`
- [ ] Start ngrok: `ngrok http 3000`
- [ ] Update `.env` with ngrok URL
- [ ] Navigate to: `https://your-ngrok.ngrok.io/auth/jobber`
- [ ] Log in to Jobber and authorize
- [ ] Verify tokens saved (check logs/database)
- [ ] Test token refresh works

### 2.3 Verify Jobber API Access

```bash
# Test client lookup
curl -X POST http://localhost:3000/webhook/retell-functions \
  -H "Content-Type: application/json" \
  -d '{"function_name":"lookup_customer","arguments":{"phone_number":"+13035551234"},"call_metadata":{"call_id":"test"}}'

# Test availability check
curl -X POST http://localhost:3000/webhook/retell-functions \
  -H "Content-Type: application/json" \
  -d '{"function_name":"check_availability","arguments":{"preferred_date":"2024-12-01","service_duration_hours":3},"call_metadata":{"call_id":"test"}}'
```

- [ ] Client lookup returns data (or "not found")
- [ ] Availability check returns slots
- [ ] No authentication errors

---

## Stage 3: Code Deployment (Fly.io + Docker)

> **See `13-deployment-flyio-docker.md` for detailed instructions**

### 3.1 Set Up Upstash Redis

- [ ] Go to https://console.upstash.com/
- [ ] Create database: `bluebucket-prod`, region `us-west-1`
- [ ] Copy `UPSTASH_REDIS_REST_URL`
- [ ] Copy `UPSTASH_REDIS_REST_TOKEN`

### 3.2 Test Locally with Docker

```bash
cd server

# Copy environment template
cp .env.example .env
# Edit .env with your credentials

# Build and run locally
docker-compose up --build

# Test health check
curl http://localhost:3000/health
```

- [ ] Docker builds successfully
- [ ] Health check returns "healthy"
- [ ] No errors in logs

### 3.3 Deploy to Fly.io

```bash
cd server

# Login to Fly.io
fly auth login

# Create app (first time only)
fly launch --no-deploy

# Set secrets (NEVER in fly.toml)
fly secrets set JOBBER_CLIENT_ID="your_client_id"
fly secrets set JOBBER_CLIENT_SECRET="your_client_secret"
fly secrets set UPSTASH_REDIS_REST_URL="https://xxx.upstash.io"
fly secrets set UPSTASH_REDIS_REST_TOKEN="AXxxx..."
fly secrets set RETELL_WEBHOOK_SECRET="your_random_secret"
fly secrets set CEO_PHONE="+13035551234"

# Deploy
fly deploy
```

- [ ] Fly.io app created
- [ ] All secrets set
- [ ] Deployment successful

### 3.4 Get Production URL

- [ ] Run `fly status` to see URL
- [ ] Production URL: `https://bluebucket-server.fly.dev`

### 3.5 Verify Deployment

```bash
# Health check
curl https://bluebucket-server.fly.dev/health

# Check logs
fly logs
```

- [ ] Health check returns "healthy"
- [ ] Redis connected
- [ ] No errors in logs

### 3.6 Authorize Jobber (Production)

- [ ] Navigate to: `https://bluebucket-server.fly.dev/oauth/authorize`
- [ ] Complete OAuth flow for production
- [ ] Verify tokens saved to Redis

---

## Stage 4: Retell Configuration

### 4.1 Create Agent

- [ ] Go to Retell Dashboard → Agents → Create Agent
- [ ] Set Agent Name: `Blue Bucket - Sarah`
- [ ] Select Voice: Choose natural-sounding female voice
- [ ] Set Language: English (US)

### 4.2 Configure Agent Prompt

- [ ] Go to Agent → Prompt
- [ ] Copy entire prompt from `docs/09-agent-prompt.md`
- [ ] Paste into System Prompt field
- [ ] Save

### 4.3 Add Custom Functions

For each function in `docs/10-function-definitions.md`:

- [ ] **lookup_customer**
  - Go to Agent → Custom Functions → Add Function
  - Paste JSON schema
  - Save

- [ ] **calculate_quote**
  - Add Function
  - Paste JSON schema
  - Save

- [ ] **check_availability**
  - Add Function
  - Paste JSON schema
  - Save

- [ ] **book_appointment**
  - Add Function
  - Paste JSON schema
  - Save

- [ ] **transfer_to_ceo**
  - Add Function
  - Paste JSON schema
  - Save

### 4.4 Set Webhook URL

- [ ] Go to Agent → Settings
- [ ] Set Webhook URL: `https://bluebucket.up.railway.app/webhook/retell-functions`
- [ ] Enable "Send call metadata"
- [ ] Save

### 4.5 Configure Dynamic Variables

- [ ] Go to Agent → Dynamic Variables
- [ ] Add defaults:
  - `customer_name`: `"valued customer"`
  - `customer_phone`: `""`
  - `service_type_requested`: `"house cleaning"`
  - `address`: `""`
  - `lead_source`: `"direct call"`

### 4.6 Upload Knowledge Base (Optional)

If using Knowledge Base instead of long prompt:
- [ ] Go to Agent → Knowledge Base
- [ ] Upload `docs/07-knowledge-base-content.md` (convert to plain text first)
- [ ] Wait for processing
- [ ] Test Q&A

### 4.7 Test Agent in Playground

- [ ] Go to Agent → Playground
- [ ] Start test conversation
- [ ] Verify:
  - [ ] Greeting plays correctly
  - [ ] AI identifies as Sarah
  - [ ] Questions asked properly
  - [ ] Functions execute (check server logs)

### 4.8 Note Agent ID

- [ ] Copy Agent ID from URL or settings
- [ ] Update `RETELL_AGENT_ID` in production environment

---

## Stage 5: Twilio Trust Hub

### 5.1 Create Business Profile

- [ ] Go to Twilio Console → Trust Hub → Customer Profiles
- [ ] Click "Create Profile"
- [ ] Select "Business"
- [ ] Fill in business details:
  - Business Name: `The Blue Bucket Cleaning Service`
  - Business Type: `LLC` (or appropriate)
  - Business Registration Number: EIN
  - Address: Full business address
- [ ] Upload documentation:
  - Business registration document
  - Utility bill or bank statement for address verification
- [ ] Submit for review

### 5.2 Wait for Business Profile Approval

- [ ] Status shows "Pending Review"
- [ ] Wait 1-3 business days
- [ ] Check email for updates
- [ ] Status changes to "Approved" ✓

### 5.3 Create SHAKEN/STIR Trust Product

- [ ] Go to Trust Hub → Trust Products
- [ ] Click "Create Trust Product"
- [ ] Select "SHAKEN/STIR"
- [ ] Link to approved Business Profile
- [ ] Submit for review

### 5.4 Wait for SHAKEN/STIR Approval

- [ ] Status shows "Pending Review"
- [ ] Wait 1-3 business days
- [ ] Status changes to "Approved" ✓

### 5.5 Assign Phone Number to Trust Products

- [ ] Go to Trust Hub → Phone Numbers
- [ ] Select your Twilio phone number
- [ ] Assign to Business Profile
- [ ] Assign to SHAKEN/STIR Trust Product
- [ ] Save

### 5.6 Verify A-Attestation

- [ ] Make test call from Twilio number
- [ ] Check Twilio call logs
- [ ] Look for "verstat" in SIP headers
- [ ] Verify shows "A" attestation (not B or C)

### 5.7 Configure Twilio Voice Webhook

- [ ] Go to Twilio Console → Phone Numbers → Your Number
- [ ] Under "Voice & Fax":
  - A Call Comes In: Webhook
  - URL: `https://api.retellai.com/twilio-voice-webhook/your-agent-id`
  - HTTP Method: POST
- [ ] Save

---

## Stage 6: Final Testing

### 6.1 End-to-End Test Calls

Complete each scenario from `docs/11-testing-procedures.md`:

- [ ] **New Customer Booking**: Full flow from greeting to confirmation
- [ ] **Existing Customer Recognition**: Customer identified by phone
- [ ] **Quote with Add-ons**: Multiple services quoted correctly
- [ ] **Recurring Service Discount**: 10% discount applied
- [ ] **Price Objection Handling**: Empathetic response
- [ ] **Transfer to Human**: Escalation works
- [ ] **Outside Service Area**: Politely declined

### 6.2 Verify Jobber Integration

- [ ] Bookings appear in Jobber calendar
- [ ] Customer records created/updated
- [ ] Job details match quote
- [ ] SMS confirmations sent (via Jobber)

### 6.3 Performance Verification

- [ ] Response latency < 800ms average
- [ ] No dropped calls during testing
- [ ] Server logs show no errors
- [ ] Memory usage stable

### 6.4 Voice Quality Check

- [ ] AI voice sounds natural
- [ ] Numbers spoken correctly
- [ ] Dates spoken correctly
- [ ] No awkward pauses
- [ ] Interruption handling works

---

## Stage 7: Go Live

### 7.1 Remove Test Configurations

- [ ] Remove `BYPASS_CALLER_ID` or set to empty
- [ ] Set `NODE_ENV=production`
- [ ] Disable verbose logging if needed
- [ ] Remove any test data from Jobber

### 7.2 Set Up Monitoring

- [ ] Configure logging service (Logtail/Papertrail)
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Create alert for health check failures
- [ ] Set up error notification (email/Slack)

### 7.3 Documentation Handoff

Provide to business owner:
- [ ] Phone number to publish
- [ ] How to check bookings in Jobber
- [ ] How to update Knowledge Base content
- [ ] Support contact for technical issues
- [ ] Instructions for common changes

### 7.4 Launch Communication

- [ ] Update website with phone number
- [ ] Update Google Business listing
- [ ] Update Angi profile
- [ ] Train staff on new system
- [ ] Set expectations for call volume

### 7.5 Post-Launch Monitoring

First 24-48 hours:
- [ ] Monitor call logs
- [ ] Review any errors
- [ ] Check booking accuracy
- [ ] Gather initial feedback
- [ ] Be available for quick fixes

---

## Rollback Procedure

If critical issues arise:

### Immediate Rollback (< 5 minutes)

1. **Disable Twilio Webhook**:
   - Go to Twilio Console → Phone Number
   - Change webhook to: `https://demo.twilio.com/welcome/voice/`
   - This plays a default message

2. **Forward to CEO**:
   - Or set webhook to forward directly to CEO phone

### Full Rollback

1. **Revert Code Changes**:
   ```bash
   # In Railway
   # Go to Deployments → Previous deployment → Rollback

   # Or via Git
   git revert HEAD
   git push
   ```

2. **Restore Environment Variables**:
   - Keep backup of working `.env`
   - Restore if needed

3. **Notify Stakeholders**:
   - Inform business owner
   - Document what failed
   - Plan fix

---

## Quick Reference: Key URLs

| Service | Production URL |
|---------|---------------|
| Server | https://bluebucket-server.fly.dev |
| Health Check | https://bluebucket-server.fly.dev/health |
| Retell Webhook | https://bluebucket-server.fly.dev/webhook/retell |
| Jobber Webhook | https://bluebucket-server.fly.dev/webhook/jobber |
| Jobber OAuth | https://bluebucket-server.fly.dev/oauth/callback |
| Retell Dashboard | https://www.retellai.com/dashboard |
| Twilio Console | https://console.twilio.com |
| Jobber App | https://secure.getjobber.com |
| Fly.io Dashboard | https://fly.io/apps/bluebucket-server |
| Upstash Console | https://console.upstash.com |

---

## Deployment Sign-Off

| Stage | Completed By | Date | Notes |
|-------|--------------|------|-------|
| Prerequisites | | | |
| Jobber Setup | | | |
| Code Deployment | | | |
| Retell Configuration | | | |
| Twilio Trust Hub | | | |
| Final Testing | | | |
| Go Live | | | |

**Final Approval**:

- [ ] All tests passing
- [ ] Business owner sign-off
- [ ] Technical owner sign-off
- [ ] Support plan in place

**Go Live Date**: _________________

**Deployed By**: _________________
