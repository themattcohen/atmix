# Availability Slot Compression

This document specifies the pre-computed availability encoding system that enables the Retell AI agent to instantly know appointment availability without mid-call function calls.

## Table of Contents
1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Solution Architecture](#3-solution-architecture)
4. [Encoding Specification](#4-encoding-specification)
5. [Decoding Algorithm](#5-decoding-algorithm)
6. [Implementation Checklist](#6-implementation-checklist)
7. [Agent Prompt Updates](#7-agent-prompt-updates)
8. [Examples](#8-examples)
9. [Testing Procedures](#9-testing-procedures)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

### Purpose
Pre-compute 3 weeks of appointment availability BEFORE the call starts, encode it in a token-efficient format, and pass it as a Retell dynamic variable. This allows the AI agent to instantly offer available slots without waiting for function call round-trips.

### Benefits
| Current Approach | Compressed Approach |
|-----------------|---------------------|
| Agent calls `check_availability` mid-call | Agent has availability instantly |
| ~1-3 second latency per function call | Zero latency for availability lookup |
| Complex data parsing during call | Simple bitfield decoding |
| Multiple function calls for date ranges | All 3 weeks available at once |
| Agent may misinterpret complex data | Clear, deterministic format |

### Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Jobber API    │     │  Outbound Caller │     │   Retell AI     │
│   (visits)      │────▶│  (pre-compute)   │────▶│   (agent)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
        │                        │                        │
   Query visits           Encode to              Decode and offer
   for 3 weeks            bitfield               slots to customer
```

---

## 2. Problem Statement

### Current Flow (with latency)
1. Agent determines customer wants to book
2. Agent calls `check_availability` function
3. Webhook queries Jobber API for visits
4. Backend calculates available slots
5. Response returns to agent (1-3 seconds)
6. Agent parses and presents options
7. If customer wants different dates, repeat steps 2-6

### Issues
- **Latency**: Each availability check adds 1-3 seconds of awkward silence
- **Complexity**: Agent must parse potentially complex slot data structures
- **Multiple Calls**: Customers often ask about multiple date ranges
- **Token Usage**: Function calls consume tokens and context window
- **Error Risk**: Mid-call API failures can break the booking flow

### Target State
- Agent has complete 3-week availability at call start
- Zero latency when discussing available times
- Simple, deterministic decoding the agent can perform
- No function calls needed for standard availability questions

---

## 3. Solution Architecture

### Data Flow

```
Pre-Call (outboundCaller.js):
┌─────────────┐    ┌─────────────────┐    ┌───────────────────┐
│ Lead Ready  │───▶│ Query Jobber    │───▶│ Encode to         │
│ for Call    │    │ visits (3 wks)  │    │ Bitfield String   │
└─────────────┘    └─────────────────┘    └───────────────────┘
                                                   │
                                                   ▼
Call Start (outbound.js):                  ┌───────────────────┐
┌─────────────────┐    ┌────────────┐      │ Pass as dynamic   │
│ Retell Agent    │◀───│ Dynamic    │◀─────│ variable:         │
│ Receives Data   │    │ Variables  │      │ availability_map  │
└─────────────────┘    └────────────┘      └───────────────────┘

During Call:
┌─────────────────┐    ┌────────────────────────────────────────┐
│ Customer asks   │───▶│ Agent decodes bitfield locally,        │
│ about dates     │    │ offers specific slots instantly        │
└─────────────────┘    └────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| `availabilityEncoder.js` | Query Jobber, compute open slots, encode to bitfield |
| `outboundCaller.js` | Call encoder before initiating call, include in context |
| `outbound.js` | Pass encoded string as `availability_map` dynamic variable |
| Agent Prompt | Explain decoding algorithm, slot interpretation rules |

---

## 4. Encoding Specification

### Format Overview
```
AM21:1110111|PM21:0111011|AM22:1111111|PM22:1101111|AM23:1010101|PM23:1111111
```

### Structure Components

#### Block Format
```
[Period][StartDay]:[7-bit availability]
```

| Component | Description | Values |
|-----------|-------------|--------|
| Period | Time of day | `AM` (morning 8am-12pm) or `PM` (afternoon 1pm-5pm) |
| StartDay | First day of the 7-day block | Day of month (1-31) |
| `:` | Separator | Literal colon |
| Availability | 7 binary digits | `1`=open, `0`=closed |

#### Day Position Mapping
Each 7-bit string represents Monday through Sunday:
```
Position:  1  2  3  4  5  6  7
Day:      Mon Tue Wed Thu Fri Sat Sun
Example:  1   1   1   0   1   1   1
          ▲   ▲   ▲   ▲   ▲   ▲   ▲
          │   │   │   │   │   │   └── Sunday: OPEN
          │   │   │   │   │   └────── Saturday: OPEN
          │   │   │   │   └────────── Friday: OPEN
          │   │   │   └────────────── Thursday: CLOSED
          │   │   └──────────────────  Wednesday: OPEN
          │   └────────────────────── Tuesday: OPEN
          └──────────────────────────  Monday: OPEN
```

#### Block Separator
- Blocks are separated by pipe `|` character
- No spaces in the encoded string
- No trailing pipe

### Coverage Period
- **3 weeks** of availability (21 days)
- **6 blocks total**: 3 weeks × 2 periods (AM/PM) = 6 blocks
- Start date: First Monday on or after tomorrow

### Week Alignment
The encoder always starts from the **next Monday** to ensure consistent day-position mapping:
```
If today is Wednesday Jan 15:
  Week 1 starts: Monday Jan 20 (day 20)
  Week 2 starts: Monday Jan 27 (day 27)
  Week 3 starts: Monday Feb 3 (day 3)
```

### Edge Case: Month Rollover
When weeks span month boundaries, use the start day of the week:
```
AM27:1111111|PM27:1111111|AM03:1111111|PM03:1111111|AM10:1111111|PM10:1111111
        ▲                      ▲
        │                      │
        Week 1 (Jan 27)        Week 2 (Feb 3)
```

---

## 5. Decoding Algorithm

### Agent Decoding Steps

The agent should follow this algorithm when a customer asks about availability:

#### Step 1: Parse the Encoded String
```
Input: "AM21:1110111|PM21:0111011|AM22:1111111|PM22:1101111"

Split by "|" to get blocks:
  - "AM21:1110111"
  - "PM21:0111011"
  - "AM22:1111111"
  - "PM22:1101111"
```

#### Step 2: Extract Block Components
```
For block "AM21:1110111":
  - Period: AM (morning, 9 AM start)
  - Start Day: 21
  - Bits: 1110111
```

#### Step 3: Map Bits to Dates
```
Bits "1110111" for week starting day 21:
  Position 1 (Mon, day 21): 1 = OPEN
  Position 2 (Tue, day 22): 1 = OPEN
  Position 3 (Wed, day 23): 1 = OPEN
  Position 4 (Thu, day 24): 0 = CLOSED
  Position 5 (Fri, day 25): 1 = OPEN
  Position 6 (Sat, day 26): 1 = OPEN
  Position 7 (Sun, day 27): 1 = OPEN
```

#### Step 4: Combine with Period
```
Available morning slots for week of Jan 21:
  - Monday Jan 21st at 9 AM
  - Tuesday Jan 22nd at 9 AM
  - Wednesday Jan 23rd at 9 AM
  - Friday Jan 25th at 9 AM
  - Saturday Jan 26th at 9 AM
  - Sunday Jan 27th at 9 AM
```

### Standard Time Slots

| Period | Start Time | Display Format |
|--------|------------|----------------|
| AM | 9:00 AM | "9 AM" or "morning" |
| PM | 1:00 PM | "1 PM" or "afternoon" |

### Pseudocode for Agent
```
function findAvailableSlots(encodedString, requestedDate):
  blocks = encodedString.split("|")

  for each block in blocks:
    [periodDay, bits] = block.split(":")
    period = periodDay[0:2]  // "AM" or "PM"
    startDay = int(periodDay[2:])

    // Find which position the requested date falls in
    dayOffset = requestedDate.day - startDay
    if dayOffset >= 0 and dayOffset < 7:
      if bits[dayOffset] == "1":
        return "Available on " + requestedDate + " " + period
      else:
        return "Not available that " + period

  return "Date not in availability window"
```

---

## 6. Implementation Checklist

### 6.1 Create Availability Encoder Service

**File**: `server/src/services/availabilityEncoder.js`

**Requirements**:
- [ ] Query Jobber `visits` API for 21-day range
- [ ] Get team capacity from `users` query (count of `availableForScheduling: true`)
- [ ] Calculate open/closed for each AM/PM slot based on capacity vs scheduled
- [ ] Generate bitfield string in specified format
- [ ] Handle month rollovers correctly
- [ ] Cache results for 15 minutes (availability doesn't change frequently)
- [ ] Return both encoded string and metadata (start date, generated time)

**Function Signature**:
```javascript
/**
 * Generate compressed availability string for the next 3 weeks.
 *
 * @returns {Promise<Object>} Availability data
 * @returns {string} .encoded - Bitfield string (e.g., "AM21:1110111|PM21:...")
 * @returns {string} .startDate - ISO date of first day covered
 * @returns {string} .generatedAt - ISO timestamp of generation
 * @returns {number} .teamCapacity - Team members available
 */
async function generateAvailabilityMap()
```

**Jobber Query** (reference from `10-function-definitions.md`):
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
      assignedUsers { nodes { id } }
    }
  }
}
```

### 6.2 Modify Outbound Caller Service

**File**: `server/src/services/outboundCaller.js`

**Changes Required**:
- [ ] Import `availabilityEncoder` service
- [ ] Call `generateAvailabilityMap()` before `registerOutboundCall()`
- [ ] Add encoded availability to `dynamicVariables` object
- [ ] Add error handling (proceed without availability if encoder fails)
- [ ] Log availability generation time for monitoring

**Integration Point** (in `executeOutboundCall` function):
```javascript
// Before Step 1: Register call with Retell
// Add availability pre-computation

const availability = await availabilityEncoder.generateAvailabilityMap()
  .catch(err => {
    console.warn('[OUTBOUND] Availability encoding failed:', err.message);
    return { encoded: '', startDate: '', generatedAt: '' };
  });

// Then pass to Retell
const retellResult = await retell.registerOutboundCall({
  // ... existing params
  dynamicVariables: {
    // ... existing variables
    availability_map: availability.encoded,
    availability_start: availability.startDate,
  },
});
```

### 6.3 Modify Retell Outbound Client

**File**: `server/src/retell/outbound.js`

**Changes Required**:
- [ ] Accept `availability_map` in dynamic variables
- [ ] Accept `availability_start` in dynamic variables
- [ ] Pass through to `retell_llm_dynamic_variables`

**Updated Variables in `registerOutboundCall`**:
```javascript
retell_llm_dynamic_variables: {
  customer_phone: toNumber,
  lead_source: metadata.source || 'Angi',
  customer_name: metadata.customerName || '',
  customer_context: metadata.context || 'New lead qualification call',
  availability_map: dynamicVariables.availability_map || '',
  availability_start: dynamicVariables.availability_start || '',
  ...dynamicVariables,
},
```

### 6.4 Update Agent Prompt

**File**: Update in Retell Dashboard (document changes in `09-agent-prompt.md`)

See [Section 7](#7-agent-prompt-updates) for complete prompt additions.

---

## 7. Agent Prompt Updates

Add the following sections to the agent prompt in Retell Dashboard.

### New Dynamic Variables
Add to the Dynamic Variables Reference table:

| Variable | Description | Example |
|----------|-------------|---------|
| `{{availability_map}}` | Compressed 3-week availability bitfield | `AM21:1110111\|PM21:0111011...` |
| `{{availability_start}}` | First date in availability window | `2025-01-21` |

### Availability Decoding Instructions
Add this new section to the agent prompt:

```
---

## AVAILABILITY MAP DECODING

You have pre-loaded availability for the next 3 weeks in {{availability_map}}.

### How to Read the Map

The availability map format is: `AM21:1110111|PM21:0111011|...`

Each block like `AM21:1110111` means:
- `AM` = Morning slots (9 AM)
- `PM` = Afternoon slots (1 PM)
- `21` = First day of that week (day of month)
- `1110111` = 7 days Monday-Sunday where 1=open, 0=closed

**Position-to-Day Mapping**:
```
Position: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
```

**Example**: `AM21:1110111` for January means:
- Monday Jan 21: OPEN (morning)
- Tuesday Jan 22: OPEN (morning)
- Wednesday Jan 23: OPEN (morning)
- Thursday Jan 24: CLOSED (morning)
- Friday Jan 25: OPEN (morning)
- Saturday Jan 26: OPEN (morning)
- Sunday Jan 27: OPEN (morning)

### How to Offer Slots

When customer asks about availability:

1. **Identify which week** they're asking about
2. **Find the matching block** (e.g., `AM27:` for week starting Jan 27)
3. **Read the bits** to see which days are open
4. **Offer 2-3 specific options** naturally

**Good Example**:
Customer: "What do you have next week?"
You: "Let me check... I have morning openings on Monday, Tuesday, and Friday. And afternoons are available Tuesday through Thursday. What works better for you?"

**Bad Example**:
Customer: "What do you have next week?"
You: "According to my availability map AM21:1110111, positions 1, 2, 3, 5, 6, 7 are set to 1..."

### When Availability Map is Empty

If {{availability_map}} is empty or missing:
- Fall back to calling the `check_availability` function
- Say: "Let me check our schedule real quick..."

### Offering Slots Naturally

**DO**: "I have a 9 AM on Tuesday or 1 PM on Wednesday - which works better?"
**DON'T**: "I'm checking position 2 in the AM block which shows a 1..."

Always translate the technical format into natural, conversational language.

---
```

### Update Tool Usage Instructions

Modify the `check_availability` section:

```
### check_availability
**When to call**: ONLY if {{availability_map}} is empty or customer asks about dates beyond the 3-week window.
**Usually NOT needed**: You already have 3 weeks of availability in {{availability_map}}.
**Do NOT call**: If you can answer using the pre-loaded availability map.

**When to use the map instead**:
- Customer asks "what do you have this week?" → Use map
- Customer asks "are you free Tuesday?" → Use map
- Customer asks "next Saturday morning?" → Use map

**When to call the function**:
- Map is empty or missing
- Customer asks about dates more than 3 weeks out
- You need to verify a specific time slot before booking
```

---

## 8. Examples

### Example 1: Full 3-Week Encoding

**Scenario**: Call placed on Tuesday, January 14, 2025. Team capacity: 2. Some slots booked.

**Encoded String**:
```
AM20:1111111|PM20:1101111|AM27:1111100|PM27:1111111|AM03:0111111|PM03:1011111
```

**Decoded**:

| Week | Period | Mon | Tue | Wed | Thu | Fri | Sat | Sun |
|------|--------|-----|-----|-----|-----|-----|-----|-----|
| Jan 20-26 | AM | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Jan 20-26 | PM | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Jan 27-Feb 2 | AM | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Jan 27-Feb 2 | PM | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feb 3-9 | AM | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Feb 3-9 | PM | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |

### Example 2: Heavily Booked Week

**Encoded String**:
```
AM20:0100100|PM20:0010010|AM27:1111111|PM27:1111111
```

**Conversation**:
```
Customer: "Do you have anything this week?"
Agent: "This week is pretty busy, but I do have a morning slot on Tuesday
        and one on Friday. Or if you're flexible, next week is wide open -
        I could get you in any day. What works best?"
```

### Example 3: Month Boundary

**Scenario**: Week spans January 27 to February 2

**Encoded String**:
```
AM27:1111111|PM27:1111111|AM03:1111111|PM03:1111111
```

Note: The `27` refers to January 27, and `03` refers to February 3. The agent should understand that `03` is the following month based on context.

### Example 4: All Closed (Vacation)

**Encoded String**:
```
AM20:0000000|PM20:0000000|AM27:1111111|PM27:1111111
```

**Conversation**:
```
Customer: "Can I book for this week?"
Agent: "Unfortunately we're fully booked this week, but starting Monday the 27th
        I have lots of openings. Would the week after work for you?"
```

---

## 9. Testing Procedures

### Unit Tests for Encoder

**Test File**: `server/tests/services/availabilityEncoder.test.js`

#### Test Cases

| Test | Description | Expected |
|------|-------------|----------|
| `generates valid format` | Output matches regex pattern | `^(AM\|PM)\d{1,2}:[01]{7}(\|(AM\|PM)\d{1,2}:[01]{7})*$` |
| `covers 3 weeks` | Output has 6 blocks | 6 pipe-separated segments |
| `starts on Monday` | First block starts on next Monday | Start day is Monday |
| `handles empty schedule` | No visits scheduled | All bits are `1` |
| `handles full schedule` | All slots booked | Appropriate bits are `0` |
| `handles month rollover` | Week spans Feb-Mar | Correct day numbers |
| `respects team capacity` | 2 cleaners, 2 visits | Slot shows closed |

#### Sample Test

```javascript
describe('availabilityEncoder', () => {
  it('generates valid format', async () => {
    const result = await generateAvailabilityMap();

    expect(result.encoded).toMatch(
      /^(AM|PM)\d{1,2}:[01]{7}(\|(AM|PM)\d{1,2}:[01]{7})*$/
    );
    expect(result.encoded.split('|')).toHaveLength(6);
  });

  it('marks slot closed when at capacity', async () => {
    // Mock Jobber to return 2 visits for Monday AM
    // With team capacity of 2
    mockJobber.visits = [
      { startAt: '2025-01-20T09:00:00', assignedUsers: { nodes: [{id: '1'}] }},
      { startAt: '2025-01-20T10:00:00', assignedUsers: { nodes: [{id: '2'}] }},
    ];
    mockJobber.teamCapacity = 2;

    const result = await generateAvailabilityMap();

    // First position of first AM block should be 0
    const firstBlock = result.encoded.split('|')[0];
    expect(firstBlock).toMatch(/^AM\d+:0/);
  });
});
```

### Integration Tests

#### Test: Availability Passes to Retell

```javascript
describe('outbound call with availability', () => {
  it('includes availability_map in dynamic variables', async () => {
    const retellSpy = jest.spyOn(retell, 'registerOutboundCall');

    await executeOutboundCall({
      phone: '+13035551234',
      requestId: 'req_123',
      propertyId: 'prop_456',
      customerName: 'John',
    });

    expect(retellSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dynamicVariables: expect.objectContaining({
          availability_map: expect.stringMatching(/^AM\d+:/),
        }),
      })
    );
  });
});
```

### Manual Testing Checklist

#### Encoder Testing
- [ ] Generate availability for current date
- [ ] Verify start date is next Monday
- [ ] Verify output has exactly 6 blocks
- [ ] Verify each block has exactly 7 bits
- [ ] Compare encoded output against actual Jobber schedule
- [ ] Test with various booking densities (empty, partial, full)

#### Call Flow Testing
- [ ] Initiate outbound call and verify availability passes through
- [ ] Check Retell call logs for `availability_map` variable
- [ ] Verify agent receives and can reference availability
- [ ] Test agent's natural language interpretation

#### Agent Behavior Testing
- [ ] Ask "what's available this week?" - agent should answer without function call
- [ ] Ask about specific date - agent should decode correctly
- [ ] Ask about date beyond 3 weeks - agent should fall back to function
- [ ] Verify agent speaks naturally, not technically

### Performance Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Encoding time | < 500ms | Log timestamp difference |
| String length | < 100 chars | `encoded.length` |
| Cache hit rate | > 90% | Redis metrics |
| Function call reduction | > 80% | Compare call logs before/after |

---

## 10. Troubleshooting

### Common Issues

#### Empty Availability Map

**Symptom**: `availability_map` is empty string in call

**Possible Causes**:
1. Jobber API credentials invalid
2. Encoder threw exception
3. No team members marked available

**Debug Steps**:
```bash
# Check encoder directly
curl http://localhost:3000/debug/availability

# Check logs for encoding errors
grep "AVAILABILITY" logs/server.log
```

#### Incorrect Day Mapping

**Symptom**: Agent offers wrong days (e.g., says Tuesday is open but it's actually Monday)

**Possible Causes**:
1. Timezone mismatch between server and Jobber
2. Off-by-one error in position mapping
3. Week start calculation wrong

**Debug Steps**:
1. Log the raw visits from Jobber
2. Log the calculated slot availability before encoding
3. Verify server timezone matches `config.businessTz`

#### Month Rollover Issues

**Symptom**: Agent confused about dates when week spans two months

**Possible Causes**:
1. Day number only (no month context)
2. Agent prompt doesn't explain month inference

**Solution**: Ensure agent prompt explains that lower day numbers in later blocks indicate the next month.

#### Agent Reads Bits Literally

**Symptom**: Agent says "position 3 is a 1" instead of "Wednesday is available"

**Possible Causes**:
1. Prompt doesn't emphasize natural language
2. Agent confused by format

**Solution**: Update prompt to strongly emphasize translating to natural language.

### Logging Recommendations

Add these log points for debugging:

```javascript
// In availabilityEncoder.js
console.log('[AVAILABILITY] Generating map for next 3 weeks');
console.log('[AVAILABILITY] Team capacity:', teamCapacity);
console.log('[AVAILABILITY] Visits found:', visits.length);
console.log('[AVAILABILITY] Encoded result:', encoded);

// In outboundCaller.js
console.log('[OUTBOUND] Availability map generated:', availability.encoded.length, 'chars');

// In outbound.js
console.log('[RETELL] Dynamic variables:', Object.keys(dynamicVariables));
```

### Monitoring Metrics

| Metric | Alert Threshold | Description |
|--------|-----------------|-------------|
| `availability.encode.duration` | > 2000ms | Encoding taking too long |
| `availability.encode.errors` | > 5/hour | Encoder failing |
| `availability.empty.rate` | > 10% | Too many empty maps |
| `calls.function.check_availability` | Increasing | Agent not using map |

---

## Quick Reference

### Encoding Format
```
AM[day]:[7 bits]|PM[day]:[7 bits]|...
```

### Bit Position to Day
```
1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
```

### Period to Time
```
AM = 9:00 AM
PM = 1:00 PM
```

### Coverage
```
3 weeks = 6 blocks (AM + PM for each week)
```

### Files to Modify
```
server/src/services/availabilityEncoder.js  (create)
server/src/services/outboundCaller.js       (modify)
server/src/retell/outbound.js               (modify)
Retell Dashboard → Agent Prompt             (update)
```
