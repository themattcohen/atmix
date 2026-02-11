# Retell Function Definitions

This document contains all custom function definitions for the Blue Bucket voice agent. Copy these JSON schemas into Retell Dashboard → Agent → Custom Functions.

## Table of Contents
1. [Overview](#1-overview)
2. [Function: lookup_customer](#2-function-lookup_customer)
3. [Function: calculate_quote](#3-function-calculate_quote)
4. [Function: check_availability](#4-function-check_availability)
5. [Function: book_appointment](#5-function-book_appointment)
6. [Function: transfer_to_ceo](#6-function-transfer_to_ceo)
7. [Webhook Configuration](#7-webhook-configuration)
8. [Error Handling](#8-error-handling)

---

## 1. Overview

### Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Retell AI     │────▶│  Your Webhook    │────▶│  Jobber API │
│   (Agent)       │◀────│  (functions.js)  │◀────│  (GraphQL)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
```

### Function Summary

| Function | Purpose | Jobber Integration |
|----------|---------|-------------------|
| `lookup_customer` | Check if caller is existing customer | Redis phone mapping → `request` query |
| `calculate_quote` | Generate price estimate | Local pricing logic |
| `check_availability` | Get available appointment slots | `visits` query with `{ after, before }` filter |
| `book_appointment` | Create booking in system | `jobCreate` mutation with `propertyId`, `scheduling`, `invoicing` |
| `transfer_to_ceo` | Escalate to human | N/A (Retell built-in) |

### Webhook Endpoint
```
POST https://your-domain.com/webhook/retell-functions
```

---

## 2. Function: lookup_customer

### Purpose
Check if the caller is an existing customer by looking up their phone number against stored Angi lead data.

### CRITICAL: How Phone Lookup Works

**The Jobber API does NOT support filtering clients by phone number.** There is no phone filter in `ClientFilterAttributes`.

Instead, we use the Request workflow:
1. Angi sends lead → Jobber auto-creates Request + Client + Property
2. Jobber fires `REQUEST_CREATE` webhook to our server
3. Webhook handler stores mapping: `phone → { requestId, propertyId, clientName }`
4. When customer calls, we look up phone in Redis → get requestId
5. Query Jobber for full Request details including `property.id`

See `08-jobber-integration-guide.md` Section 6 for complete implementation.

### When Agent Should Call
- At the start of the call if phone number is available
- When caller mentions they're an existing customer
- Before booking to check for existing profile

### Retell Function Definition
```json
{
  "name": "lookup_customer",
  "description": "Look up a customer by their phone number to check if they have an existing inquiry (Angi lead) in our system. Call this at the start of the conversation if you have the caller's phone number.",
  "parameters": {
    "type": "object",
    "properties": {
      "phone_number": {
        "type": "string",
        "description": "The customer's phone number in E.164 format (e.g., +13035551234)"
      }
    },
    "required": ["phone_number"]
  }
}
```

### Expected Response Format
```json
{
  "found": true,
  "requestId": "UmVxdWVzdDo3ODkwMTI",
  "propertyId": "UHJvcGVydHk6MTIzNDU2",
  "customer": {
    "id": "cust_abc123",
    "name": "John Smith",
    "firstName": "John",
    "email": "john@example.com",
    "phone": "+13035551234",
    "address": "1234 Cherry Creek Dr, Denver, CO 80209"
  }
}
```

### Response When Not Found
```json
{
  "found": false,
  "requestId": null,
  "propertyId": null,
  "customer": null
}
```

### Implementation Notes

**Backend must implement:**
1. Redis client for phone mapping storage
2. Phone normalization (handle various formats)
3. Request query to get full details from Jobber

```javascript
// Simplified lookup flow
async function lookupCustomer({ phone_number }) {
  // 1. Normalize phone
  const normalized = normalizePhone(phone_number); // → +13035551234

  // 2. Check Redis for mapping
  const mapping = await redis.get(`phone:${normalized}`);
  if (!mapping) return { found: false };

  // 3. Query Jobber for full Request details
  const request = await jobber.getRequestById(mapping.requestId);

  return {
    found: true,
    requestId: mapping.requestId,
    propertyId: request.property.id,  // CRITICAL: needed for booking
    customer: {
      id: request.client.id,
      name: request.client.name,
      firstName: request.client.firstName,
      email: request.email,
      phone: normalized,
      address: formatAddress(request.property.address)
    }
  };
}
```

### Agent Behavior After Response
- **If found**: "Hi [name]! I see you recently reached out about cleaning services for your home on [address]. Would you like to schedule an appointment?"
- **If not found**: Proceed as new customer, gather information naturally

---

## 3. Function: calculate_quote

### Purpose
Calculate a price estimate based on property details and service type.

### When Agent Should Call
After gathering ALL of these details:
- Number of bedrooms
- Number of bathrooms
- Square footage (or estimate)
- Service frequency (one-time, weekly, bi-weekly)
- Any add-ons requested

### Retell Function Definition
```json
{
  "name": "calculate_quote",
  "description": "Calculate a cleaning price quote based on property details. Only call this after you have collected: number of bedrooms, number of bathrooms, approximate square footage, and desired frequency (one-time, weekly, or bi-weekly).",
  "parameters": {
    "type": "object",
    "properties": {
      "bedrooms": {
        "type": "integer",
        "description": "Number of bedrooms in the property",
        "minimum": 1,
        "maximum": 10
      },
      "bathrooms": {
        "type": "number",
        "description": "Number of bathrooms (can be decimal like 2.5)",
        "minimum": 1,
        "maximum": 10
      },
      "square_feet": {
        "type": "integer",
        "description": "Approximate square footage of the property. If unknown, estimate: small home ~1200, medium ~1800, large ~2500+",
        "minimum": 500,
        "maximum": 10000
      },
      "frequency": {
        "type": "string",
        "description": "How often the customer wants cleaning service",
        "enum": ["one-time", "weekly", "bi-weekly"]
      },
      "add_ons": {
        "type": "array",
        "description": "Optional additional services requested",
        "items": {
          "type": "string",
          "enum": ["inside_fridge", "inside_oven", "inside_cabinets", "windows", "deep_clean", "move_in_out", "laundry", "dishes"]
        }
      },
      "condition": {
        "type": "string",
        "description": "Current condition of the property",
        "enum": ["normal", "needs_extra_attention", "heavy_cleaning_needed"],
        "default": "normal"
      }
    },
    "required": ["bedrooms", "bathrooms", "square_feet", "frequency"]
  }
}
```

### Expected Response Format
```json
{
  "quote": {
    "base_price": 185,
    "add_on_total": 45,
    "discount": 0,
    "discount_reason": null,
    "total": 230,
    "frequency": "one-time",
    "estimated_hours": 3.5,
    "team_size": 2
  },
  "breakdown": {
    "base": "3 bed / 2 bath / 1800 sqft: $185",
    "add_ons": [
      "Inside fridge: $25",
      "Inside oven: $20"
    ],
    "discounts": []
  },
  "notes": "Price is an estimate and may adjust based on property condition."
}
```

### Response With Recurring Discount
```json
{
  "quote": {
    "base_price": 185,
    "add_on_total": 0,
    "discount": 18.50,
    "discount_reason": "10% bi-weekly service discount",
    "total": 166.50,
    "frequency": "bi-weekly",
    "estimated_hours": 2.5,
    "team_size": 2
  },
  "breakdown": {
    "base": "3 bed / 2 bath / 1800 sqft: $185",
    "add_ons": [],
    "discounts": ["Bi-weekly discount (10%): -$18.50"]
  },
  "notes": "Recurring service pricing. First clean may take longer."
}
```

### Agent Script After Quote
"Based on what you've shared - a [bedrooms] bedroom, [bathrooms] bathroom home around [sqft] square feet - your estimated price for [frequency] cleaning would be [total]. This includes [team_size] team members for about [hours] hours. [If add-ons: That includes [add-ons].] [If discount: That includes your [discount_reason].] Keep in mind this is an estimate - if the property needs extra attention on the first visit, we'll let you know before proceeding."

---

## 4. Function: check_availability

### Purpose
Check available appointment slots by querying scheduled visits in Jobber.

### CRITICAL: How Availability Works

**There is NO `scheduleAvailability` query in the Jobber API.**

Instead, use the `visits` query with date range filter:

```graphql
query GetSchedule($after: ISO8601DateTime!, $before: ISO8601DateTime!) {
  visits(first: 100, filter: {
    startAt: { after: $after, before: $before }
    status: SCHEDULED
  }) {
    nodes {
      id
      startAt
      endAt
      assignedUsers { nodes { id name } }
    }
  }
}
```

**Availability = Team Capacity - Scheduled Visits**

The backend calculates available slots by:
1. Querying visits for the requested date range
2. Getting team members with `availableForScheduling: true`
3. Finding time blocks where `booked visits < team capacity`

### When Agent Should Call
- AFTER providing a quote
- AFTER customer expresses interest in booking
- NOT before they've decided they want to proceed

### Retell Function Definition
```json
{
  "name": "check_availability",
  "description": "Check available appointment slots for cleaning service. Only call this after providing a quote and when the customer wants to proceed with booking.",
  "parameters": {
    "type": "object",
    "properties": {
      "preferred_date": {
        "type": "string",
        "description": "Customer's preferred date in YYYY-MM-DD format. If they say 'next week' or 'this weekend', calculate the actual date.",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
      },
      "preferred_time": {
        "type": "string",
        "description": "Customer's preferred time of day",
        "enum": ["morning", "afternoon", "any"]
      },
      "service_duration_hours": {
        "type": "number",
        "description": "Expected duration of the service in hours (from the quote)",
        "minimum": 1,
        "maximum": 8
      }
    },
    "required": ["preferred_date", "service_duration_hours"]
  }
}
```

### Expected Response Format
```json
{
  "available": true,
  "slots": [
    {
      "date": "2025-01-20",
      "day_of_week": "Saturday",
      "start_time": "09:00",
      "end_time": "12:00",
      "display": "Saturday, January 20th at 9 AM"
    },
    {
      "date": "2025-01-20",
      "day_of_week": "Saturday",
      "start_time": "13:00",
      "end_time": "16:00",
      "display": "Saturday, January 20th at 1 PM"
    },
    {
      "date": "2025-01-22",
      "day_of_week": "Monday",
      "start_time": "10:00",
      "end_time": "13:00",
      "display": "Monday, January 22nd at 10 AM"
    }
  ],
  "next_available": "2025-01-20",
  "message": "We have 3 openings this week."
}
```

### Response When No Availability
```json
{
  "available": false,
  "slots": [],
  "next_available": "2025-01-27",
  "message": "We're fully booked until January 27th. Would you like me to check availability for that week?"
}
```

### Implementation Notes

```javascript
// Backend availability calculation
async function checkAvailability({ preferred_date, service_duration_hours }) {
  const startDate = new Date(preferred_date);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 7); // Check one week ahead

  // Query visits using correct filter syntax
  const visits = await jobber.query(`
    query GetSchedule($after: ISO8601DateTime!, $before: ISO8601DateTime!) {
      visits(first: 100, filter: {
        startAt: { after: $after, before: $before }
        status: SCHEDULED
      }) {
        nodes { id, startAt, endAt, assignedUsers { nodes { id } } }
      }
    }
  `, {
    after: startDate.toISOString(),
    before: endDate.toISOString()
  });

  // Get team capacity
  const teamMembers = await jobber.getAvailableTeamMembers();
  const TEAM_CAPACITY = teamMembers.length || 2;

  // Calculate available slots where booked < capacity
  return calculateAvailableSlots(visits, TEAM_CAPACITY, startDate, endDate);
}
```

### Agent Script After Response
- **If available**: "Great news! I have a few openings. I can get you in on [slot 1 display], [slot 2 display], or [slot 3 display]. Which works best for you?"
- **If not available**: "I'm sorry, we're fully booked until [next_available]. Would you like me to check what we have available that week, or would you prefer I add you to our waitlist for an earlier opening?"

---

## 5. Function: book_appointment

### Purpose
Create a confirmed booking in Jobber using the `jobCreate` mutation.

### CRITICAL: Required API Structure

**The Jobber API requires:**
- `propertyId` (NOT `customer_id`) - Get from `Request.property.id`
- `requestId` - Links job back to Angi lead
- `invoicing` object with `invoicingType` and `invoicingSchedule` (REQUIRED)
- `scheduling` object with `createVisits: true` and `notifyTeam: true`

```graphql
mutation CreateJob($input: JobCreateAttributes!) {
  jobCreate(input: $input) {
    job { id, jobNumber, visits { nodes { startAt, endAt } } }
    userErrors { message, path }
  }
}
```

### When Agent Should Call
- AFTER customer has selected a specific date and time
- AFTER confirming all booking details with the customer
- AFTER verifying customer information (name, address, contact)
- **MUST have `propertyId`** from lookup_customer or new customer creation

### Retell Function Definition
```json
{
  "name": "book_appointment",
  "description": "Create a confirmed cleaning appointment in the system. Only call this after the customer has selected a specific time slot and you have confirmed all details with them. Requires propertyId from lookup_customer response.",
  "parameters": {
    "type": "object",
    "properties": {
      "property_id": {
        "type": "string",
        "description": "The Jobber property ID from lookup_customer response (e.g., 'UHJvcGVydHk6MTIzNDU2'). REQUIRED for booking."
      },
      "request_id": {
        "type": "string",
        "description": "The Jobber request ID from lookup_customer response. Links booking to Angi lead."
      },
      "customer_name": {
        "type": "string",
        "description": "Customer's full name"
      },
      "customer_phone": {
        "type": "string",
        "description": "Customer's phone number in E.164 format"
      },
      "customer_email": {
        "type": "string",
        "description": "Customer's email address (optional but recommended)"
      },
      "service_address": {
        "type": "object",
        "description": "The address where service will be performed (only needed for new customers)",
        "properties": {
          "street": {
            "type": "string",
            "description": "Street address including unit/apt number"
          },
          "city": {
            "type": "string",
            "description": "City name"
          },
          "state": {
            "type": "string",
            "description": "State abbreviation (e.g., CO)"
          },
          "zip": {
            "type": "string",
            "description": "ZIP code"
          }
        },
        "required": ["street", "city", "state", "zip"]
      },
      "appointment_date": {
        "type": "string",
        "description": "Selected appointment date in YYYY-MM-DD format",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
      },
      "appointment_time": {
        "type": "string",
        "description": "Selected appointment start time in HH:MM format (24-hour)",
        "pattern": "^\\d{2}:\\d{2}$"
      },
      "service_type": {
        "type": "string",
        "description": "Type of cleaning service",
        "enum": ["standard", "deep_clean", "move_in_out", "recurring_weekly", "recurring_biweekly"]
      },
      "quoted_price": {
        "type": "number",
        "description": "The quoted price from calculate_quote"
      },
      "estimated_hours": {
        "type": "number",
        "description": "Estimated duration in hours"
      },
      "special_instructions": {
        "type": "string",
        "description": "Any special instructions, access codes, pet information, or focus areas"
      },
      "add_ons": {
        "type": "array",
        "description": "Selected add-on services",
        "items": {
          "type": "string"
        }
      }
    },
    "required": [
      "property_id",
      "customer_name",
      "customer_phone",
      "appointment_date",
      "appointment_time",
      "service_type",
      "quoted_price",
      "estimated_hours"
    ]
  }
}
```

### Expected Response Format
```json
{
  "success": true,
  "booking": {
    "confirmation_number": "12345",
    "job_id": "Sm9iOjEyMzQ1Ng==",
    "property_id": "UHJvcGVydHk6MTIzNDU2",
    "date": "2025-01-20",
    "time": "09:00",
    "display_datetime": "Saturday, January 20th at 9:00 AM",
    "service_type": "Standard Cleaning",
    "quoted_price": 185,
    "address": "1234 Cherry Creek Dr, Denver, CO 80209"
  },
  "notifications": {
    "confirmation_sent": true,
    "reminder_scheduled": true,
    "method": "sms"
  },
  "message": "Booking confirmed! Confirmation number 12345."
}
```

### Response On Error
```json
{
  "success": false,
  "error": {
    "code": "SLOT_NO_LONGER_AVAILABLE",
    "message": "Sorry, that time slot was just booked by another customer.",
    "suggestion": "Would you like me to check for other available times?"
  }
}
```

### Implementation Notes

**Backend must use this mutation structure:**

```javascript
async function bookAppointment(args) {
  const { property_id, request_id, appointment_date, appointment_time, estimated_hours, ... } = args;

  // Build ISO8601 times
  const startTime = new Date(`${appointment_date}T${appointment_time}:00`);
  const endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + estimated_hours);

  const input = {
    propertyId: property_id,      // REQUIRED - from Request.property.id
    requestId: request_id,         // Links to Angi lead
    title: `House Cleaning - ${args.service_type}`,
    instructions: args.special_instructions || '',

    // REQUIRED: scheduling object
    scheduling: {
      createVisits: true,          // REQUIRED - creates the visit
      notifyTeam: true,            // REQUIRED - notifies team members
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      assignedTo: []               // Optional: team member IDs
    },

    // REQUIRED: invoicing object
    invoicing: {
      invoicingType: 'ON_COMPLETION',    // REQUIRED - when to invoice
      invoicingSchedule: 'VISIT_BASED'   // REQUIRED - how to calculate
    },

    // Optional: line items for pricing
    lineItems: [{
      name: args.service_type || 'House Cleaning',
      description: `${args.customer_name} - Cleaning service`,
      quantity: 1,
      unitPrice: args.quoted_price
    }]
  };

  const result = await jobber.mutation('jobCreate', { input });

  if (result.userErrors?.length > 0) {
    throw new Error(result.userErrors[0].message);
  }

  return {
    success: true,
    booking: {
      confirmation_number: result.job.jobNumber,
      job_id: result.job.id,
      ...
    }
  };
}
```

### Invoicing Configuration Reference

**BillingStrategy (invoicingType):**
| Value | Description | Use Case |
|-------|-------------|----------|
| `ON_COMPLETION` | Invoice when job complete | Default for one-time jobs |
| `PER_VISIT` | Invoice each visit | Multi-visit jobs |
| `PERIODIC` | Invoice periodically | Recurring contracts |
| `NEVER` | Never auto-invoice | Manual invoicing |

**BillingFrequencyEnum (invoicingSchedule):**
| Value | Description | Use Case |
|-------|-------------|----------|
| `FIXED_PRICE` | Set amount per invoice | Quoted fixed price |
| `VISIT_BASED` | Bill for completed work | Default for service work |

### Agent Script After Successful Booking
"Perfect! You're all set for [display_datetime] at [address]. Your confirmation number is [confirmation_number]. You'll receive a text message shortly with all the details. Our team of two will arrive in uniform and bring all eco-friendly supplies. Is there anything specific you'd like them to focus on, or any access instructions I should note?"

### Agent Script After Error
"I apologize - it looks like [error based on code]. [suggestion]. Let me check what else we have available."

---

## 6. Function: transfer_to_ceo

### Purpose
Transfer the call to Laila (CEO) for escalations or complex inquiries.

### When Agent Should Call
ONLY in these specific situations:
- Customer explicitly requests to speak with owner/manager/human
- Commercial cleaning inquiry over 5,000 sqft
- Customer is upset or wants to escalate
- Complex custom package negotiation beyond standard services
- Business partnership or contractor inquiry

### Retell Function Definition
```json
{
  "name": "transfer_to_ceo",
  "description": "Transfer the call to Laila, the owner/CEO. Only use for: explicit requests for a human, commercial inquiries over 5000 sqft, upset customers wanting to escalate, complex custom packages, or business partnership inquiries.",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": {
        "type": "string",
        "description": "Brief reason for the transfer",
        "enum": [
          "customer_requested_human",
          "commercial_large_property",
          "customer_escalation",
          "complex_custom_package",
          "business_partnership",
          "other"
        ]
      },
      "context_summary": {
        "type": "string",
        "description": "Brief summary of the conversation so far to help Laila"
      },
      "customer_name": {
        "type": "string",
        "description": "Customer's name if known"
      },
      "customer_phone": {
        "type": "string",
        "description": "Customer's callback number"
      }
    },
    "required": ["reason", "context_summary"]
  }
}
```

### Expected Response
```json
{
  "transfer_initiated": true,
  "transfer_to": "+13035551234",
  "message": "Connecting you with Laila now."
}
```

### Response If CEO Unavailable
```json
{
  "transfer_initiated": false,
  "reason": "CEO is currently unavailable",
  "alternative": "Would you like to leave a message or have Laila call you back within 2 hours?"
}
```

### Agent Script Before Transfer
"Absolutely, let me connect you with Laila, our owner. She'll have the full context from our conversation. One moment please..."

---

## 7. Webhook Configuration

### Retell Dashboard Setup

1. Go to **Agent Settings** → **Custom Functions**
2. Set webhook URL: `https://your-domain.com/webhook/retell-functions`
3. Add all function definitions above
4. Enable "Send call metadata"

### Webhook Request Format

Retell sends POST requests with this structure:
```json
{
  "call_id": "call_abc123",
  "function_name": "calculate_quote",
  "arguments": {
    "bedrooms": 3,
    "bathrooms": 2,
    "square_feet": 1800,
    "frequency": "bi-weekly"
  },
  "call_metadata": {
    "from_number": "+13035551234",
    "to_number": "+13035559999",
    "agent_id": "agent_xyz",
    "start_time": "2025-01-15T10:30:00Z"
  }
}
```

### Expected Response Format
```json
{
  "result": {
    // Function-specific response object
  }
}
```

### Webhook Handler Template
```javascript
// functions.js
app.post('/webhook/retell-functions', async (req, res) => {
  const { function_name, arguments: args, call_metadata } = req.body;

  console.log(`[${call_metadata.call_id}] Function called: ${function_name}`);

  try {
    let result;

    switch (function_name) {
      case 'lookup_customer':
        result = await handleLookupCustomer(args, call_metadata);
        break;
      case 'calculate_quote':
        result = await handleCalculateQuote(args);
        break;
      case 'check_availability':
        result = await handleCheckAvailability(args);
        break;
      case 'book_appointment':
        result = await handleBookAppointment(args, call_metadata);
        break;
      case 'transfer_to_ceo':
        result = await handleTransferToCeo(args, call_metadata);
        break;
      default:
        throw new Error(`Unknown function: ${function_name}`);
    }

    res.json({ result });

  } catch (error) {
    console.error(`[${call_metadata.call_id}] Error in ${function_name}:`, error);
    res.json({
      result: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Sorry, I encountered a technical issue. Let me try that again.'
        }
      }
    });
  }
});
```

---

## 8. Error Handling

### Standard Error Response Format
```json
{
  "result": {
    "success": false,
    "error": {
      "code": "ERROR_CODE",
      "message": "Human-friendly message for the agent to speak",
      "suggestion": "Optional next step suggestion"
    }
  }
}
```

### Error Codes Reference

| Code | Meaning | Agent Response |
|------|---------|----------------|
| `CUSTOMER_NOT_FOUND` | No customer with that phone | "I don't see you in our system yet, but I can help you get set up." |
| `MISSING_PROPERTY_ID` | No propertyId available | "Let me have someone call you back to complete your booking." |
| `INVALID_ADDRESS` | Address validation failed | "I wasn't able to verify that address. Could you repeat it for me?" |
| `SLOT_NO_LONGER_AVAILABLE` | Slot was booked | "That time was just taken. Let me find another option." |
| `OUTSIDE_SERVICE_AREA` | Address not in Denver metro | "I'm sorry, that address is outside our current service area." |
| `BOOKING_FAILED` | General booking error | "I'm having trouble completing the booking. Let me try again." |
| `JOBBER_UNAVAILABLE` | Jobber API down | "Our booking system is temporarily unavailable. Can I take your info and call you back?" |
| `TRANSFER_FAILED` | CEO transfer failed | "Laila isn't available right now. Can I have her call you back?" |

### Timeout Handling
Functions should respond within 5 seconds. If a function might take longer:

```javascript
// For long-running operations, respond quickly with status
async function handleCheckAvailability(args) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('TIMEOUT')), 4500)
  );

  try {
    const result = await Promise.race([
      jobberClient.calculateAvailableSlots(args.preferred_date),
      timeout
    ]);
    return result;
  } catch (error) {
    if (error.message === 'TIMEOUT') {
      return {
        success: false,
        error: {
          code: 'SLOW_RESPONSE',
          message: "I'm still checking our schedule. Can you hold for just a moment?",
          retry: true
        }
      };
    }
    throw error;
  }
}
```

### Retry Logic
For transient errors, the agent can retry:
```json
{
  "result": {
    "success": false,
    "error": {
      "code": "TRANSIENT_ERROR",
      "message": "Let me try that again.",
      "retry": true,
      "retry_after_ms": 1000
    }
  }
}
```

---

## Quick Reference

### Function Call Order (Typical Flow)
1. `lookup_customer` - Start of call (if phone known) → Returns `propertyId` and `requestId`
2. `calculate_quote` - After gathering property details
3. `check_availability` - After customer wants to book (uses `visits` query)
4. `book_appointment` - After selecting time slot (requires `propertyId`, uses `jobCreate` with `scheduling` and `invoicing`)
5. `transfer_to_ceo` - Only when needed (escalation)

### Required vs Optional Parameters

| Function | Required | Optional |
|----------|----------|----------|
| lookup_customer | phone_number | - |
| calculate_quote | bedrooms, bathrooms, square_feet, frequency | add_ons, condition |
| check_availability | preferred_date, service_duration_hours | preferred_time |
| book_appointment | **property_id**, customer_name, phone, date, time, service_type, price, hours | request_id, email, service_address, instructions, add_ons |
| transfer_to_ceo | reason, context_summary | customer_name, customer_phone |

### API Schema Summary (Verified January 2026)

| Operation | API Method | Key Points |
|-----------|------------|------------|
| Phone lookup | Redis + `request` query | No phone filter in ClientFilterAttributes |
| Availability | `visits` query | Use `filter: { startAt: { after, before }}` |
| Create booking | `jobCreate` mutation | Requires `propertyId`, `invoicing`, `scheduling` |

### Testing Checklist
- [ ] Each function returns within 5 seconds
- [ ] Error responses are human-readable
- [ ] All required fields validated
- [ ] Redis phone mapping storing correctly
- [ ] `propertyId` passed through lookup → booking flow
- [ ] `invoicing` object included in jobCreate
- [ ] `scheduling.createVisits` set to true
- [ ] Transfer to CEO phone number configured
- [ ] Webhook URL accessible via HTTPS
