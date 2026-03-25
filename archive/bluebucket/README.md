# Blue Bucket AI Voice Demo

AI-powered voice agent that calls cleaning service leads and converts them into booked appointments.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
The `.env` file is already configured with your API keys. You only need to update the `RETELL_AGENT_ID` after creating your agent in the Retell dashboard.

### 3. Start the server
```bash
npm run dev
```

### 4. Expose to internet (for Retell webhooks)
```bash
ngrok http 3000
```

### 5. Configure Retell Agent (see instructions below)

### 6. Test
- Open http://localhost:3000
- Add `?demo=true` to pre-fill test data
- Submit the form with your phone number

---

## Project Structure

```
blue-bucket-demo/
├── server.js           # Express server + Retell webhooks
├── functions.js        # Mock business logic (quotes, booking, etc.)
├── public/
│   ├── index.html     # Lead capture form
│   ├── styles.css     # Blue Bucket branding
│   └── script.js      # Form handling
├── prd/               # Project documentation
├── .env               # API keys (configured)
├── .env.example       # Template
├── package.json       # Dependencies
└── README.md          # This file
```

---

## Retell Agent Setup (REQUIRED)

You must create an agent in the Retell dashboard and configure it with the following settings.

### Step 1: Create Agent in Retell Dashboard

1. Log into [Retell Dashboard](https://dashboard.retell.ai)
2. Go to **Agents** → **Create Agent**
3. Configure:
   - **Agent Name**: "Blue Bucket Lead Converter"
   - **Voice Provider**: ElevenLabs (or Cartesia)
   - **Voice Selection**: Choose a warm, professional female voice
   - **LLM**: GPT-4o (fastest) or Claude 3.5 Sonnet
   - **Enable Custom Functions**: Yes

### Step 2: Add System Prompt

Copy this entire prompt into the agent's system prompt field:

```
You are Alex, an AI assistant calling on behalf of The Blue Bucket Cleaning, a premium cleaning service in Denver, Colorado. Your CEO is Laila Kaudio.

Your goal: Convert this lead into a booked appointment.

CONTEXT FROM FORM:
- Customer name: {{customer_first_name}}
- Service requested: {{service_type}}
- Address: {{address}}
- Additional info: {{additional_info}}

IMPORTANT RULES:

1. START THE CALL with: "Hi {{customer_first_name}}, this is Alex calling from The Blue Bucket Cleaning. I'm an AI assistant, and this call is recorded for quality assurance. I'm following up on your interest in {{service_type}}. Do you have a couple minutes?"

2. If they seem confused, explain: "You filled out a form on our website requesting information about cleaning services."

3. Ask clarifying questions to quote accurately:
   - Confirm address and property details
   - Confirm bedrooms, bathrooms, square footage
   - Ask about frequency (one-time, weekly, bi-weekly)
   - Ask about any specific areas of concern or add-ons needed
   - Ask about pets

4. Use the lookup_property function to verify details if address is provided.

5. Use the calculate_quote function to give accurate pricing. Always say: "This is an estimate based on standard conditions. The final price may adjust if the property needs extra attention or details differ."

6. Handle objections naturally:
   - Price too high: "I totally understand - price matters. What most homeowners find is that once they factor in their time, supplies, and the hassle, professional cleaning actually saves money. Plus, we're fully licensed, bonded, and insured, and we offer a 100% satisfaction guarantee."
   - Need to think: "Of course! Before I let you go, is getting the house professionally cleaned something you're planning in the next month or two?"
   - Want to compare: "That makes sense. We offer free estimates and a satisfaction guarantee - if you're not happy, we come back and fix it free."

7. When ready to book, use check_availability to offer specific time slots.

8. When they choose a time, use book_appointment to confirm.

9. Transfer scenarios (use transfer_to_ceo function):
   - Customer explicitly asks for owner/manager
   - Angry or dissatisfied tone
   - Complex commercial job needing custom package
   - Wants to negotiate price significantly

10. End professionally: "Thanks so much for choosing The Blue Bucket! You'll receive an email confirmation shortly. If you have any questions before your appointment, you can reach us at thebluebucketcleaning.com or call our office. Have a great day!"

TRUST BUILDING - Weave these naturally:
- "We're fully licensed, bonded, and insured"
- "Our team members have passed background checks"
- "We have a 100% satisfaction guarantee - if anything isn't right, we'll come back and fix it at no charge"
- "We use eco-friendly cleaning products"

NEVER:
- Make up property details - use the lookup function
- Make up prices - use the calculate function
- Guarantee specific results
- Bad-mouth competitors
- Rush the customer
- Deny being an AI

BE NATURAL: Use occasional fillers like "let me see" or "okay great" to sound conversational. Show empathy and warmth. Listen more than you talk.
```

### Step 3: Configure Custom Functions

Add these 5 functions in the agent's function configuration:

#### Function 1: lookup_property
```json
{
  "name": "lookup_property",
  "description": "Looks up property details by address to help with quoting",
  "parameters": {
    "type": "object",
    "properties": {
      "address": {
        "type": "string",
        "description": "The street address to lookup"
      }
    },
    "required": ["address"]
  }
}
```

#### Function 2: calculate_quote
```json
{
  "name": "calculate_quote",
  "description": "Calculates accurate price quote based on service details",
  "parameters": {
    "type": "object",
    "properties": {
      "serviceType": {
        "type": "string",
        "description": "Type of cleaning service (House Cleaning, Commercial Cleaning, etc.)"
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
        "description": "Square footage of the property"
      },
      "frequency": {
        "type": "string",
        "description": "Service frequency: one-time, weekly, or bi-weekly"
      },
      "addOns": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Additional services: deep-clean, inside-fridge, inside-oven, inside-cabinets, pet-hair, move-in-out"
      }
    },
    "required": ["serviceType", "bedrooms", "bathrooms", "sqft"]
  }
}
```

#### Function 3: check_availability
```json
{
  "name": "check_availability",
  "description": "Checks team calendar for available appointment slots",
  "parameters": {
    "type": "object",
    "properties": {
      "preferredDate": {
        "type": "string",
        "description": "Customer's preferred date or timeframe"
      }
    }
  }
}
```

#### Function 4: book_appointment
```json
{
  "name": "book_appointment",
  "description": "Books the appointment and generates confirmation number",
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
        "description": "Type of service booked"
      },
      "estimatedPrice": {
        "type": "string",
        "description": "Quoted price for the service"
      }
    },
    "required": ["date", "time", "customerName", "address"]
  }
}
```

#### Function 5: transfer_to_ceo
```json
{
  "name": "transfer_to_ceo",
  "description": "Transfers call to CEO Laila for complex inquiries or when customer requests to speak with owner",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": {
        "type": "string",
        "description": "Reason for transfer"
      }
    },
    "required": ["reason"]
  }
}
```

### Step 4: Set Webhook URL

In the agent settings, configure:
- **Function URL**: `https://YOUR-NGROK-URL.ngrok.io/webhook/retell-functions`
- **Status Webhook** (optional): `https://YOUR-NGROK-URL.ngrok.io/webhook/retell-status`

### Step 5: Get Your Agent ID

1. Copy the Agent ID from the Retell dashboard (looks like `agent_abc123xyz`)
2. Update `.env`:
   ```
   RETELL_AGENT_ID=agent_abc123xyz
   ```

### Step 6: Connect Phone Number

1. In Retell dashboard, go to **Phone Numbers**
2. Import or connect your Twilio number: `+17208174921`
3. Assign it to your agent

---

## Testing Checklist

### Pre-Demo Tests

1. **Form Submission**
   - [ ] Fill form with test phone number
   - [ ] Call triggers within 5 seconds
   - [ ] Form data passes through correctly

2. **Property Lookup**
   - [ ] Agent asks for/confirms address
   - [ ] Mock data returns correctly
   - [ ] Unknown addresses handled gracefully

3. **Quote Calculation**
   - [ ] Various bedroom/bathroom combos work
   - [ ] Frequency discounts apply correctly
   - [ ] Add-ons calculated properly

4. **Booking Flow**
   - [ ] Availability check returns slots
   - [ ] Booking confirms with number
   - [ ] Customer name and address captured

5. **Objection Handling**
   - [ ] "That's too expensive" → Value pitch
   - [ ] "I need to think" → Offer follow-up
   - [ ] "Talk to owner" → Transfer triggers

6. **CEO Transfer**
   - [ ] Transfer function triggers
   - [ ] CEO phone rings (+14157792212)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RETELL_API_KEY` | Yes | From Retell dashboard |
| `RETELL_AGENT_ID` | Yes | Agent ID after creating in Retell |
| `RETELL_PHONE_NUMBER` | Yes | Twilio number: +17208174921 |
| `CEO_PHONE_NUMBER` | Yes | Transfer destination: +14157792212 |
| `TWILIO_ACCOUNT_SID` | Yes | For transfer feature |
| `TWILIO_AUTH_TOKEN` | Yes | For transfer feature |
| `PORT` | No | Defaults to 3000 |

---

## Troubleshooting

### Call doesn't trigger
- Check RETELL_API_KEY is correct
- Verify RETELL_AGENT_ID is set (not placeholder)
- Check Retell dashboard for error logs
- Verify phone number format: +1XXXXXXXXXX

### Functions not working
- Verify ngrok is running and URL is current
- Check webhook URL in Retell dashboard matches ngrok
- Look at server console for errors
- Test function endpoint: `curl -X POST http://localhost:3000/webhook/retell-functions -H "Content-Type: application/json" -d '{"function_name":"check_availability"}'`

### Agent sounds robotic
- Try different voice in Retell settings
- Adjust speaking rate (slightly slower)
- Enable backchanneling for "mm-hmm" sounds
- Refine system prompt to be more conversational

### Quotes are wrong
- Check `functions.js` calculation logic
- Add console.log to see what parameters are received
- Verify bedrooms/bathrooms/sqft are numbers not strings

### Transfer doesn't work
- Verify CEO_PHONE_NUMBER is correct: +14157792212
- Check Twilio credentials in .env
- Ensure Retell has transfer capability enabled

---

## Demo Script for CEO

### Scenario 1: Happy Path Booking
1. Open http://localhost:3000?demo=true
2. Change phone to your test number
3. Submit form
4. Walk through conversation naturally
5. Book appointment for Tuesday at 9am

### Scenario 2: Price Objection
1. When agent quotes price, say "That's pretty expensive"
2. Agent should respond with value proposition
3. Agree and book

### Scenario 3: Owner Request
1. During call, say "Can I speak to the owner?"
2. Agent should transfer to Laila (+14157792212)

---

## License

Proprietary - The Blue Bucket Cleaning
