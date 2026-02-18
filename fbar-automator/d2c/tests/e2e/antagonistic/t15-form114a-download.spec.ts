import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });
test.setTimeout(300000); // 5 minutes per test

/**
 * Antagonistic test: Form 114a PDF download
 *
 * Full flow: signup -> threshold -> personal -> accounts -> review -> sign -> payment
 * Then verifies:
 *   - /api/filing returns a filing with form114aUrl set after signing
 *   - /api/filing/form114a?id=<id> returns a valid PDF
 *   - Error cases: missing id -> 400, fake id -> 404
 *
 * Uses page.request throughout to share session cookies with the browser context.
 */

const TEST_PASSWORD = "TestPass123!";
const NAV_TIMEOUT = 90000;
const WAIT = 60000;

/**
 * Robust browser-based signup (same pattern as T-12/T-13).
 * Handles auto-login CSRF failures gracefully.
 */
async function robustSignup(
  page: Page,
  opts: { firstName: string; lastName: string; password: string }
): Promise<string> {
  const email = `t15-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

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
    // If still on signup page, check for auto-login failure or just go to login
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

  // Verify we're actually authenticated (not stuck on signup/login)
  if (page.url().includes("/login") || page.url().includes("/signup")) {
    throw new Error(`robustSignup failed: still on ${page.url()}`);
  }

  return email;
}

/**
 * Complete threshold step.
 */
async function doThreshold(page: Page) {
  if (!page.url().includes("/threshold")) {
    await page.goto("/threshold", { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  }
  await expect(page.locator("h1")).toContainText("Do You Need to File", {
    timeout: NAV_TIMEOUT,
  });
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 15_000 });
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
 * Complete personal info step.
 *
 * CRITICAL: The personal page has a useEffect that fetches /api/user and
 * calls setForm() which overwrites ALL field values. We must wait for the
 * page to fully settle (networkidle) before filling fields.
 */
async function doPersonalInfo(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT } as never);
  await expect(page.locator("h1")).toContainText("Personal Information", {
    timeout: NAV_TIMEOUT,
  });

  // Wait for API data to load — firstName gets pre-filled from user record
  await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30_000 });

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

/**
 * Navigate through review and complete the sign step.
 */
async function doSign(page: Page) {
  await page.locator("button:has-text('Continue to Review')").click();
  await page.waitForURL("**/review", { timeout: NAV_TIMEOUT });

  const continueBtn = page.locator(
    "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
  );
  await expect(continueBtn.first()).toBeVisible();
  await continueBtn.first().click();
  await page.waitForURL("**/sign", { timeout: NAV_TIMEOUT });

  await page.locator("#agree-checkbox").check();
  await page.locator("#typed-signature").fill("Test User");
  await page.locator('button:has-text("Sign and Continue to Payment")').click();
  await page.waitForURL("**/payment", { timeout: NAV_TIMEOUT });
}

test.describe("Form 114a Download", () => {
  test("full flow: signup -> wizard -> sign -> verify form114a download", async ({
    page,
  }) => {
    // Step 1: Signup + login
    await robustSignup(page, {
      firstName: "Test",
      lastName: "User",
      password: TEST_PASSWORD,
    });

    // Step 2: Complete wizard through signing
    await doThreshold(page);
    await doPersonalInfo(page);
    await doAddAccount(page);
    await doSign(page);

    // Verify we reached /payment
    await expect(page).toHaveURL(/\/payment/);

    // Step 3: Fetch filing list via page.request (shares session cookies)
    const filingRes = await page.request.get("/api/filing");
    expect(filingRes.status()).toBe(200);
    const filingBody = await filingRes.json();

    // /api/filing returns { data: [...] }
    const filings = filingBody.data ?? filingBody;
    const filing = Array.isArray(filings) ? filings[0] : filings;
    expect(filing).toBeDefined();
    expect(filing.id).toBeTruthy();

    // form114aUrl should be set after signing
    expect(filing.form114aUrl).toBeTruthy();

    const filingId = filing.id;

    // Step 4: Download the form114a PDF
    const downloadRes = await page.request.get(`/api/filing/form114a?id=${filingId}`);
    expect(downloadRes.status()).toBe(200);
    expect(downloadRes.headers()["content-type"]).toBe("application/pdf");
    expect(downloadRes.headers()["content-disposition"]).toContain("form114a_");
    expect(downloadRes.headers()["cache-control"]).toBe("private, max-age=3600");
    const body = await downloadRes.body();
    expect(body.length).toBeGreaterThan(0);

    // Step 5: Error case — missing id -> 400
    const res400 = await page.request.get("/api/filing/form114a");
    expect(res400.status()).toBe(400);

    // Step 6: Error case — fake id -> 404
    const res404 = await page.request.get(
      "/api/filing/form114a?id=00000000-0000-0000-0000-000000000000"
    );
    expect(res404.status()).toBe(404);
  });
});
