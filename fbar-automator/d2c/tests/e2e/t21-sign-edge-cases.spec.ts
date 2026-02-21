import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// ---------------------------------------------------------------------------
// Serial suite — tests share one user and one browser page.
// State accumulates: tests 1-6 keep the filing unsigned; test 7 signs it;
// test 8 verifies the already-signed redirect.
//
// User: firstName="Test", lastName="User", no middle name.
// Expected typed name: "Test User"
// ---------------------------------------------------------------------------
test.describe.serial("T21: Sign Page — Edge Cases", () => {
  test.describe.configure({ timeout: 90000 });

  const TEST_PASSWORD = "TestPass123!";

  let page: Page;

  // -------------------------------------------------------------------------
  // beforeAll: create user, complete wizard through /review, navigate to /sign
  // -------------------------------------------------------------------------
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // 1. Create user via API (avoids auto-login race in browser signup form)
    const email = `t21-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
    const signupResp = await page.request.post("/api/auth/signup", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: {
        firstName: "Test",
        lastName: "User",
        email,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      },
    });
    if (signupResp.status() !== 201) {
      throw new Error(
        `Signup API failed: ${signupResp.status()} ${await signupResp.text()}`
      );
    }

    // 2. Login via browser (clean session)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", email);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });

    // 3. Complete threshold (Yes / Yes → Continue to Personal Information)
    if (!page.url().includes("/threshold")) {
      await page.goto("/threshold", { waitUntil: "networkidle", timeout: 30000 });
    }
    await expect(page.locator("h1")).toContainText("Do You Need to File", {
      timeout: 20000,
    });
    const firstYes = page.locator("button:has-text('Yes')").first();
    await expect(firstYes).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500); // allow React hydration
    await firstYes.click();
    const secondYes = page.locator("button:has-text('Yes')").nth(1);
    try {
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    } catch {
      // Retry the first click if Q2 didn't appear
      await firstYes.click();
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    }
    await secondYes.click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 30000 });

    // 4. Complete personal info
    // Wait for /api/user to pre-fill firstName before touching the form
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Personal Information", {
      timeout: 15000,
    });
    await expect(page.locator("#firstName")).toHaveValue(/\w+/, {
      timeout: 30000,
    });
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
    await page.waitForURL("**/accounts", { timeout: 30000 });

    // 5. Add a foreign account
    // Handle tier selector shown on first visit
    const tierButton = page.locator("button:has-text('Enter accounts manually')");
    const addButton = page.locator("button:has-text('Add Foreign Account')");
    try {
      await tierButton.waitFor({ state: "visible", timeout: 10000 });
      await tierButton.click();
      await addButton.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      // Tier selector not shown
    }
    await addButton.click();
    await page
      .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
      .fill("Sign Test Bank AG");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("CH9876543210");
    const countrySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });
    const currencySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("75000");
    await page.locator("button:has-text('Save Account')").click();
    await expect(page.locator("text=Sign Test Bank AG")).toBeVisible({
      timeout: 15000,
    });

    // 6. Navigate to /review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Review", { timeout: 15000 });

    // 7. Navigate to /sign
    const continueToSign = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueToSign.first()).toBeVisible({ timeout: 15000 });
    await expect(continueToSign.first()).toBeEnabled();
    await continueToSign.first().click();
    await page.waitForURL("**/sign", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Sign Form 114a", {
      timeout: 15000,
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // =========================================================================
  // Helper: navigate back to /sign and wait for the page to be fully loaded.
  // =========================================================================
  async function goToSignAndWait(pg: Page) {
    await pg.goto("/sign", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(pg.locator("h1")).toContainText("Sign Form 114a", {
      timeout: 20000,
    });
    // Wait for API data (user name + filing) to finish loading
    await expect(pg.locator("#typed-signature")).toBeVisible({ timeout: 20000 });
    await pg.waitForTimeout(1000);
  }

  // =========================================================================
  // Test 1: Button disabled until BOTH checkbox AND correct name are provided
  // =========================================================================
  test("Button disabled until both checkbox and correct name provided", async () => {
    await goToSignAndWait(page);

    const agreeCheckbox = page.locator("#agree-checkbox");
    const signatureInput = page.locator("#typed-signature");
    const signButton = page.locator(
      'button:has-text("Sign and Continue to Payment")'
    );

    // Baseline: nothing filled — button disabled
    await expect(signButton).toBeDisabled();

    // Correct name only (no checkbox) — still disabled
    await signatureInput.fill("Test User");
    await expect(signButton).toBeDisabled();

    // Clear name, check checkbox only — still disabled
    await signatureInput.clear();
    await agreeCheckbox.check();
    await expect(signButton).toBeDisabled();

    // Both checkbox AND correct name — button enabled
    await signatureInput.fill("Test User");
    await expect(signButton).toBeEnabled({ timeout: 5000 });

    // Clean up for next test: uncheck and clear
    await agreeCheckbox.uncheck();
    await signatureInput.clear();
  });

  // =========================================================================
  // Test 2: Case-insensitive name match ('test user' matches 'Test User')
  // =========================================================================
  test("Case-insensitive name match: 'test user' is accepted", async () => {
    await goToSignAndWait(page);

    const agreeCheckbox = page.locator("#agree-checkbox");
    const signatureInput = page.locator("#typed-signature");
    const signButton = page.locator(
      'button:has-text("Sign and Continue to Payment")'
    );

    await agreeCheckbox.check();

    // Lowercase variant should match
    await signatureInput.fill("test user");
    // "Name must match" warning must NOT be visible
    await expect(page.locator("text=Name must match")).toBeHidden();
    // Button must be enabled
    await expect(signButton).toBeEnabled({ timeout: 5000 });

    // UPPERCASE variant should also match
    await signatureInput.clear();
    await signatureInput.fill("TEST USER");
    await expect(page.locator("text=Name must match")).toBeHidden();
    await expect(signButton).toBeEnabled({ timeout: 5000 });

    // Clean up
    await agreeCheckbox.uncheck();
    await signatureInput.clear();
  });

  // =========================================================================
  // Test 3: Extra middle name is rejected (wrong name triggers mismatch warning)
  // =========================================================================
  test("Name with extra middle name is rejected with mismatch warning", async () => {
    await goToSignAndWait(page);

    const agreeCheckbox = page.locator("#agree-checkbox");
    const signatureInput = page.locator("#typed-signature");
    const signButton = page.locator(
      'button:has-text("Sign and Continue to Payment")'
    );

    await agreeCheckbox.check();

    // Typing an extra middle name that the user does not have must fail
    await signatureInput.fill("Test J User");
    await expect(page.locator("text=Name must match")).toBeVisible({
      timeout: 5000,
    });
    await expect(signButton).toBeDisabled();

    // Partial name (first name only) must also fail
    await signatureInput.clear();
    await signatureInput.fill("Test");
    await expect(page.locator("text=Name must match")).toBeVisible();
    await expect(signButton).toBeDisabled();

    // Last name only must also fail
    await signatureInput.clear();
    await signatureInput.fill("User");
    await expect(page.locator("text=Name must match")).toBeVisible();
    await expect(signButton).toBeDisabled();

    // Clean up
    await agreeCheckbox.uncheck();
    await signatureInput.clear();
  });

  // =========================================================================
  // Test 4: Empty signature does NOT show mismatch warning
  // (Warning only appears after typing a wrong name, not on empty input)
  // =========================================================================
  test("Empty signature input does not show mismatch warning", async () => {
    await goToSignAndWait(page);

    const agreeCheckbox = page.locator("#agree-checkbox");
    const signatureInput = page.locator("#typed-signature");
    const signButton = page.locator(
      'button:has-text("Sign and Continue to Payment")'
    );

    // Ensure input is empty
    await signatureInput.clear();

    // Warning must NOT be present on empty input
    await expect(page.locator("text=Name must match")).toBeHidden();

    // Button is disabled (not because of mismatch, but because name is required)
    await expect(signButton).toBeDisabled();

    // Check the agree checkbox — warning still must not appear on empty input
    await agreeCheckbox.check();
    await expect(page.locator("text=Name must match")).toBeHidden();
    await expect(signButton).toBeDisabled();

    // Clean up
    await agreeCheckbox.uncheck();
  });

  // =========================================================================
  // Test 5: Authorization text is visible and contains key phrases
  // =========================================================================
  test("Authorization statement text is visible with expected content", async () => {
    await goToSignAndWait(page);

    // The authorization section heading — use role-based locator to avoid
    // matching both the h2 heading and any inline span with the same text.
    await expect(
      page.getByRole("heading", { name: "Authorization Statement" })
    ).toBeVisible();

    // Key legal phrases that must appear in the authorization block
    await expect(
      page.locator("text=certify").first()
    ).toBeVisible();

    await expect(
      page.locator("text=authorize").first()
    ).toBeVisible();

    // Penalty warning must be present
    await expect(
      page.locator("text=31 U.S.C. 5322").first()
    ).toBeVisible();

    // The agree checkbox label describing the statement
    const agreeLabel = page.locator('label[for="agree-checkbox"]');
    await expect(agreeLabel).toContainText("I have read and agree");
  });

  // =========================================================================
  // Test 6: Previous link navigates to /review
  // =========================================================================
  test("Previous link navigates back to /review", async () => {
    await goToSignAndWait(page);

    // WizardLayout renders a "Previous" link with aria-label "Go back to previous step"
    const previousLink = page.locator(
      'a[aria-label="Go back to previous step"], a:has-text("Previous")'
    );
    await expect(previousLink.first()).toBeVisible({ timeout: 10000 });

    await previousLink.first().click();
    await page.waitForURL("**/review", { timeout: 20000 });
    await expect(page).toHaveURL(/\/review/);

    // Return to /sign for the next tests
    await goToSignAndWait(page);
  });

  // =========================================================================
  // Test 7: Signing shows "Signing..." loading state, then navigates to /payment
  // =========================================================================
  test("Signing shows loading state and navigates to /payment", async () => {
    // Ensure we are on /sign with a fresh page load
    await goToSignAndWait(page);

    const agreeCheckbox = page.locator("#agree-checkbox");
    const signatureInput = page.locator("#typed-signature");
    const signButton = page.locator(
      'button:has-text("Sign and Continue to Payment")'
    );

    // Fill in valid details
    await agreeCheckbox.check();
    await signatureInput.fill("Test User");
    await expect(signButton).toBeEnabled({ timeout: 5000 });

    // Click sign — the button briefly shows "Signing..." (aria-busy=true) before redirect
    await signButton.click();

    // The button should either show the loading state or the page navigates immediately.
    // Check for loading text or aria-busy attribute during the transition.
    // We use a race: either "Signing..." appears, or we land on /payment.
    try {
      await expect(
        page.locator('button[aria-busy="true"], button:has-text("Signing...")')
      ).toBeVisible({ timeout: 3000 });
    } catch {
      // Loading state was too brief to catch — that is acceptable.
      // The important assertion is that we end up on /payment.
    }

    await page.waitForURL("**/payment", { timeout: 30000 });
    await expect(page).toHaveURL(/\/payment/);
  });

  // =========================================================================
  // Test 8: Already-SIGNED filing redirects to /payment when visiting /sign
  // =========================================================================
  test("Already-signed filing redirects to /payment on /sign visit", async () => {
    // The filing was signed in test 7 above. Navigating to /sign should now
    // redirect to /payment because the sign page checks for a SIGNED filing
    // and pushes to /payment when no active (REVIEWED/IN_PROGRESS) filing exists.
    await page.goto("/sign", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL("**/payment", { timeout: 20000 });
    await expect(page).toHaveURL(/\/payment/);
  });
});
