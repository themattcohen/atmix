import { Page } from "@playwright/test";

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
  await page.goto("/login");
  await page.fill('input[name="email"], #email', email);
  await page.fill('input[name="password"], #password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(
    /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
    { timeout: 15000 }
  );
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
  await page.waitForURL("**/accounts", { timeout: 15000 });
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
