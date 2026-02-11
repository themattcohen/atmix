require('dotenv').config();

const LLM_ID = 'llm_ce3dd4d6728862cf00b986a897cf';

async function check() {
  const response = await fetch(`https://api.retellai.com/get-retell-llm/${LLM_ID}`, {
    headers: { 'Authorization': `Bearer ${process.env.RETELL_API_KEY}` }
  });
  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

check().catch(console.error);
