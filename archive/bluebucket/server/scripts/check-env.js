#!/usr/bin/env node
/**
 * Environment Variable Checker
 * Validates that all required environment variables are configured
 */

const fs = require('fs');
const path = require('path');

// Define required environment variables with descriptions
const REQUIRED_VARS = [
  { name: 'JOBBER_CLIENT_ID', description: 'Jobber OAuth Client ID', critical: true },
  { name: 'JOBBER_CLIENT_SECRET', description: 'Jobber OAuth Client Secret', critical: true },
  { name: 'UPSTASH_REDIS_REST_URL', description: 'Upstash Redis REST API URL', critical: true },
  { name: 'UPSTASH_REDIS_REST_TOKEN', description: 'Upstash Redis REST API Token', critical: true },
  { name: 'RETELL_API_KEY', description: 'Retell AI API Key', critical: true },
  { name: 'RETELL_AGENT_ID', description: 'Retell AI Agent ID', critical: true },
  { name: 'TWILIO_ACCOUNT_SID', description: 'Twilio Account SID', critical: true },
  { name: 'TWILIO_AUTH_TOKEN', description: 'Twilio Auth Token', critical: true },
  { name: 'TWILIO_PHONE_NUMBER', description: 'Twilio Phone Number', critical: true },
];

// Optional but recommended variables
const OPTIONAL_VARS = [
  { name: 'PORT', description: 'Server port (default: 3000)' },
  { name: 'NODE_ENV', description: 'Environment mode (development/production)' },
  { name: 'LOG_LEVEL', description: 'Logging level (debug/info/warn/error)' },
];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    console.log(`${colors.yellow}[WARN]${colors.reset} No .env file found at: ${envPath}`);
    console.log(`${colors.dim}       Create one from .env.example if available${colors.reset}`);
    return {};
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};

  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envVars[key] = value;
    }
  });

  return envVars;
}

function checkVariables(envVars) {
  console.log('');
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  Environment Variable Check${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log('');

  const results = {
    configured: [],
    missing: [],
    empty: [],
  };

  // Check required variables
  console.log(`${colors.blue}Required Variables:${colors.reset}`);
  console.log('');

  for (const varDef of REQUIRED_VARS) {
    const value = envVars[varDef.name] || process.env[varDef.name];

    if (value && value.length > 0) {
      // Mask sensitive values
      const masked = value.length > 8
        ? value.substring(0, 4) + '****' + value.substring(value.length - 4)
        : '****';
      console.log(`  ${colors.green}[OK]${colors.reset}    ${varDef.name}`);
      console.log(`          ${colors.dim}${varDef.description}${colors.reset}`);
      console.log(`          ${colors.dim}Value: ${masked}${colors.reset}`);
      results.configured.push(varDef.name);
    } else if (varDef.name in envVars || varDef.name in process.env) {
      console.log(`  ${colors.yellow}[EMPTY]${colors.reset} ${varDef.name}`);
      console.log(`          ${colors.dim}${varDef.description}${colors.reset}`);
      results.empty.push(varDef.name);
    } else {
      console.log(`  ${colors.red}[MISSING]${colors.reset} ${varDef.name}`);
      console.log(`          ${colors.dim}${varDef.description}${colors.reset}`);
      results.missing.push(varDef.name);
    }
    console.log('');
  }

  // Check optional variables
  console.log(`${colors.blue}Optional Variables:${colors.reset}`);
  console.log('');

  for (const varDef of OPTIONAL_VARS) {
    const value = envVars[varDef.name] || process.env[varDef.name];

    if (value && value.length > 0) {
      console.log(`  ${colors.green}[OK]${colors.reset}    ${varDef.name} = ${value}`);
    } else {
      console.log(`  ${colors.dim}[--]    ${varDef.name} (not set)${colors.reset}`);
    }
    console.log(`          ${colors.dim}${varDef.description}${colors.reset}`);
    console.log('');
  }

  return results;
}

function printSummary(results) {
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log(`${colors.cyan}  Summary${colors.reset}`);
  console.log(`${colors.cyan}========================================${colors.reset}`);
  console.log('');

  const total = REQUIRED_VARS.length;
  const configured = results.configured.length;
  const missing = results.missing.length;
  const empty = results.empty.length;

  console.log(`  Configured: ${colors.green}${configured}/${total}${colors.reset}`);

  if (empty > 0) {
    console.log(`  Empty:      ${colors.yellow}${empty}${colors.reset}`);
  }

  if (missing > 0) {
    console.log(`  Missing:    ${colors.red}${missing}${colors.reset}`);
  }

  console.log('');

  if (missing > 0 || empty > 0) {
    console.log(`${colors.red}[ERROR]${colors.reset} Some required environment variables are not configured.`);
    console.log('');

    if (missing.length > 0) {
      console.log('  Missing variables:');
      results.missing.forEach(v => console.log(`    - ${v}`));
      console.log('');
    }

    if (empty.length > 0) {
      console.log('  Empty variables (set but no value):');
      results.empty.forEach(v => console.log(`    - ${v}`));
      console.log('');
    }

    console.log(`${colors.yellow}Tip:${colors.reset} Copy .env.example to .env and fill in the values.`);
    console.log('');
    return false;
  }

  console.log(`${colors.green}[SUCCESS]${colors.reset} All required environment variables are configured.`);
  console.log('');
  return true;
}

// Main execution
function main() {
  const envVars = loadEnvFile();
  const results = checkVariables(envVars);
  const success = printSummary(results);

  process.exit(success ? 0 : 1);
}

main();
