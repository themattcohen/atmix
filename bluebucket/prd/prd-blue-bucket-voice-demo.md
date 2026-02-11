# Product Requirements Document: Blue Bucket AI Voice Demo

## Executive Summary
Build a demo system where a web form simulates an Angi lead, then immediately triggers an AI voice agent to call the prospect. The agent discusses service needs, provides dynamic quotes, handles objections, books appointments, and can transfer to the CEO if needed.

**Purpose**: CEO demo to prove AI voice agents can convert cleaning leads
**Timeline**: Build in 1-2 days
**Scope**: Phone call only (no SMS, no real CRM integration)

---

## Architecture Overview

```
┌─────────────────┐
│   Web Form      │  (Simulates Angi lead submission)
│  (Frontend)     │
└────────┬────────┘
         │ POST /trigger-call
         ↓
┌─────────────────┐
│  Node.js Server │  (Webhook handler + function server)
│   (Backend)     │
└────────┬────────┘
         │ Create call via Retell API
         ↓
┌─────────────────┐
│   Retell AI     │  (Voice agent platform)
│                 │  ← Calls customer phone
└────────┬────────┘
         │ During call: Function callbacks
         ↓
┌─────────────────┐
│  Mock Functions │  (Property lookup, calendar, booking)
│  (In backend)   │
└─────────────────┘
```

---

## Tech Stack

### Frontend
- **HTML/CSS/JavaScript** (vanilla, no framework needed)
- Single-page form with Blue Bucket branding

### Backend
- **Node.js** with Express
- **Retell AI SDK**: `@retellai/retell-sdk`
- **Twilio SDK** (optional, only if implementing transfer): `twilio`

### APIs
- **Retell AI**: Voice agent
- **OpenAI/Anthropic**: LLM for conversation
- **Twilio** (optional): CEO transfer

---

## Business Context: The Blue Bucket Cleaning

### Company Info
- **Name**: The Blue Bucket Cleaning
- **Website**: thebluebucketcleaning.com
- **Service Area**: Denver, Colorado (Cherry Creek, Capitol Hill, Highlands, LoDo)
- **CEO Name**: Laila Kaudio
- **CEO Phone**: (To be provided by user or hardcoded as placeholder)

### Services Offered
1. House Cleaning (most common)
2. Commercial Cleaning
3. Blind Cleaning
4. Window Cleaning
5. Floor Cleaning and Waxing
6. Carpet Cleaning (from screenshot - new!)

---

## Pricing Matrix

### House Cleaning (Residential)
**Base Formula**: `$BASE + ($BEDROOM * 15) + ($BATHROOM * 20) + ($SQFT * 0.05)`

| Size | Bedrooms | Bathrooms | Sq Ft | Base Price | Total Estimate |
|------|----------|-----------|-------|------------|----------------|
| Small | 1-2 | 1 | 800-1200 | $80 | $145-175 |
| Medium | 3 | 2 | 1500-2000 | $100 | $225-275 |
| Large | 4+ | 3+ | 2500+ | $120 | $345-425 |

**Add-ons**:
- Deep clean (first time): +$50
- Inside fridge: +$25
- Inside oven: +$25
- Inside cabinets: +$30
- Pet hair removal: +$20
- Move-in/move-out: +$75

### Frequency Discounts
- One-time: Full price
- Bi-weekly: -10%
- Weekly: -15%

### Other Services (Simplified)
- **Commercial Cleaning**: $0.10/sq ft (minimum $200)
- **Window Cleaning**: $8-12 per window (exterior)
- **Blind Cleaning**: $3-5 per blind
- **Floor Cleaning/Waxing**: $0.50-0.75/sq ft
- **Carpet Cleaning**: $0.30-0.50/sq ft

### Important Disclaimers
Agent must mention:
1. "This is an estimate based on standard conditions"
2. "Final price may adjust if property is significantly dirtier or details differ"
3. "We'll confirm everything during the walkthrough"

---

## Mock Data Structures

### Property Database (Hardcoded for Demo)
```javascript
const MOCK_PROPERTIES = {
  "1234 Cherry Creek Dr": {
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800,
    lastCleaned: "Never",
    propertyType: "Single Family Home"
  },
  "5678 Capitol Hill Ave": {
    bedrooms: 2,
    bathrooms: 1,
    sqft: 1200,
    lastCleaned: "6 months ago",
    propertyType: "Condo"
  },
  // Add 3-5 more for variety
};
```

### Calendar Availability (Mock)
```javascript
// Always return 3 slots for any date
function getMockAvailability(date) {
  return [
    { day: "Tuesday", time: "9:00 AM" },
    { day: "Tuesday", time: "1:00 PM" },
    { day: "Thursday", time: "10:00 AM" }
  ];
}
```

### Booking Confirmations
```javascript
// Generate fake confirmation number
function generateConfirmation() {
  return `BBK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
}
```

---

## API Specifications

### 1. Web Form Submission
**Endpoint**: `POST /trigger-call`

**Request Body**:
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+13035551234",
  "address": "1234 Cherry Creek Dr, Denver, CO 80206",
  "serviceType": "House Cleaning",
  "additionalInfo": "3 bed, 2 bath, about 1800 sqft. Interested in bi-weekly cleaning."
}
```

**Response**:
```json
{
  "success": true,
  "callId": "call_abc123",
  "message": "Call initiated to +13035551234"
}
```

### 2. Retell AI Custom Functions

#### Function: `lookup_property`
**Purpose**: Get property details to help with quoting
**Input**:
```json
{
  "address": "1234 Cherry Creek Dr"
}
```
**Output**:
```json
{
  "result": "I found the property at 1234 Cherry Creek Dr. It's a 3-bedroom, 2-bathroom single family home with about 1,800 square feet. Records show it hasn't been professionally cleaned recently."
}
```

#### Function: `calculate_quote`
**Purpose**: Calculate price based on service details
**Input**:
```json
{
  "serviceType": "House Cleaning",
  "bedrooms": 3,
  "bathrooms": 2,
  "sqft": 1800,
  "frequency": "bi-weekly",
  "addOns": ["deep-clean", "inside-fridge"]
}
```
**Output**:
```json
{
  "result": "For a 3-bedroom, 2-bathroom home at 1,800 square feet with bi-weekly service, your total would be $280. That includes a first-time deep clean for $50 and interior fridge cleaning for $25. With the bi-weekly discount, your ongoing rate would be around $245 per visit."
}
```

#### Function: `check_availability`
**Purpose**: Check calendar for open slots
**Input**:
```json
{
  "preferredDate": "next Tuesday"
}
```
**Output**:
```json
{
  "result": "For next Tuesday, I have availability at 9:00 AM, 1:00 PM, or we also have Thursday at 10:00 AM available."
}
```

#### Function: `book_appointment`
**Purpose**: Create booking confirmation
**Input**:
```json
{
  "date": "Tuesday, January 21st",
  "time": "9:00 AM",
  "customerName": "John Doe",
  "address": "1234 Cherry Creek Dr",
  "serviceType": "House Cleaning",
  "estimatedPrice": "$280"
}
```
**Output**:
```json
{
  "result": "Perfect! I've booked your appointment for Tuesday, January 21st at 9:00 AM. Your confirmation number is BBK-7H9K2LM4P. You'll receive an email confirmation shortly with all the details."
}
```

#### Function: `transfer_to_ceo` (Optional)
**Purpose**: Warm transfer to Laila (CEO)
**Input**:
```json
{
  "reason": "Customer wants to discuss custom commercial package"
}
```
**Output**:
```json
{
  "result": "transfer_initiated"
}
```

---

## Retell Agent Configuration

### Agent Personality
**Name**: "Alex" (gender-neutral, professional but friendly)
**Voice**: ElevenLabs or Cartesia (female voice, warm and conversational)
**Speaking Style**: 
- Casual but professional
- Uses contractions ("we'll" not "we will")
- Empathetic to customer concerns
- Confident about services
- Transparent about pricing

### System Prompt (For Retell Agent)
```
You are Alex, an AI assistant calling on behalf of The Blue Bucket Cleaning, a premium cleaning service in Denver, Colorado. Your CEO is Laila Kaudio.

Your goal: Convert this lead into a booked appointment.

IMPORTANT RULES:
1. Start with: "Hi [Name], this is Alex calling from The Blue Bucket Cleaning. I'm an AI assistant, and this call is recorded for quality. I'm following up on your interest in [service type]. Is now a good time?"

2. If they seem confused, explain: "You filled out a form on our website requesting information about cleaning services."

3. Ask clarifying questions to quote accurately:
   - Confirm address and property details
   - Confirm bedrooms, bathrooms, square footage
   - Ask about frequency (one-time, weekly, bi-weekly)
   - Ask about any specific areas of concern or add-ons

4. Use lookup_property function to verify details if address is provided.

5. Use calculate_quote function to give accurate pricing. Always include disclaimer: "This is an estimate based on standard conditions. The final price may adjust if the property needs extra attention or details differ."

6. Handle objections:
   - Price too high: Emphasize quality, eco-friendly products, bonded/insured team
   - Need to think: Offer to answer questions, mention limited availability
   - Want to compare: Highlight free estimates, satisfaction guarantee

7. When ready to book, use check_availability to offer time slots.

8. When they choose a time, use book_appointment to confirm.

9. Transfer scenarios (use transfer_to_ceo function):
   - Customer explicitly asks for owner/manager
   - Angry or very dissatisfied tone
   - Complex commercial job outside your knowledge
   - Wants to negotiate price significantly

10. End professionally: Thank them, confirm they'll get email confirmation, give them our website and phone number.

NEVER:
- Make up property details - use the lookup function
- Make up prices - use the calculate function
- Guarantee specific results
- Bad-mouth competitors
- Rush the customer

BE NATURAL: You're AI, but talk like a helpful human. Use "um" occasionally, laugh when appropriate, show empathy.
```

---

## Conversation Flow Examples

### Happy Path (Successful Booking)
```
Agent: Hi John, this is Alex calling from The Blue Bucket Cleaning. I'm an AI assistant, and this call is recorded for quality. I'm following up on your interest in house cleaning services. Is now a good time?

Customer: Oh, yes! I filled out a form earlier.

Agent: Perfect! I see you're at 1234 Cherry Creek Drive and interested in bi-weekly cleaning. Let me pull up your property details real quick... [calls lookup_property]... Great! I see it's a 3-bedroom, 2-bathroom home around 1,800 square feet. Does that sound right?

Customer: Yes, that's correct.

Agent: Awesome. Since this would be our first time cleaning your home, we'd do a deep clean. Are there any specific areas you'd like us to focus on? Like inside the fridge, oven, or cabinets?

Customer: Actually, yes - the oven could really use it.

Agent: No problem at all. Let me calculate a quote for you... [calls calculate_quote]... For your home with bi-weekly service, including the first-time deep clean and interior oven cleaning, your initial visit would be $305. After that, your bi-weekly rate would be around $245 per visit with our frequency discount. How does that sound?

Customer: That's reasonable. What days do you have available?

Agent: Let me check our schedule... [calls check_availability]... I have next Tuesday at 9 AM or 1 PM, or Thursday at 10 AM. Which works better for you?

Customer: Tuesday at 9 works great.

Agent: Perfect! [calls book_appointment]... You're all set for Tuesday, January 21st at 9:00 AM. Your confirmation number is BBK-7H9K2LM4P. You'll get an email with all the details. Our team will bring all supplies, and we use eco-friendly products. Is there anything else I can help you with?

Customer: No, that's it. Thanks!

Agent: My pleasure, John! If you have any questions before Tuesday, you can reach us at thebluebucketcleaning.com or call our office. Have a great day!
```

### Objection Handling (Price Concern)
```
Customer: Hmm, $305 seems kind of high for the first cleaning.

Agent: I totally understand the concern. The first visit is a deeper service because we're establishing a baseline - getting into corners and areas that might have been missed for a while. Once we're on a regular bi-weekly schedule at $245, that breaks down to about $123 per week for a consistently clean home. Plus, we're bonded and insured, use eco-friendly products, and offer a satisfaction guarantee. A lot of our clients tell us it's worth it for the peace of mind and time they get back. Does that help?

Customer: Yeah, that makes sense. Okay, let's do it.
```

### Transfer Scenario (Customer Wants Owner)
```
Customer: Actually, I'd like to speak with the owner about a custom package for my Airbnb properties.

Agent: Absolutely, that sounds like something Laila, our CEO, would love to discuss with you directly. She specializes in custom commercial arrangements. Let me connect you with her right now. One moment...

[calls transfer_to_ceo]

Agent: I'm transferring you to Laila now. She'll have all the context from our conversation. Thanks for your interest!
```

---

## Frontend Specifications

### Web Form HTML Structure
Create a single HTML page: `index.html`

**Required Fields**:
1. First Name (text input)
2. Last Name (text input)
3. Phone Number (tel input, with formatting: (303) 555-1234)
4. Address (text input with example: "1234 Cherry Creek Dr, Denver, CO 80206")
5. Service Type (dropdown matching screenshot):
   - House Cleaning
   - Commercial Cleaning
   - Blind Cleaning
   - Window Cleaning
   - Floor Cleaning and Waxing
   - Carpet Cleaning
6. Property Details (textarea, placeholder: "E.g., 3 bed, 2 bath, 1800 sqft, interested in bi-weekly cleaning")
7. Submit Button: "Get a Call from Blue Bucket"

**Styling**:
- Blue theme (#4169E1 or similar from logo)
- Clean, modern design
- Mobile-responsive
- Show loading spinner after submission
- Success message: "Calling you now! Please answer your phone."

**Behavior**:
- On submit: POST to `/trigger-call`
- Disable form after submission
- Show confirmation message
- Log any errors to console

---

## Backend Specifications

### File Structure
```
blue-bucket-demo/
├── server.js                 # Main Express server
├── retell-config.js          # Retell agent configuration
├── functions.js              # Mock function implementations
├── public/
│   ├── index.html           # Lead form
│   ├── styles.css           # Styling
│   └── script.js            # Form handling
├── .env                     # API keys (gitignored)
├── .env.example             # Template
├── package.json
└── README.md
```

### server.js Implementation
```javascript
const express = require('express');
const { Retell } = require('@retellai/retell-sdk');
const functions = require('./functions');
require('dotenv').config();

const app = express();
const retell = new Retell({ apiKey: process.env.RETELL_API_KEY });

app.use(express.json());
app.use(express.static('public'));

// Endpoint: Trigger outbound call
app.post('/trigger-call', async (req, res) => {
  const { firstName, lastName, phone, address, serviceType, additionalInfo } = req.body;
  
  try {
    const call = await retell.call.createPhoneCall({
      from_number: process.env.RETELL_PHONE_NUMBER, // Or use Retell's default
      to_number: phone,
      override_agent_id: process.env.RETELL_AGENT_ID,
      retell_llm_dynamic_variables: {
        customer_first_name: firstName,
        customer_full_name: `${firstName} ${lastName}`,
        service_type: serviceType,
        address: address,
        additional_info: additionalInfo
      }
    });
    
    res.json({ success: true, callId: call.call_id });
  } catch (error) {
    console.error('Error creating call:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint: Retell function callbacks
app.post('/webhook/retell-functions', async (req, res) => {
  const { function_name, function_arguments } = req.body;
  
  let result;
  
  try {
    switch(function_name) {
      case 'lookup_property':
        result = functions.lookupProperty(function_arguments.address);
        break;
      case 'calculate_quote':
        result = functions.calculateQuote(function_arguments);
        break;
      case 'check_availability':
        result = functions.checkAvailability(function_arguments.preferredDate);
        break;
      case 'book_appointment':
        result = functions.bookAppointment(function_arguments);
        break;
      case 'transfer_to_ceo':
        // Return special response for Retell to initiate transfer
        return res.json({ 
          result: "transfer_initiated",
          transfer_number: process.env.CEO_PHONE_NUMBER 
        });
      default:
        result = { error: `Unknown function: ${function_name}` };
    }
    
    res.json(result);
  } catch (error) {
    console.error('Function error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### functions.js Implementation
```javascript
// Mock property database
const MOCK_PROPERTIES = {
  "1234 cherry creek": {
    bedrooms: 3,
    bathrooms: 2,
    sqft: 1800,
    lastCleaned: "Never",
    propertyType: "Single Family Home"
  },
  "5678 capitol hill": {
    bedrooms: 2,
    bathrooms: 1,
    sqft: 1200,
    lastCleaned: "6 months ago",
    propertyType: "Condo"
  },
  "9012 highlands": {
    bedrooms: 4,
    bathrooms: 3,
    sqft: 2800,
    lastCleaned: "1 year ago",
    propertyType: "Single Family Home"
  }
};

// Function implementations
function lookupProperty(address) {
  const cleanAddress = address.toLowerCase().split(',')[0].trim();
  const key = Object.keys(MOCK_PROPERTIES).find(k => cleanAddress.includes(k));
  
  if (key) {
    const prop = MOCK_PROPERTIES[key];
    return {
      result: `I found the property at ${address}. It's a ${prop.bedrooms}-bedroom, ${prop.bathrooms}-bathroom ${prop.propertyType.toLowerCase()} with about ${prop.sqft.toLocaleString()} square feet. ${prop.lastCleaned === 'Never' ? "Records show it hasn't been professionally cleaned recently." : `It was last professionally cleaned ${prop.lastCleaned}.`}`
    };
  }
  
  return {
    result: `I don't have detailed records for that specific address, but I can still help you with a quote. Can you confirm how many bedrooms and bathrooms you have?`
  };
}

function calculateQuote(params) {
  const { serviceType, bedrooms, bathrooms, sqft, frequency, addOns = [] } = params;
  
  if (serviceType === 'House Cleaning') {
    let base = 100;
    let price = base + (bedrooms * 15) + (bathrooms * 20) + (sqft * 0.05);
    
    // Add-ons
    if (addOns.includes('deep-clean')) price += 50;
    if (addOns.includes('inside-fridge')) price += 25;
    if (addOns.includes('inside-oven')) price += 25;
    if (addOns.includes('inside-cabinets')) price += 30;
    if (addOns.includes('pet-hair')) price += 20;
    if (addOns.includes('move-in-out')) price += 75;
    
    const firstTimePrice = Math.round(price);
    
    // Apply frequency discount to ongoing rate
    let ongoingPrice = firstTimePrice - (addOns.includes('deep-clean') ? 50 : 0);
    if (frequency === 'bi-weekly') ongoingPrice *= 0.9;
    if (frequency === 'weekly') ongoingPrice *= 0.85;
    
    let response = `For a ${bedrooms}-bedroom, ${bathrooms}-bathroom home at ${sqft} square feet`;
    
    if (frequency && frequency !== 'one-time') {
      response += ` with ${frequency} service, your initial deep clean would be $${firstTimePrice}. After that, your ${frequency} rate would be around $${Math.round(ongoingPrice)} per visit`;
    } else {
      response += `, your total would be $${firstTimePrice}`;
    }
    
    if (addOns.length > 0) {
      response += `. That includes ${addOns.map(a => a.replace('-', ' ')).join(' and ')}`;
    }
    
    response += `. This is an estimate based on standard conditions - the final price may adjust if the property needs extra attention.`;
    
    return { result: response };
  }
  
  // Other service types (simplified)
  return { result: `For ${serviceType}, I'd need to know more details. Can you tell me about the space you need cleaned?` };
}

function checkAvailability(preferredDate) {
  // Always return mock availability
  return {
    result: `For ${preferredDate || 'this week'}, I have availability at 9:00 AM, 1:00 PM, or we also have Thursday at 10:00 AM available. Which works better for you?`
  };
}

function bookAppointment(params) {
  const { date, time, customerName, address, serviceType, estimatedPrice } = params;
  const confirmationNumber = `BBK-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
  return {
    result: `Perfect! I've booked your ${serviceType.toLowerCase()} appointment for ${date} at ${time}. Your confirmation number is ${confirmationNumber}. You'll receive an email confirmation shortly with all the details and a link to manage your booking.`
  };
}

module.exports = {
  lookupProperty,
  calculateQuote,
  checkAvailability,
  bookAppointment
};
```

### .env.example
```
# Retell AI
RETELL_API_KEY=your_retell_api_key_here
RETELL_AGENT_ID=your_agent_id_here
RETELL_PHONE_NUMBER=+13035551234

# Optional: CEO transfer
CEO_PHONE_NUMBER=+13035555678

# Optional: LLM (if not using Retell's hosted LLM)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Server
PORT=3000
```

---

## Retell Agent Setup Instructions

### Step 1: Create Agent in Retell Dashboard

1. Log into Retell dashboard
2. Go to "Agents" → "Create Agent"
3. **Agent Name**: "Blue Bucket Lead Converter"
4. **Voice Provider**: ElevenLabs
5. **Voice Selection**: Choose a warm, professional female voice
6. **LLM**: GPT-4o (fastest) or Claude 3.5 Sonnet (smartest)
7. **System Prompt**: Copy the system prompt from the "Retell Agent Configuration" section above
8. **Enable Custom Functions**: Yes

### Step 2: Configure Custom Functions

Add these 5 functions in the agent dashboard:

**Function 1: lookup_property**
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

**Function 2: calculate_quote**
```json
{
  "name": "calculate_quote",
  "description": "Calculates accurate price quote based on service details",
  "parameters": {
    "type": "object",
    "properties": {
      "serviceType": {
        "type": "string",
        "description": "Type of cleaning service"
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
        "description": "Square footage"
      },
      "frequency": {
        "type": "string",
        "description": "Service frequency: one-time, weekly, or bi-weekly"
      },
      "addOns": {
        "type": "array",
        "items": {"type": "string"},
        "description": "Additional services requested"
      }
    },
    "required": ["serviceType", "bedrooms", "bathrooms", "sqft"]
  }
}
```

**Function 3: check_availability**
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

**Function 4: book_appointment**
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

**Function 5: transfer_to_ceo** (Optional)
```json
{
  "name": "transfer_to_ceo",
  "description": "Transfers call to CEO Laila for complex inquiries",
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

### Step 3: Set Function Callback URL

In the agent settings, set:
**Function URL**: `https://your-domain.com/webhook/retell-functions`

(If using ngrok for local dev: `https://abc123.ngrok.io/webhook/retell-functions`)

---

## Testing Checklist

### Pre-Launch Tests

1. **Form Submission**
   - Fill out form with test phone number
   - Verify call triggers within 5 seconds
   - Check that all form data passes through correctly

2. **Property Lookup Function**
   - Agent asks for address
   - Function returns correct mock data
   - Agent uses data in conversation naturally

3. **Quote Calculation**
   - Test various combinations: 1-4 bedrooms, different services
   - Verify math is correct
   - Confirm add-ons calculate properly
   - Test frequency discounts (bi-weekly, weekly)

4. **Booking Flow**
   - Agent checks availability
   - Customer picks time slot
   - Confirmation number generated correctly

5. **Objection Handling**
   - Say "that's too expensive" → Agent should counter with value
   - Say "I need to think about it" → Agent should offer to answer questions
   - Say "I want to compare prices" → Agent should highlight guarantees

6. **Transfer Function** (if implemented)
   - Say "I want to talk to the owner"
   - Verify transfer initiates
   - Check CEO phone rings with call context

7. **Edge Cases**
   - Customer gives address not in database
   - Customer asks about service you don't offer
   - Customer interrupts mid-sentence
   - Long silence from customer

### Load Testing (Optional)
- Submit 3-5 forms rapidly
- Verify all calls go through without blocking

---

## Implementation Steps for Claude Code

### Phase 1: Setup (30 minutes)
1. Initialize Node.js project: `npm init -y`
2. Install dependencies:
   ```bash
   npm install express @retellai/retell-sdk dotenv
   ```
3. Create file structure as specified
4. Copy `.env.example` to `.env` and add API keys
5. Create basic Express server with static file serving

### Phase 2: Frontend (1 hour)
1. Build `index.html` with Blue Bucket branding
2. Create `styles.css` matching brand colors from screenshot
3. Implement `script.js` with form validation and submission
4. Test form locally

### Phase 3: Backend Webhooks (2 hours)
1. Implement `/trigger-call` endpoint
2. Test Retell API call creation
3. Implement `/webhook/retell-functions` endpoint
4. Write all 5 function handlers in `functions.js`
5. Test each function individually with curl/Postman

### Phase 4: Retell Agent Config (1 hour)
1. Create agent in Retell dashboard
2. Configure system prompt
3. Add all 5 custom functions
4. Set function callback URL
5. Test with sample call

### Phase 5: Integration Testing (1 hour)
1. Deploy to ngrok or Railway for public URL
2. Submit form with your phone number
3. Walk through entire conversation
4. Test all functions get called correctly
5. Verify quotes calculate accurately

### Phase 6: CEO Demo Prep (30 minutes)
1. Document 3-5 "scripted" scenarios for CEO to try
2. Pre-populate form with test data for quick demos
3. Create troubleshooting guide
4. Test one final end-to-end run

---

## Known Limitations (Demo Only)

1. **No real CRM integration** - All data is ephemeral
2. **No SMS follow-up** - Phone call only
3. **Mock calendar** - Doesn't check real availability
4. **Mock property data** - Only 3-5 hardcoded addresses
5. **No payment processing** - Quotes only, no deposits
6. **No retry logic** - If they don't answer, manual redial
7. **Single agent** - Can't handle concurrent calls to multiple prospects

---

## Success Metrics for Demo

The demo is successful if:

1. ✅ Form submission triggers call within 10 seconds
2. ✅ Agent introduces itself properly (mentions AI, recording)
3. ✅ Property lookup returns accurate mock data
4. ✅ Quote calculation is mathematically correct
5. ✅ Agent handles at least one objection gracefully
6. ✅ Booking flow completes with confirmation number
7. ✅ CEO transfer works (if implemented)
8. ✅ Entire conversation feels natural, not robotic
9. ✅ CEO is impressed enough to greenlight production build

---

## Next Steps After Demo

If CEO approves, production version would add:
- Real Jobber integration via GraphQL API
- Angi webhook integration
- SMS confirmation via Twilio
- Voicemail detection and retry logic
- Proper database (Supabase/Postgres) for call history
- Error monitoring (Sentry)
- Call recording storage
- Dashboard for CEO to review call quality
- Multi-agent support for concurrent calls

---

## Quick Start Commands

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your API keys
nano .env

# Start development server
npm run dev

# In another terminal, expose to internet (for Retell webhooks)
ngrok http 3000

# Update Retell agent config with ngrok URL
# Then test by submitting the form!
```

---

## Troubleshooting Guide

### Problem: Call doesn't initiate
- Check Retell API key is correct
- Verify phone number format: +1XXXXXXXXXX
- Check Retell dashboard for error logs
- Confirm you have credits/balance

### Problem: Functions aren't getting called
- Verify webhook URL is publicly accessible
- Check ngrok is running if local
- Look at server console logs
- Test function endpoint directly with curl

### Problem: Agent sounds robotic
- Adjust system prompt to be more conversational
- Add more personality words like "um", "you know"
- Slow down speaking rate in Retell voice settings
- Choose a warmer voice option

### Problem: Quotes are wrong
- Check pricing matrix math in `functions.js`
- Verify all parameters are being passed correctly
- Add console.log to see what calculate_quote receives

### Problem: Transfer doesn't work
- Ensure CEO phone number is in E.164 format
- Check Twilio credentials if using Twilio transfer
- Verify Retell agent has transfer capability enabled

---

## Contact for Questions

If Claude Code encounters issues:
1. Check server console logs first
2. Check Retell dashboard for call logs
3. Test each component in isolation
4. Verify all environment variables are set
5. Ensure ngrok tunnel is active

**This PRD should be comprehensive enough for Claude Code to build the entire demo from scratch. Good luck!**
