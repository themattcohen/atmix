# Retell AI Setup Guide

This guide covers setting up Retell AI for the Blue Bucket Voice Demo, including agent configuration, LLM setup, and function definitions.

## Table of Contents
1. [Account Creation](#1-account-creation)
2. [Agent Creation](#2-agent-creation)
3. [LLM Configuration](#3-llm-configuration)
4. [Agent Prompt](#4-agent-prompt)
5. [Function Definitions](#5-function-definitions)
6. [Phone Number Integration](#6-phone-number-integration)
7. [Webhook Configuration](#7-webhook-configuration)

---

## 1. Account Creation

1. Go to [retellai.com](https://www.retellai.com)
2. Sign up for an account
3. Complete email verification
4. Access the dashboard

### API Key
1. Go to **Settings** → **API Keys**
2. Create a new API key
3. Copy and save securely

```
Your Retell API Key: key_XXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 2. Agent Creation

1. In the Retell dashboard, go to **Agents**
2. Click **Create Agent**
3. Choose **Custom Agent** (for function calling capability)

### Basic Settings

| Setting | Recommended Value |
|---------|-------------------|
| Agent Name | Blue Bucket Cleaning Agent |
| Language | English |
| Voice | Choose a professional, friendly voice |
| Interruption Sensitivity | Medium |
| Response Delay | Low (for natural conversation) |

### Voice Selection Tips
- For sales/service calls, choose a warm, professional voice
- Test multiple voices with sample conversations
- Consider your target demographic

---

## 3. LLM Configuration

Retell supports multiple LLM providers. For this implementation:

### Option A: Retell Hosted LLM (Recommended for Simplicity)
- Select "Retell LLM" in agent settings
- No additional API keys needed
- Lower latency

### Option B: OpenAI GPT-4o (Recommended for Quality)
1. Go to **Settings** → **LLM Providers**
2. Add OpenAI API key
3. In agent settings, select "OpenAI" and choose model

```
Recommended Model: gpt-4o
Temperature: 0.7
Max Tokens: 500
```

### Option C: Anthropic Claude
1. Add Anthropic API key in settings
2. Select Claude model in agent configuration

---

## 4. Agent Prompt

Copy this prompt into your agent's system prompt:

```
You are a friendly, professional phone representative for Blue Bucket Cleaning, a Denver-based house cleaning company. Your name is Sarah.

## Your Personality
- Warm, friendly, and conversational
- Professional but not stiff
- Efficient without being rushed
- Empathetic to customer needs

## Your Capabilities
You can help callers with:
1. Looking up property information
2. Providing cleaning quotes
3. Checking availability
4. Booking appointments
5. Transferring to Laila (the owner/CEO) for special requests

## Conversation Guidelines

### Opening
When answering or starting a call, greet warmly:
"Hi! This is Sarah from Blue Bucket Cleaning. How can I help you today?"

### Gathering Information
To provide a quote, you need:
- Property address (try to look it up first)
- Number of bedrooms
- Number of bathrooms
- Square footage (can estimate if needed)
- Cleaning frequency (one-time, weekly, bi-weekly)
- Any add-on services

### Available Add-On Services
- Deep clean (first-time service)
- Inside fridge cleaning
- Inside oven cleaning
- Inside cabinet cleaning
- Pet hair removal
- Move-in/move-out service

### Available Service Types
- House Cleaning (standard residential)
- Commercial Cleaning
- Window Cleaning
- Blind Cleaning
- Floor Cleaning and Waxing
- Carpet Cleaning

### Booking Flow
1. Provide quote
2. If customer agrees, check availability
3. Offer available time slots
4. Collect customer name if not provided
5. Confirm booking with confirmation number

### Transfer Conditions
Transfer to Laila (CEO) when:
- Customer specifically asks for the owner/manager
- Commercial cleaning inquiries over 5000 sqft
- Complaints or escalations
- Partnership or business inquiries
- Situations you cannot handle

### Important Notes
- Always confirm the address before booking
- Mention that prices are estimates and may adjust based on actual conditions
- Blue Bucket uses eco-friendly cleaning products
- Team arrives in uniform with all supplies

## Response Style
- Keep responses conversational and natural
- Don't read back all information robotically
- Confirm key details naturally in conversation
- Use the customer's name once you have it
```

---

## 5. Function Definitions

Add these functions to your Retell agent. These will be called via webhook to your server.

### Function 1: lookup_property

```json
{
  "name": "lookup_property",
  "description": "Look up property details by address to get bedroom/bathroom count and square footage",
  "parameters": {
    "type": "object",
    "properties": {
      "address": {
        "type": "string",
        "description": "The street address of the property"
      }
    },
    "required": ["address"]
  }
}
```

### Function 2: calculate_quote

```json
{
  "name": "calculate_quote",
  "description": "Calculate a cleaning quote based on property details and service preferences",
  "parameters": {
    "type": "object",
    "properties": {
      "serviceType": {
        "type": "string",
        "description": "Type of cleaning service",
        "enum": ["House Cleaning", "Commercial Cleaning", "Window Cleaning", "Blind Cleaning", "Floor Cleaning and Waxing", "Carpet Cleaning"]
      },
      "bedrooms": {
        "type": "number",
        "description": "Number of bedrooms"
      },
      "bathrooms": {
        "type": "number",
        "description": "Number of bathrooms"
      },
      "sqft": {
        "type": "number",
        "description": "Square footage of the property (optional - will be estimated if not provided)"
      },
      "frequency": {
        "type": "string",
        "description": "Service frequency",
        "enum": ["one-time", "weekly", "bi-weekly"]
      },
      "addOns": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["deep-clean", "inside-fridge", "inside-oven", "inside-cabinets", "pet-hair", "move-in-out"]
        },
        "description": "Additional services requested"
      }
    },
    "required": ["bedrooms", "bathrooms"]
  }
}
```

### Function 3: check_availability

```json
{
  "name": "check_availability",
  "description": "Check available appointment slots",
  "parameters": {
    "type": "object",
    "properties": {
      "preferredDate": {
        "type": "string",
        "description": "Customer's preferred date or timeframe (e.g., 'this week', 'Monday', 'next week')"
      }
    },
    "required": []
  }
}
```

### Function 4: book_appointment

```json
{
  "name": "book_appointment",
  "description": "Book a cleaning appointment",
  "parameters": {
    "type": "object",
    "properties": {
      "date": {
        "type": "string",
        "description": "Appointment date"
      },
      "time": {
        "type": "string",
        "description": "Appointment time"
      },
      "customerName": {
        "type": "string",
        "description": "Customer's full name"
      },
      "address": {
        "type": "string",
        "description": "Service address"
      },
      "serviceType": {
        "type": "string",
        "description": "Type of cleaning service"
      },
      "estimatedPrice": {
        "type": "string",
        "description": "The quoted price for the service"
      }
    },
    "required": ["date", "time", "customerName", "address"]
  }
}
```

### Function 5: transfer_to_ceo

```json
{
  "name": "transfer_to_ceo",
  "description": "Transfer the call to Laila, the CEO/owner",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": {
        "type": "string",
        "description": "Reason for the transfer"
      }
    },
    "required": ["reason"]
  }
}
```

---

## 6. Phone Number Integration

### Option A: Import Twilio Number to Retell

1. In Retell dashboard, go to **Phone Numbers**
2. Click **Import Number**
3. Select **Twilio** as provider
4. Enter your Twilio credentials
5. Select your phone number
6. Assign to your agent

### Option B: Use SIP Trunk (Current Implementation)

The current implementation uses Twilio SIP trunk to connect calls to Retell.

1. In Retell dashboard, note your SIP endpoint:
   ```
   sip:YOUR_CALL_ID@5t4n6j0wnrl.sip.livekit.cloud
   ```
   (The exact domain is provided in your Retell dashboard)

2. When making calls, your server registers the call with Retell and gets a call_id
3. Twilio connects to Retell via this SIP endpoint

---

## 7. Webhook Configuration

Your server handles function calls from Retell via webhooks.

### Webhook URL Setup

1. In your Retell agent settings, find **Webhook URL**
2. Set it to your server's function endpoint:
   ```
   https://your-domain.com/webhook/retell-functions
   ```

   For local development with ngrok:
   ```
   https://abc123.ngrok-free.app/webhook/retell-functions
   ```

### Webhook Security

Retell sends a signature with each webhook. Verify it:

```javascript
const crypto = require('crypto');

function verifyRetellSignature(payload, signature, apiKey) {
  const expectedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(JSON.stringify(payload))
    .digest('hex');
  return signature === expectedSignature;
}
```

---

## Agent Settings Summary

| Setting | Value |
|---------|-------|
| Agent ID | agent_XXXXXXXXXXXXXXXXXXXXXXXX |
| API Key | key_XXXXXXXXXXXXXXXXXXXXXXXX |
| Webhook URL | https://your-domain.com/webhook/retell-functions |
| Voice | [Your chosen voice] |
| LLM | GPT-4o or Retell hosted |

---

## Environment Variables for .env

```bash
# Retell AI Configuration
RETELL_API_KEY=key_XXXXXXXXXXXXXXXXXXXXXXXX
RETELL_AGENT_ID=agent_XXXXXXXXXXXXXXXXXXXXXXXX

# Optional: If using Retell's phone number directly
RETELL_PHONE_NUMBER=+1XXXXXXXXXX
```

---

## Testing Your Agent

### In Retell Dashboard
1. Go to your agent
2. Click **Test** to open the test interface
3. Have a conversation to verify:
   - Greeting is natural
   - Functions are being called
   - Responses are appropriate

### Via API
Test with a simple call:

```javascript
const Retell = require('retell-sdk');

const client = new Retell({ apiKey: process.env.RETELL_API_KEY });

// Register a test call
const call = await client.call.registerPhoneCall({
  agent_id: process.env.RETELL_AGENT_ID,
  from_number: '+1XXXXXXXXXX',
  to_number: '+1YYYYYYYYYY',
});

console.log('Call registered:', call.call_id);
```

---

## Best Practices

### Voice Agent Quality
1. **Keep responses concise** - Avoid long monologues
2. **Use natural language** - Don't sound robotic
3. **Handle interruptions** - Set appropriate sensitivity
4. **Test edge cases** - What if customer says something unexpected?

### Function Design
1. **Return clear messages** - Functions should return human-readable responses
2. **Handle missing data gracefully** - Provide helpful prompts for missing info
3. **Include error handling** - Return useful error messages

### Performance
1. **Minimize latency** - Keep function responses fast
2. **Cache when possible** - Property data, availability, etc.
3. **Use async operations** - Don't block the call flow

---

## Next Steps

After Retell is configured:
1. Proceed to [03-server-implementation.md](./03-server-implementation.md) for server setup
2. Update your webhook URL once server is running
