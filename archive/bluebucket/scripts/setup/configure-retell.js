/**
 * Configure Retell LLM with Blue Bucket system prompt and custom functions
 * Run this once to set up the agent: node configure-retell.js
 */

require('dotenv').config();
const Retell = require('retell-sdk').default || require('retell-sdk');

const LLM_ID = 'llm_ce3dd4d6728862cf00b986a897cf';
const AGENT_ID = 'agent_6753470c1fbd2b2b3664ac953e';

// System prompt for the Blue Bucket voice agent
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

// Custom functions/tools for the agent
const CUSTOM_TOOLS = [
  {
    type: "custom",
    name: "lookup_property",
    description: "Looks up property details by address to help with quoting. Use this when the customer provides an address to get information about bedrooms, bathrooms, and square footage.",
    url: "WEBHOOK_URL_PLACEHOLDER/webhook/retell-functions",
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "The street address to lookup"
        }
      },
      required: ["address"]
    }
  },
  {
    type: "custom",
    name: "calculate_quote",
    description: "Calculates accurate price quote based on service details. Use this after gathering property information to provide the customer with pricing.",
    url: "WEBHOOK_URL_PLACEHOLDER/webhook/retell-functions",
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        serviceType: {
          type: "string",
          description: "Type of cleaning service (House Cleaning, Commercial Cleaning, Window Cleaning, Blind Cleaning, Floor Cleaning and Waxing, Carpet Cleaning)"
        },
        bedrooms: {
          type: "number",
          description: "Number of bedrooms"
        },
        bathrooms: {
          type: "number",
          description: "Number of bathrooms"
        },
        sqft: {
          type: "number",
          description: "Square footage of the property"
        },
        frequency: {
          type: "string",
          description: "Service frequency: one-time, weekly, or bi-weekly"
        },
        addOns: {
          type: "array",
          items: { type: "string" },
          description: "Additional services: deep-clean, inside-fridge, inside-oven, inside-cabinets, pet-hair, move-in-out"
        }
      },
      required: ["serviceType", "bedrooms", "bathrooms", "sqft"]
    }
  },
  {
    type: "custom",
    name: "check_availability",
    description: "Checks team calendar for available appointment slots. Use this when the customer is ready to book and wants to know available times.",
    url: "WEBHOOK_URL_PLACEHOLDER/webhook/retell-functions",
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        preferredDate: {
          type: "string",
          description: "Customer's preferred date or timeframe (e.g., 'next Tuesday', 'this week', 'as soon as possible')"
        }
      }
    }
  },
  {
    type: "custom",
    name: "book_appointment",
    description: "Books the appointment and generates confirmation number. Use this after the customer has selected a time slot.",
    url: "WEBHOOK_URL_PLACEHOLDER/webhook/retell-functions",
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Appointment date (e.g., 'Tuesday, January 21st')"
        },
        time: {
          type: "string",
          description: "Appointment time (e.g., '9:00 AM')"
        },
        customerName: {
          type: "string",
          description: "Customer's full name"
        },
        address: {
          type: "string",
          description: "Service address"
        },
        serviceType: {
          type: "string",
          description: "Type of service booked"
        },
        estimatedPrice: {
          type: "string",
          description: "Quoted price for the service"
        }
      },
      required: ["date", "time", "customerName", "address"]
    }
  },
  {
    type: "custom",
    name: "transfer_to_ceo",
    description: "Transfers call to CEO Laila for complex inquiries or when customer requests to speak with owner. Use when: customer asks for owner/manager, is angry, needs custom commercial package, or wants significant price negotiation.",
    url: "WEBHOOK_URL_PLACEHOLDER/webhook/retell-functions",
    speak_during_execution: true,
    speak_after_execution: false,
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Reason for transfer (e.g., 'customer requested owner', 'complex commercial inquiry', 'price negotiation')"
        }
      },
      required: ["reason"]
    }
  }
];

async function configureRetellLLM(webhookUrl) {
  if (!process.env.RETELL_API_KEY) {
    console.error('❌ RETELL_API_KEY not found in .env');
    process.exit(1);
  }

  if (!webhookUrl) {
    console.error('❌ Webhook URL required. Usage: node configure-retell.js <ngrok-url>');
    console.error('   Example: node configure-retell.js https://abc123.ngrok.io');
    process.exit(1);
  }

  // Update tools with actual webhook URL
  const tools = CUSTOM_TOOLS.map(tool => ({
    ...tool,
    url: tool.url.replace('WEBHOOK_URL_PLACEHOLDER', webhookUrl)
  }));

  console.log('\n🔧 Configuring Retell LLM...');
  console.log(`   LLM ID: ${LLM_ID}`);
  console.log(`   Agent ID: ${AGENT_ID}`);
  console.log(`   Webhook URL: ${webhookUrl}/webhook/retell-functions`);

  const client = new Retell({ apiKey: process.env.RETELL_API_KEY });

  try {
    // First, get current LLM config to see what we're working with
    console.log('\n📖 Fetching current LLM configuration...');
    const currentConfig = await client.llm.retrieve(LLM_ID);
    console.log('   Current model:', currentConfig.model || 'not set');
    console.log('   Current begin_message:', currentConfig.begin_message ? 'set' : 'not set');
    console.log('   Current general_prompt length:', currentConfig.general_prompt?.length || 0);
    console.log('   Current tools count:', currentConfig.general_tools?.length || 0);

    // Update the LLM with our configuration
    console.log('\n📝 Updating LLM configuration...');
    const updatedLlm = await client.llm.update(LLM_ID, {
      model: 'gpt-4o',
      model_temperature: 0.7,
      general_prompt: SYSTEM_PROMPT,
      general_tools: tools,
      begin_message: null, // Let the system prompt handle the greeting
      default_dynamic_variables: {
        customer_first_name: "there",
        customer_full_name: "valued customer",
        service_type: "cleaning services",
        address: "your property",
        additional_info: "none provided"
      }
    });

    console.log('\n✅ LLM Configuration Updated Successfully!');
    console.log(`   LLM ID: ${updatedLlm.llm_id}`);
    console.log(`   Model: ${updatedLlm.model}`);
    console.log(`   Tools configured: ${updatedLlm.general_tools?.length || 0}`);

    // Now update the agent to use the Twilio phone number
    console.log('\n📞 Checking agent configuration...');
    const agent = await client.agent.retrieve(AGENT_ID);
    console.log('   Agent name:', agent.agent_name || 'not set');
    console.log('   Voice ID:', agent.voice_id || 'not set');

    console.log('\n🎉 Configuration Complete!');
    console.log('\n📋 Next Steps:');
    console.log('   1. Make sure ngrok is running: ngrok http 3000');
    console.log('   2. Start the server: npm run dev');
    console.log('   3. Open http://localhost:3000');
    console.log('   4. Submit the form with your phone number');
    console.log('   5. Answer the call and test the conversation!');

  } catch (error) {
    console.error('\n❌ Error configuring Retell:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

// Get webhook URL from command line argument
const webhookUrl = process.argv[2];
configureRetellLLM(webhookUrl);
