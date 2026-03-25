# Jobber API Integration Guide

This guide covers connecting the Blue Bucket Voice Agent to Jobber CRM for real-time data access.

**Last Updated**: January 2026
**API Version**: 2025-04-16
**Status**: ✅ Verified against GraphQL introspection

## Table of Contents
1. [Overview](#1-overview)
2. [Jobber Developer Setup](#2-jobber-developer-setup)
3. [OAuth Authentication](#3-oauth-authentication)
4. [GraphQL API Reference](#4-graphql-api-reference)
5. [Implementation Code](#5-implementation-code)
6. [Phone-to-Request Mapping](#6-phone-to-request-mapping)
7. [Webhook Configuration](#7-webhook-configuration)
8. [Error Handling](#8-error-handling)

---

## 1. Overview

### What Jobber Integration Provides

| Feature | Description | Replaces |
|---------|-------------|----------|
| **Real Availability** | Check actual team calendar via visits query | Mock availability slots |
| **Request Lookup** | Find Angi leads by stored phone mapping | No existing customer recognition |
| **Job Creation** | Create real jobs with scheduling | Mock confirmation numbers |
| **Built-in SMS** | Automatic confirmations/reminders | Custom Twilio SMS |

### Architecture

```
Angi Lead → Jobber (auto-creates Request/Client/Property)
                ↓
         Webhook → Your Server (stores phone → requestId)
                ↓
Customer Call → Retell AI → Your Server
                              ↓
                         Lookup requestId by phone
                              ↓
                         Query Jobber for Request details
                              ↓
                         Check availability (visits query)
                              ↓
                         Create Job (jobCreate mutation)
                              ↓
                         Jobber sends SMS confirmation
```

### Verified Workflow

```
1. Angi webhook → creates Request with Client + Property automatically
2. Request.property.id → gives us propertyId (REQUIRED for jobCreate)
3. Request.id → gives us requestId (to link job back to lead)
4. visits(filter: startAt/endAt) → availability check
5. jobCreate(propertyId, requestId, scheduling, invoicing) → creates scheduled job
```

### Prerequisites
- Jobber account (Connect or Grow plan for API access)
- Jobber Developer account
- Redis instance (for phone mapping storage)
- Your app registered in Jobber Developer Center

---

## 2. Jobber Developer Setup

### Step 2.1: Create Developer Account

1. Go to [developer.getjobber.com](https://developer.getjobber.com)
2. Sign up or log in with your Jobber account
3. Access the Developer Center

### Step 2.2: Register Your Application

1. In Developer Center, click **Create New App**
2. Fill in application details:

| Field | Value |
|-------|-------|
| App Name | Blue Bucket Voice Agent |
| Description | AI voice agent integration for lead qualification and booking |
| Category | Business Operations |
| Website URL | https://thebluebucketcleaning.com |
| Redirect URI | https://your-server.com/oauth/callback |

3. Save and note your credentials:
```
Client ID: your_client_id_here
Client Secret: your_client_secret_here
```

### Step 2.3: Developer Testing Account

For testing without affecting production:
1. Go to Developer Center → Testing Accounts
2. Create a developer testing account
3. Use this account for all development/testing
4. Testing accounts have 90-day trial (can be extended)

---

## 3. OAuth Authentication

Jobber uses OAuth 2.0 for authentication.

### Step 3.1: Authorization Flow

#### A. Redirect User to Jobber Authorization

```javascript
// oauth.js
const JOBBER_AUTH_URL = 'https://api.getjobber.com/api/oauth/authorize';

function getAuthorizationUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'read_clients write_clients read_jobs write_jobs read_schedule read_requests'
  });

  return `${JOBBER_AUTH_URL}?${params.toString()}`;
}
```

#### B. Handle OAuth Callback

```javascript
// server.js - OAuth callback endpoint

app.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('OAuth error:', error);
    return res.status(400).send('Authorization failed');
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await storeTokens(tokens);
    res.send('Authorization successful! You can close this window.');
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).send('Token exchange failed');
  }
});

async function exchangeCodeForTokens(code) {
  const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
    client_id: process.env.JOBBER_CLIENT_ID,
    client_secret: process.env.JOBBER_CLIENT_SECRET,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: process.env.JOBBER_REDIRECT_URI
  });

  return response.data;
  // Returns: { access_token, refresh_token, expires_in, token_type }
}
```

#### C. Token Refresh

```javascript
async function refreshAccessToken(refreshToken) {
  const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
    client_id: process.env.JOBBER_CLIENT_ID,
    client_secret: process.env.JOBBER_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  return response.data;
}

async function getValidAccessToken() {
  const tokens = await loadTokens();

  if (isTokenExpired(tokens.expires_at)) {
    const newTokens = await refreshAccessToken(tokens.refresh_token);
    await storeTokens(newTokens);
    return newTokens.access_token;
  }

  return tokens.access_token;
}
```

### Step 3.2: Token Storage

**For Development** (file-based):
```javascript
const fs = require('fs').promises;
const TOKEN_FILE = './.jobber-tokens.json';

async function storeTokens(tokens) {
  const data = {
    ...tokens,
    expires_at: Date.now() + (tokens.expires_in * 1000)
  };
  await fs.writeFile(TOKEN_FILE, JSON.stringify(data, null, 2));
}

async function loadTokens() {
  const data = await fs.readFile(TOKEN_FILE, 'utf-8');
  return JSON.parse(data);
}
```

**For Production**: Use AWS Secrets Manager, HashiCorp Vault, or encrypted database.

---

## 4. GraphQL API Reference

### API Endpoint
```
POST https://api.getjobber.com/api/graphql
```

### Headers
```javascript
{
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json',
  'X-JOBBER-GRAPHQL-VERSION': '2025-04-16'
}
```

### Key Queries

#### Get Schedule/Visits

**⚠️ IMPORTANT**: Use `{ after, before }` NOT `{ gte, lte }`

```graphql
query GetSchedule($after: ISO8601DateTime!, $before: ISO8601DateTime!) {
  visits(first: 100, filter: {
    startAt: { after: $after, before: $before }
    status: SCHEDULED
  }) {
    nodes {
      id
      title
      startAt
      endAt
      status
      assignedUsers {
        nodes {
          id
          name
        }
      }
    }
  }
}
```

Variables:
```json
{
  "after": "2025-01-20T00:00:00Z",
  "before": "2025-01-27T23:59:59Z"
}
```

**Iso8601DateTimeRangeInput Fields:**

| Field | Type | Notes |
|-------|------|-------|
| `after` | ISO8601DateTime | Filter for dates after this value |
| `before` | ISO8601DateTime | Filter for dates before this value |
| `eq` | ISO8601DateTime | Exact date match |

#### Get Request (Angi Lead Data)

```graphql
query GetRequest($requestId: EncodedId!) {
  request(id: $requestId) {
    id
    title
    contactName
    phone
    email
    source
    requestStatus
    createdAt
    client {
      id
      name
      firstName
      lastName
      phones { number primary }
      emails { address primary }
    }
    property {
      id
      name
      address {
        street
        city
        province
        postalCode
        country
      }
    }
    arrivalWindow {
      startAt
      endAt
    }
    lineItems {
      nodes {
        name
        description
        quantity
        unitPrice
      }
    }
  }
}
```

**Request Type Fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | NON_NULL | Request ID for linking to job |
| `client` | NON_NULL | Direct link to Client object |
| `property` | Object | Direct link to Property - use `property.id` for jobCreate |
| `contactName` | String | Customer name |
| `phone` | String | Phone number |
| `email` | String | Email address |
| `source` | NON_NULL | Lead source (e.g., Angi) |

#### Get Users (Team Members)

```graphql
query GetUsers($first: Int!) {
  users(first: $first) {
    nodes {
      id
      name
      email
      availableForScheduling
      status
      timezone
      assignedColor
    }
  }
}
```

**User Type Fields:**

| Field | Type | Notes |
|-------|------|-------|
| `id` | NON_NULL | User ID for `scheduling.assignedTo` |
| `name` | NON_NULL | Display name |
| `availableForScheduling` | NON_NULL | **Use this to filter assignable team members** |

#### Client Lookup

**⚠️ WARNING**: ClientFilterAttributes does NOT support phone number filtering.

```graphql
query GetClients($first: Int!, $filter: ClientFilterAttributes) {
  clients(first: $first, filter: $filter) {
    nodes {
      id
      name
      firstName
      lastName
      phones { number primary }
      emails { address primary }
      properties {
        nodes {
          id
          address { street city }
        }
      }
    }
  }
}
```

**Available ClientFilterAttributes:**

| Field | Type | Notes |
|-------|------|-------|
| `isCompany` | Boolean | Filter by company vs individual |
| `isLead` | Boolean | Filter leads vs clients |
| `isArchived` | Boolean | Filter archived status |
| `updatedAt` | Iso8601DateTimeRangeInput | Filter by update date |
| `createdAt` | Iso8601DateTimeRangeInput | Filter by creation date |
| `tags` | List | Filter by tags |

**❌ NO phone filter exists** - Use Request workflow for Angi leads instead.

### Key Mutations

#### Create Job

**⚠️ CRITICAL**: Uses `propertyId` (NOT `clientId`), requires `invoicing` and `scheduling` objects.

```graphql
mutation CreateJob($input: JobCreateAttributes!) {
  jobCreate(input: $input) {
    job {
      id
      jobNumber
      title
      totalPrice
      visits {
        nodes {
          id
          startAt
          endAt
          assignedUsers {
            nodes { id name }
          }
        }
      }
    }
    userErrors {
      message
      path
    }
  }
}
```

**Complete Variables Example:**
```json
{
  "input": {
    "propertyId": "UHJvcGVydHk6MTIzNDU2",
    "requestId": "UmVxdWVzdDo3ODkwMTI",
    "title": "House Cleaning - 3BR/2BA",
    "instructions": "Focus on kitchen and bathrooms. Dog in backyard.",
    "scheduling": {
      "createVisits": true,
      "notifyTeam": true,
      "startTime": "2025-01-25T09:00:00",
      "endTime": "2025-01-25T12:00:00",
      "assignedTo": ["VXNlcjoxMjM0NTY="]
    },
    "invoicing": {
      "invoicingType": "ON_COMPLETION",
      "invoicingSchedule": "VISIT_BASED"
    },
    "lineItems": [
      {
        "name": "Standard House Cleaning",
        "description": "3 bedroom, 2 bathroom",
        "quantity": 1,
        "unitPrice": 150.00
      }
    ]
  }
}
```

**JobCreateAttributes (Required Fields):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `propertyId` | EncodedId | **YES** | Get from `Request.property.id` |
| `invoicing` | JobInvoicingAttributes | **YES** | Invoicing configuration |
| `scheduling` | JobSchedulingAttributes | No | For creating scheduled visits |
| `requestId` | EncodedId | No | Link to Angi lead (recommended) |
| `title` | String | No | Job title |
| `instructions` | String | No | Notes for team |
| `lineItems` | List | No | Services/products |

**JobSchedulingAttributes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `createVisits` | Boolean | **YES** | Set `true` to create visits |
| `notifyTeam` | Boolean | **YES** | Set `true` to notify team |
| `startTime` | ISO8601Time | No | Visit start time |
| `endTime` | ISO8601Time | No | Visit end time |
| `assignedTo` | List | No | Array of User IDs |
| `recurrence` | ICalendarRule | No | For recurring jobs |

**JobInvoicingAttributes:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `invoicingType` | BillingStrategy | **YES** | When to invoice |
| `invoicingSchedule` | BillingFrequencyEnum | **YES** | How to calculate |

**BillingStrategy Enum:**

| Value | Description | Use Case |
|-------|-------------|----------|
| `ON_COMPLETION` | Invoice when job complete | **Default for one-time jobs** |
| `PER_VISIT` | Invoice each visit | Multi-visit jobs |
| `PERIODIC` | Invoice periodically | Recurring contracts |
| `NEVER` | Never auto-invoice | Manual invoicing |

**BillingFrequencyEnum:**

| Value | Description | Use Case |
|-------|-------------|----------|
| `FIXED_PRICE` | Set amount per invoice | Quoted fixed price |
| `VISIT_BASED` | Bill for completed work | **Default for service work** |

---

## 5. Implementation Code

### JobberClient Class

```javascript
// jobber-client.js

const axios = require('axios');

class JobberClient {
  constructor() {
    this.baseUrl = 'https://api.getjobber.com/api/graphql';
    this.apiVersion = '2025-04-16';
  }

  async getAccessToken() {
    const tokens = await loadTokens();

    if (this.isTokenExpired(tokens.expires_at)) {
      const newTokens = await this.refreshToken(tokens.refresh_token);
      await storeTokens(newTokens);
      return newTokens.access_token;
    }

    return tokens.access_token;
  }

  isTokenExpired(expiresAt) {
    return Date.now() >= expiresAt - 60000; // 1 min buffer
  }

  async refreshToken(refreshToken) {
    const response = await axios.post('https://api.getjobber.com/api/oauth/token', {
      client_id: process.env.JOBBER_CLIENT_ID,
      client_secret: process.env.JOBBER_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    });
    return response.data;
  }

  async query(graphqlQuery, variables = {}) {
    const accessToken = await this.getAccessToken();

    try {
      const response = await axios.post(
        this.baseUrl,
        { query: graphqlQuery, variables },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': this.apiVersion
          },
          timeout: 10000
        }
      );

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        throw new Error(response.data.errors[0].message);
      }

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('Token invalid, attempting refresh...');
        const tokens = await loadTokens();
        const newTokens = await this.refreshToken(tokens.refresh_token);
        await storeTokens(newTokens);
        return this.query(graphqlQuery, variables);
      }
      throw error;
    }
  }

  // ============ REQUEST OPERATIONS ============

  /**
   * Get Request by ID (for Angi leads)
   * Returns property.id needed for job creation
   */
  async getRequestById(requestId) {
    const query = `
      query GetRequest($id: EncodedId!) {
        request(id: $id) {
          id
          title
          contactName
          phone
          email
          requestStatus
          client {
            id
            name
            firstName
            lastName
          }
          property {
            id
            address {
              street
              city
              province
              postalCode
            }
          }
          lineItems {
            nodes {
              name
              description
              unitPrice
            }
          }
        }
      }
    `;

    const result = await this.query(query, { id: requestId });
    return result.request;
  }

  // ============ USER OPERATIONS ============

  /**
   * Get team members available for scheduling
   */
  async getAvailableTeamMembers() {
    const query = `
      query GetUsers {
        users(first: 50) {
          nodes {
            id
            name
            availableForScheduling
            status
          }
        }
      }
    `;

    const result = await this.query(query);
    return result.users.nodes.filter(u => u.availableForScheduling);
  }

  // ============ SCHEDULE OPERATIONS ============

  /**
   * Get scheduled visits for a date range
   * Uses correct { after, before } filter syntax
   */
  async getScheduledVisits(startDate, endDate) {
    const query = `
      query GetSchedule($after: ISO8601DateTime!, $before: ISO8601DateTime!) {
        visits(first: 100, filter: {
          startAt: { after: $after, before: $before }
          status: SCHEDULED
        }) {
          nodes {
            id
            startAt
            endAt
            assignedUsers {
              nodes { id name }
            }
          }
        }
      }
    `;

    const result = await this.query(query, {
      after: startDate.toISOString(),
      before: endDate.toISOString()
    });

    return result.visits.nodes;
  }

  /**
   * Calculate available time slots based on booked visits and team capacity
   */
  async calculateAvailableSlots(preferredDate, daysAhead = 7) {
    const startDate = preferredDate ? new Date(preferredDate) : new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysAhead);

    // Get booked visits and available team members
    const [visits, teamMembers] = await Promise.all([
      this.getScheduledVisits(startDate, endDate),
      this.getAvailableTeamMembers()
    ]);

    const TEAM_CAPACITY = teamMembers.length || 2;
    const SLOT_TIMES = ['09:00', '10:00', '13:00', '14:00'];
    const WORK_DAYS = [1, 2, 3, 4, 5, 6]; // Mon-Sat

    // Create map of booked time blocks
    const bookedBlocks = {};
    visits.forEach(visit => {
      const dateKey = visit.startAt.split('T')[0];
      const hour = new Date(visit.startAt).getHours();
      const key = `${dateKey}-${hour}`;
      bookedBlocks[key] = (bookedBlocks[key] || 0) + 1;
    });

    // Find available slots
    const slots = [];
    const current = new Date(startDate);

    while (current <= endDate && slots.length < 6) {
      if (WORK_DAYS.includes(current.getDay())) {
        const dateKey = current.toISOString().split('T')[0];

        for (const time of SLOT_TIMES) {
          const hour = parseInt(time.split(':')[0]);
          const key = `${dateKey}-${hour}`;
          const bookedCount = bookedBlocks[key] || 0;

          if (bookedCount < TEAM_CAPACITY) {
            slots.push({
              date: dateKey,
              time: time,
              dayName: current.toLocaleDateString('en-US', { weekday: 'long' }),
              displayDate: current.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric'
              })
            });
          }

          if (slots.length >= 6) break;
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  // ============ JOB OPERATIONS ============

  /**
   * Create a scheduled job
   * Uses correct propertyId, scheduling object, and invoicing object
   */
  async createJob(jobData) {
    const mutation = `
      mutation CreateJob($input: JobCreateAttributes!) {
        jobCreate(input: $input) {
          job {
            id
            jobNumber
            title
            visits {
              nodes {
                id
                startAt
                endAt
                assignedUsers { nodes { id name } }
              }
            }
          }
          userErrors {
            message
            path
          }
        }
      }
    `;

    // Build ISO8601 times
    const { startTime, endTime } = this.buildScheduleTimes(
      jobData.date,
      jobData.time,
      jobData.durationHours || 3
    );

    const input = {
      propertyId: jobData.propertyId,  // REQUIRED - from Request.property.id
      requestId: jobData.requestId,     // Links to Angi lead
      title: jobData.title || `${jobData.serviceType || 'Cleaning'} - ${jobData.address || 'Service'}`,
      instructions: jobData.notes || '',
      scheduling: {
        createVisits: true,             // REQUIRED
        notifyTeam: true,               // REQUIRED
        startTime: startTime,
        endTime: endTime,
        assignedTo: jobData.assignedTo || []
      },
      invoicing: {
        invoicingType: 'ON_COMPLETION',   // REQUIRED
        invoicingSchedule: 'VISIT_BASED'  // REQUIRED
      },
      ...(jobData.price && {
        lineItems: [{
          name: jobData.serviceType || 'House Cleaning',
          description: jobData.description || 'Cleaning service',
          quantity: 1,
          unitPrice: parseFloat(String(jobData.price).replace(/[^0-9.]/g, ''))
        }]
      })
    };

    const result = await this.query(mutation, { input });

    if (result.jobCreate.userErrors?.length > 0) {
      throw new Error(result.jobCreate.userErrors[0].message);
    }

    return result.jobCreate.job;
  }

  /**
   * Build ISO8601 schedule times from date and time strings
   */
  buildScheduleTimes(dateStr, timeStr, durationHours = 3) {
    const date = this.parseDate(dateStr);
    const [hours, minutes] = this.parseTime(timeStr);

    const startTime = new Date(date);
    startTime.setHours(hours, minutes, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + durationHours);

    return {
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString()
    };
  }

  parseDate(dateStr) {
    const now = new Date();
    const lower = dateStr.toLowerCase();

    const dayMap = {
      'monday': 1, 'tuesday': 2, 'wednesday': 3,
      'thursday': 4, 'friday': 5, 'saturday': 6, 'sunday': 0
    };

    for (const [day, num] of Object.entries(dayMap)) {
      if (lower.includes(day)) {
        const daysUntil = (num - now.getDay() + 7) % 7 || 7;
        const result = new Date(now);
        result.setDate(result.getDate() + daysUntil);
        return result;
      }
    }

    // Try parsing as date string
    const parsed = new Date(dateStr);
    return isNaN(parsed) ? now : parsed;
  }

  parseTime(timeStr) {
    const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
    if (!match) return [9, 0]; // Default 9 AM

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]) || 0;
    const ampm = match[3]?.toLowerCase();

    if (ampm === 'pm' && hours < 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;

    return [hours, minutes];
  }
}

module.exports = new JobberClient();
```

### Function Handlers

```javascript
// functions-jobber.js

const jobber = require('./jobber-client');
const { getRequestDetailsByPhone } = require('./phone-lookup');

/**
 * Look up customer by phone using stored Request mapping
 */
async function lookupCustomer(args) {
  const { phone } = args;

  try {
    // Lookup Request via stored phone mapping
    const mapping = await getRequestDetailsByPhone(phone);

    if (!mapping || !mapping.request) {
      return {
        result: "I don't see an existing inquiry with that phone number. No problem - I can help you as a new customer. What's your name?",
        found: false
      };
    }

    const request = mapping.request;
    const client = request.client;
    const property = request.property;
    const address = property?.address
      ? `${property.address.street}, ${property.address.city}`
      : null;

    return {
      result: `Hi ${client.firstName}! I see you recently reached out about cleaning services${address ? ` for your home on ${property.address.street}` : ''}. Would you like to schedule an appointment?`,
      found: true,
      requestId: mapping.requestId,
      clientId: client.id,
      clientName: client.name,
      propertyId: property?.id,
      address: address
    };
  } catch (error) {
    console.error('[FUNCTION] lookupCustomer error:', error);
    return {
      result: "I'm having trouble looking up your information. Let me help you - what's your name?",
      found: false
    };
  }
}

/**
 * Check real calendar availability
 */
async function checkAvailability(args) {
  const { preferredDate } = args;

  try {
    const slots = await jobber.calculateAvailableSlots(preferredDate);

    if (slots.length === 0) {
      return {
        result: "I'm looking at our schedule and we're pretty booked up this week. Would you be flexible on timing? I can check the following week.",
        slots: [],
        available: false
      };
    }

    // Format for speech
    const slotDescriptions = slots.slice(0, 3).map(s =>
      `${s.dayName} at ${formatTimeForSpeech(s.time)}`
    );

    const lastSlot = slotDescriptions.pop();
    const slotsText = slotDescriptions.length
      ? `${slotDescriptions.join(', ')}, or ${lastSlot}`
      : lastSlot;

    return {
      result: `I have availability ${slotsText}. Which works better for you?`,
      slots: slots.slice(0, 3),
      available: true
    };
  } catch (error) {
    console.error('[FUNCTION] checkAvailability error:', error);
    // CRITICAL: Don't provide fake availability - request callback
    return {
      result: "I'm having trouble checking our live schedule right now. Let me have someone call you back within the hour to get you scheduled. Would that work?",
      slots: [],
      available: false,
      needsCallback: true
    };
  }
}

/**
 * Book appointment - creates job with correct API structure
 * CRITICAL: Never returns fake confirmations on failure
 */
async function bookAppointment(args) {
  const {
    date,
    time,
    customerName,
    phone,
    address,
    serviceType,
    estimatedPrice,
    requestId,
    propertyId,
    notes
  } = args;

  // Validate required fields
  if (!propertyId) {
    console.error('[FUNCTION] bookAppointment missing propertyId');
    return {
      result: "I'm missing some information needed to complete your booking. Let me have someone call you back within the hour to finalize this. Would that work?",
      success: false,
      needsCallback: true
    };
  }

  try {
    const job = await jobber.createJob({
      propertyId: propertyId,           // REQUIRED
      requestId: requestId,             // Links to Angi lead
      date: date,
      time: time,
      serviceType: serviceType || 'House Cleaning',
      address: address,
      price: estimatedPrice,
      notes: `Booked via AI agent. Customer: ${customerName}. ${notes || ''}`
    });

    console.log(`[FUNCTION] Created job: ${job.jobNumber}`);

    return {
      result: `Perfect! I've booked your ${(serviceType || 'cleaning').toLowerCase()} for ${date} at ${formatTimeForSpeech(time)}. Your confirmation number is ${job.jobNumber}. You'll receive a text shortly with all the details. Our team will arrive in uniform and bring all supplies. Is there anything specific you'd like them to focus on?`,
      success: true,
      jobId: job.id,
      jobNumber: job.jobNumber
    };
  } catch (error) {
    console.error('[FUNCTION] bookAppointment error:', error);

    // CRITICAL: Do NOT return fake confirmation - request human follow-up
    return {
      result: "I apologize, but I'm having trouble completing your booking right now. Let me have our team call you back within the hour to confirm everything. We have your information saved. Would that work for you?",
      success: false,
      needsCallback: true,
      error: error.message
    };
  }
}

function formatTimeForSpeech(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return minutes ? `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}` : `${hour12} ${ampm}`;
}

module.exports = {
  lookupCustomer,
  checkAvailability,
  bookAppointment
};
```

---

## 6. Phone-to-Request Mapping

The Jobber API does **not** support filtering clients or requests by phone number. To identify callers from Angi leads, we must:

1. Capture `REQUEST_CREATE` webhooks from Jobber
2. Store phone → requestId mapping in Redis
3. Lookup requestId when customer calls

### 6.1 Redis Setup

```bash
npm install redis
```

```javascript
// redis-client.js

const { createClient } = require('redis');

class RedisClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    if (this.isConnected) return this.client;

    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.client.on('error', (err) => {
      console.error('[REDIS] Error:', err.message);
      this.isConnected = false;
    });

    this.client.on('ready', () => {
      console.log('[REDIS] Connected');
      this.isConnected = true;
    });

    await this.client.connect();
    return this.client;
  }

  async getClient() {
    if (!this.isConnected) await this.connect();
    return this.client;
  }
}

module.exports = new RedisClient();
```

### 6.2 Phone Normalization

```javascript
// phone-utils.js

function normalizePhone(phone) {
  if (!phone) return null;

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;  // US number
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  } else if (digits.length > 10) {
    return `+${digits}`;
  }

  return digits.length >= 10 ? `+${digits}` : null;
}

module.exports = { normalizePhone };
```

### 6.3 Webhook Handler

```javascript
// webhook-handler.js

const crypto = require('crypto');
const redisClient = require('./redis-client');
const { normalizePhone } = require('./phone-utils');

const TTL_DAYS = 90;
const TTL_SECONDS = TTL_DAYS * 24 * 60 * 60;

function verifySignature(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('base64');

  return crypto.timingSafeEqual(
    Buffer.from(signature || ''),
    Buffer.from(expected)
  );
}

async function storePhoneMapping(phone, data) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;

  const redis = await redisClient.getClient();
  const key = `phone:${normalized}`;

  await redis.set(key, JSON.stringify({
    requestId: data.requestId,
    clientName: data.clientName,
    propertyId: data.propertyId,
    createdAt: new Date().toISOString()
  }), { EX: TTL_SECONDS });

  console.log(`[PHONE_MAPPING] Stored: ${normalized} → ${data.requestId}`);
  return true;
}

async function handleRequestCreate(payload) {
  const { data } = payload;

  const requestId = data?.id;
  const phone = data?.phone;
  const clientName = data?.contactName;
  const propertyId = data?.property?.id;

  if (!requestId || !phone) {
    console.warn('[WEBHOOK] Missing requestId or phone');
    return { processed: false };
  }

  await storePhoneMapping(phone, { requestId, clientName, propertyId, phone });
  return { processed: true, requestId };
}

// Express route
async function webhookHandler(req, res) {
  const signature = req.headers['x-jobber-hmac-sha256'];

  if (!verifySignature(req.body, signature, process.env.JOBBER_WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const { topic } = req.body;

  if (topic === 'REQUEST_CREATE') {
    const result = await handleRequestCreate(req.body);
    return res.json({ received: true, ...result });
  }

  res.json({ received: true, topic });
}

module.exports = { webhookHandler, storePhoneMapping };
```

### 6.4 Phone Lookup

```javascript
// phone-lookup.js

const redisClient = require('./redis-client');
const { normalizePhone } = require('./phone-utils');
const jobber = require('./jobber-client');

async function getRequestByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const redis = await redisClient.getClient();
  const data = await redis.get(`phone:${normalized}`);

  return data ? JSON.parse(data) : null;
}

async function getRequestDetailsByPhone(phone) {
  const mapping = await getRequestByPhone(phone);
  if (!mapping) return null;

  try {
    const request = await jobber.getRequestById(mapping.requestId);
    return { ...mapping, request };
  } catch (error) {
    console.error('[LOOKUP] Jobber query error:', error.message);
    return mapping;  // Return cached mapping on error
  }
}

module.exports = { getRequestByPhone, getRequestDetailsByPhone };
```

### 6.5 Server Integration

```javascript
// server.js

const express = require('express');
const { webhookHandler } = require('./webhook-handler');

const app = express();
app.use(express.json());

// Jobber webhook endpoint
app.post('/webhook/jobber', webhookHandler);
```

### 6.6 Complete Flow

```
1. Angi sends lead → Jobber creates Request
2. Jobber fires REQUEST_CREATE webhook
3. Webhook handler stores: phone:+13035551234 → { requestId, propertyId, ... }
4. Customer calls → lookupCustomer({ phone })
5. Lookup returns requestId → query Request → get propertyId
6. Book appointment with propertyId
```

---

## 7. Webhook Configuration

### Subscribe to Topics

In Developer Center → Your App → Webhooks:

| Topic | Purpose |
|-------|---------|
| `REQUEST_CREATE` | **Required** - Store phone → requestId mapping |
| `JOB_CREATE` | Optional - Sync confirmations |
| `JOB_UPDATE` | Optional - Sync status changes |

### Webhook Endpoint

```javascript
app.post('/webhook/jobber', webhookHandler);
```

---

## 8. Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired | Refresh and retry |
| 403 Forbidden | Missing scope | Check OAuth scopes |
| `userErrors` in response | Validation failed | Check required fields |

### Critical Rule: No Fake Confirmations

**NEVER** return a fake confirmation number when booking fails:

```javascript
// ❌ WRONG - Creates phantom bookings
catch (error) {
  return {
    result: `Booked! Your number is BBK-${Math.random()}`,
    jobNumber: 'BBK-FAKE123'
  };
}

// ✅ CORRECT - Request human follow-up
catch (error) {
  return {
    result: "I'm having trouble completing your booking. Let me have someone call you back within the hour.",
    needsCallback: true
  };
}
```

---

## Environment Variables

```bash
# Jobber OAuth
JOBBER_CLIENT_ID=your_client_id
JOBBER_CLIENT_SECRET=your_client_secret
JOBBER_REDIRECT_URI=https://your-server.com/oauth/callback
JOBBER_WEBHOOK_SECRET=your_webhook_secret

# Redis
REDIS_URL=redis://localhost:6379

# Phone mapping TTL
PHONE_MAPPING_TTL_DAYS=90
```

---

## Verified API Summary

| Operation | Status | Method |
|-----------|--------|--------|
| Query visits by date | ✅ Verified | `visits(filter: { startAt: { after, before }})` |
| Create scheduled job | ✅ Verified | `jobCreate` with `scheduling`, `invoicing` |
| Get Request details | ✅ Verified | `request(id)` returns `property.id` |
| Link job to Angi lead | ✅ Verified | `requestId` field in `JobCreateAttributes` |
| Assign team members | ✅ Verified | `scheduling.assignedTo` + `User.availableForScheduling` |
| Client phone lookup | ❌ Not supported | Use Request workflow instead |

**API Version**: 2025-04-16
**Last Verified**: January 2026
