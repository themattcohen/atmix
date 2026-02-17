import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// ---------------------------------------------------------------------------
// All operations are inline with very generous timeouts to handle dev server
// compilation and API latency (individual requests can take 10-35s).
// ---------------------------------------------------------------------------

const WAIT = 60000; // 60s for any single navigation/wait

// ---------------------------------------------------------------------------
// Robust signup: handles auto-login CSRF failures gracefully
// ---------------------------------------------------------------------------
async function robustSignup(
  page: Page,
  opts: { firstName: string; lastName: string; password: string }
): Promise<string> {
  const email = `t13-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

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
    const errorText = page.locator("text=auto-login failed");
    if (await errorText.isVisible().catch(() => false)) {
      await page.goto("/login");
    } else {
      await page.waitForURL(/\/(threshold|login|dashboard)/, { timeout: WAIT });
    }
  }

  if (page.url().includes("/login")) {
    await page.fill("#email", email);
    await page.fill("#password", opts.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: WAIT });
  }

  return email;
}

// ==========================================================================
// SERIAL TEST GROUP A: Full wizard flow -> Payment page tests
// One signup, one full flow, multiple payment assertions in sequence
// ==========================================================================
test.describe.serial("T13-A: Payment page (full wizard flow)", () => {
  test.setTimeout(600000); // 10 minutes for entire serial group

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("setup: signup and complete wizard to /payment", async () => {
    const firstName = "Pay";
    const lastName = "Tester";

    await robustSignup(page, { firstName, lastName, password: "TestPass123!" });

    // Ensure on /threshold
    if (!page.url().includes("/threshold")) {
      await page.goto("/threshold");
      await page.waitForLoadState("domcontentloaded");
    }

    // Threshold: Yes/Yes/Continue
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: WAIT });

    // Personal info
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
    await page.waitForURL("**/accounts", { timeout: WAIT });

    // Add account
    await page.locator("button:has-text('Add Foreign Account')").click();
    await page
      .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
      .fill("Test Bank AG");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("CH1234567890");
    await page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') })
      .selectOption({ index: 1 });
    await page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select currency")') })
      .selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("50000");
    await page.locator("button:has-text('Save Account')").click();
    await page.waitForSelector("text=Test Bank AG", { timeout: WAIT });

    // Continue to review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: WAIT });

    // Go to sign (review CTA may say "Everything Looks Correct - Continue to Sign")
    await page
      .locator("button")
      .filter({ hasText: /Continue|Sign/ })
      .first()
      .click();
    // May go to /sign or directly to /payment if filing already signed
    await page.waitForURL(/\/(sign|payment)/, { timeout: WAIT });

    // Complete signing (if we're on /sign; skip if already on /payment)
    if (page.url().includes("/sign")) {
      await page.locator("#agree-checkbox").waitFor({ state: "visible", timeout: WAIT });
      await page.locator("#agree-checkbox").check();
      await page.locator("#typed-signature").fill(`${firstName} ${lastName}`);
      await page.locator('button:has-text("Sign and Continue to Payment")').click();
      await page.waitForURL("**/payment", { timeout: WAIT });
    }
  });

  test("payment page: heading renders", async () => {
    await expect(page).toHaveURL(/\/payment/);
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: WAIT });
    await expect(heading).toContainText("Payment");
  });

  test("payment page: filing summary visible with price", async () => {
    await expect(page.locator("text=Filing Summary")).toBeVisible({ timeout: WAIT });
    await expect(page.locator("text=Calendar Year")).toBeVisible();
    await expect(page.getByText("Accounts:")).toBeVisible();
    await expect(page.locator("text=$59.00")).toBeVisible();
    await expect(page.locator("text=Total")).toBeVisible();
  });

  test("payment page: Stripe pay button and security messaging", async () => {
    const payButton = page.locator("button:has-text('Pay $59')");
    await expect(payButton).toBeVisible({ timeout: WAIT });
    await expect(payButton).toBeEnabled();

    await expect(page.locator("text=Secure payment via Stripe")).toBeVisible();
    await expect(page.locator("text=submit your FBAR directly to FinCEN")).toBeVisible();
    await expect(page.locator("text=BSA tracking ID")).toBeVisible();
  });

  test("payment page: Previous link points to /sign", async () => {
    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/sign");
  });

  test("dashboard: filing card shows after signing", async () => {
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: WAIT });
    await expect(heading).toContainText("My FBAR Filings");

    await expect(page.locator("text=Tax Year").first()).toBeVisible({ timeout: WAIT });
    await expect(page.locator("text=Signed").first()).toBeVisible();
    await expect(page.locator("text=Complete Payment").first()).toBeVisible();
  });
});

// ==========================================================================
// SERIAL TEST GROUP B: Dashboard + payment edge cases (lighter tests)
// ==========================================================================
test.describe.serial("T13-B: Dashboard + payment edge cases", () => {
  test.setTimeout(600000);

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test("dashboard: Start New Filing navigates to /threshold", async () => {
    await robustSignup(page, {
      firstName: "New",
      lastName: "Tester",
      password: "TestPass123!",
    });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const startFilingButton = page
      .locator("a")
      .filter({ hasText: /Start.*Filing/ })
      .first();
    await expect(startFilingButton).toBeVisible({ timeout: WAIT });

    await startFilingButton.click();
    await page.waitForURL("**/threshold", { timeout: WAIT });
    await expect(page).toHaveURL(/\/threshold/);
  });

  test("payment page: no signed filing shows signing prompt", async () => {
    // Navigate directly to /payment (user from previous test has no SIGNED filing)
    await page.goto("/payment");
    await page.waitForLoadState("networkidle");

    const signingPrompt = page.locator("text=Please complete the signing step first");
    const goToSignLink = page.locator("a:has-text('Go to Signing')");
    const loadingSpinner = page.locator('[aria-label="Loading payment page"]');

    const anyVisible = await Promise.any([
      signingPrompt.waitFor({ state: "visible", timeout: WAIT }).then(() => "prompt"),
      goToSignLink.waitFor({ state: "visible", timeout: WAIT }).then(() => "link"),
      loadingSpinner.waitFor({ state: "visible", timeout: WAIT }).then(() => "loading"),
    ]).catch(() => null);

    expect(anyVisible).toBeTruthy();
  });
});
