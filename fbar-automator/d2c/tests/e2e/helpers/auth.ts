import { Page, expect } from "@playwright/test";
import { generateTotpToken } from "./totp";

/**
 * Log in as an existing test user.
 * Expects a user with these credentials to exist in the database.
 * The debug@example.com user is seeded by default.
 */
export async function loginAsTestUser(
  page: Page,
  email = "debug@example.com",
  password = "Debug123!"
) {
  const doLogin = async () => {
    await page.goto("/login");
    await page.fill('input[name="email"], #email', email);
    await page.fill('input[name="password"], #password', password);
    await page.click('button[type="submit"]');
  };

  await doLogin();

  try {
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 10000 }
    );
  } catch {
    // Rate-limited or other transient error; wait and retry once
    await page.waitForTimeout(2000);
    await doLogin();
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 20000 }
    );
  }
}

/**
 * Sign up a brand-new user with a unique email address.
 * Returns the email used so the caller can log in again later.
 * After signup the app redirects to /threshold.
 */
export async function signupTestUser(page: Page): Promise<string> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  await page.goto("/signup");
  await page.fill('input[name="firstName"], #firstName', "Test");
  await page.fill('input[name="lastName"], #lastName', "User");
  await page.fill('input[name="email"], #email', email);
  await page.fill('input[name="password"], #password', "TestPassword123!");
  await page.fill('input[name="confirmPassword"], #confirmPassword', "TestPassword123!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/threshold", { timeout: 15000 });
  return email;
}

/**
 * Navigate a fresh user through the threshold step (Yes/Yes) so they
 * arrive at the /personal page. Assumes the user is already on /threshold.
 */
export async function completeThreshold(page: Page) {
  await page.locator("button:has-text('Yes')").first().click();
  await page.locator("button:has-text('Yes')").nth(1).click();
  await page.locator("text=Continue to Personal Information").click();
  await page.waitForURL("**/personal", { timeout: 15000 });
}

/**
 * Fill out the personal information form with minimal valid data and submit.
 * Assumes the user is already on /personal.
 */
export async function completePersonalInfo(page: Page) {
  // Wait for the form to be rendered and personal data API to finish loading.
  // The firstName field is pre-filled from the signup API call; wait until it
  // has a value so we know React hydration and the GET /api/user fetch are done.
  await page.locator("#firstName").waitFor({ state: "visible", timeout: 15000 });
  await expect(page.locator("#firstName")).toHaveValue(/.+/, { timeout: 15000 });
  await page.waitForTimeout(1000); // settle after API prefill

  await page.locator('input[placeholder="XXX-XX-XXXX"]').fill("123456789");
  await page.locator('input[type="date"]').fill("1990-01-15");
  await page.locator('input[placeholder="Street Address"]').fill("123 Test St");
  await page.locator('input[placeholder="City"]').fill("Testville");
  await page
    .locator("select")
    .filter({ has: page.locator('option:has-text("State")') })
    .selectOption("CA");
  await page.locator('input[placeholder="ZIP Code"]').fill("90210");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/accounts", { timeout: 30000 });
}

/**
 * Add a single foreign account on the /accounts page.
 * Assumes the user is already on /accounts.
 */
export async function addForeignAccount(
  page: Page,
  bankName = "Test Bank AG"
) {
  await page.locator("button:has-text('Add Foreign Account')").click();
  await page
    .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
    .fill(bankName);

  const formInputs = page.locator("form input[type='text']");
  await formInputs.nth(1).fill("CH1234567890");

  const countrySelect = page
    .locator("select")
    .filter({ has: page.locator('option:has-text("Select country")') });
  await countrySelect.selectOption({ index: 1 });

  const currencySelect = page
    .locator("select")
    .filter({ has: page.locator('option:has-text("Select currency")') });
  await currencySelect.selectOption({ index: 1 });

  await page.locator('input[type="number"]').fill("50000");
  await page.locator("button:has-text('Save Account')").click();
  await page.waitForSelector(`text=${bankName}`, { timeout: 10000 });
}

/**
 * Complete the signing step on /sign page.
 * Assumes the user is already on /sign and has personal info (firstName, lastName) set.
 * The typed name must match firstName + " " + lastName (or firstName + middleName + lastName).
 */
export async function completeSigning(
  page: Page,
  firstName = "Test",
  lastName = "User"
) {
  // Check the "I agree" checkbox
  await page.locator('#agree-checkbox').check();

  // Type the full legal name (must match what the sign page expects)
  const fullName = `${firstName} ${lastName}`;
  await page.locator('#typed-signature').fill(fullName);

  // Click "Sign and Continue to Payment"
  await page.locator('button:has-text("Sign and Continue to Payment")').click();

  // Wait for redirect to /payment
  await page.waitForURL('**/payment', { timeout: 15000 });
}

/**
 * Reset lockout state for a test user.
 * Only works in non-production environments.
 */
export async function resetLockout(
  request: import("@playwright/test").APIRequestContext,
  email = "debug@example.com"
) {
  // The /api/test/reset-lockout route has been deleted for security.
  // In dev/test, the seed user debug@example.com never locks out because
  // tests reset state by using a fresh signup or by accepting that the
  // login test might encounter a lockout (which auto-expires after 15 min).
  // This function is now a no-op kept for backward compatibility.
  // If lockout becomes an issue in tests, run:
  //   npx tsx -e "const {prisma} = require('./src/lib/db'); prisma.user.updateMany({where:{email:'${email}'}, data:{failedLoginAttempts:0, lockoutUntil:null}})"
}

/**
 * Enable MFA via API for the currently logged-in user.
 * Requires MFA_TEST_SECRET_OVERRIDE env var to be set on the server.
 * Returns the recovery codes from setup.
 *
 * Note: After this call, the user's tokenVersion is incremented and
 * subsequent requests may require re-authentication.
 */
export async function enableMfaViaApi(
  page: Page,
  base32Secret: string
): Promise<string[]> {
  const setupResp = await page.request.post("/api/auth/mfa/setup", {
    headers: { "X-Requested-With": "XMLHttpRequest" },
  });

  let recoveryCodes: string[] = [];
  if (setupResp.ok()) {
    const data = await setupResp.json();
    recoveryCodes = data.recoveryCodes;
  } else if (setupResp.status() === 409) {
    // Setup already in progress — proceed to verify
  } else {
    throw new Error(`MFA setup failed: ${setupResp.status()}`);
  }

  const token = generateTotpToken(base32Secret);
  const verifyResp = await page.request.post("/api/auth/mfa/verify", {
    headers: { "X-Requested-With": "XMLHttpRequest" },
    data: { token },
  });

  if (!verifyResp.ok()) {
    throw new Error(`MFA verify failed: ${verifyResp.status()}`);
  }

  return recoveryCodes;
}

/**
 * Seed a filing's status directly via test-only API endpoint.
 * Works in non-production environments only.
 */
export async function seedFilingStatus(
  request: import("@playwright/test").APIRequestContext,
  filingId: string,
  status: string,
  extras?: { bsaId?: string; rejectionReason?: string; submittedAt?: string }
) {
  const resp = await request.post("http://127.0.0.1:3001/api/internal/seed-status", {
    headers: { "X-Requested-With": "XMLHttpRequest" },
    data: { filingId, status, ...extras },
  });
  if (!resp.ok()) {
    throw new Error(
      `seedFilingStatus failed: ${resp.status()} ${await resp.text()}`
    );
  }
}
