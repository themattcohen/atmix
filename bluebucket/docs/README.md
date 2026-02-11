# Blue Bucket Voice Agent - Production System

## Overview

Blue Bucket is an AI-powered voice agent for a Denver-based house cleaning company. The system handles inbound calls from Angi leads, provides quotes, checks availability, and books appointments automatically.

**Stack:**
- **Voice AI**: Retell AI (Sarah persona)
- **Telephony**: Twilio (with STIR/SHAKEN A-attestation)
- **CRM**: Jobber (GraphQL API v2025-04-16)
- **Server**: Node.js + Express in Docker
- **Hosting**: Fly.io (free tier)
- **Storage**: Upstash Redis (free tier)

---

## MVP Scope (Current)

| Feature | Status | Notes |
|---------|--------|-------|
| Angi lead handling | ✅ In Scope | Phone mapping via Jobber webhook |
| Quote calculation | ✅ In Scope | Local pricing formula |
| Availability checking | ✅ In Scope | Jobber `visits` query |
| Appointment booking | ✅ In Scope | Jobber `jobCreate` mutation |
| New customer creation | ❌ OUT OF SCOPE | Queue for human callback |
| Recurring bookings | ❌ OUT OF SCOPE | MVP is one-time only |

**Business Hours**: 7 days/week, 8am-6pm Mountain Time

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PRODUCTION ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────┐    ┌───────────┐    ┌─────────────────────────────────┐  │
│  │  Caller   │───▶│  Twilio   │───▶│  Retell AI (Sarah)             │  │
│  │  (Angi    │◀───│  (SIP)    │◀───│  - Voice processing            │  │
│  │   Lead)   │    └───────────┘    │  - Function calls → webhook    │  │
│  └───────────┘                     └──────────────┬──────────────────┘  │
│                                                   │                      │
│                                                   ▼                      │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    FLY.IO (Docker Container)                       │ │
│  │  ┌──────────────────────────────────────────────────────────────┐ │ │
│  │  │  POST /webhook/retell    ← Function calls (with auth)        │ │ │
│  │  │  POST /webhook/jobber    ← REQUEST_CREATE webhook            │ │ │
│  │  │  GET  /oauth/callback    ← Initial Jobber authorization      │ │ │
│  │  │  GET  /health            ← Health check                      │ │ │
│  │  └──────────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                              │                      │                    │
│                              ▼                      ▼                    │
│  ┌───────────────────────────────┐   ┌───────────────────────────────┐  │
│  │      UPSTASH REDIS            │   │      JOBBER API               │  │
│  │  • phone → requestId mapping  │   │  • GraphQL (visits, jobCreate)│  │
│  │  • OAuth token storage        │   │  • Webhooks (REQUEST_CREATE)  │  │
│  └───────────────────────────────┘   └───────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Documentation Index

### Source of Truth (Verified)

| # | Document | Description |
|---|----------|-------------|
| **14** | [jobber-api-verified-schema.md](./14-jobber-api-verified-schema.md) | **API REFERENCE** - Verified GraphQL schema (January 2026) |
| **08** | [jobber-integration-guide.md](./08-jobber-integration-guide.md) | **IMPLEMENTATION** - Complete Jobber integration code |
| **10** | [function-definitions.md](./10-function-definitions.md) | **RETELL FUNCTIONS** - All function JSON schemas |
| **13** | [deployment-flyio-docker.md](./13-deployment-flyio-docker.md) | **DEPLOYMENT** - Fly.io + Docker + Upstash guide |

### Configuration & Content

| # | Document | Description |
|---|----------|-------------|
| 07 | [knowledge-base-content.md](./07-knowledge-base-content.md) | KB template with business info, FAQs, scripts |
| 09 | [agent-prompt.md](./09-agent-prompt.md) | Copy-paste agent prompt for Retell Dashboard |
| 04 | [environment-config.md](./04-environment-config.md) | Environment variables reference |

### Setup Guides

| # | Document | Description |
|---|----------|-------------|
| 01 | [twilio-setup.md](./01-twilio-setup.md) | Twilio account, Trust Hub, STIR/SHAKEN |
| 02 | [retell-setup.md](./02-retell-setup.md) | Retell AI agent configuration |
| 05 | [troubleshooting.md](./05-troubleshooting.md) | Common issues, T-Mobile workaround |

### Testing & Deployment

| # | Document | Description |
|---|----------|-------------|
| 11 | [testing-procedures.md](./11-testing-procedures.md) | Test scenarios and scripts |
| 12 | [deployment-checklist.md](./12-deployment-checklist.md) | Step-by-step go-live checklist |

### Features & Architecture

| # | Document | Description |
|---|----------|-------------|
| 15 | [availability-compression.md](./15-availability-compression.md) | Availability Slot Compression |
| 16 | [call-outcome-logging.md](./16-call-outcome-logging.md) | Post-Call Outcome Logging |
| 17 | [outbound-calling-architecture.md](./17-outbound-calling-architecture.md) | Outbound Calling Architecture |

### Reference (May Need Updates)

| Document | Status | Notes |
|----------|--------|-------|
| 03-server-implementation.md | ⚠️ Outdated | Demo code only - use file 08 instead |
| 06-deployment.md | ⚠️ Outdated | Use file 13 (Fly.io) instead |
| IMPLEMENTATION_WORKFLOW.md | ⚠️ Partial | Reference only - some outdated code |

---

## Quick Start

### For New Implementation

1. **Read** `14-jobber-api-verified-schema.md` - Understand the API
2. **Set up** accounts: Fly.io, Upstash, Jobber Developer Portal
3. **Follow** `13-deployment-flyio-docker.md` - Deploy infrastructure
4. **Configure** Retell with functions from `10-function-definitions.md`
5. **Test** using `11-testing-procedures.md`
6. **Go live** using `12-deployment-checklist.md`

### For AI Implementation

Give a fresh Claude Code instance:
1. The `docs/` folder
2. Say: "Implement the Blue Bucket Voice Agent following the documentation. Use files 08, 10, 13, and 14 as primary sources."

---

## Critical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hosting | Fly.io (Docker) | Free tier, no cold starts, local=prod parity |
| Storage | Upstash Redis | Free tier, phone mapping + OAuth tokens |
| Scheduling | Direct Jobber API | ~~Cal.com NOT needed~~ - API supports direct scheduling |
| New customers | Queue for callback | MVP simplicity - add clientCreate later |
| Error handling | Transfer to CEO | Don't lose leads on API failures |

---

## Key API Facts (Verified January 2026)

| Fact | Value |
|------|-------|
| API Version | `2025-04-16` |
| Job creation requires | `propertyId` (NOT clientId) |
| Job creation requires | `invoicing` object (NON_NULL) |
| Job creation requires | `scheduling` with `createVisits: true` |
| Visit filter syntax | `{ after, before }` (NOT `{ gte, lte }`) |
| Phone lookup | ❌ NO phone filter - use Redis mapping |

---

## Critical Warning: Carrier Call Blocking

**T-Mobile and other carriers may block calls** without proper STIR/SHAKEN A-attestation.

### Solution
1. Complete Twilio Trust Hub business registration (see `01-twilio-setup.md`)
2. Wait for approval (24-72 hours)
3. Assign phone numbers to SHAKEN/STIR Trust Product
4. Verify A-attestation in call logs

### Temporary Workaround
While waiting for Trust Hub approval, use verified caller ID. See `05-troubleshooting.md`.

---

## File Structure

```
bluebucket/
├── server/                      # ← NEW: Docker-based server
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── fly.toml
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── index.js             # Express app
│       ├── config.js            # Environment config
│       ├── redis.js             # Upstash client
│       ├── jobber/
│       │   ├── client.js        # GraphQL client
│       │   ├── oauth.js         # Token management
│       │   └── queries.js       # GraphQL operations
│       ├── handlers/
│       │   ├── lookupCustomer.js
│       │   ├── calculateQuote.js
│       │   ├── checkAvailability.js
│       │   └── bookAppointment.js
│       └── webhooks/
│           └── jobberWebhook.js # REQUEST_CREATE handler
│
└── docs/                        # Documentation
    ├── README.md                # This file
    ├── 01-twilio-setup.md
    ├── 02-retell-setup.md
    ├── ...
    └── 14-jobber-api-verified-schema.md
```

---

## Version History

- **v1.0** - Initial implementation with SIP trunk
- **v1.1** - T-Mobile workaround
- **v1.2** - Quote calculation fixes
- **v2.0** - Full Jobber integration, complete documentation
- **v3.0** - Docker/Fly.io deployment, verified API schema, MVP scope clarification

---

## Support Resources

- [Twilio Trust Hub](https://www.twilio.com/docs/trust-hub)
- [Retell AI Documentation](https://docs.retellai.com/)
- [Jobber GraphQL API](https://developer.getjobber.com/docs/api/graphql)
- [Fly.io Documentation](https://fly.io/docs/)
- [Upstash Redis](https://upstash.com/docs/redis/overall/getstarted)
