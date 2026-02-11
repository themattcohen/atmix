# Blue Bucket Production Implementation Workflow

## Research Summary

Based on comprehensive research of Retell AI best practices and Jobber API capabilities, this workflow outlines the full production implementation.

### Key Research Findings

#### Retell AI Best Practices
| Area | Best Practice | Source |
|------|---------------|--------|
| **Prompt Structure** | Break into sections: Identity, Style, Response Guidelines, Tool Usage | [Prompt Engineering Guide](https://docs.retellai.com/build/prompt-engineering-guide) |
| **Knowledge Base** | Use native KB for static info - auto-syncs, $0.005/min | [Knowledge Base Feature](https://www.retellai.com/features/knowledge-base) |
| **Architecture Choice** | Use Conversation Flow when >1000 words or >5 functions | [Prompt vs Flow Guide](https://www.retellai.com/blog/prompt-based-vs-conversational-pathways-choosing-the-right-approach) |
| **Dynamic Variables** | All values MUST be strings, set defaults at agent level | [Dynamic Variables Docs](https://docs.retellai.com/build/dynamic-variables) |
| **Latency Target** | 800ms or lower, use GPT-4.1 Mini for speed-critical flows | [Latency Guide](https://www.retellai.com/blog/why-low-latency-matters-how-retell-ai-outpaces-traditional-players) |
| **Functions** | 2-min timeout, up to 2 retries, specify exact call conditions in prompt | [Custom Functions](https://docs.retellai.com/build/single-multi-prompt/custom-function) |

#### Jobber API Capabilities
| Capability | Details | Notes |
|------------|---------|-------|
| **API Type** | GraphQL via POST | Version: `2025-01-20` |
| **Clients** | Create, read, update customers | Full CRUD operations |
| **Jobs** | Create jobs with schedules | `startAt`, `endAt` fields |
| **Webhooks** | CLIENT_CREATE, NEW_APPOINTMENT | 1-second response required |
| **Online Booking** | Native booking page support | Can check availability |
| **Built-in SMS** | Jobber has native SMS | No need for custom Twilio SMS |

---

## Architecture Decision: Hybrid Approach

Based on research, the optimal architecture is:

```
┌─────────────────────────────────────────────────────────────────┐
│                     RETELL AI AGENT                              │
├─────────────────────────────────────────────────────────────────┤
│  KNOWLEDGE BASE (Static Info)          CUSTOM FUNCTIONS (Dynamic)│
│  ├─ Service descriptions               ├─ jobber_check_availability│
│  ├─ Pricing tiers & policies           ├─ jobber_lookup_customer   │
│  ├─ Service area (neighborhoods)       ├─ jobber_create_job        │
│  ├─ Team info & certifications         ├─ calculate_quote          │
│  ├─ FAQs & objection responses         └─ transfer_to_ceo          │
│  └─ Compliance scripts                                           │
├─────────────────────────────────────────────────────────────────┤
│  DYNAMIC VARIABLES (Per-Call Context)                            │
│  ├─ {{customer_name}}                                            │
│  ├─ {{customer_phone}}                                           │
│  ├─ {{lead_source}} (Angi, Website, Referral)                   │
│  ├─ {{service_type_requested}}                                   │
│  └─ {{address}}                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR SERVER (Express.js)                     │
├─────────────────────────────────────────────────────────────────┤
│  /webhook/retell-functions                                       │
│  ├─ jobber_check_availability → Jobber GraphQL API              │
│  ├─ jobber_lookup_customer → Jobber GraphQL API                 │
│  ├─ jobber_create_job → Jobber GraphQL API                      │
│  ├─ calculate_quote → Local pricing logic                       │
│  └─ transfer_to_ceo → Return transfer signal                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        JOBBER CRM                                │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Real calendar/availability                                   │
│  ✅ Customer database                                            │
│  ✅ Job creation & scheduling                                    │
│  ✅ Built-in SMS confirmations & reminders                       │
│  ✅ Angi lead import (via Jobber-Angi integration)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Knowledge Base Setup (Day 1)
**Goal**: Give the agent 99% question-answering capability through comprehensive knowledge

#### 1.1 Create Knowledge Base Content Document
Create a comprehensive document with ALL business information:

```markdown
# Blue Bucket Cleaning - Complete Knowledge Base

## Company Information
- **Company Name**: The Blue Bucket Cleaning
- **Website**: thebluebucketcleaning.com
- **Owner/CEO**: Laila Kaudio
- **Years in Business**: [PLACEHOLDER - fill in]
- **Team Size**: [PLACEHOLDER - fill in]
- **Service Area**: Denver, Colorado metropolitan area

## Service Areas (Neighborhoods Served)
[PLACEHOLDER - List all neighborhoods/zip codes]
- Cherry Creek
- Capitol Hill
- Highlands
- LoDo (Lower Downtown)
- Washington Park
- [Add more...]

## Services Offered

### House Cleaning (Residential)
Standard cleaning includes:
- Dusting all surfaces
- Vacuuming carpets and rugs
- Mopping hard floors
- Kitchen cleaning (counters, appliances exterior, sink)
- Bathroom cleaning (toilet, shower/tub, sink, mirrors)
- Making beds (linens in place)
- Emptying trash

### Deep Cleaning
Everything in standard plus:
- Baseboards
- Ceiling fans
- Light fixtures
- Inside window sills
- Door frames and handles
- Behind furniture (where accessible)

### Add-On Services
- Inside refrigerator: $25
- Inside oven: $25
- Inside cabinets: $30
- Pet hair removal: $20
- Move-in/move-out: $75
- First-time deep clean: $50

### Commercial Cleaning
- $0.10 per square foot (minimum $200)
- Custom packages available for regular service
- Contact Laila directly for commercial inquiries over 5000 sqft

### Specialty Services
- Window Cleaning: $8-12 per window (exterior)
- Blind Cleaning: $3-5 per blind
- Floor Cleaning/Waxing: $0.50-0.75 per sqft
- Carpet Cleaning: $0.30-0.50 per sqft

## Pricing Structure

### House Cleaning Formula
Base: $100
+ $15 per bedroom
+ $20 per bathroom
+ $0.05 per square foot

### Frequency Discounts
- One-time: Full price
- Bi-weekly service: 10% off each visit
- Weekly service: 15% off each visit

### Example Quotes
- 2 bed, 1 bath, 1000 sqft: ~$180
- 3 bed, 2 bath, 1800 sqft: ~$275
- 4 bed, 3 bath, 2500 sqft: ~$370

## Scheduling & Policies

### Minimum Notice
[PLACEHOLDER - e.g., "24 hours notice required for new bookings"]

### Cancellation Policy
[PLACEHOLDER - e.g., "Cancel 24 hours in advance for full refund"]

### Rescheduling
[PLACEHOLDER - e.g., "Reschedule up to 12 hours before appointment"]

### Service Hours
[PLACEHOLDER - e.g., "Monday-Saturday 8am-5pm"]

## Trust & Credentials

### Licensing & Insurance
- Fully licensed to operate in Colorado
- Bonded for customer protection
- General liability insurance coverage
- Workers' compensation for all team members

### Team Standards
- All team members pass background checks
- Professional training program completed
- Uniformed staff with company ID
- Arrive in company-marked vehicles

### Satisfaction Guarantee
100% satisfaction guarantee - if you're not happy with any area we cleaned, call us within 24 hours and we'll come back to fix it at no additional charge.

## Frequently Asked Questions

### Q: Do I need to be home during the cleaning?
A: No, many of our clients are not home during cleanings. Our team is fully background-checked and insured. You can provide a key, garage code, or lockbox access.

### Q: Do you bring your own supplies?
A: Yes, we bring all cleaning supplies and equipment. We use eco-friendly, non-toxic products that are safe for children and pets.

### Q: How long does a typical cleaning take?
A: For a standard 3-bedroom home, expect 2-3 hours with a team of two cleaners. Deep cleans take approximately 50% longer.

### Q: What if something is damaged?
A: We're fully insured. In the rare event of damage, report it within 24 hours and we'll handle the claim promptly.

### Q: Do you clean [specific item]?
[Add common specific questions about:
- Inside appliances
- Windows
- Laundry
- Dishes
- Pet areas
- Outdoor areas
etc.]

## Objection Handling Responses

### "That's too expensive"
"I understand price is a consideration. Many of our customers find that when they factor in their own time, supplies, and the hassle, professional cleaning actually saves money. Plus, our bi-weekly service includes a 10% discount, bringing it to [calculated price]. And we have a 100% satisfaction guarantee - if you're not happy, we make it right."

### "I need to think about it"
"Absolutely, take your time. Quick question though - is getting professional cleaning something you're planning in the next month or so, or is it just not on your radar right now? I'd be happy to hold a time slot for you while you decide."

### "I want to compare prices"
"That makes total sense. A few things to keep in mind when comparing - we're fully bonded and insured, our team is background-checked, we use eco-friendly products, and we offer a 100% satisfaction guarantee. Many customers who've switched to us from other services say the peace of mind is worth it."

### "I already have someone"
"Great that you have help! Just curious - what do you like most about them? A lot of our customers came from other services because they needed more consistency or attention to detail. Would you be open to trying us for a one-time deep clean to see how we compare?"

## Compliance Scripts

### AI Disclosure (FCC Requirement)
"Hi [Name], this is Sarah, an AI assistant calling from The Blue Bucket cleaning service. This call may be recorded for quality purposes."

### Recording Notice
"Just to let you know, this call is being recorded to help us improve our service."

### Transfer Offer
"Would you prefer to speak with someone from our team directly? I can connect you right now."
```

#### 1.2 Upload to Retell Knowledge Base
1. Go to Retell Dashboard → Your Agent → Knowledge Base
2. Create new Knowledge Base
3. Upload the document OR paste the content
4. Test retrieval with sample questions

---

### Phase 2: Enhanced Agent Prompt (Day 1-2)
**Goal**: Structured prompt that leverages Knowledge Base and functions optimally

#### 2.1 Restructured Agent Prompt

```
## IDENTITY

You are Sarah, an AI assistant for The Blue Bucket cleaning service in Denver, Colorado. Your role is to:
- Qualify leads and provide accurate quotes
- Answer questions about services, pricing, and policies
- Book appointments using the scheduling system
- Build trust through professionalism and transparency

Owner/CEO: Laila Kaudio
Website: thebluebucketcleaning.com

## STYLE GUARDRAILS

- Be concise: Keep responses under 2 sentences unless explaining complex topics
- Be conversational: Use contractions ("we'll" not "we will"), acknowledge what the caller says
- Be empathetic: Show understanding for their situation and concerns
- Be confident: Speak positively about services without overselling
- Be transparent: Always mention you're an AI when asked, disclose pricing clearly

## RESPONSE GUIDELINES

- Say dates in spoken form: "January fifteenth" not "1/15"
- Say prices naturally: "two eighty-five" not "$285"
- Ask ONE question at a time - never overwhelm with multiple questions
- Confirm important details back: "Just to confirm, that's a 3-bedroom home at..."
- Use brief acknowledgments: "Great", "Perfect", "Got it", "I see"

## OPENING SCRIPT

For Angi/website leads:
"Hi {{customer_name}}, this is Sarah, an AI assistant calling from The Blue Bucket cleaning service. This call may be recorded. I'm following up on your interest in cleaning services. Do you have a couple minutes?"

If they seem confused:
"You filled out a form requesting information about cleaning services. I'm calling to help answer any questions and potentially get you scheduled."

## TOOL USAGE INSTRUCTIONS

### lookup_customer
Call this FIRST if the caller mentions they're an existing customer or you have their phone number. Use exact phone number format.

### calculate_quote
Call this AFTER you have:
- Number of bedrooms (required)
- Number of bathrooms (required)
- Square footage (estimate if they don't know: small home ~1200sqft, medium ~1800sqft, large ~2500sqft+)
- Frequency preference (ask: "Are you looking for one-time cleaning or ongoing service like weekly or bi-weekly?")
- Any add-ons they mentioned

### check_availability
Call this AFTER providing a quote AND they express interest in booking. Ask: "Would you like to get on our schedule? I can check what we have available this week."

### book_appointment
Call this AFTER:
- They've received a quote
- They've chosen a specific date and time from availability
- You have their full name and address confirmed

### transfer_to_ceo
Call this ONLY when:
- Customer explicitly asks for owner/manager
- Commercial job over 5000 sqft
- Customer is upset or escalating
- Complex custom package negotiation
- Business partnership inquiry

## CONVERSATION FLOW

1. **Opening** → Greet, disclose AI, get permission to continue
2. **Qualification** → Gather bedrooms, bathrooms, sqft, frequency, add-ons
3. **Quote** → Call calculate_quote, present price with trust elements
4. **Objection Handling** → Address concerns using Knowledge Base responses
5. **Close** → Call check_availability, offer specific times
6. **Booking** → Call book_appointment, confirm all details
7. **Wrap-up** → Thank them, mention confirmation will be sent, offer to answer more questions

## KNOWLEDGE BASE USAGE

For questions about:
- Service areas, neighborhoods served
- Detailed service descriptions
- Company policies (cancellation, rescheduling)
- Team credentials, insurance, guarantees
- Frequently asked questions

→ The Knowledge Base has this information. Answer naturally using it.

## NEVER DO

- Make up property details - use lookup functions
- Invent prices - use calculate_quote function
- Guarantee specific results ("your home will be spotless")
- Bad-mouth competitors
- Rush or pressure the customer
- Deny being an AI
- Skip the booking confirmation details
```

---

### Phase 3: Jobber Integration Functions (Day 2-3)
**Goal**: Connect to real Jobber data for availability, customers, and job creation

#### 3.1 Jobber API Setup

```javascript
// jobber-client.js
const axios = require('axios');

class JobberClient {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.baseUrl = 'https://api.getjobber.com/api/graphql';
    this.apiVersion = '2025-01-20';
  }

  async query(graphqlQuery, variables = {}) {
    const response = await axios.post(
      this.baseUrl,
      { query: graphqlQuery, variables },
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-JOBBER-GRAPHQL-VERSION': this.apiVersion
        }
      }
    );

    if (response.data.errors) {
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data;
  }

  // Check availability for a date range
  async getAvailability(startDate, endDate) {
    const query = `
      query GetSchedule($startDate: ISO8601Date!, $endDate: ISO8601Date!) {
        visits(first: 50, filter: {
          startAt: { gte: $startDate, lte: $endDate }
        }) {
          nodes {
            id
            startAt
            endAt
            title
          }
        }
      }
    `;
    // Note: Actual availability logic may need to check against
    // team capacity vs scheduled visits
    return this.query(query, { startDate, endDate });
  }

  // Lookup customer by phone or email
  async lookupCustomer(phone) {
    const query = `
      query FindClient($phone: String!) {
        clients(first: 1, filter: {
          phones: { contains: $phone }
        }) {
          nodes {
            id
            name
            firstName
            lastName
            emails
            phones { number }
            billingAddress {
              street
              city
              postalCode
            }
            jobs(first: 10) {
              nodes {
                id
                title
                totalPrice
                completedAt
              }
            }
          }
        }
      }
    `;
    return this.query(query, { phone });
  }

  // Create a new client
  async createClient(clientData) {
    const mutation = `
      mutation CreateClient($input: ClientCreateInput!) {
        clientCreate(input: $input) {
          client {
            id
            name
          }
          userErrors {
            message
            path
          }
        }
      }
    `;
    return this.query(mutation, {
      input: {
        firstName: clientData.firstName,
        lastName: clientData.lastName,
        phones: [{ number: clientData.phone }],
        emails: clientData.email ? [{ address: clientData.email }] : [],
        billingAddress: clientData.address ? {
          street: clientData.address,
          city: 'Denver',
          province: 'CO'
        } : null
      }
    });
  }

  // Create a job/appointment
  async createJob(jobData) {
    const mutation = `
      mutation CreateJob($input: JobCreateInput!) {
        jobCreate(input: $input) {
          job {
            id
            jobNumber
            title
          }
          userErrors {
            message
            path
          }
        }
      }
    `;
    return this.query(mutation, {
      input: {
        clientId: jobData.clientId,
        title: jobData.serviceType || 'House Cleaning',
        startAt: jobData.startAt,
        endAt: jobData.endAt,
        // Add line items for pricing
      }
    });
  }
}

module.exports = JobberClient;
```

#### 3.2 Updated Function Handlers

```javascript
// functions.js - Updated with Jobber integration
const JobberClient = require('./jobber-client');

const jobber = new JobberClient(process.env.JOBBER_ACCESS_TOKEN);

// ... keep existing mock functions as fallback ...

async function jobberCheckAvailability(preferredDate) {
  try {
    // Calculate date range (next 7 days from preferred)
    const startDate = new Date(preferredDate || Date.now());
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 7);

    const schedule = await jobber.getAvailability(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Logic to find open slots based on team capacity
    // This is simplified - real implementation needs capacity checking
    const openSlots = findOpenSlots(schedule.visits.nodes);

    if (openSlots.length === 0) {
      return {
        result: "I'm looking at our schedule and we're pretty booked up this week. Let me check the following week - would that work for you?"
      };
    }

    const slotDescriptions = openSlots.slice(0, 3).map(s =>
      `${s.dayName} at ${s.time}`
    ).join(', or ');

    return {
      result: `I have availability ${slotDescriptions}. Which works better for you?`,
      slots: openSlots.slice(0, 3)
    };
  } catch (error) {
    console.error('Jobber availability error:', error);
    // Fall back to mock availability
    return checkAvailability(preferredDate);
  }
}

async function jobberLookupCustomer(phone) {
  try {
    const result = await jobber.lookupCustomer(phone);
    const client = result.clients.nodes[0];

    if (!client) {
      return {
        result: "I don't see an existing account with that phone number. No problem - I can set you up as a new customer. What's your full name?",
        found: false
      };
    }

    const lastJob = client.jobs.nodes[0];
    const greeting = lastJob
      ? `Welcome back! I see we last cleaned for you on ${new Date(lastJob.completedAt).toLocaleDateString()}.`
      : `I see you're already in our system.`;

    return {
      result: `${greeting} How can I help you today, ${client.firstName}?`,
      found: true,
      clientId: client.id,
      clientName: client.name,
      address: client.billingAddress?.street
    };
  } catch (error) {
    console.error('Jobber lookup error:', error);
    return {
      result: "I'm having trouble looking up your account right now. Let me help you as a new customer. What's your name?",
      found: false
    };
  }
}

async function jobberCreateJob(params) {
  const { date, time, customerName, address, serviceType, estimatedPrice, clientId } = params;

  try {
    // Create client if no clientId
    let finalClientId = clientId;
    if (!finalClientId) {
      const nameParts = customerName.split(' ');
      const clientResult = await jobber.createClient({
        firstName: nameParts[0],
        lastName: nameParts.slice(1).join(' ') || '',
        phone: params.phone,
        address: address
      });
      finalClientId = clientResult.clientCreate.client.id;
    }

    // Parse date and time into ISO format
    const startAt = parseDateTime(date, time);
    const endAt = new Date(startAt);
    endAt.setHours(endAt.getHours() + 3); // Assume 3-hour job

    const jobResult = await jobber.createJob({
      clientId: finalClientId,
      serviceType: serviceType,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString()
    });

    const jobNumber = jobResult.jobCreate.job.jobNumber;

    return {
      result: `Perfect! I've booked your ${serviceType.toLowerCase()} for ${date} at ${time}. Your job number is ${jobNumber}. You'll receive a confirmation text shortly with all the details. Is there anything specific you'd like our team to focus on?`,
      jobId: jobResult.jobCreate.job.id,
      jobNumber: jobNumber
    };
  } catch (error) {
    console.error('Jobber create job error:', error);
    // Fall back to mock booking
    return bookAppointment(params);
  }
}

module.exports = {
  // Original functions (as fallback)
  lookupProperty,
  calculateQuote,
  checkAvailability,
  bookAppointment,
  transferToCeo,

  // Jobber-integrated functions
  jobberCheckAvailability,
  jobberLookupCustomer,
  jobberCreateJob,

  MOCK_PROPERTIES
};
```

---

### Phase 4: Retell Agent Configuration (Day 3)
**Goal**: Update Retell dashboard with new functions and Knowledge Base

#### 4.1 Update Custom Functions in Retell

Add/update these functions:

**Function: lookup_customer**
```json
{
  "name": "lookup_customer",
  "description": "Look up an existing customer by phone number. Call this if caller mentions they're an existing customer.",
  "parameters": {
    "type": "object",
    "properties": {
      "phone": {
        "type": "string",
        "description": "Customer phone number in format +1XXXXXXXXXX"
      }
    },
    "required": ["phone"]
  }
}
```

**Function: check_availability**
```json
{
  "name": "check_availability",
  "description": "Check real calendar availability for appointments. Call AFTER providing quote and customer wants to book.",
  "parameters": {
    "type": "object",
    "properties": {
      "preferredDate": {
        "type": "string",
        "description": "Customer's preferred date or timeframe like 'this week', 'next Tuesday', 'as soon as possible'"
      }
    }
  }
}
```

**Function: book_appointment**
```json
{
  "name": "book_appointment",
  "description": "Book the cleaning appointment in our system. Call after customer chooses specific date/time.",
  "parameters": {
    "type": "object",
    "properties": {
      "date": { "type": "string", "description": "Appointment date" },
      "time": { "type": "string", "description": "Appointment time" },
      "customerName": { "type": "string", "description": "Customer's full name" },
      "phone": { "type": "string", "description": "Customer phone number" },
      "address": { "type": "string", "description": "Service address" },
      "serviceType": { "type": "string", "description": "Type of service" },
      "estimatedPrice": { "type": "string", "description": "Quoted price" },
      "clientId": { "type": "string", "description": "Jobber client ID if existing customer" }
    },
    "required": ["date", "time", "customerName", "address"]
  }
}
```

#### 4.2 Webhook URL Configuration
Set function webhook URL to:
```
https://your-production-domain.com/webhook/retell-functions
```

---

### Phase 5: Testing & Validation (Day 4)
**Goal**: Comprehensive testing of all flows

#### 5.1 Test Scenarios

| Scenario | Test | Expected Outcome |
|----------|------|------------------|
| New customer, book appointment | Full flow from intro to booking | Job created in Jobber |
| Existing customer recognition | Call with known phone | Greeted by name, history referenced |
| Price objection | Say "that's too expensive" | Agent handles with KB responses |
| Knowledge question | Ask about service areas | Accurate answer from KB |
| Transfer request | Say "let me speak to owner" | Transfer initiated |
| Availability edge case | Request date with no slots | Agent offers alternatives |

#### 5.2 Jobber Verification
After each test booking:
1. Check Jobber dashboard for new job
2. Verify customer was created (if new)
3. Confirm SMS confirmation was sent (Jobber built-in)

---

### Phase 6: Production Deployment (Day 5)

#### 6.1 Environment Variables (Production)
```bash
# Add to production .env
JOBBER_ACCESS_TOKEN=your_jobber_oauth_token
JOBBER_REFRESH_TOKEN=your_refresh_token
JOBBER_CLIENT_ID=your_app_client_id
JOBBER_CLIENT_SECRET=your_app_client_secret
```

#### 6.2 Jobber OAuth Setup
See separate guide: [Jobber OAuth Implementation](#jobber-oauth-guide)

---

## Placeholder Checklist

Before going live, fill in these placeholders in the Knowledge Base:

- [ ] Years in business
- [ ] Team size
- [ ] All service area neighborhoods/zip codes
- [ ] Minimum notice period
- [ ] Cancellation policy details
- [ ] Rescheduling policy
- [ ] Service hours
- [ ] Any specific FAQs from real customer calls
- [ ] CEO direct line for transfers

---

## Success Metrics

Track these KPIs post-launch:

| Metric | Target | How to Measure |
|--------|--------|----------------|
| Booking rate | 25-40% | Booked calls / Total calls |
| Containment rate | 65-80% | Calls handled without transfer |
| Average call duration | 2-5 min | Retell analytics |
| Customer satisfaction | 4.3+/5 | Post-call survey |
| Knowledge accuracy | 95%+ | Spot-check call transcripts |
| Jobber sync success | 99%+ | Monitor function errors |

---

## Sources

- [Retell AI Prompt Engineering Guide](https://docs.retellai.com/build/prompt-engineering-guide)
- [Retell AI Knowledge Base Feature](https://www.retellai.com/features/knowledge-base)
- [Retell AI Custom Functions](https://docs.retellai.com/build/single-multi-prompt/custom-function)
- [Retell AI Dynamic Variables](https://docs.retellai.com/build/dynamic-variables)
- [Retell AI Conversation Flow Overview](https://docs.retellai.com/build/conversation-flow/overview)
- [Jobber API Documentation](https://developer.getjobber.com/docs/)
- [Jobber Webhooks Guide](https://developer.getjobber.com/docs/using_jobbers_api/setting_up_webhooks/)
