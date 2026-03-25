# Environment Configuration Guide

This guide covers all environment variables needed for the Blue Bucket Voice Demo.

## Table of Contents
1. [Quick Start Template](#1-quick-start-template)
2. [Variable Reference](#2-variable-reference)
3. [Getting Your Credentials](#3-getting-your-credentials)
4. [Security Best Practices](#4-security-best-practices)

---

## 1. Quick Start Template

Create a `.env` file in your project root with these variables:

```bash
# =============================================================================
# BLUE BUCKET VOICE DEMO - ENVIRONMENT VARIABLES
# =============================================================================
# SECURITY: Do not commit this file to version control
# =============================================================================

# -----------------------------------------------------------------------------
# CORE REQUIRED (Server will not start in production without these)
# -----------------------------------------------------------------------------

# Jobber OAuth Configuration
JOBBER_CLIENT_ID=your_jobber_client_id
JOBBER_CLIENT_SECRET=your_jobber_client_secret
JOBBER_REDIRECT_URI=http://localhost:3000/oauth/callback

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_redis_token

# Retell Webhook Security
RETELL_WEBHOOK_SECRET=whsec_your_webhook_secret

# -----------------------------------------------------------------------------
# RETELL AI CONFIGURATION
# -----------------------------------------------------------------------------

RETELL_API_KEY=key_your_retell_api_key_here
RETELL_AGENT_ID=agent_your_agent_id_here
RETELL_PHONE_NUMBER=+1XXXXXXXXXX
# RETELL_SIP_DOMAIN=5t4n6j0wnrl.sip.livekit.cloud  # Default works for most cases

# -----------------------------------------------------------------------------
# TWILIO CONFIGURATION
# -----------------------------------------------------------------------------

TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here

# Twilio SIP Trunk Credentials (optional - for Retell outbound via Twilio)
# TWILIO_SIP_TRUNK_ID=TKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# TWILIO_SIP_USERNAME=your_sip_username
# TWILIO_SIP_PASSWORD=your_sip_password

# -----------------------------------------------------------------------------
# SERVER CONFIGURATION
# -----------------------------------------------------------------------------

PORT=3000
NODE_ENV=development
WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app
BUSINESS_TZ=America/Denver

# -----------------------------------------------------------------------------
# OUTBOUND CALLING CONFIGURATION
# -----------------------------------------------------------------------------

OUTBOUND_CALLING_ENABLED=true
OUTBOUND_CALL_DELAY=30
MAX_CALLS_PER_HOUR=50
OUTBOUND_MAX_RETRIES=2
OUTBOUND_RETRY_DELAY=300
OUTBOUND_START_HOUR=9
OUTBOUND_END_HOUR=20

# -----------------------------------------------------------------------------
# BUSINESS OPERATIONS
# -----------------------------------------------------------------------------

# CEO/Owner phone for transfers
CEO_PHONE=+1XXXXXXXXXX

# Team and scheduling
TEAM_CAPACITY=2
BUSINESS_HOURS_START=08:00
BUSINESS_HOURS_END=18:00
WORK_DAYS=1,2,3,4,5
SLOT_TIMES=08:00,10:00,13:00,15:00

# -----------------------------------------------------------------------------
# PRICING CONFIGURATION (optional - defaults shown)
# -----------------------------------------------------------------------------

# Base pricing
# PRICE_PER_BEDROOM=35
# PRICE_PER_BATHROOM=25
# PRICE_SQFT_RATE=0.05
# PRICE_MINIMUM=100
# RECURRING_DISCOUNT=0.10

# Add-on pricing
# ADDON_DEEP_CLEAN=75
# ADDON_INSIDE_OVEN=35
# ADDON_INSIDE_FRIDGE=25
# ADDON_INSIDE_CABINETS=50
# ADDON_WINDOWS=5
# ADDON_LAUNDRY=25
# ADDON_GARAGE=40
# ADDON_PATIO=30
# ADDON_MOVE_IN_OUT=100

# -----------------------------------------------------------------------------
# STORAGE TTL CONFIGURATION (optional - defaults shown)
# -----------------------------------------------------------------------------

# PHONE_MAPPING_TTL=7776000  # 90 days in seconds
# TOKEN_TTL=3500             # ~58 minutes

# -----------------------------------------------------------------------------
# LEGACY/OPTIONAL
# -----------------------------------------------------------------------------

# T-Mobile Workaround - Bypass Caller ID
# BYPASS_CALLER_ID=+1XXXXXXXXXX

# OpenAI (optional - Retell provides hosted LLM)
# OPENAI_API_KEY=sk-your_openai_key_here
```

---

## 2. Variable Reference

### Core Required Variables

These variables are required for the server to start in production mode.

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `JOBBER_CLIENT_ID` | Jobber OAuth application client ID | `abc123...` | **Yes** |
| `JOBBER_CLIENT_SECRET` | Jobber OAuth application client secret | `secret_xyz...` | **Yes** |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | `https://xxx.upstash.io` | **Yes** |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token | `AXxxxx...` | **Yes** |
| `RETELL_WEBHOOK_SECRET` | Retell webhook signature validation secret | `whsec_...` | **Yes** |

### Retell AI Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `RETELL_API_KEY` | Your Retell AI API key | `key_abc123...` | None |
| `RETELL_AGENT_ID` | Your Retell agent ID | `agent_xyz789...` | None |
| `RETELL_WEBHOOK_SECRET` | Webhook signature validation secret | `whsec_...` | None |
| `RETELL_SIP_DOMAIN` | SIP domain for Retell calls | `5t4n6j0wnrl.sip.livekit.cloud` | `5t4n6j0wnrl.sip.livekit.cloud` |
| `RETELL_PHONE_NUMBER` | Phone number for Retell calls | `+17208174921` | Same as `TWILIO_PHONE_NUMBER` |

### Twilio Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `AC51fb41d9...` | None |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | `1ef9db6c4e...` | None |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (E.164) | `+17208174921` | None |

### SIP Trunk Variables (if using SIP integration)

| Variable | Description | Example |
|----------|-------------|---------|
| `TWILIO_SIP_TRUNK_ID` | Twilio SIP Trunk identifier | `TKXXXXXXXX...` |
| `TWILIO_SIP_USERNAME` | SIP authentication username | `sip_user` |
| `TWILIO_SIP_PASSWORD` | SIP authentication password | `sip_pass` |

### Jobber Integration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `JOBBER_CLIENT_ID` | OAuth application client ID | `abc123...` | None |
| `JOBBER_CLIENT_SECRET` | OAuth application client secret | `secret_xyz...` | None |
| `JOBBER_REDIRECT_URI` | OAuth callback redirect URI | `https://app.com/oauth/callback` | `http://localhost:3000/oauth/callback` |
| `JOBBER_API_URL` | Jobber GraphQL API endpoint | `https://api.getjobber.com/api/graphql` | `https://api.getjobber.com/api/graphql` |

### Redis Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST API URL | `https://xxx.upstash.io` | None |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST API token | `AXxxxx...` | None |

### Server Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `PORT` | Server port number | `3000` | `3000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `production` | `development` |
| `WEBHOOK_URL` | Public URL for webhooks (ngrok for dev) | `https://abc.ngrok-free.app` | None |
| `BUSINESS_TZ` | Timezone for business operations (IANA format) | `America/Denver` | `America/Denver` |

### Outbound Calling Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `OUTBOUND_CALLING_ENABLED` | Enable/disable outbound calling | `true` or `false` | `true` |
| `OUTBOUND_CALL_DELAY` | Delay (seconds) before calling a new lead | `30` | `30` |
| `MAX_CALLS_PER_HOUR` | Maximum outbound calls per hour (rate limit) | `50` | `50` |
| `OUTBOUND_MAX_RETRIES` | Maximum retry attempts for failed calls | `2` | `2` |
| `OUTBOUND_RETRY_DELAY` | Delay (seconds) between retry attempts | `300` | `300` (5 minutes) |
| `OUTBOUND_START_HOUR` | Earliest hour for outbound calls (24h format) | `9` | `9` (9 AM) |
| `OUTBOUND_END_HOUR` | Latest hour for outbound calls (24h format) | `20` | `20` (8 PM) |

### Business Operations Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `CEO_PHONE` | CEO phone number for transfers (E.164) | `+13035551234` | None |
| `TEAM_CAPACITY` | Number of concurrent appointments team can handle | `2` | `2` |
| `BUSINESS_HOURS_START` | Business hours start time (24h format) | `08:00` | `08:00` |
| `BUSINESS_HOURS_END` | Business hours end time (24h format) | `18:00` | `18:00` |
| `WORK_DAYS` | Comma-separated work days (0=Sun, 6=Sat) | `1,2,3,4,5` | `1,2,3,4,5` (Mon-Fri) |
| `SLOT_TIMES` | Comma-separated appointment slot times (24h) | `08:00,10:00,13:00,15:00` | `08:00,10:00,13:00,15:00` |

### Pricing Configuration

#### Base Pricing

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `PRICE_PER_BEDROOM` | Base price per bedroom | `35` | `35` |
| `PRICE_PER_BATHROOM` | Base price per bathroom | `25` | `25` |
| `PRICE_SQFT_RATE` | Price per square foot | `0.05` | `0.05` |
| `PRICE_MINIMUM` | Minimum job price | `100` | `100` |
| `RECURRING_DISCOUNT` | Discount for recurring customers (decimal) | `0.10` | `0.10` (10%) |

#### Add-On Services Pricing

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `ADDON_DEEP_CLEAN` | Deep clean add-on price | `75` | `75` |
| `ADDON_INSIDE_OVEN` | Inside oven cleaning price | `35` | `35` |
| `ADDON_INSIDE_FRIDGE` | Inside fridge cleaning price | `25` | `25` |
| `ADDON_INSIDE_CABINETS` | Inside cabinets cleaning price | `50` | `50` |
| `ADDON_WINDOWS` | Window cleaning price (per window) | `5` | `5` |
| `ADDON_LAUNDRY` | Laundry service price | `25` | `25` |
| `ADDON_GARAGE` | Garage cleaning price | `40` | `40` |
| `ADDON_PATIO` | Patio cleaning price | `30` | `30` |
| `ADDON_MOVE_IN_OUT` | Move-in/move-out cleaning price | `100` | `100` |

### Storage TTL Configuration

| Variable | Description | Example | Default |
|----------|-------------|---------|---------|
| `PHONE_MAPPING_TTL` | Phone-to-client mapping TTL (seconds) | `7776000` | `7776000` (90 days) |
| `TOKEN_TTL` | OAuth token storage TTL (seconds) | `3500` | `3500` (~58 minutes) |

### Legacy/Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CEO_PHONE_NUMBER` | Deprecated - use `CEO_PHONE` instead | None |
| `BYPASS_CALLER_ID` | Alternate caller ID for T-Mobile workaround | `TWILIO_PHONE_NUMBER` |
| `OPENAI_API_KEY` | OpenAI key (if using OpenAI LLM in Retell) | None |

---

## 3. Getting Your Credentials

### Jobber Credentials

1. **OAuth App Credentials**:
   - Log into [Jobber Developer Center](https://developer.getjobber.com)
   - Create or select your application
   - Copy **Client ID** and **Client Secret**
   - Set **Redirect URI** to match your server (e.g., `http://localhost:3000/oauth/callback`)

2. **API Version**:
   - The server uses API version `2025-04-16` by default
   - Check Jobber docs for latest version if needed

### Upstash Redis Credentials

1. **Create Redis Database**:
   - Log into [Upstash Console](https://console.upstash.com)
   - Click **Create Database**
   - Select region closest to your server

2. **Get REST API Credentials**:
   - Select your database
   - Go to **REST API** tab
   - Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN**

### Retell AI Credentials

1. **API Key**:
   - Log into [Retell Dashboard](https://dashboard.retellai.com)
   - Go to **Settings** → **API Keys**
   - Click **Create API Key**
   - Copy the key (starts with `key_`)

2. **Agent ID**:
   - Go to **Agents** in dashboard
   - Click on your agent
   - Copy the Agent ID from the URL or settings (starts with `agent_`)

3. **Webhook Secret**:
   - Go to **Settings** → **Webhooks**
   - Copy or generate webhook signing secret (starts with `whsec_`)

### Twilio Credentials

1. **Account SID and Auth Token**:
   - Log into [Twilio Console](https://console.twilio.com)
   - Dashboard shows Account SID and Auth Token
   - Click the eye icon to reveal Auth Token

2. **Phone Number**:
   - Go to **Phone Numbers** → **Manage** → **Active Numbers**
   - Copy your phone number in E.164 format (`+1XXXXXXXXXX`)

3. **SIP Trunk Credentials** (if using SIP):
   - Go to **Voice** → **Manage** → **SIP Trunking**
   - Select your trunk
   - Find Trunk SID (starts with `TK`)
   - Go to **Credential Lists** for username/password

### Webhook URL

**For Local Development (ngrok)**:
1. Start ngrok: `ngrok http 3000`
2. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

**For Production**:
Use your deployed server URL (e.g., `https://api.yourdomain.com`)

---

## 4. Security Best Practices

### Never Commit .env Files

Add to your `.gitignore`:
```gitignore
# Environment files
.env
.env.local
.env.*.local
*.env
```

### Use Environment-Specific Files

```
.env                # Local development
.env.production     # Production values (also gitignored)
.env.example        # Template with placeholder values (safe to commit)
```

### Validate Environment on Startup

The server includes built-in validation. In production mode, missing required variables will cause the server to exit. In development, warnings are logged but the server continues.

Required variables by category:
```javascript
const REQUIRED_VARS = {
  core: ['JOBBER_CLIENT_ID', 'JOBBER_CLIENT_SECRET'],
  redis: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
  security: ['RETELL_WEBHOOK_SECRET'],
};
```

For custom validation, you can add:
```javascript
function validateEnv() {
  const required = [
    // Core (enforced by server)
    'JOBBER_CLIENT_ID',
    'JOBBER_CLIENT_SECRET',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'RETELL_WEBHOOK_SECRET',
    // Outbound calling (optional but needed for calls)
    'RETELL_API_KEY',
    'RETELL_AGENT_ID',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_PHONE_NUMBER',
    'WEBHOOK_URL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error('Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }

  console.log('All required environment variables present');
}

// Call at startup
validateEnv();
```

### Rotate Credentials Regularly

1. Twilio Auth Tokens can be regenerated in console
2. Retell API keys can be rotated in settings
3. Update production environments securely

### Production Security

For production deployments:
- Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Set environment variables in your hosting platform
- Never log sensitive values
- Use HTTPS for all webhooks

---

## Example .env.example File

This file is safe to commit to version control:

```bash
# =============================================================================
# BLUE BUCKET VOICE DEMO - ENVIRONMENT TEMPLATE
# =============================================================================
# Copy this file to .env and fill in your actual values
# NEVER commit the .env file with real credentials
# =============================================================================

# -----------------------------------------------------------------------------
# CORE REQUIRED (Server will not start in production without these)
# -----------------------------------------------------------------------------

# Jobber OAuth Configuration
# Get from: https://developer.getjobber.com
JOBBER_CLIENT_ID=REPLACE_WITH_JOBBER_CLIENT_ID
JOBBER_CLIENT_SECRET=REPLACE_WITH_JOBBER_CLIENT_SECRET
JOBBER_REDIRECT_URI=http://localhost:3000/oauth/callback
# JOBBER_API_URL=https://api.getjobber.com/api/graphql

# Redis (Upstash)
# Get from: https://console.upstash.com
UPSTASH_REDIS_REST_URL=https://REPLACE_WITH_UPSTASH_URL.upstash.io
UPSTASH_REDIS_REST_TOKEN=REPLACE_WITH_UPSTASH_TOKEN

# Retell Webhook Security
# Get from: https://dashboard.retellai.com/settings/webhooks
RETELL_WEBHOOK_SECRET=whsec_REPLACE_WITH_WEBHOOK_SECRET

# -----------------------------------------------------------------------------
# RETELL AI CONFIGURATION
# -----------------------------------------------------------------------------

# Get from: https://dashboard.retellai.com/settings/api-keys
RETELL_API_KEY=key_REPLACE_WITH_YOUR_KEY
RETELL_AGENT_ID=agent_REPLACE_WITH_YOUR_AGENT_ID
RETELL_PHONE_NUMBER=+1XXXXXXXXXX
# RETELL_SIP_DOMAIN=5t4n6j0wnrl.sip.livekit.cloud

# -----------------------------------------------------------------------------
# TWILIO CONFIGURATION
# -----------------------------------------------------------------------------

# Get from: https://console.twilio.com
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=REPLACE_WITH_AUTH_TOKEN

# Twilio SIP Trunk (optional - for SIP integration)
# TWILIO_SIP_TRUNK_ID=TKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
# TWILIO_SIP_USERNAME=your_sip_username
# TWILIO_SIP_PASSWORD=your_sip_password

# -----------------------------------------------------------------------------
# SERVER CONFIGURATION
# -----------------------------------------------------------------------------

PORT=3000
NODE_ENV=development
BUSINESS_TZ=America/Denver

# Webhook URL
# For development: Use ngrok URL
# For production: Use your deployed server URL
WEBHOOK_URL=https://REPLACE_WITH_NGROK_OR_PRODUCTION_URL

# -----------------------------------------------------------------------------
# OUTBOUND CALLING CONFIGURATION
# -----------------------------------------------------------------------------

OUTBOUND_CALLING_ENABLED=true
# OUTBOUND_CALL_DELAY=30
# MAX_CALLS_PER_HOUR=50
# OUTBOUND_MAX_RETRIES=2
# OUTBOUND_RETRY_DELAY=300
# OUTBOUND_START_HOUR=9
# OUTBOUND_END_HOUR=20

# -----------------------------------------------------------------------------
# BUSINESS OPERATIONS
# -----------------------------------------------------------------------------

# CEO/Owner phone for transfers
CEO_PHONE=+1XXXXXXXXXX

# Team and scheduling
# TEAM_CAPACITY=2
# BUSINESS_HOURS_START=08:00
# BUSINESS_HOURS_END=18:00
# WORK_DAYS=1,2,3,4,5
# SLOT_TIMES=08:00,10:00,13:00,15:00

# -----------------------------------------------------------------------------
# PRICING CONFIGURATION (uncomment to override defaults)
# -----------------------------------------------------------------------------

# Base pricing
# PRICE_PER_BEDROOM=35
# PRICE_PER_BATHROOM=25
# PRICE_SQFT_RATE=0.05
# PRICE_MINIMUM=100
# RECURRING_DISCOUNT=0.10

# Add-on pricing
# ADDON_DEEP_CLEAN=75
# ADDON_INSIDE_OVEN=35
# ADDON_INSIDE_FRIDGE=25
# ADDON_INSIDE_CABINETS=50
# ADDON_WINDOWS=5
# ADDON_LAUNDRY=25
# ADDON_GARAGE=40
# ADDON_PATIO=30
# ADDON_MOVE_IN_OUT=100

# -----------------------------------------------------------------------------
# STORAGE TTL CONFIGURATION (optional)
# -----------------------------------------------------------------------------

# PHONE_MAPPING_TTL=7776000
# TOKEN_TTL=3500

# -----------------------------------------------------------------------------
# LEGACY/OPTIONAL
# -----------------------------------------------------------------------------

# T-Mobile Workaround (optional)
# BYPASS_CALLER_ID=+1XXXXXXXXXX

# OpenAI (optional - only if using custom LLM)
# OPENAI_API_KEY=sk-REPLACE_WITH_OPENAI_KEY
```

---

## Environment Setup Checklist

### Initial Setup
- [ ] Created `.env` file from template
- [ ] Added `.env` to `.gitignore`

### Core Required (Production)
- [ ] Set `JOBBER_CLIENT_ID` from Jobber Developer Center
- [ ] Set `JOBBER_CLIENT_SECRET` from Jobber Developer Center
- [ ] Set `UPSTASH_REDIS_REST_URL` from Upstash Console
- [ ] Set `UPSTASH_REDIS_REST_TOKEN` from Upstash Console
- [ ] Set `RETELL_WEBHOOK_SECRET` from Retell dashboard

### Retell Configuration
- [ ] Set `RETELL_API_KEY` from Retell dashboard
- [ ] Set `RETELL_AGENT_ID` from Retell dashboard
- [ ] Configured Retell agent with correct prompts

### Twilio Configuration
- [ ] Set `TWILIO_ACCOUNT_SID` from Twilio console
- [ ] Set `TWILIO_AUTH_TOKEN` from Twilio console
- [ ] Set `TWILIO_PHONE_NUMBER` from Twilio console

### Server & Webhooks
- [ ] Started ngrok and set `WEBHOOK_URL`
- [ ] Updated Retell webhook URL to match ngrok URL
- [ ] Set `BUSINESS_TZ` to correct timezone

### Business Configuration
- [ ] Set `CEO_PHONE` for call transfers
- [ ] Configured business hours if different from defaults
- [ ] Configured pricing if different from defaults

### Verification
- [ ] Tested with `/health` endpoint
- [ ] Verified Jobber OAuth flow works
- [ ] Tested inbound call handling
- [ ] Tested outbound calling (if enabled)

---

## Troubleshooting Environment Issues

### "Cannot read property of undefined"
Usually means an environment variable is not set. Check:
```javascript
console.log('RETELL_API_KEY:', process.env.RETELL_API_KEY ? 'Set' : 'MISSING');
```

### "Invalid API Key"
- Verify the key is copied correctly (no extra spaces)
- Check if key was revoked or expired
- Generate a new key if needed

### Webhook URL Issues
- ngrok URL changes on restart (free tier)
- Remember to update both `.env` AND Retell dashboard
- Use `http://localhost:4040` to verify ngrok is working
