# AI voice agent architecture for cleaning company lead conversion

**Retell AI paired with Zapier middleware, RentCast property lookup, and Twilio telephony delivers the optimal stack for sub-800ms response times at $0.12–0.18 per minute total cost.** This architecture enables instant callbacks within 30 seconds of lead arrival, real-time property verification, dynamic quote generation, and seamless CEO handoff—all integrating with existing Jobber workflows. Implementation requires 6–10 weeks with a developer and costs approximately **$180–$400/month** at moderate lead volumes (50 leads/month).

The system works because Jobber's native Angi integration and `REQUEST_CREATE` webhooks provide real-time lead triggers, while Retell AI's **~600ms consistent latency** and native function calling enable mid-conversation property lookups and calendar queries without awkward pauses.

---

## Recommended tech stack with component justification

The architecture centers on **Retell AI** as the voice platform, selected after evaluating latency benchmarks across eight competing platforms. Retell achieves **600ms end-to-end latency consistently**—well under the 800ms target—while Vapi shows latency spikes to 3–4 seconds under load, and Bland.ai hovers right at the 800ms threshold.

| Component | Recommended Product | Justification |
|-----------|---------------------|---------------|
| **Voice AI Platform** | Retell AI | Consistent 600ms latency, $0.07/min flat rate, 99.99% uptime, native function calling for property lookups, Warm Transfer 2.0 for CEO handoff |
| **Middleware/Orchestration** | Zapier (Professional) | Fastest path from Angi→Voice AI; webhook triggers in seconds, no-code, reliable |
| **Telephony** | Twilio | Required for Retell's warm transfers, branded caller ID, $0.0085/min |
| **Property Data API** | RentCast | 50 free lookups/month, $74/mo for 1,000 lookups, 140M+ properties, millisecond response |
| **CRM/FSM** | Jobber (Grow plan) | Native Angi integration, GraphQL API, webhooks, two-way SMS in platform |
| **SMS Fallback** | Twilio SMS | Jobber API cannot send SMS; Twilio at $0.0079/message fills the gap |

**Retell AI over Vapi rationale**: While Vapi claims 465ms optimal latency, real-world testing shows significant variance. Retell's infrastructure achieves more consistent sub-700ms performance. Retell also includes phone number provisioning ($2/mo), verified caller ID (critical for lead answer rates), and flat-rate pricing that simplifies cost forecasting. Vapi's stacked pricing (hosting + LLM + TTS + STT) often totals $0.15–0.25/min versus Retell's $0.07/min all-inclusive.

**Why not Synthflow**: Though Synthflow owns its telephony stack (good for reliability), it's designed for no-code users with less sophisticated conversation handling. For complex multi-turn sales conversations with objection handling, Retell's LLM flexibility (GPT-4, Claude) provides better performance.

---

## Complete data flow from lead to scheduled appointment

The architecture implements a **30-second speed-to-lead** pipeline that moves prospects from form submission to live conversation faster than competitors can dial.

### Primary flow: Angi lead → AI call → booked appointment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. LEAD CAPTURE (0-5 seconds)                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ Customer submits Angi form → Angi webhook fires to Zapier                   │
│ Parallel: Angi→Jobber native sync creates Request (backup record)           │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. ORCHESTRATION (5-15 seconds)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Zapier receives JSON payload with:                                          │
│ - firstName, lastName, primaryPhone, address, city, stateProvince, zip      │
│ - taskName (service type), comments (customer notes)                        │
│ - automatedContactCompliant (TCPA consent verification)                     │
│                                                                             │
│ Zapier actions:                                                             │
│ ① Create/update Jobber client via GraphQL API                               │
│ ② Trigger Retell AI outbound call via HTTP POST to /v2/create-phone-call    │
│ ③ Pass lead context as call metadata                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. AI CALL INITIATION (15-25 seconds)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│ Retell AI places outbound call with:                                        │
│ - Branded Caller ID (your business name)                                    │
│ - Verified phone number (reduces spam flagging)                             │
│ - Pre-loaded context: customer name, address, service interest              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. CONVERSATION FLOW (2-8 minutes)                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ Opening (with compliance disclosures):                                      │
│ "Hi [Name], this is Sarah, an AI assistant from ABC Cleaning. This call     │
│  is recorded for quality. I'm following up on your cleaning request—is     │
│  now a good time?"                                                          │
│                                                                             │
│ ↓ Property Verification (function call during conversation)                 │
│ AI: "I have your address as [address]. Let me pull up the property details."│
│ [Retell calls RentCast API → returns beds/baths/sqft in <500ms]             │
│ AI: "I see a 3-bedroom, 2-bath home at about 1,800 square feet. Does that   │
│      sound right?"                                                          │
│                                                                             │
│ ↓ Clarifying Questions                                                      │
│ - "How often are you looking for cleaning—weekly, bi-weekly, or one-time?"  │
│ - "Any specific areas of concern or focus?"                                 │
│ - "Do you have any pets?"                                                   │
│                                                                             │
│ ↓ Quote Generation (pricing matrix calculation)                             │
│ AI calculates: base rate × bedrooms × bathrooms × sqft multiplier           │
│ AI: "Based on your 3-bed, 2-bath home, a bi-weekly deep clean runs $185.    │
│      Note: this quote assumes standard cleaning conditions—if we find the   │
│      property needs extra attention or details differ, we'll adjust."       │
│                                                                             │
│ ↓ Objection Handling                                                        │
│ [Pre-programmed responses for "too expensive," "need to think," etc.]       │
│                                                                             │
│ ↓ Availability Check (function call to Jobber API)                          │
│ [Retell queries Jobber visits for requested date range]                     │
│ AI: "I have Thursday at 10 AM or Friday at 2 PM available. Which works?"    │
│                                                                             │
│ ↓ Booking Confirmation                                                      │
│ [Retell creates job in Jobber via GraphQL mutation]                         │
│ AI: "You're all set for Thursday at 10 AM. You'll receive a confirmation    │
│      shortly."                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. POST-CALL ACTIONS (immediate)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Via Retell webhooks → Zapier:                                               │
│ ① Create quote in Jobber with line items and previewUrl                     │
│ ② Send quote link via Twilio SMS (Jobber API cannot send SMS)               │
│ ③ Update Jobber request status                                              │
│ ④ Log call recording and transcript                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Retry flow: No-answer handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ RETRY LOGIC                                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│ If no answer:                                                               │
│ ① Wait 10 minutes (Zapier Delay step)                                       │
│ ② Retry call #2                                                             │
│ ③ If voicemail detected: Leave message via Retell voicemail feature         │
│    "Hi [Name], this is ABC Cleaning following up on your request.           │
│     Please call us back at [number] or reply to the text I'm sending."      │
│ ④ Send SMS via Twilio with quote link and callback option                   │
│ ⑤ Update Jobber request notes with attempt history                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### CEO handoff flow: Exception handling

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TRANSFER TRIGGERS (detected by LLM + keyword rules)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│ Immediate transfer:                                                         │
│ • "speak to owner/manager/human" (keyword)                                  │
│ • Sentiment score < -0.5 (anger/frustration detected)                       │
│ • Price negotiation: "discount," "too expensive," "better price"            │
│ • Services not offered: commercial, specialty cleaning                      │
│ • Property mismatch > 50% (sqft significantly different)                    │
│ • Technical failure: API timeout, booking error                             │
│                                                                             │
│ Transfer execution (Retell Warm Transfer 2.0):                              │
│ ① AI: "I'd be happy to connect you with Mike, our owner. One moment."       │
│ ② Retell dials CEO mobile, delivers whisper briefing:                       │
│    "Incoming transfer: [Customer name], [Property address], upset about     │
│     pricing, wants $30 discount on $185 quote."                             │
│ ③ Calls merge; AI exits                                                     │
│ ④ If CEO unavailable: Offer callback, take message, send SMS alert          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost analysis across volume tiers

All costs are monthly estimates in USD. The architecture scales efficiently because most components charge per-use rather than flat fees.

### Component-level cost breakdown

| Component | Pricing Model | 10 leads/mo | 50 leads/mo | 200 leads/mo |
|-----------|---------------|-------------|-------------|--------------|
| **Retell AI** | $0.07/min (avg 5 min/call) | $3.50 | $17.50 | $70.00 |
| **Twilio Voice** | $0.0085/min | $0.43 | $2.13 | $8.50 |
| **Twilio SMS** | $0.0079/msg (2 per lead) | $0.16 | $0.79 | $3.16 |
| **Twilio Numbers** | $2/mo per number | $2.00 | $2.00 | $4.00 |
| **RentCast API** | Free tier / $74 Foundation | $0.00 | $0.00 | $74.00 |
| **Zapier** | $29/mo Starter, $73 Pro | $29.00 | $73.00 | $73.00 |
| **Jobber** | $199/mo Grow plan | $199.00 | $199.00 | $199.00 |
| **Retell Phone** | $2/mo per number | $2.00 | $2.00 | $2.00 |

### Total monthly cost by volume

| Volume | Fixed Costs | Variable Costs | **Total** | **Cost per Lead** |
|--------|-------------|----------------|-----------|-------------------|
| **10 leads/mo** | $232 | $4.09 | **$236** | $23.60 |
| **50 leads/mo** | $276 | $20.42 | **$296** | $5.93 |
| **200 leads/mo** | $352 | $85.66 | **$438** | $2.19 |

**Key insight**: The system becomes dramatically more cost-efficient at scale. At 200 leads/month, the per-lead cost drops to **$2.19**—roughly the cost of a single SMS in some legacy systems. The primary fixed costs are Jobber ($199) and Zapier ($73), which don't increase with volume.

### Cost comparison: AI agent vs human receptionist

| Metric | AI Voice Agent | Part-time Human |
|--------|----------------|-----------------|
| Monthly cost (50 leads) | ~$296 | ~$1,500+ |
| Availability | 24/7 | Limited hours |
| Response time | <30 seconds | Minutes to hours |
| Consistency | 100% script adherence | Variable |
| Scalability | Instant | Requires hiring |

---

## Implementation timeline and phases

This timeline assumes hiring a **mid-level developer** with API integration experience or using a technical agency. No-code implementation is possible but adds 2–3 weeks and limits customization.

### Phase 1: Foundation (Weeks 1–2)

**Objectives**: Establish accounts, basic integrations, compliance framework

- Day 1–3: Create accounts (Retell AI, Twilio, RentCast, Zapier)
- Day 4–7: Configure Jobber webhooks and API authentication
- Day 8–10: Set up Angi webhook integration (email crmintegrations@angi.com)
- Day 11–14: Build compliance disclosure script and test recording

**Deliverables**: All accounts active, Angi→Zapier webhook receiving test leads

**Required skills**: Basic API knowledge, account administration

### Phase 2: Core voice agent (Weeks 3–5)

**Objectives**: Build conversation flow, property lookup, quote generation

- Day 15–21: Design and implement Retell AI agent with conversation script
- Day 22–25: Integrate RentCast property lookup as function call
- Day 26–28: Build pricing matrix logic (bedrooms × baths × sqft)
- Day 29–35: Implement Jobber calendar query for availability checks

**Deliverables**: Working voice agent that answers, qualifies, and quotes

**Required skills**: Prompt engineering, JavaScript/Python for functions, API integration

### Phase 3: Booking and CRM integration (Weeks 6–7)

**Objectives**: End-to-end workflow from call to scheduled appointment

- Day 36–40: Implement Jobber job creation via GraphQL mutation
- Day 41–45: Configure post-call quote generation and SMS delivery
- Day 46–49: Build retry logic with 10-minute delay and voicemail

**Deliverables**: Complete booking flow with automated follow-up

**Required skills**: GraphQL, webhook handling, workflow automation

### Phase 4: CEO handoff and edge cases (Weeks 8–9)

**Objectives**: Transfer capability, exception handling, monitoring

- Day 50–54: Configure Retell warm transfer to CEO mobile
- Day 55–59: Implement sentiment detection and transfer triggers
- Day 60–63: Build fallback flows (CEO unavailable, technical failures)

**Deliverables**: Seamless handoff with context passing

**Required skills**: Telephony configuration, LLM prompt tuning

### Phase 5: Testing and optimization (Week 10)

**Objectives**: Quality assurance, latency verification, compliance audit

- Day 64–66: End-to-end testing with simulated leads
- Day 67–68: Latency measurement and optimization
- Day 69–70: Compliance review and script refinement

**Deliverables**: Production-ready system with documented runbooks

### Resource requirements

| Role | Effort | Alternative |
|------|--------|-------------|
| **Developer** | 80–120 hours | Agency ($8K–15K project) |
| **Project Manager** | 20–30 hours | Owner/operator |
| **QA/Testing** | 15–20 hours | Included in dev |
| **Legal Review** | 2–4 hours | Compliance consultant |

**Can this be no-code?** Partially. Zapier and Retell both support no-code configuration, but the property lookup function, pricing matrix, and Jobber GraphQL integration require custom code. A hybrid approach using Retell's visual builder plus custom functions is most practical.

---

## Colorado compliance implementation

Colorado is a **one-party consent state** for call recording, but the Colorado Artificial Intelligence Act (CAIA) takes effect **February 1, 2026**, requiring AI disclosure.

### Required disclosures (script)

Every call must begin with:

> *"Hi [Customer Name], this is Sarah, an AI assistant calling from ABC Cleaning. This call is recorded for quality assurance. I'm following up on your cleaning request—is now a good time?"*

This script satisfies:
- **AI disclosure** (CAIA requirement, effective Feb 2026)
- **Recording disclosure** (best practice, required for interstate calls)
- **Business identification** (FCC requirement)
- **Purpose statement** (builds trust)

### Interstate calling considerations

When leads originate from two-party consent states (California, Florida, Illinois, etc.), the stricter law applies. The recommended approach: **always disclose** to all callers regardless of location. The 5-second disclosure adds negligible friction while eliminating legal risk.

### TCPA compliance for Angi leads

Angi leads who submit their phone number provide **prior express consent** for informational calls. However, for telemarketing (which this arguably is), **prior express written consent** is technically required. Angi's intake forms generally include consent language, but verify:

- Check `automatedContactCompliant` field in Angi webhook payload
- Respect calling hours: 8 AM – 9 PM local time
- Scrub against National Do-Not-Call Registry (Twilio provides lookup)
- Honor opt-out requests immediately

---

## Jobber API capabilities and workarounds

Jobber's GraphQL API enables most required functionality, with one critical exception.

### What works via Jobber API

| Function | API Support | Endpoint/Mutation |
|----------|-------------|-------------------|
| Receive new lead notification | ✅ Webhook | `REQUEST_CREATE` topic |
| Read customer/lead data | ✅ Query | `clients`, `requests` |
| Check calendar availability | ✅ Query | `visits`, `jobs` with date filters |
| Create appointments/jobs | ✅ Mutation | `jobCreate` |
| Create quotes | ✅ Mutation | `quoteCreate` |
| Get quote link for customer | ✅ Field | `previewUrl` on Quote object |

### What doesn't work: SMS sending

**Jobber's API cannot send SMS messages.** The platform has two-way texting on the Grow plan, but this functionality is not exposed via API.

**Workaround**: Use Twilio SMS as a parallel channel:
1. Create quote in Jobber via API
2. Extract `previewUrl` from the response
3. Send SMS via Twilio: *"Thanks for chatting! Here's your quote: [previewUrl]. Reply with questions."*

### Calendar conflict checking

Jobber lacks a dedicated "availability check" endpoint. Implementation requires:
1. Query all visits/jobs for the requested date range
2. Parse `startAt` and `endAt` times
3. Check for overlaps programmatically
4. Return available slots to the voice agent

This adds ~200ms to the calendar lookup but works reliably.

---

## Risk factors and mitigation strategies

### Technical risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Latency spikes during high volume** | Medium | High | Monitor Retell dashboard; have Vapi as backup; implement circuit breaker |
| **Angi webhook delivery delays** | Low | High | Use native Jobber-Angi integration as parallel backup; monitor webhook health |
| **Property API returns no data** | Medium | Medium | Graceful fallback: "I don't have property details on file—can you confirm bedrooms and bathrooms?" |
| **Jobber API rate limiting** | Low | Medium | Implement request queuing; use pagination; cache calendar data |
| **Twilio spam flagging** | Medium | High | Use verified numbers; register STIR/SHAKEN; maintain low complaint rate |

### Business risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Customers hang up on AI** | High (initially) | Medium | A/B test opening scripts; emphasize "quick question" framing; iterate on voice persona |
| **Incorrect property data causes mispricing** | Medium | High | Always include price disclaimer; flag mismatches > 30% for CEO review |
| **CEO unavailable for transfers** | Medium | High | Implement callback queue; train AI to schedule callbacks; SMS alerts |
| **Competitor responds faster** | Medium | High | Optimize for sub-30-second response; consider parallel SMS/call |

### Compliance risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **TCPA violation (calling wrong number)** | Low | Very High | Verify Angi consent field; scrub DNC registry; maintain opt-out list |
| **CAIA violation (no AI disclosure)** | Low | Medium | Script includes disclosure; audit calls monthly |
| **Recording law violation (interstate)** | Low | High | Always disclose regardless of caller location |

### Recommended monitoring

- **Daily**: Review call completion rates, average handle time, booking conversion
- **Weekly**: Audit random call recordings for quality and compliance
- **Monthly**: Analyze sentiment trends, transfer reasons, cost per booking
- **Quarterly**: Review latency percentiles, compare to benchmarks, evaluate platform alternatives

---

## Alternative platforms worth monitoring

While Retell AI is the current recommendation, the voice AI market evolves rapidly. Keep these alternatives on the radar:

- **Vapi**: If Retell pricing increases or latency issues emerge, Vapi offers more LLM flexibility and open-source components. Requires more technical expertise.
- **Synthflow**: If the business prioritizes no-code simplicity over conversation sophistication, Synthflow's visual builder may accelerate iteration.
- **ElevenLabs Conversational AI**: Best voice quality in the industry; consider as a voice layer integrated with Vapi if customers respond better to more natural-sounding voices.

The recommended architecture is designed with modular components (middleware, telephony, property lookup) that can be swapped without rebuilding the entire system.

---

## Conclusion

This architecture delivers **sub-800ms conversational AI** that can handle the full lead-to-booking workflow while maintaining compliance and providing human fallback for exceptions. The key technical decisions—Retell AI for latency, RentCast for property data, Zapier for orchestration—optimize for reliability and cost-efficiency at the 50–200 leads/month scale.

The **$300–$450/month total cost** (excluding Jobber, which the business already uses) represents roughly 80% savings versus a part-time human receptionist while enabling 24/7 availability and sub-30-second response times. The 6–10 week implementation timeline is realistic for a developer with API experience, though businesses without technical resources should budget $10K–$15K for agency implementation.

The primary risks—spam flagging, AI hang-ups, property data gaps—are manageable with the mitigation strategies outlined. The system should be treated as a living product that improves through iteration on scripts, pricing logic, and conversation flows based on real call data.