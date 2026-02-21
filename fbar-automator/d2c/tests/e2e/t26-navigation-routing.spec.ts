/**
 * T26 — Navigation, Routing, and Wizard Step Indicators
 *
 * Tests:
 *   01–05  Wizard step indicators (serial — needs user progressing through wizard)
 *   06–09  Wizard Previous links (serial — needs user in mid-wizard)
 *   10–14  Marketing nav links (parallel — unauthenticated, marketing pages)
 *   15–16  Footer links (parallel — unauthenticated)
 *   17–19  Dynamic routes: /fbar/[country], /compare/[slug], /start/[variant] (parallel)
 *   20–21  App nav: email display + sign out (serial — needs authentication)
 *
 * Step labels from WIZARD_STEPS in src/types/index.ts:
 *   1: Threshold  2: Personal Info  3: Accounts  4: Review  5: Sign  6: Payment  7: Confirmation
 *
 * WizardLayout marks the active step with aria-current="step" on the <li> element.
 * The active step <li> also carries aria-label="Step N of 7: Label (current)".
 */

import { test, expect, type Page } from "@playwright/test";
import {
  signupTestUser,
  completeThreshold,
  completePersonalInfo,
  addForeignAccount,
  completeSigning,
} from "./helpers/auth";

test.use({ baseURL: "http://localhost:3001" });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const NAV_TIMEOUT = 90_000;

/**
 * Sign up a fresh user via API and log in via browser, then complete
 * threshold so the user arrives at /personal.
 */
async function robustSignupToPersonal(page: Page): Promise<void> {
  const email = `t26-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
  const password = "TestPassword123!";

  const resp = await page.request.post("/api/auth/signup", {
    headers: { "X-Requested-With": "XMLHttpRequest" },
    data: {
      firstName: "T26",
      lastName: "NavUser",
      email,
      password,
      confirmPassword: password,
    },
  });
  if (resp.status() !== 201) {
    throw new Error(`Signup API failed: ${resp.status()} ${await resp.text()}`);
  }

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").waitFor({ state: "visible", timeout: 15_000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30_000 });

  if (!page.url().includes("/threshold")) {
    await page.goto("/threshold", { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  }

  // Complete threshold (Yes/Yes)
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await firstYes.click();

  const secondYes = page.locator("button:has-text('Yes')").nth(1);
  try {
    await expect(secondYes).toBeVisible({ timeout: 10_000 });
  } catch {
    await firstYes.click();
    await expect(secondYes).toBeVisible({ timeout: 10_000 });
  }
  await secondYes.click();

  await page.locator("text=Continue to Personal Information").click();
  await page.waitForURL("**/personal", { timeout: NAV_TIMEOUT });
}

/**
 * Fill personal info and proceed to /accounts.
 */
async function doPersonalInfo(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT } as never);
  await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30_000 });
  await page.waitForTimeout(1500);

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
  await page.waitForURL("**/accounts", { timeout: NAV_TIMEOUT });
}

/**
 * Add a single foreign account, handling the optional tier selector.
 */
async function doAddAccount(page: Page, bankName = "T26 Test Bank AG"): Promise<void> {
  const tierButton = page.locator("button:has-text('Enter accounts manually')");
  const addButton = page.locator("button:has-text('Add Foreign Account')");

  try {
    await tierButton.waitFor({ state: "visible", timeout: 10_000 });
    await tierButton.click();
    await addButton.waitFor({ state: "visible", timeout: 15_000 });
  } catch {
    // Tier selector not shown — user already in manual mode
  }

  await addButton.click();
  await page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]').fill(bankName);

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
  await expect(page.locator(`text=${bankName}`)).toBeVisible({ timeout: NAV_TIMEOUT });
}

/**
 * Assert that the wizard step indicator marks the given step name as current.
 *
 * WizardLayout renders:
 *   <li aria-current="step" aria-label="Step N of 7: Label (current)">
 *
 * We look for the <li> with aria-current="step" and confirm its aria-label
 * contains the expected step label text.
 */
async function assertActiveStep(page: Page, stepLabel: string): Promise<void> {
  const activeStep = page.locator('[aria-current="step"]');
  await expect(activeStep).toBeVisible({ timeout: 15_000 });
  const label = await activeStep.getAttribute("aria-label");
  expect(label).toContain(stepLabel);
}

// ---------------------------------------------------------------------------
// Suite 1: Wizard Step Indicators (serial)
// ---------------------------------------------------------------------------
test.describe("Wizard Step Indicators", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    await robustSignupToPersonal(sharedPage);
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  // Test 01
  test("01: /personal shows step 2 (Personal Info) as active", async () => {
    // We are already on /personal from beforeAll
    await expect(sharedPage).toHaveURL(/\/personal/, { timeout: 15_000 });
    await assertActiveStep(sharedPage, "Personal Info");
  });

  // Test 02
  test("02: /accounts shows step 3 (Accounts) as active", async () => {
    await doPersonalInfo(sharedPage);
    await expect(sharedPage).toHaveURL(/\/accounts/);
    await assertActiveStep(sharedPage, "Accounts");
  });

  // Test 03
  test("03: /review shows step 4 (Review) as active", async () => {
    await doAddAccount(sharedPage);

    await sharedPage.locator("button:has-text('Continue to Review')").click();
    await sharedPage.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    await expect(sharedPage).toHaveURL(/\/review/);
    await assertActiveStep(sharedPage, "Review");
  });

  // Test 04
  test("04: /sign shows step 5 (Sign) as active", async () => {
    const continueBtn = sharedPage.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueBtn.first()).toBeVisible({ timeout: 15_000 });
    await continueBtn.first().click();
    await sharedPage.waitForURL("**/sign", { timeout: NAV_TIMEOUT });

    await expect(sharedPage).toHaveURL(/\/sign/);
    await assertActiveStep(sharedPage, "Sign");
  });

  // Test 05
  test("05: /payment shows step 6 (Payment) as active", async () => {
    await completeSigning(sharedPage, "T26", "NavUser");
    await expect(sharedPage).toHaveURL(/\/payment/);
    await assertActiveStep(sharedPage, "Payment");
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Wizard Previous Links (serial — needs a user mid-wizard)
// ---------------------------------------------------------------------------
test.describe("Wizard Previous Links", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(300_000);

  let sharedPage: Page;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    // Get user through to /accounts so we can test Previous on multiple steps
    await robustSignupToPersonal(sharedPage);
    await doPersonalInfo(sharedPage);
    await doAddAccount(sharedPage);
    // Continue to /review so we can reach sign later
    await sharedPage.locator("button:has-text('Continue to Review')").click();
    await sharedPage.waitForURL("**/review", { timeout: NAV_TIMEOUT });
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  // Test 09 (run first — go back from /review to /accounts to /personal order)
  // We navigate explicitly since the shared page is at /review after beforeAll.

  // Test 06
  test("06: /accounts Previous navigates to /personal", async () => {
    await sharedPage.goto("/accounts", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await sharedPage.waitForURL("**/accounts", { timeout: NAV_TIMEOUT });

    const prevLink = sharedPage.locator('a[aria-label="Go back to previous step"]');
    await expect(prevLink).toBeVisible({ timeout: 15_000 });
    await prevLink.click();

    await sharedPage.waitForURL("**/personal", { timeout: NAV_TIMEOUT });
    await expect(sharedPage).toHaveURL(/\/personal/);
  });

  // Test 07
  test("07: /review Previous navigates to /accounts", async () => {
    await sharedPage.goto("/review", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await sharedPage.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    const prevLink = sharedPage.locator('a[aria-label="Go back to previous step"]');
    await expect(prevLink).toBeVisible({ timeout: 15_000 });
    await prevLink.click();

    await sharedPage.waitForURL("**/accounts", { timeout: NAV_TIMEOUT });
    await expect(sharedPage).toHaveURL(/\/accounts/);
  });

  // Test 08
  test("08: /sign Previous navigates to /review", async () => {
    // Navigate to sign — need to pass through review first
    await sharedPage.goto("/review", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    const continueBtn = sharedPage.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueBtn.first()).toBeVisible({ timeout: 15_000 });
    await continueBtn.first().click();
    await sharedPage.waitForURL("**/sign", { timeout: NAV_TIMEOUT });

    const prevLink = sharedPage.locator('a[aria-label="Go back to previous step"]');
    await expect(prevLink).toBeVisible({ timeout: 15_000 });
    await prevLink.click();

    await sharedPage.waitForURL("**/review", { timeout: NAV_TIMEOUT });
    await expect(sharedPage).toHaveURL(/\/review/);
  });

  // Test 09
  test("09: /personal Previous navigates to /threshold", async () => {
    await sharedPage.goto("/personal", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await sharedPage.waitForURL("**/personal", { timeout: NAV_TIMEOUT });

    const prevLink = sharedPage.locator('a[aria-label="Go back to previous step"]');
    await expect(prevLink).toBeVisible({ timeout: 15_000 });
    await prevLink.click();

    await sharedPage.waitForURL("**/threshold", { timeout: NAV_TIMEOUT });
    await expect(sharedPage).toHaveURL(/\/threshold/);
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Marketing Nav Links (parallel — unauthenticated)
// ---------------------------------------------------------------------------
test.describe("Marketing Nav Links", () => {
  test.setTimeout(60_000);

  // Test 10
  test("10: Logo (FBAR Direct) links back to /", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await page.locator("nav[aria-label='Main navigation']").waitFor({
      state: "visible",
      timeout: 15_000,
    });

    const logo = page.locator("nav[aria-label='Main navigation']").getByText("FBAR Direct").first();
    await expect(logo).toBeVisible();
    await logo.click();

    await page.waitForURL(/\/$/, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
  });

  // Test 11
  test("11: 'How to File' nav link navigates to /#how-to-file section", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("nav[aria-label='Main navigation']").waitFor({
      state: "visible",
      timeout: 15_000,
    });

    const howToFileLink = page
      .locator("nav[aria-label='Main navigation']")
      .getByText("How to File");
    await expect(howToFileLink).toBeVisible();
    await howToFileLink.click();

    await expect(page).toHaveURL(/\/#how-to-file/);
    await expect(page.locator("#how-to-file")).toBeVisible();
  });

  // Test 12
  test("12: 'Pricing' nav link navigates to /#pricing section", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("nav[aria-label='Main navigation']").waitFor({
      state: "visible",
      timeout: 15_000,
    });

    const pricingLink = page
      .locator("nav[aria-label='Main navigation']")
      .getByText("Pricing")
      .first();
    await expect(pricingLink).toBeVisible();
    await pricingLink.click();

    await expect(page).toHaveURL(/\/#pricing/);
    await expect(page.locator("#pricing")).toBeVisible();
  });

  // Test 13
  test("13: 'Log In' nav link navigates to /login", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("nav[aria-label='Main navigation']").waitFor({
      state: "visible",
      timeout: 15_000,
    });

    const loginLink = page
      .locator("nav[aria-label='Main navigation']")
      .getByText("Log In");
    await expect(loginLink).toBeVisible();
    await loginLink.click();

    await page.waitForURL("**/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
  });

  // Test 14
  test("14: 'Begin Filing' CTA button navigates to /signup", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator("nav[aria-label='Main navigation']").waitFor({
      state: "visible",
      timeout: 15_000,
    });

    const ctaButton = page
      .locator("nav[aria-label='Main navigation']")
      .getByText("Begin Filing");
    await expect(ctaButton).toBeVisible();
    await ctaButton.click();

    await page.waitForURL("**/signup", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/signup$/);
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Footer Links (parallel — unauthenticated)
// ---------------------------------------------------------------------------
test.describe("Footer Links", () => {
  test.setTimeout(60_000);

  // Test 15
  test("15: Footer 'Privacy Policy' link navigates to /privacy", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const privacyLink = page.locator('footer a[href="/privacy"]');
    await expect(privacyLink).toBeVisible({ timeout: 10_000 });
    await privacyLink.click();

    await page.waitForURL("**/privacy", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/privacy$/);
  });

  // Test 16
  test("16: Footer 'Terms of Service' link navigates to /terms", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const termsLink = page.locator('footer a[href="/terms"]');
    await expect(termsLink).toBeVisible({ timeout: 10_000 });
    await termsLink.click();

    await page.waitForURL("**/terms", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/terms$/);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Dynamic Routes (parallel — page-load checks only)
// ---------------------------------------------------------------------------
test.describe("Dynamic Routes", () => {
  test.setTimeout(60_000);

  // Test 17
  test("17: /fbar/germany renders without 404", async ({ page }) => {
    const response = await page.goto("/fbar/germany", {
      waitUntil: "domcontentloaded",
    });
    // No 404
    expect(response?.status()).not.toBe(404);

    // Should have a heading mentioning Germany
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 15_000 });
    const headingText = await h1.textContent();
    expect(headingText?.toLowerCase()).toContain("germany");
  });

  // Test 18
  test("18: /compare/fbar-direct-vs-cpa renders without 404", async ({ page }) => {
    const response = await page.goto("/compare/fbar-direct-vs-cpa", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).not.toBe(404);

    // Should have visible heading content
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 15_000 });
  });

  // Test 19
  test("19: /start/fbar-expat renders without 404", async ({ page }) => {
    const response = await page.goto("/start/fbar-expat", {
      waitUntil: "domcontentloaded",
    });
    expect(response?.status()).not.toBe(404);

    // Should have visible heading content
    const h1 = page.locator("h1");
    await expect(h1).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 6: App Nav — email display and sign out (serial)
// ---------------------------------------------------------------------------
test.describe("App Nav", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  let sharedPage: Page;
  let testEmail: string;

  test.beforeAll(async ({ browser }) => {
    sharedPage = await browser.newPage();
    testEmail = await signupTestUser(sharedPage);
    // signupTestUser lands on /threshold; navigate somewhere in the app
    await sharedPage.goto("/dashboard", {
      waitUntil: "networkidle",
      timeout: 30_000,
    });
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  // Test 20
  test("20: authenticated app nav displays the user email", async () => {
    await expect(sharedPage).not.toHaveURL(/\/login/, { timeout: 5_000 });

    // The app nav renders: <span class="text-sm text-gray-500">{session.user?.email}</span>
    const emailDisplay = sharedPage.locator(`text=${testEmail}`);
    await expect(emailDisplay).toBeVisible({ timeout: 15_000 });
  });

  // Test 21
  test("21: 'Log Out' button signs out and redirects to / or /login, then /dashboard redirects to /login", async () => {
    const signOutButton = sharedPage.locator('button:has-text("Log Out")');
    await expect(signOutButton).toBeVisible({ timeout: 10_000 });
    await signOutButton.click();

    // Should be redirected away from the app (to / or /login)
    await sharedPage.waitForURL(/\/(login|$)/, { timeout: 30_000 });
    const urlAfterSignOut = sharedPage.url();
    const isOnPublicPage =
      urlAfterSignOut.includes("/login") ||
      urlAfterSignOut.match(/localhost:3001\/?$/) !== null;
    expect(isOnPublicPage).toBe(true);

    // Attempting to navigate to a protected page should redirect to /login
    await sharedPage.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await sharedPage.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(sharedPage).toHaveURL(/\/login/);
  });
});
