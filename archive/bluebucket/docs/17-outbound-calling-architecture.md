# Outbound Calling Architecture

This document describes the webhook-triggered outbound calling system for automatic lead qualification.

## Overview

When new leads arrive via Angi (or other sources) into Jobber CRM, the system automatically initiates outbound calls to qualify prospects. This replaces manual SDR workflows with AI-powered voice agents.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OUTBOUND CALL FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

 ┌─────────┐     ┌──────────────┐     ┌─────────────────────────────────────┐
 │  Angi   │────>│   Jobber     │────>│  Blue Bucket Server                 │
 │  Lead   │     │  (CRM)       │     │                                     │
 └─────────┘     └──────────────┘     │  ┌─────────────────────────────────┐│
                       │              │  │ POST /webhook/jobber            ││
                       │              │  │ • Verify HMAC signature         ││
                       │              │  │ • Parse REQUEST_CREATE event    ││
                       │              │  │ • Extract phone from Request    ││
                       │              │  └──────────────┬──────────────────┘│
                       │              │                 │                   │
                       │              │  ┌──────────────▼──────────────────┐│
                       │              │  │ outboundCaller.scheduleCall()   ││
                       │              │  │ • Check working hours           ││
                       │              │  │ • Apply call delay (30s)        ││
                       │              │  │ • Check rate limits             ││
                       │              │  └──────────────┬──────────────────┘│
                       │              │                 │                   │
                       │              │  ┌──────────────▼──────────────────┐│
                       │              │  │ availabilityEncoder             ││
                       │              │  │ • Query Jobber for visits       ││
                       │              │  │ • Compress 3-week availability  ││
                       │              │  │ • Cache in Redis (15min TTL)    ││
                       │              │  └──────────────┬──────────────────┘│
                       │              │                 │                   │
                       │              │  ┌──────────────▼──────────────────┐│
                       │              │  │ retell/outbound.js              ││
                       │              │  │ • Register call with Retell     ││
                       │              │  │ • Pass availability as vars     ││
                       │              │  │ • Store call context            ││
                       │              │  └──────────────┬──────────────────┘│
                       │              └─────────────────┼───────────────────┘
                                                        │
┌─────────────────────────────────────────────────────────────────────────────┐
│                               CALL EXECUTION                                 │
└─────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────────────────┐
 │     Twilio      │     │     Retell      │     │     Prospect Phone          │
 │                 │     │     Agent       │     │                             │
 └────────┬────────┘     └────────┬────────┘     └──────────────┬──────────────┘
          │                       │                             │
          │  1. twilioClient.calls.create()                     │
          │<──────────────────────────────────────────────────────
          │                       │                             │
          │  2. Dial prospect     │                             │
          ├────────────────────────────────────────────────────>│
          │                       │                             │
          │  3. Prospect answers  │                             │
          │<────────────────────────────────────────────────────┤
          │                       │                             │
          │  4. Webhook: /webhook/twilio-connect-retell         │
          │──────────────────────>│                             │
          │                       │                             │
          │  5. TwiML: <Dial><Sip>│                             │
          │<──────────────────────│                             │
          │                       │                             │
          │  6. SIP connect to Retell                           │
          ├──────────────────────>│                             │
          │                       │                             │
          │                       │  7. AI converses with       │
          │                       │     prospect                │
          │                       │<───────────────────────────>│
          │                       │                             │
          │                       │  8. Function calls          │
          │                       │     (calculate_quote, etc)  │
          │                       │                             │

┌─────────────────────────────────────────────────────────────────────────────┐
│                            POST-CALL LOGGING                                 │
└─────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────┐     ┌─────────────────────────────────────────────────────┐
 │     Twilio      │     │  Blue Bucket Server                                 │
 │  statusCallback │     │                                                     │
 └────────┬────────┘     │  ┌─────────────────────────────────────────────────┐│
          │              │  │ POST /webhook/call-status                       ││
          │──────────────┼─>│ CallStatus=completed, Duration=120              ││
          │              │  └──────────────┬──────────────────────────────────┘│
          │              │                 │                                   │
          │              │  ┌──────────────▼──────────────────────────────────┐│
          │              │  │ callOutcomeLogger.logOutcome()                  ││
          │              │  │ • Determine outcome (booked/callback/etc)       ││
          │              │  │ • Create note on Jobber Request                 ││
          │              │  │ • Update Request status if needed               ││
          │              │  └─────────────────────────────────────────────────┘│
          │              └─────────────────────────────────────────────────────┘
```

## Components

### 1. Jobber Webhook Handler
**File**: `server/src/webhooks/jobber.js`

Receives REQUEST_CREATE events when new leads arrive:
- Verifies HMAC signature for security
- Parses request data from Jobber GraphQL API
- Extracts customer phone number
- Triggers outbound call scheduling

### 2. Outbound Caller Service
**File**: `server/src/services/outboundCaller.js`

Orchestrates the outbound call process:
- **Working Hours Check**: Ensures calls are within business hours (8am-8pm MT)
- **Call Delay**: Configurable wait before calling (default 30s)
- **Rate Limiting**: Prevents excessive calls per hour
- **Call Scheduling**: Queues calls for appropriate timing

Configuration:
```javascript
{
  callDelay: 30,           // seconds before calling
  callingHoursStart: 8,    // 8:00 AM
  callingHoursEnd: 20,     // 8:00 PM
  timezone: 'America/Denver',
  maxCallsPerHour: 30
}
```

### 3. Availability Encoder
**File**: `server/src/services/availabilityEncoder.js`

Pre-computes 3-week availability for instant slot lookup:
- Queries Jobber visits API for scheduled appointments
- Encodes as token-efficient bitfield format
- Caches in Redis with 15-minute TTL

Format: `AM21:1110111|PM21:0111011|...`
- Each bit = one day (1=available, 0=busy)
- AM/PM slots for morning/afternoon

### 4. Retell Outbound Client
**File**: `server/src/retell/outbound.js`

Registers calls with Retell AI:
- Creates call registration with agent ID
- Passes availability as dynamic variables
- Returns call ID for SIP bridging

### 5. Twilio Client
**File**: `server/src/twilio/client.js`

Handles phone dialing:
- Creates outbound call via Twilio API
- Configures SIP trunk for Retell connection
- Sets up status callback webhooks

### 6. Call Context Store
**File**: `server/src/services/callContextStore.js`

Maintains call state for outcome determination:
- Stores request ID, phone, timestamps
- Tracks function call results (booking made, etc)
- Enables outcome logging after call ends

### 7. Call Outcome Logger
**File**: `server/src/services/callOutcomeLogger.js`

Logs outcomes to Jobber CRM:
- Determines outcome from Twilio status, machine detection, transcript
- Creates note on Request with call summary
- Updates Request status (CONVERTED, ARCHIVED)

## Outcome Types

| Outcome | Description | Request Status |
|---------|-------------|----------------|
| `booked` | Appointment scheduled | CONVERTED |
| `callback_requested` | Customer wants callback | (unchanged) |
| `not_interested` | Customer declined | ARCHIVED |
| `voicemail` | Left voicemail | (unchanged) |
| `no_answer` | No answer after attempts | (unchanged) |
| `busy` | Line was busy | (unchanged) |
| `failed` | Technical failure | (unchanged) |

## Configuration

### Environment Variables
```bash
# Outbound Calling Control
OUTBOUND_ENABLED=true
OUTBOUND_CALL_DELAY=30

# Calling Hours (24-hour format)
CALLING_HOURS_START=8
CALLING_HOURS_END=20
BUSINESS_TIMEZONE=America/Denver

# Rate Limiting
MAX_CALLS_PER_HOUR=30

# Retell Configuration
RETELL_API_KEY=key_xxx
RETELL_AGENT_ID=agent_xxx
RETELL_PHONE_NUMBER=+17208174921

# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+17208174921
TWILIO_SIP_TRUNK_ID=TKxxx
SIP_USERNAME=xxx
SIP_PASSWORD=xxx

# Webhook URL (for Twilio callbacks)
WEBHOOK_URL=https://your-server.fly.dev
```

## Working Hours Logic

```javascript
function isWithinCallingHours() {
  const now = new Date();
  const localTime = new Date(now.toLocaleString('en-US', {
    timeZone: config.businessTz
  }));

  const hour = localTime.getHours();
  const day = localTime.getDay();

  // Skip weekends (optional)
  if (day === 0 || day === 6) return false;

  // Check hours
  return hour >= config.callingHoursStart &&
         hour < config.callingHoursEnd;
}
```

## Rate Limiting

Prevents overwhelming prospects or burning through call credits:

```javascript
async function checkRateLimit() {
  const key = `ratelimit:calls:${currentHour}`;
  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour TTL
  }

  return count <= config.maxCallsPerHour;
}
```

## Call Delay Strategy

A delay between lead arrival and call provides:
1. Time for Jobber data to fully sync
2. Customer just submitted form, still at computer
3. Reduces perception of "creepy fast" AI calling

Default: 30 seconds (configurable via OUTBOUND_CALL_DELAY)

## Error Handling

### Retell Registration Failure
- Log error with request ID
- Do not retry automatically (avoid duplicate calls)
- Alert ops team for investigation

### Twilio Dial Failure
- Log error with call details
- Retell call is orphaned but will timeout
- Consider retry logic for transient failures

### Working Hours Violation
- Queue call for next business day
- Log scheduling for audit trail

## Monitoring

### Health Check Response
```json
{
  "services": {
    "outbound_calling": "ready"
  }
}
```

Statuses:
- `ready`: All systems configured and operational
- `not_configured`: Missing Retell or Twilio credentials
- `disabled`: OUTBOUND_ENABLED=false

### Key Metrics to Track
- Calls initiated per hour
- Call success rate
- Average call duration
- Outcome distribution
- Time from lead to call

## Security Considerations

1. **Jobber Webhook Verification**: HMAC-SHA256 signature required
2. **Phone Number Validation**: Normalize and validate before dialing
3. **Rate Limiting**: Prevent abuse and cost overruns
4. **Credential Security**: SIP credentials in environment only
5. **Audit Logging**: All calls logged with timestamps and outcomes

## Testing

### Manual Testing
1. Create test Request in Jobber
2. Verify webhook received at `/webhook/jobber`
3. Check call initiated (Twilio console)
4. Verify SIP connection to Retell
5. Complete conversation
6. Verify outcome logged in Jobber

### Automated Tests
```bash
cd server
npm test -- --grep "outbound"
```

## Troubleshooting

### Calls Not Initiating
1. Check OUTBOUND_ENABLED=true
2. Verify within calling hours
3. Check rate limit not exceeded
4. Verify Jobber webhook configured
5. Check server logs for errors

### SIP Connection Failing
1. Verify SIP_USERNAME and SIP_PASSWORD
2. Check TWILIO_SIP_TRUNK_ID correct
3. Verify Retell call was registered
4. Check Twilio console for SIP errors

### Outcomes Not Logging
1. Verify call-status webhook configured in Twilio
2. Check callContextStore has call data
3. Verify Jobber OAuth token valid
4. Check for GraphQL mutation errors
