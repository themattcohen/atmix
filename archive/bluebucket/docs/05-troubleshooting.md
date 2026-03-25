# Troubleshooting Guide

This guide covers common issues with the Blue Bucket Voice Demo, including the critical T-Mobile call blocking problem and its workaround.

## Table of Contents
1. [T-Mobile Call Blocking (CRITICAL)](#1-t-mobile-call-blocking-critical)
2. [Call Connection Issues](#2-call-connection-issues)
3. [Webhook Problems](#3-webhook-problems)
4. [Function Call Failures](#4-function-call-failures)
5. [Server Issues](#5-server-issues)
6. [Retell AI Issues](#6-retell-ai-issues)
7. [Debugging Tools](#7-debugging-tools)

---

## 1. T-Mobile Call Blocking (CRITICAL)

### The Problem
T-Mobile (and other carriers) actively block calls that don't have proper STIR/SHAKEN A-attestation. Symptoms include:
- Calls go straight to voicemail
- Calls show as "Spam Likely"
- Calls silently fail
- Calls work to some carriers but not T-Mobile

### Root Cause
Without Trust Hub registration, your calls receive B or C attestation:
- **A-attestation**: Carrier verified you AND your right to use the number ✅
- **B-attestation**: Carrier knows you but can't verify number ownership ⚠️
- **C-attestation**: No verification at all ❌

### Permanent Solution
Complete Twilio Trust Hub registration (see [01-twilio-setup.md](./01-twilio-setup.md)):
1. Create Business Profile with your legal business info
2. Wait for approval (~24 hours)
3. Create SHAKEN/STIR Trust Product
4. Assign phone numbers to both profile and trust product
5. Wait for Trust Product approval (~72 hours)

### Temporary Workaround
While waiting for Trust Hub approval, use the `/trigger-call-direct` endpoint with a verified caller ID.

#### How the Workaround Works

1. **Get a verified number**: Use a number that already has A-attestation (e.g., from a personal Twilio account with completed Trust Hub, or a verified business line)

2. **Configure the bypass caller ID** in your `.env`:
   ```bash
   BYPASS_CALLER_ID=+18183122212
   ```

3. **Use the direct endpoint** instead of the standard endpoint:
   ```javascript
   // Instead of POST /trigger-call
   // Use POST /trigger-call-direct

   fetch('/trigger-call-direct', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       phoneNumber: '3035551234',
       context: 'Test call'
     })
   });
   ```

4. **How it works internally**:
   ```javascript
   // The direct endpoint uses the bypass caller ID
   const callerIdToUse = process.env.BYPASS_CALLER_ID || process.env.TWILIO_PHONE_NUMBER;

   // Creates the call with the verified number
   const twilioCall = await twilioClient.calls.create({
     to: formattedPhone,
     from: callerIdToUse,  // This is the verified number
     url: webhookUrl
   });
   ```

### Verification Steps
1. Check your call attestation in Twilio Console:
   - Go to **Monitor** → **Logs** → **Calls**
   - Click on a specific call
   - Look for "SHAKEN/STIR Attestation" field

2. Expected result after Trust Hub approval:
   ```
   Attestation Level: A (Full)
   ```

---

## 2. Call Connection Issues

### Symptom: Calls Don't Connect to Retell

**Check 1: Verify SIP endpoint**
The SIP endpoint format should be:
```
sip:CALL_ID@5t4n6j0wnrl.sip.livekit.cloud
```

**Check 2: Verify Retell call was registered**
Look in server logs for:
```
[RETELL] Call registered: call_abc123
```

**Check 3: Verify webhook is being called**
Look for:
```
[WEBHOOK] Twilio connecting to Retell. Call ID: call_abc123
```

**Fix:** Ensure WEBHOOK_URL in .env matches your ngrok/public URL exactly.

### Symptom: Call Rings But No Audio

**Possible causes:**
1. SIP endpoint incorrect
2. Retell agent not responding
3. Audio codec mismatch

**Check:** Test the agent directly in Retell dashboard first.

### Symptom: Call Connects But Hangs Up Immediately

**Possible causes:**
1. Retell API key invalid
2. Agent ID incorrect
3. Function webhook returning errors

**Check server logs** for any error messages during the call.

---

## 3. Webhook Problems

### Symptom: Webhooks Not Reaching Server

**Check 1: ngrok is running**
```bash
# Verify ngrok is active
ngrok http 3000
```

**Check 2: ngrok URL matches .env**
```bash
# In .env
WEBHOOK_URL=https://abc123.ngrok-free.app

# This must match your actual ngrok URL
```

**Check 3: Retell dashboard has correct URL**
In Retell agent settings, webhook URL should be:
```
https://abc123.ngrok-free.app/webhook/retell-functions
```

### Symptom: Webhooks Timing Out

**Check:** Your function handlers should respond quickly.
```javascript
// Bad - slow async operation blocking response
app.post('/webhook/retell-functions', async (req, res) => {
  await someSlowOperation();  // This can cause timeouts
  res.json({ response: result });
});

// Good - respond quickly
app.post('/webhook/retell-functions', async (req, res) => {
  try {
    const result = functionCall(req.body.args);
    res.json({ response: result.result });
  } catch (error) {
    res.json({ response: "Error processing request" });
  }
});
```

### Symptom: ngrok Tunnel Keeps Dying

**If using free ngrok:**
- Free tunnels have session limits
- URL changes on each restart

**Solutions:**
1. Use paid ngrok for stable URLs
2. Use alternative tunnel (serveo, localtunnel)
3. Deploy to a cloud provider for testing

**Quick restart script (Windows):**
```batch
@echo off
taskkill /F /IM ngrok.exe 2>nul
start /B ngrok http 3000
timeout /t 3
echo Remember to update webhook URLs!
```

---

## 4. Function Call Failures

### Symptom: Function Not Being Called

**Check 1: Function name matches exactly**
In Retell dashboard, function name must match server handler:
```javascript
// If Retell defines function as "calculate_quote"
case 'calculate_quote':  // Must match exactly
  result = calculateQuote(args);
  break;
```

**Check 2: Function is defined in Retell agent**
Go to your agent in Retell dashboard and verify all functions are listed.

### Symptom: calculate_quote Returns Error

**Common issue:** Missing required parameters.

**Check the function requirements:**
```javascript
// Required: bedrooms, bathrooms
// Optional: sqft (will be estimated), frequency, addOns

// If bedrooms or bathrooms missing:
// "To give you an accurate quote, I need to know the number of bedrooms and bathrooms."
```

**Fix:** Ensure the agent prompt instructs the LLM to gather bedrooms and bathrooms before calling the function.

### Symptom: Wrong Quote Amount

**Verify the calculation formula:**
```javascript
let base = 100;
let price = base + (bedrooms * 15) + (bathrooms * 20) + (sqft * 0.05);

// Example: 3 bed, 2 bath, 1800 sqft
// 100 + (3*15) + (2*20) + (1800*0.05) = 100 + 45 + 40 + 90 = $275
```

---

## 5. Server Issues

### Symptom: "Port already in use" Error

**Windows:**
```bash
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual number)
taskkill /F /PID 12345
```

**Mac/Linux:**
```bash
# Find and kill process
lsof -i :3000
kill -9 <PID>
```

### Symptom: Server Crashes on Startup

**Check 1: All environment variables set**
```javascript
// These are required
RETELL_API_KEY=...
RETELL_AGENT_ID=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
WEBHOOK_URL=...
```

**Check 2: Dependencies installed**
```bash
npm install
```

**Check 3: Node version**
```bash
node --version  # Should be 18+
```

### Symptom: Environment Variables Not Loading

**Check:** .env file is in the root directory
```
bluebucket/
├── .env          # Must be here
├── server.js
├── functions.js
└── ...
```

**Check:** dotenv is loading first in server.js
```javascript
require('dotenv').config();  // This must be at the top
```

---

## 6. Retell AI Issues

### Symptom: Agent Not Responding

**Check 1: Test in Retell dashboard**
Use the built-in test interface to verify the agent works.

**Check 2: Verify API key**
```javascript
// In your terminal
node -e "console.log(process.env.RETELL_API_KEY?.substring(0,10))"
```

**Check 3: Agent ID is correct**
```javascript
// Verify the agent ID matches your dashboard
console.log(process.env.RETELL_AGENT_ID);
```

### Symptom: Agent Says Wrong Things

**Check the prompt:** Review your agent prompt in Retell dashboard for:
- Clear instructions
- Correct business information
- Proper function usage guidance

### Symptom: Agent Not Calling Functions

**Check function descriptions:** The LLM needs clear descriptions to know when to call functions.

Example of good description:
```json
{
  "name": "calculate_quote",
  "description": "Calculate a cleaning quote. Call this AFTER you have the number of bedrooms and bathrooms from the customer."
}
```

---

## 7. Debugging Tools

### Server Logging

Add detailed logging:
```javascript
app.post('/webhook/retell-functions', async (req, res) => {
  console.log('=== FUNCTION CALL ===');
  console.log('Full body:', JSON.stringify(req.body, null, 2));
  console.log('Function name:', req.body.name);
  console.log('Arguments:', req.body.args);
  // ...
});
```

### Test Endpoints with curl

**Health check:**
```bash
curl http://localhost:3000/health
```

**Trigger call:**
```bash
curl -X POST http://localhost:3000/trigger-call-direct \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "3035551234", "context": "Test"}'
```

**Test function directly:**
```bash
curl -X POST http://localhost:3000/webhook/retell-functions \
  -H "Content-Type: application/json" \
  -d '{"name": "calculate_quote", "args": {"bedrooms": 3, "bathrooms": 2}}'
```

### Twilio Debugger

1. Go to Twilio Console
2. Click **Monitor** → **Logs** → **Errors**
3. Review any error messages

### Retell Call Logs

1. Go to Retell Dashboard
2. Click **Calls**
3. Select a specific call to see:
   - Transcript
   - Function calls
   - Timing information
   - Any errors

### Network Debugging

**ngrok web interface:**
Open `http://localhost:4040` to see all requests through ngrok.

---

## Quick Diagnostic Checklist

When calls aren't working, check in order:

- [ ] Is the server running? (`curl localhost:3000/health`)
- [ ] Is ngrok running? (Check `http://localhost:4040`)
- [ ] Does .env WEBHOOK_URL match ngrok URL?
- [ ] Is Retell webhook URL updated?
- [ ] Are Twilio credentials correct?
- [ ] Is Retell API key valid?
- [ ] Are calls getting A-attestation? (Check Twilio logs)
- [ ] Is the agent working in Retell test interface?
- [ ] Are function names matching exactly?

---

## Getting Help

If you've gone through this guide and still have issues:

1. **Twilio Support**: For phone/SIP/Trust Hub issues
   - https://support.twilio.com/

2. **Retell AI Support**: For agent/voice issues
   - Check Retell documentation: https://docs.retellai.com/

3. **Server Logs**: Always check your console output for error messages
