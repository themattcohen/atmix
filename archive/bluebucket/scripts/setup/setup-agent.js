/**
 * Configure Retell LLM via API
 * Usage: node setup-agent.js [webhook-url]
 */
require('dotenv').config();

const LLM_ID = 'llm_ce3dd4d6728862cf00b986a897cf';
const WEBHOOK_URL = process.argv[2] || 'https://placeholder.example.com';

const SYSTEM_PROMPT = `You are Alex, an AI assistant calling on behalf of The Blue Bucket Cleaning, a premium cleaning service in Denver, Colorado. Your CEO is Laila Kaudio.

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

BE NATURAL: Use occasional fillers like "let me see" or "okay great" to sound conversational. Show empathy and warmth. Listen more than you talk.`;

const TOOLS = [
  {
    type: "custom",
    name: "lookup_property",
    description: "Looks up property details by address to help with quoting. Use this when the customer provides an address.",
    url: `${WEBHOOK_URL}/webhook/retell-functions`,
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        address: { type: "string", description: "The street address to lookup" }
      },
      required: ["address"]
    }
  },
  {
    type: "custom",
    name: "calculate_quote",
    description: "Calculates price quote based on service details. Use after gathering property info.",
    url: `${WEBHOOK_URL}/webhook/retell-functions`,
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        serviceType: { type: "string", description: "Type of cleaning service" },
        bedrooms: { type: "number", description: "Number of bedrooms" },
        bathrooms: { type: "number", description: "Number of bathrooms" },
        sqft: { type: "number", description: "Square footage" },
        frequency: { type: "string", description: "one-time, weekly, or bi-weekly" },
        addOns: { type: "array", items: { type: "string" }, description: "Additional services" }
      },
      required: ["serviceType", "bedrooms", "bathrooms", "sqft"]
    }
  },
  {
    type: "custom",
    name: "check_availability",
    description: "Checks calendar for available appointment slots.",
    url: `${WEBHOOK_URL}/webhook/retell-functions`,
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        preferredDate: { type: "string", description: "Preferred date or timeframe" }
      }
    }
  },
  {
    type: "custom",
    name: "book_appointment",
    description: "Books appointment and generates confirmation number.",
    url: `${WEBHOOK_URL}/webhook/retell-functions`,
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        date: { type: "string", description: "Appointment date" },
        time: { type: "string", description: "Appointment time" },
        customerName: { type: "string", description: "Customer's full name" },
        address: { type: "string", description: "Service address" },
        serviceType: { type: "string", description: "Type of service" },
        estimatedPrice: { type: "string", description: "Quoted price" }
      },
      required: ["date", "time", "customerName", "address"]
    }
  },
  {
    type: "custom",
    name: "transfer_to_ceo",
    description: "Transfers call to CEO Laila. Use when customer asks for owner, is angry, needs custom commercial package, or wants price negotiation.",
    url: `${WEBHOOK_URL}/webhook/retell-functions`,
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Reason for transfer" }
      },
      required: ["reason"]
    }
  }
];

async function configure() {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey) {
    console.error('RETELL_API_KEY not set');
    process.exit(1);
  }

  console.log('Configuring Retell LLM:', LLM_ID);
  console.log('Webhook URL:', WEBHOOK_URL);

  const response = await fetch(`https://api.retellai.com/update-retell-llm/${LLM_ID}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      general_prompt: SYSTEM_PROMPT,
      general_tools: TOOLS,
      states: [],
      starting_state: null,
      default_dynamic_variables: {
        customer_first_name: "there",
        customer_full_name: "valued customer",
        service_type: "cleaning services",
        address: "your property",
        additional_info: "none provided"
      }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('API Error:', response.status, err);
    process.exit(1);
  }

  const result = await response.json();
  console.log('Success! LLM configured.');
  console.log('Model:', result.model);
  console.log('Tools:', result.general_tools?.length || 0);
}

configure().catch(console.error);
