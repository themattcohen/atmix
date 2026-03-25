require('dotenv').config();
const twilio = require('twilio');

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

async function check() {
  try {
    // Get phone number details
    const numbers = await client.incomingPhoneNumbers.list();
    console.log('Phone numbers in account:');
    numbers.forEach(n => {
      console.log(`  ${n.phoneNumber} - Voice: ${n.capabilities.voice}, SMS: ${n.capabilities.sms}`);
      console.log(`    Voice URL: ${n.voiceUrl}`);
      console.log(`    SID: ${n.sid}`);
    });

    // Check SIP trunks
    console.log('\nSIP Trunks:');
    const trunks = await client.trunking.v1.trunks.list();
    if (trunks.length === 0) {
      console.log('  No SIP trunks configured');
    } else {
      for (const trunk of trunks) {
        console.log(`  ${trunk.friendlyName} (${trunk.sid})`);
        console.log(`    Domain: ${trunk.domainName}`);

        // Get origination URLs
        const originations = await client.trunking.v1.trunks(trunk.sid).originationUrls.list();
        console.log(`    Origination URLs: ${originations.length}`);
        originations.forEach(o => console.log(`      ${o.sipUrl}`));

        // Get phone numbers on trunk
        const trunkNumbers = await client.trunking.v1.trunks(trunk.sid).phoneNumbers.list();
        console.log(`    Phone numbers: ${trunkNumbers.length}`);
        trunkNumbers.forEach(n => console.log(`      ${n.phoneNumber}`));
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

check();
