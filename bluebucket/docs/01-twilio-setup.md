# Twilio Setup Guide

This guide covers setting up Twilio for the Blue Bucket Voice Demo, including the **critical Trust Hub registration** needed to avoid carrier call blocking.

## Table of Contents
1. [Account Creation](#1-account-creation)
2. [Phone Number Purchase](#2-phone-number-purchase)
3. [Trust Hub Registration (CRITICAL)](#3-trust-hub-registration-critical)
4. [SHAKEN/STIR Setup](#4-shakenstir-setup)
5. [SIP Trunk Configuration](#5-sip-trunk-configuration)
6. [API Credentials](#6-api-credentials)

---

## 1. Account Creation

1. Go to [twilio.com](https://www.twilio.com)
2. Click "Sign Up" and create an account
3. Verify your email and phone number
4. Complete the account setup wizard

### Upgrade from Trial
Trial accounts have limitations. For production use:
1. Go to **Billing** in the Console
2. Add a payment method
3. Upgrade to a paid account

---

## 2. Phone Number Purchase

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a Number**
2. Search for a number in your desired area code (e.g., 720 for Denver)
3. Ensure the number has **Voice** capability
4. Purchase the number

**Note**: This number will be your main business line for outbound calls.

### Record Your Number
```
Your Twilio Phone Number: +1XXXXXXXXXX
```

---

## 3. Trust Hub Registration (CRITICAL)

> ⚠️ **THIS IS THE MOST IMPORTANT STEP**
>
> Without Trust Hub registration, your calls will receive B or C attestation and **T-Mobile and other carriers will block your calls** or mark them as spam.

### Understanding STIR/SHAKEN Attestation

| Level | Meaning | What Happens |
|-------|---------|--------------|
| **A (Full)** | Carrier knows you AND you own the number | Calls go through normally |
| **B (Partial)** | Carrier knows you BUT can't verify number ownership | Often blocked or marked spam |
| **C (Gateway)** | No verification at all | Almost always blocked |

### Step-by-Step Trust Hub Registration

#### Step 3.1: Create Business Profile

1. Go to **Console** → **Trust Hub** → **Business Profiles**
2. Click **Create new Business Profile**
3. Fill in your business information:
   - **Business Name**: Your legal business name (e.g., "Blue Bucket Cleaning LLC")
   - **Business Type**: Select appropriate type (LLC, Corporation, etc.)
   - **Business Registration Number**: Your EIN or state registration
   - **Business Address**: Physical business address
   - **Business Phone**: Your business contact phone
   - **Business Website**: Your company website
   - **Industry**: Select "Cleaning Services" or appropriate category

4. **Authorized Representative** section:
   - Full legal name of authorized person
   - Job title
   - Email address
   - Phone number

5. Click **Submit for Review**

**Timeline**: Business Profile vetting takes approximately **24 hours**.

#### Step 3.2: Wait for Business Profile Approval

Check the status in Trust Hub:
- **Pending**: Under review
- **Approved**: Ready for next step
- **Rejected**: Review feedback and resubmit

#### Step 3.3: Create SHAKEN/STIR Trust Product

1. Go to **Trust Hub** → **Trust Products**
2. Click **Create new Trust Product**
3. Select **SHAKEN/STIR** as the product type
4. Link to your approved Business Profile
5. Assign your Twilio phone numbers to this Trust Product

**Important**: Only phone numbers assigned to both the Business Profile AND the SHAKEN/STIR Trust Product will receive A-attestation.

#### Step 3.4: Assign Phone Numbers

1. In Trust Hub, go to your SHAKEN/STIR Trust Product
2. Click **Assign Phone Numbers**
3. Select your purchased Twilio number(s)
4. Submit for review

**Timeline**: SHAKEN/STIR Trust Product vetting takes approximately **72 hours**.

### Trust Hub Checklist

- [ ] Business Profile created with accurate information
- [ ] Business Profile submitted and approved
- [ ] SHAKEN/STIR Trust Product created
- [ ] Phone numbers assigned to Business Profile
- [ ] Phone numbers assigned to SHAKEN/STIR Trust Product
- [ ] Trust Product approved (status: "Twilio-Approved")

---

## 4. SHAKEN/STIR Setup

Once your Trust Product is approved, verify your calls are getting A-attestation:

### Verification Steps

1. Make a test call
2. Check call logs in Twilio Console
3. Look for the attestation level in call details

### Console Navigation
```
Console → Monitor → Logs → Calls → [Select a call] → SHAKEN/STIR Attestation
```

### Expected Result
```
Attestation Level: A (Full)
```

If you see B or C attestation, verify:
- Phone number is assigned to Business Profile
- Phone number is assigned to SHAKEN/STIR Trust Product
- Trust Product status is "Twilio-Approved"

---

## 5. SIP Trunk Configuration

For Retell AI integration, you need a SIP trunk.

### Create SIP Trunk

1. Go to **Voice** → **Manage** → **SIP Trunking**
2. Click **Create new SIP Trunk**
3. Name it (e.g., "Blue Bucket Retell")

### Configure Origination (Inbound to Retell)

1. In your SIP Trunk, go to **Origination**
2. Add an Origination URI:
   ```
   sip:YOUR_RETELL_SIP_DOMAIN.sip.livekit.cloud
   ```
   (You'll get this from Retell after agent setup)

### Configure Termination (Outbound from Retell)

1. Go to **Termination**
2. Create a Termination SIP Domain
3. Set up Credential Lists:
   - Click **Credential Lists**
   - Create new list
   - Add username and password

### Record SIP Credentials
```
SIP Trunk ID: TKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
SIP Username: your_username
SIP Password: your_password
SIP Domain: your-domain.pstn.twilio.com
```

---

## 6. API Credentials

### Get Account SID and Auth Token

1. Go to **Console** → **Account** → **API keys & tokens**
2. Or find them on the Console dashboard

### Record Your Credentials
```
Account SID: ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Auth Token: your_auth_token_here
```

> ⚠️ **Security Warning**: Never commit these credentials to version control. Use environment variables.

---

## Environment Variables for .env

After completing setup, add these to your `.env` file:

```bash
# Twilio Configuration
TWILIO_PHONE_NUMBER=+1XXXXXXXXXX
TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_AUTH_TOKEN=your_auth_token_here

# Twilio SIP Trunk Credentials (for Retell)
TWILIO_SIP_TRUNK_ID=TKXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
TWILIO_SIP_USERNAME=your_sip_username
TWILIO_SIP_PASSWORD=your_sip_password
```

---

## Troubleshooting Trust Hub

### Common Issues

**Issue**: Business Profile rejected
- **Solution**: Ensure all information matches your official business registration exactly

**Issue**: Can't find SHAKEN/STIR option
- **Solution**: Ensure you have a paid account, not trial

**Issue**: Still getting B-attestation after approval
- **Solution**: Verify phone numbers are assigned to BOTH Business Profile AND Trust Product

**Issue**: Trust Product stuck in "Pending"
- **Solution**: Contact Twilio support if it's been more than 72 hours

### Support Resources

- [Twilio Trust Hub Documentation](https://www.twilio.com/docs/trust-hub)
- [SHAKEN/STIR Onboarding Guide](https://www.twilio.com/docs/voice/trusted-calling-with-shakenstir/shakenstir-onboarding)
- [Twilio Support](https://support.twilio.com/)

---

## Next Steps

Once Twilio is fully configured:
1. Proceed to [02-retell-setup.md](./02-retell-setup.md) for Retell AI configuration
2. The Retell setup will provide the SIP endpoint to add to your Twilio trunk
