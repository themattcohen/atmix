require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const PHONE_NUMBER = '+17208174921';
const RETELL_SIP_URI = 'sip.retellai.com';

async function setup() {
  if (!process.env.RETELL_SIP_PASSWORD) {
    console.error('RETELL_SIP_PASSWORD environment variable is required');
    process.exit(1);
  }

  try {
    console.log('Setting up SIP trunk for Retell AI...\n');

    // Step 1: Create SIP trunk
    console.log('1. Creating SIP trunk...');
    const trunk = await client.trunking.v1.trunks.create({
      friendlyName: 'BlueBucket-Retell',
      secure: false
    });
    console.log(`   Created trunk: ${trunk.sid}`);
    console.log(`   Domain: ${trunk.domainName}`);

    // Step 2: Create termination credentials for outbound calls
    console.log('\n2. Creating credential list for outbound calls...');
    const credentialList = await client.sip.credentialLists.create({
      friendlyName: 'BlueBucket-Retell-Credentials'
    });
    console.log(`   Created credential list: ${credentialList.sid}`);

    // Create credential (username/password for SIP auth)
    const credential = await client.sip.credentialLists(credentialList.sid)
      .credentials.create({
        username: 'retell_outbound',
        password: process.env.RETELL_SIP_PASSWORD  // Strong password for SIP auth
      });
    console.log(`   Created credential: ${credential.username}`);

    // Associate credential list with trunk
    await client.trunking.v1.trunks(trunk.sid)
      .credentialLists.create({ credentialListSid: credentialList.sid });
    console.log('   Associated credential list with trunk');

    // Step 3: Add origination URL (where Twilio sends inbound SIP)
    console.log('\n3. Adding origination URL for inbound...');
    await client.trunking.v1.trunks(trunk.sid)
      .originationUrls.create({
        weight: 1,
        priority: 1,
        enabled: true,
        friendlyName: 'Retell-Inbound',
        sipUrl: `sip:${RETELL_SIP_URI}:5060`
      });
    console.log(`   Added origination URL: sip:${RETELL_SIP_URI}:5060`);

    // Step 4: Associate phone number with trunk
    console.log('\n4. Associating phone number with trunk...');
    await client.trunking.v1.trunks(trunk.sid)
      .phoneNumbers.create({ phoneNumberSid: 'PN1437301bb78f1b064127d3ec1bf91873' });
    console.log(`   Associated ${PHONE_NUMBER} with trunk`);

    // Output configuration for Retell
    console.log('\n' + '='.repeat(60));
    console.log('SIP TRUNK SETUP COMPLETE');
    console.log('='.repeat(60));
    console.log('\nUse these settings in Retell phone number config:');
    console.log(`  Termination URI: ${trunk.domainName}`);
    console.log('  Auth Username: retell_outbound');
    console.log('  Auth Password: [from RETELL_SIP_PASSWORD env var]');
    console.log('='.repeat(60));

    return {
      trunkSid: trunk.sid,
      domainName: trunk.domainName,
      username: 'retell_outbound',
      password: '[REDACTED - see RETELL_SIP_PASSWORD env var]',
    };

  } catch (error) {
    console.error('Error:', error.message);
    if (error.code) console.error('Code:', error.code);
    throw error;
  }
}

setup();
