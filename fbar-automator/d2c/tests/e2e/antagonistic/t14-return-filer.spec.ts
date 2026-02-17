import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// ---------------------------------------------------------------------------
// All operations are inline with very generous timeouts to handle dev server
// compilation and API latency.
// ---------------------------------------------------------------------------

const WAIT = 60000; // 60s for any single navigation/wait
const NAV_TIMEOUT = 90000;

// Year constants: always within the 5-option dropdown (currentYear-1 through currentYear-5)
const yearN = new Date().getFullYear() - 2;   // e.g., 2024 — the "prior" filing year
const yearN1 = new Date().getFullYear() - 1;  // e.g., 2025 — the "new" filing year

// ---------------------------------------------------------------------------
// Robust signup: handles auto-login CSRF failures gracefully
// ---------------------------------------------------------------------------
async function robustSignup(
  page: Page,
  opts: { firstName: string; lastName: string; password: string }
): Promise<string> {
  const email = `t14-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  await page.goto("/signup");
  await page.waitForLoadState("domcontentloaded");
  await page.fill("#firstName", opts.firstName);
  await page.fill("#lastName", opts.lastName);
  await page.fill("#email", email);
  await page.fill("#password", opts.password);
  await page.fill("#confirmPassword", opts.password);
  await page.click('button[type="submit"]');

  try {
    await page.waitForURL(/\/(threshold|login|dashboard)/, { timeout: WAIT });
  } catch {
    if (page.url().includes("/signup")) {
      await page.goto("/login");
      await page.waitForLoadState("domcontentloaded");
    }
  }

  if (page.url().includes("/login")) {
    await page.fill("#email", email);
    await page.fill("#password", opts.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: WAIT });
  }

  // Verify we're actually authenticated
  if (page.url().includes("/login") || page.url().includes("/signup")) {
    throw new Error(`robustSignup failed: still on ${page.url()}`);
  }

  return email;
}

// ---------------------------------------------------------------------------
// Complete threshold step — year-aware variant
// ---------------------------------------------------------------------------
async function doThreshold(page: Page, year?: number) {
  if (!page.url().includes("/threshold")) {
    await page.goto("/threshold", { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  }
  await expect(page.locator("h1")).toContainText("Do You Need to File", {
    timeout: NAV_TIMEOUT,
  });

  // Select year if specified (dropdown: currentYear-1 through currentYear-5)
  if (year) {
    await page.locator("#calendar-year").selectOption(String(year));
  }

  // Wait for React hydration before clicking
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await firstYes.click();

  // Wait for Q2 to appear, retry Q1 click if needed
  const secondYes = page.locator("button:has-text('Yes')").nth(1);
  try {
    await expect(secondYes).toBeVisible({ timeout: 10000 });
  } catch {
    await firstYes.click();
    await expect(secondYes).toBeVisible({ timeout: 10000 });
  }
  await secondYes.click();

  await page.locator("text=Continue to Personal Information").click();
  await page.waitForURL("**/personal", { timeout: NAV_TIMEOUT });
}

// ---------------------------------------------------------------------------
// Complete personal info step.
//
// CRITICAL: The personal page has a useEffect that fetches /api/user and
// calls setForm() which overwrites ALL field values. We must wait for the
// page to fully settle (networkidle) before filling fields.
// ---------------------------------------------------------------------------
async function doPersonalInfo(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT } as never);
  await expect(page.locator("h1")).toContainText("Personal Information", {
    timeout: NAV_TIMEOUT,
  });

  // Wait for API data to load — firstName gets pre-filled from user record
  await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30000 });

  // Extra settling time for React re-renders
  await page.waitForTimeout(2000);

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

// ---------------------------------------------------------------------------
// Add a foreign account — uses named bankName, unique account number per call
// ---------------------------------------------------------------------------
async function doAddAccount(
  page: Page,
  bankName: string,
  opts?: {
    accountNumber?: string;
    countryIndex?: number;
    currencyIndex?: number;
    maxValue?: string;
    isJoint?: boolean;
  }
) {
  await page.locator("button:has-text('Add Foreign Account')").click();
  await page
    .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
    .fill(bankName);

  const formInputs = page.locator("form input[type='text']");
  await formInputs.nth(1).fill(opts?.accountNumber ?? "CH1234567890");

  const countrySelect = page
    .locator("select")
    .filter({ has: page.locator('option:has-text("Select country")') });
  await countrySelect.selectOption({ index: opts?.countryIndex ?? 1 });

  const currencySelect = page
    .locator("select")
    .filter({ has: page.locator('option:has-text("Select currency")') });
  await currencySelect.selectOption({ index: opts?.currencyIndex ?? 1 });

  await page.locator('input[type="number"]').fill(opts?.maxValue ?? "50000");

  // Check joint account checkbox if requested
  if (opts?.isJoint) {
    const jointCheckbox = page.locator("#new-account-isJoint");
    const isVisible = await jointCheckbox.isVisible().catch(() => false);
    if (isVisible) {
      await jointCheckbox.check();
    }
  }

  await page.locator("button:has-text('Save Account')").click();
  await expect(page.locator(`text=${bankName}`)).toBeVisible({ timeout: WAIT });
}

// ==========================================================================
// SERIAL TEST GROUP A: Return filer flow
// One signup, complete year N filing, then start year N+1 and verify import.
// ==========================================================================
test.describe.serial("T14-A: Return filer flow", () => {
  test.setTimeout(600000); // 10 minutes for entire serial group

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------------
  // Test 1: Signup + complete year N filing through sign step
  // -------------------------------------------------------------------------
  test("setup: signup + complete year N filing", async () => {
    await robustSignup(page, {
      firstName: "Return",
      lastName: "Filer",
      password: "TestPass123!",
    });

    // Complete threshold for year N
    await doThreshold(page, yearN);

    // Complete personal info
    await doPersonalInfo(page);

    // Add account 1: Swiss Bank AG
    await doAddAccount(page, "Swiss Bank AG", {
      accountNumber: "CH1234567890",
      countryIndex: 1,
      currencyIndex: 1,
      maxValue: "50000",
      isJoint: false,
    });

    // Add account 2: Joint Account Ltd (joint account)
    await doAddAccount(page, "Joint Account Ltd", {
      accountNumber: "GB9876543210",
      countryIndex: 2,
      currencyIndex: 2,
      maxValue: "75000",
      isJoint: true,
    });

    // Continue to Review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    // Continue to Sign
    const continueBtn = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueBtn.first()).toBeVisible({ timeout: WAIT });
    await continueBtn.first().click();
    await page.waitForURL("**/sign", { timeout: NAV_TIMEOUT });

    // Sign the filing
    await page.locator("#agree-checkbox").waitFor({ state: "visible", timeout: WAIT });
    await page.locator("#agree-checkbox").check();
    await page.locator("#typed-signature").fill("Return Filer");

    const signButton = page.locator('button:has-text("Sign and Continue to Payment")');
    await expect(signButton).toBeEnabled({ timeout: 10000 });
    await signButton.click();
    await page.waitForURL("**/payment", { timeout: NAV_TIMEOUT });

    // Confirm we landed on /payment (do not pay — stop here)
    await expect(page).toHaveURL(/\/payment/);
  });

  // -------------------------------------------------------------------------
  // Test 2: Start year N+1 filing from dashboard
  // -------------------------------------------------------------------------
  test("start year N+1 filing", async () => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const startFilingLink = page
      .locator("a")
      .filter({ hasText: /Start.*Filing/ })
      .first();
    await expect(startFilingLink).toBeVisible({ timeout: WAIT });
    await startFilingLink.click();
    await page.waitForURL("**/threshold", { timeout: NAV_TIMEOUT });

    // Select year N+1 and complete threshold
    await doThreshold(page, yearN1);

    // Personal info is pre-populated for return filer — just verify and submit.
    // NOTE: Can't use doPersonalInfo() because the TIN field placeholder changes
    // from "XXX-XX-XXXX" to "***-**-**** (saved — enter new to update)" when
    // there's existing TIN data, so the selector won't match.
    await expect(page.locator("h1")).toContainText("Personal Information", {
      timeout: NAV_TIMEOUT,
    });
    // Wait for /api/user data to load — under full suite load, this can be slow
    await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: WAIT });
    await page.waitForTimeout(2000); // Extra settle time for React re-renders
    await expect(page.locator("#firstName")).toHaveValue("Return", { timeout: 10_000 });
    await expect(page.locator("#lastName")).toHaveValue("Filer", { timeout: 10_000 });
    // TIN shows masked value "***-**-6789" which fails validation on submit.
    // Must fill with a valid SSN — focusing clears the mask, then fill types.
    await page.locator("#tin").fill("123456789");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/accounts", { timeout: NAV_TIMEOUT });

    // Should now be on /accounts
    await expect(page).toHaveURL(/\/accounts/);
  });

  // -------------------------------------------------------------------------
  // Test 3: Import banner visible (accounts empty, prior year exists)
  // -------------------------------------------------------------------------
  test("import banner visible with prior year and account count", async () => {
    await expect(page).toHaveURL(/\/accounts/);

    // Wait for skeleton to disappear (loading state resolves)
    await page.waitForSelector('[aria-label="Loading accounts"]', { state: "hidden", timeout: WAIT }).catch(() => null);

    const importBanner = page.locator('[data-testid="import-banner"]');
    await expect(importBanner).toBeVisible({ timeout: 30000 });

    // Banner should mention the prior year and account count (2)
    const bannerText = await importBanner.textContent();
    expect(bannerText).toContain(String(yearN));
    expect(bannerText).toMatch(/2\s*account/);
  });

  // -------------------------------------------------------------------------
  // Test 4: Click import, verify accounts appear and banner is gone
  // -------------------------------------------------------------------------
  test("click import — accounts populate and banner disappears", async () => {
    // Click the "Import from <year>" button inside the banner
    const importButton = page.locator('[data-testid="import-banner"] button').filter({
      hasText: /Import from/,
    });
    await expect(importButton).toBeVisible({ timeout: 10000 });
    await importButton.click();

    // Wait for accounts to appear
    await expect(page.locator("text=Swiss Bank AG")).toBeVisible({ timeout: 30000 });
    await expect(page.locator("text=Joint Account Ltd")).toBeVisible({ timeout: 10000 });

    // Banner should be gone (dismissed after import triggers loadData which now has accounts)
    await expect(page.locator('[data-testid="import-banner"]')).not.toBeVisible({
      timeout: 10000,
    });
  });

  // -------------------------------------------------------------------------
  // Test 5: Fill max values — imported accounts are editable
  // -------------------------------------------------------------------------
  test("post-import editing — update max value on Swiss Bank AG", async () => {
    // Edit Swiss Bank AG
    const editSwiss = page.locator('button[aria-label="Edit Swiss Bank AG account"]');
    await expect(editSwiss).toBeVisible({ timeout: WAIT });
    await editSwiss.click();

    // Edit form should appear — find input by placeholder (same pattern as t11)
    const institutionInput = page.locator("input[placeholder='e.g., HSBC, Deutsche Bank']").first();
    await expect(institutionInput).toHaveValue("Swiss Bank AG", { timeout: 10_000 });

    // Update the max value
    const maxValueInput = page.locator('input[type="number"]').first();
    await maxValueInput.clear();
    await maxValueInput.fill("60000");

    // Also rename to "Updated Swiss Bank" to use in deletion test
    await institutionInput.clear();
    await institutionInput.fill("Updated Swiss Bank");

    await page.locator("button:has-text('Save Changes')").click();

    // Verify updated name appears
    await expect(page.locator("text=Updated Swiss Bank")).toBeVisible({ timeout: WAIT });
  });

  // -------------------------------------------------------------------------
  // Test 6: Continue through review — year N+1 data shown
  // -------------------------------------------------------------------------
  test("post-import deletion — delete Updated Swiss Bank, 1 account remains", async () => {
    // Accept confirm dialogs automatically
    page.on("dialog", (dialog) => dialog.accept());

    const deleteBtn = page.locator('button[aria-label="Delete Updated Swiss Bank account"]');
    await expect(deleteBtn).toBeVisible({ timeout: WAIT });
    await deleteBtn.click();

    // Verify Updated Swiss Bank is gone
    await expect(page.locator("text=Updated Swiss Bank")).not.toBeVisible({ timeout: WAIT });

    // Joint Account Ltd should still be present
    await expect(page.locator("text=Joint Account Ltd")).toBeVisible({ timeout: WAIT });

    // Only 1 account remaining
    const accountCards = page.locator(".bg-white.rounded-lg.shadow-sm.border").filter({
      hasText: /Joint Account Ltd/,
    });
    await expect(accountCards).toHaveCount(1, { timeout: 10000 });
  });

  test("continue through review — shows year N+1 data", async () => {
    // Ensure we're on /accounts and exactly 1 account exists before continuing
    await expect(page).toHaveURL(/\/accounts/);
    await expect(page.locator("text=Joint Account Ltd")).toBeVisible({ timeout: WAIT });

    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    await expect(page.locator("h1")).toContainText("Review Your FBAR", {
      timeout: NAV_TIMEOUT,
    });

    // Filing information should show year N+1
    await expect(page.locator("text=Calendar Year")).toBeVisible({ timeout: WAIT });
    const reviewContent = await page.locator("#wizard-content").textContent();
    expect(reviewContent).toContain(String(yearN1));
  });
});

// ==========================================================================
// SERIAL TEST GROUP B: Edge cases — new user has no import banner
// ==========================================================================
test.describe.serial("T14-B: Edge cases", () => {
  test.setTimeout(600000);
  test.describe.configure({ retries: 1 });

  let page: Page;
  let freshEmail: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------------
  // Test: Fresh user has no import banner on accounts page
  // -------------------------------------------------------------------------
  test("new user: no import banner on accounts page", async () => {
    freshEmail = await robustSignup(page, {
      firstName: "Fresh",
      lastName: "User",
      password: "TestPass123!",
    });

    // Verify session is valid before proceeding (same pattern as t12 edge cases)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    if (page.url().includes("/login")) {
      // Session wasn't preserved — re-login
      await page.fill("#email", freshEmail);
      await page.fill("#password", "TestPass123!");
      await page.click('button[type="submit"]');
      await page.waitForURL(/\/(threshold|dashboard)/, { timeout: WAIT });
    }

    // Complete threshold (default year, no explicit year param)
    await doThreshold(page);

    // Complete personal info
    await doPersonalInfo(page);

    // Should be on /accounts
    await expect(page).toHaveURL(/\/accounts/);

    // Wait for skeleton to disappear
    await page.waitForSelector('[aria-label="Loading accounts"]', { state: "hidden", timeout: WAIT }).catch(() => null);

    // Import banner should NOT be visible (no prior filing exists)
    await expect(page.locator('[data-testid="import-banner"]')).not.toBeVisible({
      timeout: 5000,
    });
  });

  // -------------------------------------------------------------------------
  // Test: Accounts page works normally for new user — add and verify account
  // -------------------------------------------------------------------------
  test("new user: can add account normally without import banner", async () => {
    await expect(page).toHaveURL(/\/accounts/);

    await doAddAccount(page, "Fresh Bank Ltd", {
      accountNumber: "DE12345678",
      countryIndex: 1,
      currencyIndex: 1,
      maxValue: "25000",
    });

    // Verify the account is present
    await expect(page.locator("text=Fresh Bank Ltd")).toBeVisible({ timeout: WAIT });

    // Import banner should still not be visible after adding an account
    await expect(page.locator('[data-testid="import-banner"]')).not.toBeVisible({
      timeout: 5000,
    });
  });
});
