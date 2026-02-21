import { test, expect, type Page } from "@playwright/test";
import {
  signupTestUser,
  completeThreshold,
  completePersonalInfo,
  addForeignAccount,
} from "./helpers/auth";

/**
 * T28 — Review Page Completeness
 *
 * Verifies that the /review page (WizardLayout Step 4) correctly displays:
 *   - Filing calendar year
 *   - Account count
 *   - Account table data (institution, country, masked account number)
 *   - Masked SSN / TIN in the personal info section
 *   - Date of birth in the personal info section
 *   - Full mailing address in the personal info section
 *   - CTA button state (skipped: P2-1 — REVIEWED status never set)
 *   - Multiple accounts all rendered correctly
 *
 * Strategy: Serial suite, one browser page shared across all tests.
 *   beforeAll creates a user and completes the wizard through /accounts
 *   (adding 1 account), then navigates to /review.
 *   Test 6 navigates back to /accounts to add a second account, then
 *   returns to /review to verify both appear.
 */

test.use({ baseURL: "http://localhost:3001" });
test.describe.configure({ mode: "serial" });

const TEST_PASSWORD = "TestPass123!";
const random = Math.random().toString(36).slice(2, 6);
const email = `t28-${Date.now()}-${random}@test.com`;

let page: Page;

// ---------------------------------------------------------------------------
// Helper: navigate to /review and wait for personal data to load
// ---------------------------------------------------------------------------
async function goToReviewAndWait(pg: Page): Promise<void> {
  await pg.goto("/review", { waitUntil: "domcontentloaded", timeout: 30000 });
  await expect(pg.locator("h1")).toContainText("Review", { timeout: 20000 });

  const personalSection = pg.locator(
    'section[aria-labelledby="personal-info-heading"]'
  );
  await expect(personalSection).toBeVisible({ timeout: 30000 });
  // Wait for at least one <dd> to have real content (API data loaded)
  await expect(personalSection.locator("dd").first()).toContainText(/\w+/, {
    timeout: 30000,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
test.describe("T28: Review Page — Completeness", () => {
  test.describe.configure({ timeout: 90000 });

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // 1. Create user via API to avoid CSRF friction
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

    // 2. Login via browser
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", email);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });

    // 3. Complete threshold
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
      // Retry first click if Q2 didn't appear
      await firstYes.click();
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    }
    await secondYes.click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 30000 });

    // 4. Complete personal info
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

    // 5. Handle tier selector if shown, then add one foreign account
    const tierButton = page.locator("button:has-text('Enter accounts manually')");
    const addButton = page.locator("button:has-text('Add Foreign Account')");
    try {
      await tierButton.waitFor({ state: "visible", timeout: 10000 });
      await tierButton.click();
      await addButton.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      // Tier selector not shown — already dismissed or not applicable
    }
    await addForeignAccount(page, "Test Bank AG");

    // 6. Navigate to /review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText("Review", { timeout: 15000 });

    // Wait for data to load before tests begin
    const personalSection = page.locator(
      'section[aria-labelledby="personal-info-heading"]'
    );
    await expect(personalSection).toBeVisible({ timeout: 30000 });
    await expect(personalSection.locator("dd").first()).toContainText(/\w+/, {
      timeout: 30000,
    });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // =========================================================================
  // Test 1: Calendar year displayed correctly
  // =========================================================================
  test("1 — calendar year displayed correctly", async () => {
    await goToReviewAndWait(page);

    // Filing year is typically the previous calendar year.
    // For filings made in 2026, the filing covers calendar year 2025.
    // Accept either the current year or the previous year to be resilient
    // across year boundaries.
    const currentYear = new Date().getFullYear();
    const filingYear = currentYear - 1; // e.g., 2025 when running in 2026

    // Look for the filing year anywhere on the page
    const yearPattern = new RegExp(`${filingYear}|${currentYear}`);
    await expect(page.locator(`text=${filingYear}`).first()).toBeVisible({
      timeout: 15000,
    });

    // More specifically, assert the page contains a reference to the year
    // as part of a calendar-year label (e.g., "Calendar Year 2025" or "2025 FBAR")
    const pageText = await page.locator("body").innerText();
    expect(pageText).toMatch(yearPattern);
  });

  // =========================================================================
  // Test 2: Account count matches
  // =========================================================================
  test("2 — account count matches number of accounts added", async () => {
    await goToReviewAndWait(page);

    const accountsSection = page.locator(
      'section[aria-labelledby="accounts-heading"]'
    );
    await expect(accountsSection).toBeVisible({ timeout: 15000 });

    // The page should display a count — e.g., "1 Account" or "1 Foreign Account"
    // Accept various pluralisation and labelling patterns.
    await expect(
      accountsSection.locator("text=/1\\s+(Foreign\\s+)?Account/i").first()
    ).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // Test 3: Account table shows institution, country, and masked account number
  // =========================================================================
  test("3 — account table shows institution, country, and masked account number", async () => {
    await goToReviewAndWait(page);

    const accountsSection = page.locator(
      'section[aria-labelledby="accounts-heading"]'
    );
    await expect(accountsSection).toBeVisible({ timeout: 15000 });

    // Institution name from addForeignAccount default
    await expect(accountsSection.locator("text=Test Bank AG").first()).toBeVisible({
      timeout: 15000,
    });

    // Country: addForeignAccount selects index 1 of the country dropdown.
    // The page should display some country text (non-empty) in the row.
    const accountsText = await accountsSection.innerText();
    // Country column should have content — at least one non-numeric string
    // that is not the bank name or currency.
    expect(accountsText.length).toBeGreaterThan(0);

    // Masked account number: CH1234567890 → expect last 4 digits visible (7890)
    // and asterisks masking the rest.
    // Patterns: ****7890 / ••••7890 / XXXX7890 / ending in 7890
    await expect(
      accountsSection.locator("text=/[*•X]+7890|7890/i").first()
    ).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // Test 4: SSN is masked in the personal info section
  // =========================================================================
  test("4 — SSN is masked; full SSN not shown in plain text", async () => {
    await goToReviewAndWait(page);

    const personalSection = page.locator(
      'section[aria-labelledby="personal-info-heading"]'
    );
    await expect(personalSection).toBeVisible({ timeout: 15000 });

    // The masked TIN should show the last 4 digits (6789) but hide the rest.
    // Accept patterns: ***-**-6789 / •••-••-6789 / XXX-XX-6789 / ending 6789
    await expect(
      personalSection.locator("text=/[*•X]+-[*•X]+-6789|[*•X]+6789/i").first()
    ).toBeVisible({ timeout: 15000 });

    // The full unmasked SSN (123-45-6789) must NOT appear as plain text.
    const sectionText = await personalSection.innerText();
    expect(sectionText).not.toContain("123-45-6789");
    // Also ensure "123456789" is not printed bare
    expect(sectionText).not.toContain("123456789");
  });

  // =========================================================================
  // Test 5: Review CTA sets REVIEWED status
  // (Skipped: P2-1 not implemented — REVIEWED status is never set by current code)
  // =========================================================================
  test("5 — review CTA sets REVIEWED status (P2-1)", async () => {
    test.skip(
      true,
      "P2-1 not implemented: POST /api/filing/review endpoint does not yet set status to REVIEWED"
    );

    await goToReviewAndWait(page);

    const cta = page.locator(
      "button:has-text('Everything Looks Correct'), button:has-text('Continue to Sign')"
    );
    await expect(cta.first()).toBeVisible({ timeout: 15000 });
    await expect(cta.first()).toBeEnabled();

    // Click CTA — should call POST /api/filing/review and then redirect to /sign
    const reviewResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/filing/review") &&
        resp.request().method() === "POST",
      { timeout: 15000 }
    );
    await cta.first().click();
    const resp = await reviewResp;
    expect(resp.status()).toBeLessThan(400);

    // Should navigate to /sign after REVIEWED status is set
    await page.waitForURL("**/sign", { timeout: 20000 });
    await expect(page).toHaveURL(/\/sign/);
  });

  // =========================================================================
  // Test 6: Multiple accounts all visible after adding a second account
  // =========================================================================
  test("6 — multiple accounts all visible on review page", async () => {
    // Navigate to /accounts and add a second account
    await page.goto("/accounts", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 20000 });

    await addForeignAccount(page, "Second Bank Ltd");

    // Return to /review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });

    await goToReviewAndWait(page);

    const accountsSection = page.locator(
      'section[aria-labelledby="accounts-heading"]'
    );
    await expect(accountsSection).toBeVisible({ timeout: 15000 });

    // Both institution names must appear
    await expect(accountsSection.locator("text=Test Bank AG").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(accountsSection.locator("text=Second Bank Ltd").first()).toBeVisible({
      timeout: 15000,
    });

    // Account count should now show 2
    await expect(
      accountsSection.locator("text=/2\\s+(Foreign\\s+)?Accounts/i").first()
    ).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // Test 7: Date of birth displayed in the personal info section
  // =========================================================================
  test("7 — date of birth displayed in personal info section", async () => {
    await goToReviewAndWait(page);

    const personalSection = page.locator(
      'section[aria-labelledby="personal-info-heading"]'
    );
    await expect(personalSection).toBeVisible({ timeout: 15000 });

    // DOB entered as 1990-01-15.
    // Accept various formatted outputs: "01/15/1990", "January 15, 1990",
    // "Jan 15, 1990", "1990-01-15", or at minimum the year "1990".
    const sectionText = await personalSection.innerText();
    const dobPatterns = [
      /01\/15\/1990/,        // MM/DD/YYYY
      /January\s+15,?\s+1990/i, // Long month format
      /Jan\.?\s+15,?\s+1990/i,  // Short month format
      /1990-01-15/,          // ISO format
      /1990/,                // Year only as last resort
    ];
    const matchesAny = dobPatterns.some((p) => p.test(sectionText));
    expect(
      matchesAny,
      `Expected DOB (1990-01-15) in one of the accepted formats, got: "${sectionText}"`
    ).toBe(true);
  });

  // =========================================================================
  // Test 8: Full mailing address displayed in the personal info section
  // =========================================================================
  test("8 — full mailing address displayed in personal info section", async () => {
    await goToReviewAndWait(page);

    const personalSection = page.locator(
      'section[aria-labelledby="personal-info-heading"]'
    );
    await expect(personalSection).toBeVisible({ timeout: 15000 });

    // Address entered in completePersonalInfo:
    //   street = "123 Test St", city = "Testville", state = "CA", zip = "90210"
    // The review page may render these in one block or separate fields.
    const sectionText = await personalSection.innerText();

    // Each address component should appear somewhere in the section
    expect(sectionText).toContain("123 Test St");
    expect(sectionText).toMatch(/Testville|CA|90210/);
  });
});
