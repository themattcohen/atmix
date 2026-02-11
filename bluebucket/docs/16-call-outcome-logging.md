# Post-Call Outcome Logging

This document describes the call outcome logging system that records call results to Jobber CRM after outbound calls complete. The system tracks outcomes that a normal SDR/appointment setter would track.

**Last Updated**: January 2026
**Status**: Design Complete - Ready for Implementation

## Table of Contents
1. [Overview](#1-overview)
2. [Outcome Determination Logic](#2-outcome-determination-logic)
3. [Jobber API Integration](#3-jobber-api-integration)
4. [Implementation Checklist](#4-implementation-checklist)
5. [Note Format Examples](#5-note-format-examples)
6. [Testing Procedures](#6-testing-procedures)

---

## 1. Overview

### Purpose

When outbound calls complete (via Twilio call-status webhook), the system logs outcomes to Jobber CRM to:
- Track lead qualification results
- Maintain call history on Request records
- Update Request status when appropriate
- Provide visibility into conversion metrics

### Architecture

```
Twilio Call Completes
        │
        ▼
POST /webhook/call-status
        │
        ▼
┌───────────────────────────────┐
│  callOutcomeLogger.js         │
│  ─────────────────────────    │
│  1. Determine outcome type    │
│  2. Build note content        │
│  3. Add note to Request       │
│  4. Update Request status     │
└───────────────────────────────┘
        │
        ▼
┌───────────────────────────────┐
│  Jobber GraphQL API           │
│  ─────────────────────────    │
│  - noteCreate mutation        │
│  - requestUpdate mutation     │
└───────────────────────────────┘
```

### Outcome Types

| Outcome | Code | Description | Status Action |
|---------|------|-------------|---------------|
| Booked | `booked` | Appointment was scheduled during call | Update to `CONVERTED` |
| Callback Requested | `callback_requested` | Customer asked to be called back later | Keep as `LEAD` |
| Not Interested | `not_interested` | Customer declined service | Update to `ARCHIVED` |
| Voicemail | `voicemail` | Left voicemail message | Keep as `LEAD` |
| No Answer | `no_answer` | No one answered the call | Keep as `LEAD` |
| Busy | `busy` | Line was busy | Keep as `LEAD` |
| Failed | `failed` | Call failed to connect | Keep as `LEAD` |

### Data Sources

The outcome logger requires data from multiple sources:

1. **Twilio Call Status Webhook**: Call result (completed, busy, no-answer, failed)
2. **Twilio Machine Detection**: Whether voicemail was detected
3. **Retell Call Data**: Conversation transcript and function call results
4. **Call Context Store**: Original lead data (requestId, propertyId, customerName)

---

## 2. Outcome Determination Logic

### Decision Flow

```
                    ┌─────────────────────┐
                    │ Call Status Webhook │
                    └─────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
         │completed│    │busy     │    │no-answer│
         │         │    │         │    │failed   │
         └────┬────┘    └────┬────┘    └────┬────┘
              │               │               │
     ┌────────▼────────┐      │               │
     │Check AnsweredBy │      │               │
     └────────┬────────┘      │               │
              │               │               │
    ┌─────────┼─────────┐     │               │
    │         │         │     │               │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ │               │
│machine│ │human  │ │unknown│ │               │
└───┬───┘ └───┬───┘ └───┬───┘ │               │
    │         │         │     │               │
    ▼         ▼         ▼     ▼               ▼
voicemail   Check    human   busy     no_answer/failed
           Retell
           Result
              │
    ┌─────────┼─────────────┐
    │         │             │
┌───▼───┐ ┌───▼──────┐ ┌───▼───────────┐
│booked │ │callback_ │ │not_interested │
│       │ │requested │ │               │
└───────┘ └──────────┘ └───────────────┘
```

### Determination Algorithm

```javascript
/**
 * Determine call outcome based on available data.
 *
 * Priority order:
 * 1. Twilio status (busy, no-answer, failed)
 * 2. Machine detection (voicemail)
 * 3. Retell function results (booked, callback_requested)
 * 4. Conversation analysis (not_interested)
 *
 * @param {Object} twilioData - Twilio call status webhook data
 * @param {Object} retellData - Retell call completion data (optional)
 * @returns {Object} Outcome determination with type and details
 */
function determineOutcome(twilioData, retellData = null) {
  const { CallStatus, AnsweredBy, CallDuration } = twilioData;

  // Priority 1: Non-connected call statuses
  if (CallStatus === 'busy') {
    return { type: 'busy', source: 'twilio' };
  }

  if (CallStatus === 'no-answer' || CallStatus === 'canceled') {
    return { type: 'no_answer', source: 'twilio' };
  }

  if (CallStatus === 'failed') {
    return { type: 'failed', source: 'twilio' };
  }

  // Priority 2: Machine/voicemail detection
  if (AnsweredBy && AnsweredBy.startsWith('machine')) {
    return { type: 'voicemail', source: 'twilio_machine_detection' };
  }

  // Priority 3: Check Retell function call results
  if (retellData && retellData.functionCalls) {
    // Check if book_appointment was called successfully
    const bookingCall = retellData.functionCalls.find(
      fc => fc.name === 'book_appointment' && fc.result?.success === true
    );
    if (bookingCall) {
      return {
        type: 'booked',
        source: 'retell_function',
        details: {
          jobNumber: bookingCall.result.jobNumber,
          jobId: bookingCall.result.jobId,
        },
      };
    }
  }

  // Priority 4: Analyze conversation for callback request or not interested
  if (retellData && retellData.transcript) {
    const outcome = analyzeTranscript(retellData.transcript);
    if (outcome) {
      return { type: outcome, source: 'transcript_analysis' };
    }
  }

  // Priority 5: Very short completed calls likely not interested
  const duration = parseInt(CallDuration || '0', 10);
  if (CallStatus === 'completed' && duration < 30) {
    return { type: 'not_interested', source: 'short_call_duration' };
  }

  // Default for completed calls without clear outcome
  return { type: 'completed', source: 'default' };
}
```

### Transcript Analysis

```javascript
/**
 * Analyze transcript for outcome indicators.
 *
 * @param {string} transcript - Call transcript text
 * @returns {string|null} Detected outcome type or null
 */
function analyzeTranscript(transcript) {
  const lower = transcript.toLowerCase();

  // Callback requested indicators
  const callbackPhrases = [
    'call me back',
    'call back later',
    'not a good time',
    'bad time',
    'busy right now',
    "can't talk",
    "can't talk right now",
    'in a meeting',
    'driving',
    'at work',
  ];

  for (const phrase of callbackPhrases) {
    if (lower.includes(phrase)) {
      return 'callback_requested';
    }
  }

  // Not interested indicators
  const notInterestedPhrases = [
    'not interested',
    'no thanks',
    "don't need",
    "don't want",
    'remove me',
    'stop calling',
    "don't call",
    'do not call',
    'wrong number',
    'already have',
    'already hired',
    'found someone',
  ];

  for (const phrase of notInterestedPhrases) {
    if (lower.includes(phrase)) {
      return 'not_interested';
    }
  }

  return null;
}
```

---

## 3. Jobber API Integration

### Note Create Mutation

The `noteCreate` mutation adds a note to any Jobber record that supports notes.

#### GraphQL Schema

```graphql
mutation CreateNote($input: NoteCreateAttributes!) {
  noteCreate(input: $input) {
    note {
      id
      message
      createdAt
      createdBy {
        id
        name
      }
    }
    userErrors {
      message
      path
    }
  }
}
```

#### NoteCreateAttributes

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `linkedToId` | EncodedId | **YES** | ID of record to attach note (Request ID) |
| `message` | String | **YES** | Note content (max 10,000 characters) |
| `isVisibleToClient` | Boolean | No | Whether note is visible to client (default: false) |

#### Example Variables

```json
{
  "input": {
    "linkedToId": "UmVxdWVzdDo3ODkwMTI",
    "message": "[AI Call - Booked]\nDate: 2026-01-17 10:30 AM MST\nDuration: 3m 45s\nOutcome: Appointment scheduled\n\nDetails:\n- Confirmation #12345\n- Scheduled for Sat Jan 20 at 9:00 AM\n- Service: Standard House Cleaning\n- Quote: $185\n\nAgent Notes:\n- Customer confirmed address at 1234 Cherry Creek Dr\n- Has a dog in the backyard\n- Prefers morning appointments",
    "isVisibleToClient": false
  }
}
```

### Request Status Update (Optional)

When a booking is successful, update the Request status to reflect conversion.

#### GraphQL Schema

```graphql
mutation UpdateRequestStatus($requestId: EncodedId!, $status: RequestStatusEnum!) {
  requestUpdate(
    requestId: $requestId,
    attributes: { requestStatus: $status }
  ) {
    request {
      id
      requestStatus
    }
    userErrors {
      message
      path
    }
  }
}
```

#### RequestStatusEnum Values

| Value | Description | Use Case |
|-------|-------------|----------|
| `LEAD` | New lead, not yet contacted | Initial state |
| `ASSESSMENT_PENDING` | Awaiting assessment | Need site visit |
| `QUOTE_PENDING` | Quote being prepared | Quote workflow |
| `AWAITING_APPROVAL` | Waiting for client approval | Quote sent |
| `APPROVED` | Quote/request approved | Ready to convert |
| `CONVERTED` | Converted to job | **Use when booked** |
| `ARCHIVED` | Lead archived/lost | **Use when not interested** |

### Query Definitions

Add these to `server/src/jobber/queries.js`:

```javascript
/**
 * NOTE_CREATE - Create a note attached to a record
 *
 * Used to log call outcomes to Request records.
 *
 * @param {NoteCreateAttributes} $input - Note creation input
 * @returns Created note with id and message
 */
const NOTE_CREATE = `
  mutation CreateNote($input: NoteCreateAttributes!) {
    noteCreate(input: $input) {
      note {
        id
        message
        createdAt
        createdBy {
          id
          name
        }
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * REQUEST_UPDATE_STATUS - Update a Request's status
 *
 * Used to mark requests as converted or archived after call outcomes.
 *
 * @param {EncodedId} $requestId - The request ID to update
 * @param {RequestStatusEnum} $status - New status value
 * @returns Updated request with new status
 */
const REQUEST_UPDATE_STATUS = `
  mutation UpdateRequestStatus($requestId: EncodedId!, $status: RequestStatusEnum!) {
    requestUpdate(
      requestId: $requestId,
      attributes: { requestStatus: $status }
    ) {
      request {
        id
        requestStatus
      }
      userErrors {
        message
        path
      }
    }
  }
`;
```

### Client Methods

Add these to `server/src/jobber/client.js`:

```javascript
/**
 * Create a note attached to a record.
 *
 * @param {string} linkedToId - EncodedId of the record (e.g., Request ID)
 * @param {string} message - Note content
 * @param {boolean} [isVisibleToClient=false] - Client visibility
 * @returns {Promise<Object>} Created note object
 * @throws {Error} If note creation fails
 */
async createNote(linkedToId, message, isVisibleToClient = false) {
  const result = await this.query(queries.NOTE_CREATE, {
    input: {
      linkedToId,
      message,
      isVisibleToClient,
    },
  });

  if (result.noteCreate.userErrors?.length > 0) {
    throw new Error(result.noteCreate.userErrors[0].message);
  }

  return result.noteCreate.note;
}

/**
 * Update a Request's status.
 *
 * @param {string} requestId - EncodedId of the Request
 * @param {string} status - New status (LEAD, CONVERTED, ARCHIVED, etc.)
 * @returns {Promise<Object>} Updated request object
 * @throws {Error} If update fails
 */
async updateRequestStatus(requestId, status) {
  const result = await this.query(queries.REQUEST_UPDATE_STATUS, {
    requestId,
    status,
  });

  if (result.requestUpdate.userErrors?.length > 0) {
    throw new Error(result.requestUpdate.userErrors[0].message);
  }

  return result.requestUpdate.request;
}
```

---

## 4. Implementation Checklist

### File Creation

- [ ] **`server/src/services/callOutcomeLogger.js`**
  - Main outcome logging service
  - Outcome determination logic
  - Note content building
  - Jobber API integration

- [ ] **`server/src/services/callContextStore.js`** (if not exists)
  - In-memory or Redis store for active call context
  - Maps Twilio CallSid to lead data (requestId, propertyId, etc.)
  - TTL-based cleanup

### File Modifications

#### 1. `server/src/jobber/queries.js`

Add mutations:
```javascript
const NOTE_CREATE = `...`;  // As defined in Section 3
const REQUEST_UPDATE_STATUS = `...`;  // As defined in Section 3

module.exports = {
  // ... existing exports
  NOTE_CREATE,
  REQUEST_UPDATE_STATUS,
};
```

#### 2. `server/src/jobber/client.js`

Add methods:
```javascript
async createNote(linkedToId, message, isVisibleToClient = false) { ... }
async updateRequestStatus(requestId, status) { ... }
```

#### 3. `server/src/services/outboundCaller.js`

Store call context when initiating calls:
```javascript
// After successful call initiation
await callContextStore.store(twilioResult.callSid, {
  requestId,
  propertyId,
  customerName,
  phone,
  source,
  initiatedAt: new Date().toISOString(),
});
```

#### 4. `server/src/webhooks/twilio.js`

Modify call-status handler (lines 107-109):
```javascript
case 'completed':
  console.log(`[CALL_STATUS] Call completed - Duration: ${CallDuration || Duration}s`);

  // Log outcome to Jobber
  try {
    await callOutcomeLogger.logOutcome({
      callSid: CallSid,
      status: CallStatus,
      duration: CallDuration || Duration,
      answeredBy: AnsweredBy,
      toNumber: To,
    });
  } catch (error) {
    console.error(`[CALL_STATUS] Failed to log outcome:`, error.message);
  }
  break;

case 'busy':
case 'no-answer':
case 'failed':
  console.warn(`[CALL_STATUS] Call ${CallStatus} to ${To} - may need retry`);

  // Log non-connected outcome
  try {
    await callOutcomeLogger.logOutcome({
      callSid: CallSid,
      status: CallStatus,
      toNumber: To,
    });
  } catch (error) {
    console.error(`[CALL_STATUS] Failed to log outcome:`, error.message);
  }
  break;
```

### Implementation Order

1. **Phase 1: Core Infrastructure**
   - Create `callContextStore.js` for storing call context
   - Add NOTE_CREATE mutation to queries.js
   - Add createNote method to client.js
   - Unit test Jobber note creation

2. **Phase 2: Outcome Logger**
   - Create `callOutcomeLogger.js` with outcome determination
   - Implement note content formatting
   - Add outcome logging to twilio.js webhook
   - Integration test with mock data

3. **Phase 3: Status Updates**
   - Add REQUEST_UPDATE_STATUS mutation
   - Add updateRequestStatus method
   - Implement status updates based on outcome
   - Full end-to-end testing

4. **Phase 4: Retell Integration** (optional enhancement)
   - Add Retell call completion webhook handler
   - Capture transcript and function call results
   - Enhance outcome determination with Retell data

---

## 5. Note Format Examples

### Booked

```
[AI Call - Booked]
Date: 2026-01-17 10:30 AM MST
Duration: 3m 45s
Outcome: Appointment scheduled

Booking Details:
- Confirmation #12345
- Scheduled: Saturday, January 20th at 9:00 AM
- Service: Standard House Cleaning
- Quote: $185.00

Call Summary:
- Customer confirmed address at 1234 Cherry Creek Dr
- 3 bed / 2 bath home, approximately 1,800 sqft
- Has a dog in the backyard (will be secured)
- Prefers morning appointments

---
Logged automatically by Blue Bucket AI Voice Agent
```

### Callback Requested

```
[AI Call - Callback Requested]
Date: 2026-01-17 10:30 AM MST
Duration: 0m 45s
Outcome: Customer requested callback

Details:
- Customer was driving and could not talk
- Requested callback after 5 PM today
- Seemed interested in service

Action Required:
- Schedule follow-up call for 5:00 PM MST

---
Logged automatically by Blue Bucket AI Voice Agent
```

### Not Interested

```
[AI Call - Not Interested]
Date: 2026-01-17 10:30 AM MST
Duration: 0m 30s
Outcome: Customer declined service

Reason:
- Already hired another cleaning service

Notes:
- Customer was polite but not interested
- Request archived - no follow-up needed

---
Logged automatically by Blue Bucket AI Voice Agent
```

### Voicemail

```
[AI Call - Voicemail]
Date: 2026-01-17 10:30 AM MST
Duration: 0m 25s
Outcome: Left voicemail

Message Left:
"Hi, this is calling from Blue Bucket Cleaning regarding your
recent inquiry on Angi. We'd love to help with your cleaning
needs. Please call us back at (303) 555-1234 or we'll try
again later. Thank you!"

Action Required:
- Retry in 24 hours if no callback received

---
Logged automatically by Blue Bucket AI Voice Agent
```

### No Answer

```
[AI Call - No Answer]
Date: 2026-01-17 10:30 AM MST
Duration: 0m 30s
Outcome: No answer (rang but not answered)

Attempt: 1 of 3

Action Required:
- Retry in 4 hours

---
Logged automatically by Blue Bucket AI Voice Agent
```

### Busy

```
[AI Call - Line Busy]
Date: 2026-01-17 10:30 AM MST
Duration: 0m 5s
Outcome: Line busy

Attempt: 1 of 3

Action Required:
- Retry in 1 hour

---
Logged automatically by Blue Bucket AI Voice Agent
```

### Failed

```
[AI Call - Failed]
Date: 2026-01-17 10:30 AM MST
Duration: 0m 0s
Outcome: Call failed to connect

Error: Network connectivity issue

Attempt: 1 of 3

Action Required:
- Verify phone number is valid
- Retry in 30 minutes

---
Logged automatically by Blue Bucket AI Voice Agent
```

---

## 6. Testing Procedures

### Unit Tests

#### Test Outcome Determination

```javascript
describe('determineOutcome', () => {
  it('should return busy for busy status', () => {
    const result = determineOutcome({ CallStatus: 'busy' });
    expect(result.type).toBe('busy');
    expect(result.source).toBe('twilio');
  });

  it('should return voicemail for machine detection', () => {
    const result = determineOutcome({
      CallStatus: 'completed',
      AnsweredBy: 'machine_start',
    });
    expect(result.type).toBe('voicemail');
  });

  it('should return booked when book_appointment succeeded', () => {
    const result = determineOutcome(
      { CallStatus: 'completed', AnsweredBy: 'human' },
      {
        functionCalls: [{
          name: 'book_appointment',
          result: { success: true, jobNumber: '12345' },
        }],
      }
    );
    expect(result.type).toBe('booked');
    expect(result.details.jobNumber).toBe('12345');
  });

  it('should detect callback_requested from transcript', () => {
    const result = determineOutcome(
      { CallStatus: 'completed', AnsweredBy: 'human' },
      { transcript: "I'm driving right now, can you call me back later?" }
    );
    expect(result.type).toBe('callback_requested');
  });

  it('should detect not_interested from transcript', () => {
    const result = determineOutcome(
      { CallStatus: 'completed', AnsweredBy: 'human' },
      { transcript: "No thanks, we already hired someone." }
    );
    expect(result.type).toBe('not_interested');
  });
});
```

#### Test Note Formatting

```javascript
describe('buildNoteContent', () => {
  it('should format booked note correctly', () => {
    const note = buildNoteContent({
      type: 'booked',
      timestamp: new Date('2026-01-17T17:30:00Z'),
      duration: 225,
      details: {
        jobNumber: '12345',
        scheduledFor: 'Saturday, January 20th at 9:00 AM',
        serviceType: 'Standard House Cleaning',
        quote: 185,
      },
    });

    expect(note).toContain('[AI Call - Booked]');
    expect(note).toContain('Confirmation #12345');
    expect(note).toContain('$185');
  });

  it('should format no_answer note with retry info', () => {
    const note = buildNoteContent({
      type: 'no_answer',
      timestamp: new Date(),
      duration: 30,
      attemptNumber: 1,
      maxAttempts: 3,
    });

    expect(note).toContain('[AI Call - No Answer]');
    expect(note).toContain('Attempt: 1 of 3');
    expect(note).toContain('Retry in');
  });
});
```

### Integration Tests

#### Test Jobber Note Creation

```javascript
describe('Jobber Note Integration', () => {
  it('should create note on request', async () => {
    const testRequestId = 'UmVxdWVzdDo3ODkwMTI'; // Use test request

    const note = await jobberClient.createNote(
      testRequestId,
      '[Test Note]\nThis is a test note from integration tests.',
      false
    );

    expect(note.id).toBeDefined();
    expect(note.message).toContain('[Test Note]');
  });

  it('should update request status', async () => {
    const testRequestId = 'UmVxdWVzdDo3ODkwMTI';

    const request = await jobberClient.updateRequestStatus(
      testRequestId,
      'LEAD' // Reset to LEAD for idempotent testing
    );

    expect(request.requestStatus).toBe('LEAD');
  });
});
```

#### Test End-to-End Flow

```javascript
describe('Call Outcome Logging E2E', () => {
  it('should log completed call outcome to Jobber', async () => {
    // 1. Store call context (simulating outbound call initiation)
    const callSid = 'CA_test_' + Date.now();
    await callContextStore.store(callSid, {
      requestId: 'UmVxdWVzdDo3ODkwMTI',
      propertyId: 'UHJvcGVydHk6MTIzNDU2',
      customerName: 'Test Customer',
      phone: '+13035551234',
    });

    // 2. Simulate Twilio webhook with completed status
    const response = await request(app)
      .post('/webhook/call-status')
      .send({
        CallSid: callSid,
        CallStatus: 'completed',
        To: '+13035551234',
        From: '+13035559999',
        CallDuration: '180',
        AnsweredBy: 'human',
      });

    expect(response.status).toBe(200);

    // 3. Verify note was created in Jobber
    // (Would need to query Jobber to verify, or check logs)
  });
});
```

### Manual Testing

#### Test with Real Calls

1. **Trigger Test Lead**
   - Create test Request in Jobber manually
   - Note the Request ID

2. **Store Test Context**
   ```javascript
   // Via Redis CLI or test endpoint
   await callContextStore.store('test-call-sid', {
     requestId: 'YOUR_REQUEST_ID',
     customerName: 'Test User',
   });
   ```

3. **Simulate Webhook**
   ```bash
   curl -X POST http://localhost:3000/webhook/call-status \
     -H "Content-Type: application/json" \
     -d '{
       "CallSid": "test-call-sid",
       "CallStatus": "completed",
       "CallDuration": "120",
       "To": "+13035551234",
       "AnsweredBy": "human"
     }'
   ```

4. **Verify in Jobber**
   - Open Request in Jobber dashboard
   - Check Notes section for logged outcome

### Test Cases Matrix

| Scenario | Twilio Status | AnsweredBy | Retell Data | Expected Outcome | Status Update |
|----------|---------------|------------|-------------|------------------|---------------|
| Successful booking | completed | human | book_appointment success | booked | CONVERTED |
| Short call, declined | completed | human | none | not_interested | ARCHIVED |
| Asked for callback | completed | human | transcript match | callback_requested | LEAD |
| Left voicemail | completed | machine_start | none | voicemail | LEAD |
| Line busy | busy | null | none | busy | LEAD |
| No answer | no-answer | null | none | no_answer | LEAD |
| Call failed | failed | null | none | failed | LEAD |
| Unknown human call | completed | human | none | completed | LEAD |

---

## Summary

This system provides comprehensive call outcome logging that:

1. **Captures all outcome types** - From successful bookings to failed calls
2. **Integrates with Jobber** - Uses GraphQL API for notes and status updates
3. **Provides visibility** - Detailed notes with context for human review
4. **Enables analytics** - Structured outcomes enable conversion tracking
5. **Supports retry logic** - Tracks attempt counts for follow-up scheduling

Implementation follows the existing patterns in the Blue Bucket codebase and integrates cleanly with the Twilio webhook flow.
