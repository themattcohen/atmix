# Server Implementation Guide

This guide covers the Express.js server implementation for the Blue Bucket Voice Agent, including all endpoints, webhooks, and business logic.

## Table of Contents
1. [Project Structure](#1-project-structure)
2. [Dependencies](#2-dependencies)
3. [Core Architecture](#3-core-architecture)
4. [Endpoints Reference](#4-endpoints-reference)
5. [Webhook Handlers](#5-webhook-handlers)
6. [Business Logic Functions](#6-business-logic-functions)
7. [Running Locally](#7-running-locally)

---

## 1. Project Structure

```
bluebucket/
├── server/
│   ├── src/
│   │   ├── index.js              # Main Express server
│   │   ├── config.js             # Configuration management
│   │   ├── redis.js              # Redis client
│   │   ├── handlers/             # Function handlers
│   │   │   ├── index.js          # Handler router
│   │   │   ├── lookupCustomer.js
│   │   │   ├── calculateQuote.js
│   │   │   ├── checkAvailability.js
│   │   │   ├── bookAppointment.js
│   │   │   └── transferToCeo.js
│   │   ├── webhooks/             # Webhook handlers
│   │   │   ├── index.js          # Webhook router
│   │   │   ├── retell.js         # Retell function callbacks
│   │   │   ├── jobber.js         # Jobber webhook events
│   │   │   └── twilio.js         # Twilio SIP & status
│   │   ├── jobber/               # Jobber API integration
│   │   │   ├── index.js          # Combined exports
│   │   │   ├── client.js         # GraphQL client
│   │   │   ├── oauth.js          # OAuth 2.0 flow
│   │   │   └── queries.js        # GraphQL queries
│   │   ├── services/             # Business services
│   │   │   ├── outboundCaller.js      # Outbound call orchestration
│   │   │   ├── availabilityEncoder.js # Availability compression
│   │   │   ├── callOutcomeLogger.js   # Post-call CRM logging
│   │   │   └── callContextStore.js    # Call state tracking
│   │   ├── retell/               # Retell integration
│   │   │   └── outbound.js       # Outbound call registration
│   │   ├── twilio/               # Twilio integration
│   │   │   └── client.js         # Twilio API client
│   │   └── utils/                # Utilities
│   │       └── phone.js          # Phone number normalization
│   ├── tests/                    # Test files
│   ├── package.json
│   ├── Dockerfile
│   └── fly.toml
├── docs/                         # Documentation
├── scripts/                      # Setup & dev scripts
│   ├── setup/
│   │   ├── configure-retell.js
│   │   ├── setup-agent.js
│   │   └── setup-sip-trunk.js
│   └── dev/
│       ├── check-llm.js
│       └── check-twilio.js
├── public/                       # Test dashboard
├── prd/                          # Product requirements
├── .env.example
└── package.json
```

---

## 2. Dependencies

### server/package.json
```json
{
  "name": "blue-bucket-server",
  "version": "1.0.0",
  "description": "Blue Bucket Voice Agent Server",
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "jest"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "helmet": "^7.1.0",
    "ioredis": "^5.3.2",
    "morgan": "^1.10.0",
    "retell-sdk": "^4.0.0",
    "twilio": "^4.19.0"
  }
}
```

### Dependency Purposes
| Package | Purpose |
|---------|---------|
| express | Web server framework |
| helmet | Security headers |
| cors | Cross-origin resource sharing |
| morgan | Request logging |
| ioredis | Redis client for token storage & caching |
| retell-sdk | Retell AI API client |
| twilio | Twilio API for calling |
| dotenv | Environment variable management |

---

## 3. Core Architecture

### Call Flow Overview

**Inbound Calls:**
```
Customer → Twilio → SIP Bridge → Retell Agent → Function Webhooks → Jobber API
```

**Outbound Calls (Webhook-Triggered):**
```
Jobber REQUEST_CREATE → Webhook → Delay → Retell Register → Twilio Dial → SIP → Agent
```

### Key Architectural Decisions

1. **Webhook-Triggered Outbound Calls**: Outbound calls are automatically triggered when new leads arrive via Jobber webhooks, not via API endpoints.

2. **Working Hours Enforcement**: Calls are only placed during configurable business hours (default 8am-8pm MT).

3. **Call Delay**: Configurable delay before calling (default 30 seconds) to allow lead data to settle.

4. **Availability Compression**: Pre-computed 3-week availability passed to agent as dynamic variables for instant slot lookup.

5. **Outcome Logging**: Post-call outcomes logged to Jobber CRM with notes and status updates.

---

## 4. Endpoints Reference

### Health Check

#### GET /health
Health check endpoint for monitoring and load balancers.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T12:00:00.000Z",
  "uptime": 3600,
  "version": "1.0.0",
  "services": {
    "redis": "connected",
    "jobber_token": "valid",
    "outbound_calling": "ready"
  }
}
```

### OAuth Endpoints

#### GET /oauth/authorize
Initiates Jobber OAuth flow by redirecting to Jobber's authorization page.

#### GET /oauth/callback
OAuth callback endpoint. Exchanges authorization code for tokens.

**Query Parameters:**
- `code` - Authorization code from Jobber
- `error` - Error code if authorization denied

**Response:**
```json
{
  "success": true,
  "message": "Jobber authorization successful",
  "expiresIn": 7200
}
```

#### GET /oauth/status
Check current OAuth authorization status. Useful for health checks and validating the Jobber integration is properly configured.

**Response (Authorized):**
```json
{
  "authorized": true,
  "expiresAt": "2026-01-17T14:00:00.000Z",
  "isExpired": false,
  "hasRefreshToken": true
}
```

**Response (Not Authorized):**
```json
{
  "authorized": false,
  "reason": "No tokens stored"
}
```

#### POST /oauth/revoke
Revoke current OAuth tokens and clear storage. Use when disconnecting the Jobber integration.

**Response (Success):**
```json
{
  "success": true,
  "message": "Tokens revoked successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message describing the failure"
}
```

---

## 5. Webhook Handlers

### POST /webhook/retell
Called by Retell when the AI agent needs to execute a function.

**Security**: HMAC signature verification required (X-Retell-Signature header).

**Request:**
```json
{
  "call": { "call_id": "call_abc123" },
  "name": "calculate_quote",
  "args": {
    "bedrooms": 3,
    "bathrooms": 2,
    "frequency": "bi-weekly"
  }
}
```

**Response:**
```json
{
  "response": "For a 3-bedroom, 2-bathroom home with bi-weekly service..."
}
```

### POST /webhook/jobber
Called by Jobber for webhook events (REQUEST_CREATE, etc).

**Security**: HMAC signature verification required (X-Jobber-Hmac-SHA256 header).

**Supported Events:**
- `REQUEST_CREATE`: New lead/request created → triggers outbound call

**Request:**
```json
{
  "webHookEvent": "REQUEST_CREATE",
  "appId": "app_123",
  "topic": "REQUEST_CREATE",
  "itemId": "request_456",
  "accountId": "account_789"
}
```

### ALL /webhook/twilio-connect-retell
Called by Twilio when call is answered. Returns TwiML to connect via SIP.

**Query Parameters:**
- `retell_call_id` - The Retell call ID to connect to
- `context` - Optional call context

**Response (TwiML):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Sip username="..." password="...">
      sip:call_id@5t4n6j0wnrl.sip.livekit.cloud
    </Sip>
  </Dial>
</Response>
```

### POST /webhook/call-status
Called by Twilio with call status updates. Used for logging and tracking call outcomes. On completion or failure, logs outcomes to Jobber CRM.

**Request (form-urlencoded):**
```
CallSid=CA123456
CallStatus=completed
To=+13035551234
From=+17208174921
Duration=120
AnsweredBy=human
CallDuration=120
```

**Status Values:**
| Status | Description |
|--------|-------------|
| `initiated` | Call is being placed |
| `ringing` | Phone is ringing |
| `answered` | Call was answered |
| `completed` | Call ended normally |
| `busy` | Line was busy |
| `no-answer` | No one answered |
| `failed` | Call failed |
| `canceled` | Call was canceled |

**Response:** `200 OK` (empty body)

**Behavior:**
- All statuses are logged for debugging and analytics
- On `completed`, `busy`, `no-answer`, or `failed`: outcome is logged to Jobber CRM via `callOutcomeLogger`

### POST /webhook/machine-detection
Called by Twilio with answering machine detection results.

**Request (form-urlencoded):**
```
CallSid=CA123456
AnsweredBy=machine_start
To=+13035551234
MachineDetectionDuration=3500
```

**AnsweredBy Values:**
| Value | Description |
|-------|-------------|
| `human` | Call answered by a person |
| `machine_start` | Answering machine detected at start |
| `machine_end_beep` | Voicemail beep detected |
| `machine_end_silence` | Voicemail ended with silence |
| `machine_end_other` | Other voicemail ending |
| `fax` | Fax machine detected |
| `unknown` | Could not determine |

**Response:** `200 OK` (empty body)

### GET /webhook/twilio/health
Health check endpoint for Twilio webhook configuration.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-17T12:00:00.000Z",
  "configuration": {
    "isReady": true,
    "accountSid": "configured",
    "fromNumber": "configured"
  },
  "endpoints": [
    "POST /webhook/twilio-connect-retell",
    "POST /webhook/call-status",
    "POST /webhook/machine-detection"
  ]
}
```

---

## 6. Business Logic Functions

### Function Handlers

| Function | Handler File | Purpose |
|----------|-------------|---------|
| `lookup_customer` | lookupCustomer.js | Look up customer by phone in Jobber |
| `calculate_quote` | calculateQuote.js | Calculate cleaning quote |
| `check_availability` | checkAvailability.js | Check calendar availability |
| `book_appointment` | bookAppointment.js | Create job in Jobber |
| `transfer_to_ceo` | transferToCeo.js | Transfer call to owner |

### Quote Calculation Formula
```javascript
// Base pricing
let base = 100;
let price = base + (bedrooms * 15) + (bathrooms * 20) + (sqft * 0.05);

// Frequency discounts
if (frequency === 'bi-weekly') price *= 0.9;  // 10% discount
if (frequency === 'weekly') price *= 0.85;    // 15% discount

// Add-ons
if (addOns.includes('deep-clean')) price += 50;
if (addOns.includes('inside-fridge')) price += 25;
```

### Square Footage Estimation
```javascript
const estimatedSqft = sqft || (bedrooms * 400 + 200);
```

---

## 7. Running Locally

### Step 1: Install Dependencies
```bash
cd server
npm install
```

### Step 2: Set Up Environment Variables
```bash
cp .env.example .env
# Edit .env with your actual values
```

### Step 3: Start Redis
```bash
# Using Docker
docker run -d -p 6379:6379 redis

# Or use a hosted Redis (Upstash, etc)
```

### Step 4: Start ngrok Tunnel
```bash
ngrok http 3000
```

Note your ngrok URL (e.g., `https://abc123.ngrok-free.app`)

### Step 5: Update Configuration
```bash
# In .env
WEBHOOK_URL=https://abc123.ngrok-free.app
```

### Step 6: Configure Retell Webhook
In Retell dashboard, update your agent's webhook URL:
```
https://abc123.ngrok-free.app/webhook/retell
```

### Step 7: Start Server
```bash
npm run dev
```

### Step 8: Authorize Jobber
1. Navigate to `http://localhost:3000/oauth/authorize`
2. Complete OAuth flow in Jobber
3. Verify at `http://localhost:3000/oauth/status`

---

## Common Issues

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :3000
taskkill /F /PID <PID>
```

### Redis Connection Failed
1. Verify Redis is running
2. Check REDIS_URL in .env
3. Test: `redis-cli ping`

### Webhook Signature Verification Failed
1. Verify RETELL_WEBHOOK_SECRET is correct
2. Verify JOBBER_WEBHOOK_SECRET matches Jobber app settings
3. Check request body is not modified before verification

### Outbound Calls Not Working
1. Check `/health` endpoint for outbound_calling status
2. Verify RETELL_API_KEY and RETELL_AGENT_ID
3. Verify TWILIO credentials and SIP trunk
4. Check if within calling hours

---

## Next Steps

1. Environment configuration: [04-environment-config.md](./04-environment-config.md)
2. Troubleshooting: [05-troubleshooting.md](./05-troubleshooting.md)
3. Deployment: [06-deployment.md](./06-deployment.md)
4. Outbound calling architecture: [17-outbound-calling-architecture.md](./17-outbound-calling-architecture.md)
