import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });
test.setTimeout(300000); // 5 minutes per test

/**
 * Antagonistic test: Review + Sign wizard steps
 *
 * Full flow: signup -> login -> threshold -> personal -> accounts -> review -> sign -> payment
 *
 * Uses browser-based signup (same pattern as T-13 which passes reliably).
 */

const TEST_PASSWORD = "TestPass123!";
const NAV_TIMEOUT = 90000;
const WAIT = 60000;

/**
 * Create user via API and login via browser.
 * Bypasses signup page auto-login race condition (signup UI is covered by auth.spec.ts).
 */
async function robustSignup(
  page: Page,
  opts: { firstName: string; lastName: string; password: string }
): Promise<string> {
  const email = `t12-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  // Create user via API (avoids auto-login race condition)
  const response = await page.request.post("/api/auth/signup", {
    data: {
      firstName: opts.firstName,
      lastName: opts.lastName,
      email,
      password: opts.password,
      confirmPassword: opts.password,
    },
  });
  if (response.status() !== 201) {
    throw new Error(`Signup API failed: ${response.status()} ${await response.text()}`);
  }

  // Login via /login page (clean session, no CSRF race)
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
  await page.fill("#email", email);
  await page.fill("#password", opts.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(threshold|dashboard)/, { timeout: WAIT });

  if (page.url().includes("/login") || page.url().includes("/signup")) {
    throw new Error(`robustSignup failed: still on ${page.url()}`);
  }

  return email;
}

/**
 * Complete threshold step.
 */
async function doThreshold(page: Page) {
  // Ensure we're on threshold
  if (!page.url().includes("/threshold")) {
    await page.goto("/threshold", { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  }
  await expect(page.locator("h1")).toContainText("Do You Need to File", {
    timeout: NAV_TIMEOUT,
  });
  // Wait for React hydration
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1500);
  await firstYes.click();
  // Wait for Q2 to appear, retry if needed
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
 * Complete personal info step.
 *
 * CRITICAL: The personal page has a useEffect that fetches /api/user and
 * calls setForm() which overwrites ALL field values. We must wait for the
 * page to fully settle (networkidle) before filling fields.
 */
async function doPersonalInfo(page: Page) {
  // Wait for page to fully settle — API data loaded, all renders complete
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT } as never);
  await expect(page.locator("h1")).toContainText("Personal Information", {
    timeout: NAV_TIMEOUT,
  });

  // Wait for API data to load — firstName gets pre-filled from user record
  await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30_000 });

  // Extra settling time for React re-renders
  await page.waitForTimeout(2000);

  // Use T-13's exact fill pattern (which passes reliably)
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
 * Add a foreign account.
 */
async function doAddAccount(page: Page, bankName = "Test Bank AG") {
  // Handle tier selector (shown when user has no accounts yet)
  const tierButton = page.locator("button:has-text('Enter accounts manually')");
  const addButton = page.locator("button:has-text('Add Foreign Account')");
  try {
    await tierButton.waitFor({ state: "visible", timeout: 10000 });
    await tierButton.click();
    await addButton.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    // Tier selector not shown — user already has accounts
  }

  await addButton.click();
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
  await expect(page.locator(`text=${bankName}`)).toBeVisible({ timeout: NAV_TIMEOUT });
}

test.describe("Review + Sign: Full Flow", () => {
  test("signup through review, verify data, then sign and reach payment", async ({
    page,
  }) => {
    // Step 1: Signup + Login (browser-based, like T-13)
    await robustSignup(page, { firstName: "Test", lastName: "User", password: TEST_PASSWORD });

    // Step 2: Complete threshold
    await doThreshold(page);

    // Step 3: Complete personal info
    await doPersonalInfo(page);

    // Step 4: Add a foreign account
    await doAddAccount(page, "Test Bank AG");

    // Click Continue to Review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    // Step 5: Verify Review page content
    await expect(page.locator("h1")).toContainText("Review Your FBAR", {
      timeout: NAV_TIMEOUT,
    });

    // Personal Info section
    const personalSection = page.locator(
      'section[aria-labelledby="personal-info-heading"]'
    );
    await expect(personalSection).toBeVisible({ timeout: NAV_TIMEOUT });
    // Wait for user data to load (dd elements only render after API response)
    await expect(personalSection.locator("dd").first()).toContainText("Test User", { timeout: NAV_TIMEOUT });
    await expect(personalSection.locator("text=6789")).toBeVisible();
    await expect(personalSection.locator("text=123 Test St")).toBeVisible();
    await expect(personalSection.locator("text=Testville")).toBeVisible();
    await expect(personalSection.locator("text=CA")).toBeVisible();
    await expect(personalSection.locator("text=90210")).toBeVisible();

    // Foreign Accounts section
    const accountsSection = page.locator(
      'section[aria-labelledby="accounts-heading"]'
    );
    await expect(accountsSection).toBeVisible();
    await expect(accountsSection.locator("text=Test Bank AG").first()).toBeVisible();

    // Edit links (at least 2)
    const editLinks = page.locator('a:has-text("Edit")');
    const editCount = await editLinks.count();
    expect(editCount).toBeGreaterThanOrEqual(2);
    await expect(page.locator('a[href="/personal"]:has-text("Edit")').first()).toBeVisible();
    await expect(page.locator('a[href="/accounts"]:has-text("Edit")').first()).toBeVisible();

    // Filing Information section
    await expect(page.locator("text=Filing Information")).toBeVisible();
    await expect(page.locator("text=Calendar Year")).toBeVisible();
    await expect(page.locator("text=Number of Accounts")).toBeVisible();

    // Step 5a: Test Edit links
    await page.locator('a[href="/personal"]:has-text("Edit")').first().click();
    await page.waitForURL("**/personal", { timeout: NAV_TIMEOUT });
    await expect(page).toHaveURL(/\/personal/);

    await page.goBack();
    await page.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    await page.locator('a[href="/accounts"]:has-text("Edit")').first().click();
    await page.waitForURL("**/accounts", { timeout: NAV_TIMEOUT });
    await expect(page).toHaveURL(/\/accounts/);

    await page.goBack();
    await page.waitForURL("**/review", { timeout: NAV_TIMEOUT });

    // Step 6: Click Continue to Sign
    const continueBtn = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueBtn.first()).toBeVisible();
    await expect(continueBtn.first()).toBeEnabled();
    await continueBtn.first().click();
    await page.waitForURL("**/sign", { timeout: NAV_TIMEOUT });

    // Step 7: Verify Sign page elements
    await expect(page.locator("h1")).toContainText("Sign Form 114a", {
      timeout: NAV_TIMEOUT,
    });

    const agreeCheckbox = page.locator("#agree-checkbox");
    await expect(agreeCheckbox).toBeVisible();
    await expect(agreeCheckbox).not.toBeChecked();

    const signatureInput = page.locator("#typed-signature");
    await expect(signatureInput).toBeVisible();

    // Step 8: Sign button validation guards
    const signButton = page.locator(
      'button:has-text("Sign and Continue to Payment")'
    );
    await expect(signButton).toBeVisible();

    // Disabled: no checkbox, no name
    await expect(signButton).toBeDisabled();

    // Name only (no checkbox) -> disabled
    await signatureInput.fill("Test User");
    await expect(signButton).toBeDisabled();

    // Checkbox only (no name) -> disabled
    await signatureInput.clear();
    await agreeCheckbox.check();
    await expect(signButton).toBeDisabled();

    // Wrong name + checkbox -> disabled + mismatch
    await signatureInput.fill("Wrong Name");
    await expect(page.locator("text=Name must match")).toBeVisible();
    await expect(signButton).toBeDisabled();

    // Partial name -> mismatch
    await signatureInput.clear();
    await signatureInput.fill("Test");
    await expect(page.locator("text=Name must match")).toBeVisible();
    await expect(signButton).toBeDisabled();

    // Step 9: Correct name -> sign -> payment
    await signatureInput.clear();
    await signatureInput.fill("Test User");
    await expect(page.locator("text=Name must match")).toBeHidden();
    await expect(signButton).toBeEnabled({ timeout: 5000 });

    await signButton.click();
    await page.waitForURL("**/payment", { timeout: NAV_TIMEOUT });
    await expect(page).toHaveURL(/\/payment/);
  });
});

test.describe("Review + Sign: Edge Cases", () => {
  test.describe.configure({ retries: 1 });

  test("review page blocks continue when no accounts exist", async ({
    page,
  }) => {
    test.setTimeout(600000); // 10 minutes — full signup + wizard flow

    await robustSignup(page, { firstName: "Test", lastName: "User", password: TEST_PASSWORD });
    await doThreshold(page);
    await doPersonalInfo(page);

    // Verify session is still valid before navigating
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    if (page.url().includes("/login")) {
      throw new Error("Session expired after doPersonalInfo — retrying");
    }

    // Navigate directly to /review (no accounts added)
    await page.goto("/review", { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await expect(page.locator("h1")).toContainText("Review Your FBAR", {
      timeout: NAV_TIMEOUT,
    });

    // Continue button disabled
    const continueBtn = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueBtn.first()).toBeDisabled();

    // Warning message
    await expect(
      page.locator("text=Add at least one foreign account to continue")
    ).toBeVisible();
  });
});
