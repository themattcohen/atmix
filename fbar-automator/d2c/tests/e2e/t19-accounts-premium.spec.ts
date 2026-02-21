import { test, expect, type Page } from "@playwright/test";
import {
  signupTestUser,
  completeThreshold,
  completePersonalInfo,
} from "./helpers/auth";

/**
 * T19 — Accounts page: Premium tier and statement upload UI.
 *
 * Tests the tier selection screen, BASIC vs PREMIUM flows, the StatementUpload
 * component's file-input behaviour, and manual account entry alongside upload.
 *
 * Two users are created in beforeAll so tier-selection state is predictable:
 *   userA → selects BASIC (tests 1–2, 10a)
 *   userB → selects PREMIUM (tests 3–5, 9, 10b)
 *
 * Tests 6–8 are skipped because they require the S3 + AI extraction pipeline.
 */

test.use({ baseURL: "http://localhost:3001" });
test.describe.configure({ mode: "serial" });

// ── Shared state populated in beforeAll ──────────────────────────────────────

let emailA = "";
let emailB = "";
const PASSWORD = "TestPassword123!";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Sign up a fresh user and walk through threshold + personal info so the
 * browser lands on /accounts ready for tier selection.
 */
async function createUserAtAccounts(page: Page): Promise<string> {
  const email = await signupTestUser(page);
  await completeThreshold(page);
  // Wait for the personal info page to fully load and for any API prefill
  // requests to settle before filling form fields.  Without this the form
  // fields can still be empty/disabled when completePersonalInfo() tries to
  // interact with them, causing a navigation timeout.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000);
  await completePersonalInfo(page);
  await page.waitForURL("**/accounts", { timeout: 20_000 });
  return email;
}

/**
 * Log in an existing user and navigate to /accounts.
 * Uses the NextAuth credentials callback directly to avoid bcrypt slowdown.
 */
async function loginAndGoToAccounts(page: Page, email: string): Promise<void> {
  const context = page.context();
  const baseURL = "http://127.0.0.1:3001";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const csrfResp = await context.request.get(`${baseURL}/api/auth/csrf`);
      const { csrfToken } = await csrfResp.json();

      await context.request.post(
        `${baseURL}/api/auth/callback/credentials`,
        {
          form: { email, password: PASSWORD, csrfToken, json: "true" },
          maxRedirects: 0,
        }
      );

      const cookies = await context.cookies([baseURL, "http://localhost:3001"]);
      const sessionCookie = cookies.find((c) => c.name.includes("session-token"));
      if (!sessionCookie) {
        throw new Error(`No session cookie on attempt ${attempt}`);
      }

      if (sessionCookie.domain === "127.0.0.1") {
        await context.addCookies([{ ...sessionCookie, domain: "localhost" }]);
      }
      break;
    } catch (err) {
      if (attempt === 3) throw new Error(`Login failed after 3 attempts: ${err}`);
      await page.waitForTimeout(5_000);
    }
  }

  await page.goto("/accounts", { waitUntil: "networkidle", timeout: 60_000 });
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe("T19 — Accounts page: premium tier and statement upload UI", () => {
  test.setTimeout(90_000);

  // Create both users before any test runs so every test in the suite can
  // reuse them without re-running signup/threshold/personal.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120000);
    // User A — will choose BASIC
    const pageA = await browser.newPage();
    emailA = await createUserAtAccounts(pageA);
    await pageA.close();

    // User B — will choose PREMIUM
    const pageB = await browser.newPage();
    emailB = await createUserAtAccounts(pageB);
    await pageB.close();
  });

  // ── Test 1 ─────────────────────────────────────────────────────────────────

  test("1 — tier selection screen renders for new user", async ({ page }) => {
    // User A has not selected a tier yet; logging in and navigating to /accounts
    // should show the tier selector.
    await loginAndGoToAccounts(page, emailA);

    // Heading
    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).toBeVisible({ timeout: 20_000 });

    // BASIC option — price + CTA
    await expect(page.locator("text=$59")).toBeVisible();
    await expect(
      page.locator("button:has-text('Enter accounts manually')")
    ).toBeVisible();

    // PREMIUM option — price + CTA
    await expect(page.locator("text=$79")).toBeVisible();
    await expect(
      page.locator("button:has-text('Upload statements')")
    ).toBeVisible();

    // The "Recommended" badge on the premium card
    await expect(page.locator("text=Recommended")).toBeVisible();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────

  test("2 — BASIC tier dismisses tier screen and shows Add Account button", async ({
    page,
  }) => {
    await loginAndGoToAccounts(page, emailA);

    // Tier screen must be present before clicking
    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).toBeVisible({ timeout: 20_000 });

    // Click BASIC
    await page.locator("button:has-text('Enter accounts manually')").click();

    // Wait for the PATCH /api/filing/tier request to resolve
    await page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/filing/tier") &&
        resp.request().method() === "PATCH",
      { timeout: 15_000 }
    ).catch(() => {
      // Non-critical: tier PATCH is best-effort in the app
    });

    // Tier selector should be gone
    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).not.toBeVisible({ timeout: 15_000 });

    // Main accounts heading and Add button should appear
    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.locator("button:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────

  test("3 — PREMIUM tier shows StatementUpload area and Add Account button", async ({
    page,
  }) => {
    // User B hasn't selected a tier yet.
    await loginAndGoToAccounts(page, emailB);

    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).toBeVisible({ timeout: 20_000 });

    // Click PREMIUM
    await page.locator("button:has-text('Upload statements')").click();

    await page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/filing/tier") &&
        resp.request().method() === "PATCH",
      { timeout: 15_000 }
    ).catch(() => {});

    // Tier selector gone
    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).not.toBeVisible({ timeout: 15_000 });

    // Foreign Accounts heading present
    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 15_000 });

    // StatementUpload component — the upload area (role="button") should be visible
    await expect(
      page.locator('[aria-label="Upload bank statement"]')
    ).toBeVisible({ timeout: 10_000 });

    // Manual entry is still available alongside upload
    await expect(
      page.locator("button:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────

  test("4 — file input accept attribute includes PDF, CSV, and Excel", async ({
    page,
  }) => {
    // User B already chose PREMIUM — go straight to accounts
    await loginAndGoToAccounts(page, emailB);

    // Wait for the upload area to confirm we are in premium mode
    await expect(
      page.locator('[aria-label="Upload bank statement"]')
    ).toBeVisible({ timeout: 20_000 });

    // The hidden <input type="file"> is rendered inside StatementUpload
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached({ timeout: 10_000 });

    const accept = await fileInput.getAttribute("accept");
    expect(accept).toBeTruthy();

    // Must accept PDF
    expect(accept).toMatch(/\.pdf/i);

    // Must accept CSV
    expect(accept).toMatch(/\.csv/i);

    // Must accept Excel
    expect(accept).toMatch(/\.xlsx/i);
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────

  test("5 — unsupported file type triggers an error message", async ({
    page,
  }) => {
    await loginAndGoToAccounts(page, emailB);

    await expect(
      page.locator('[aria-label="Upload bank statement"]')
    ).toBeVisible({ timeout: 20_000 });

    // The file input is hidden (aria-hidden). We interact with it directly
    // via setInputFiles so we bypass OS file-picker restrictions.
    const fileInput = page.locator('input[type="file"]');

    // Upload a plain text buffer — MIME type not in ACCEPTED_TYPES and
    // extension does not match the accepted-extensions regex.
    await fileInput.setInputFiles({
      name: "not-a-statement.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("this is plain text"),
    });

    // StatementUpload calls onError() which sets the page-level error state,
    // rendered as a red alert with the unsupported-type message.
    // Exclude Next.js's #__next-route-announcer__ which also carries role="alert".
    const errorAlert = page
      .locator('[role="alert"]:not(#__next-route-announcer__)')
      .filter({ hasText: /unsupported file type/i });

    await expect(errorAlert).toBeVisible({ timeout: 10_000 });

    await expect(errorAlert).toContainText(/unsupported file type/i, {
      timeout: 10_000,
    });
  });

  // ── Tests 6–8 (skipped — require S3 + AI extraction pipeline) ─────────────

  test("6 — upload triggers extraction and shows review screen", async ({
    page: _page,
  }) => {
    test.skip(true, "Requires S3 + AI extraction pipeline (not available in CI)");
  });

  test("7 — accepting extracted accounts saves them to the account list", async ({
    page: _page,
  }) => {
    test.skip(true, "Requires S3 + AI extraction pipeline (not available in CI)");
  });

  test("8 — rejecting extracted accounts returns to the upload area", async ({
    page: _page,
  }) => {
    test.skip(true, "Requires S3 + AI extraction pipeline (not available in CI)");
  });

  // ── Test 9 ─────────────────────────────────────────────────────────────────

  test("9 — can add accounts manually while in PREMIUM tier", async ({
    page,
  }) => {
    await loginAndGoToAccounts(page, emailB);

    // Confirm we are in the accounts management view (tier already selected)
    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 20_000 });

    // StatementUpload is present (confirms premium mode)
    await expect(
      page.locator('[aria-label="Upload bank statement"]')
    ).toBeVisible({ timeout: 10_000 });

    // Click manual add
    await page.locator("button:has-text('Add Foreign Account')").click();

    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10_000 });

    // Fill the add-account form
    const bankName = `PremiumTestBank-${Date.now()}`;
    await page.locator("#new-account-institutionName").fill(bankName);
    await page.locator("#new-account-accountNumber").fill("CH9876543210");
    await page.locator("#new-account-countryCode").selectOption({ index: 1 });
    await page.locator("#new-account-currencyCode").selectOption({ index: 1 });
    await page.locator("#new-account-maxValueLocal").fill("12000");

    // Save and wait for POST /api/accounts
    const saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20_000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    const response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    // Account card should appear
    await expect(page.locator(`text=${bankName}`)).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── Test 10 ────────────────────────────────────────────────────────────────

  test("10 — selected tier is persisted after page reload", async ({
    page,
  }) => {
    // Use User B (PREMIUM). Reload /accounts and confirm tier selector is NOT shown.
    await loginAndGoToAccounts(page, emailB);

    // Confirm we land directly on the accounts management view
    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 20_000 });

    // Tier selection heading must NOT appear
    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).not.toBeVisible();

    // PREMIUM-specific UI (upload area) must be present — confirms tier persisted
    await expect(
      page.locator('[aria-label="Upload bank statement"]')
    ).toBeVisible({ timeout: 10_000 });

    // Reload the page
    await page.reload({ waitUntil: "networkidle", timeout: 60_000 });

    // After reload: still no tier selector
    await expect(
      page.locator("h1:has-text('Choose Your Filing Method')")
    ).not.toBeVisible({ timeout: 15_000 });

    // Still in PREMIUM mode — upload area remains
    await expect(
      page.locator('[aria-label="Upload bank statement"]')
    ).toBeVisible({ timeout: 15_000 });
  });
});
