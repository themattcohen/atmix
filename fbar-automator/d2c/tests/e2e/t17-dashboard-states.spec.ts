/**
 * T17: Dashboard Filing States
 *
 * Tests all dashboard states visible on /dashboard including empty state,
 * every FilingStatus badge + action button, BSA ID box, rejection reason,
 * calendar year display, and account count.
 *
 * Strategy:
 *   1. Create a single fresh user (serial mode, shared across tests).
 *   2. Progress through the wizard to create a filing with one account.
 *   3. Capture filingId via GET /api/filing.
 *   4. Use seedFilingStatus() to flip the filing into each status and
 *      reload /dashboard to assert the rendered output.
 *
 */

import { test, expect } from "@playwright/test";
import {
  signupTestUser,
  completeThreshold,
  completePersonalInfo,
  addForeignAccount,
  completeSigning,
  seedFilingStatus,
} from "./helpers/auth";

// ---------------------------------------------------------------------------
// Shared state — populated during the setup tests and reused for status tests
// ---------------------------------------------------------------------------
let sharedEmail: string;
let sharedPassword: string;
let sharedFilingId: string;

const BASE = "http://127.0.0.1:3001";

// ---------------------------------------------------------------------------
// Helper: fast API-level login (bypasses bcrypt; use after signupTestUser)
// ---------------------------------------------------------------------------
async function apiLogin(page: import("@playwright/test").Page, email: string, password: string) {
  const context = page.context();

  const csrfResp = await context.request.get(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfResp.json();

  await context.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { email, password, csrfToken, json: "true" },
    maxRedirects: 0,
  });

  // Mirror the session-token cookie from 127.0.0.1 → localhost so
  // page navigations on localhost:3001 see the authenticated session.
  const cookies = await context.cookies([BASE, "http://localhost:3001"]);
  const sc = cookies.find((c) => c.name.includes("session-token"));
  if (sc?.domain === "127.0.0.1") {
    await context.addCookies([{ ...sc, domain: "localhost" }]);
  }
}

// ---------------------------------------------------------------------------
// Helper: navigate to /dashboard and wait for it to finish loading
// ---------------------------------------------------------------------------
async function gotoDashboard(page: import("@playwright/test").Page) {
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  // The dashboard has a client-side fetch; wait until the spinner is gone
  await page.waitForSelector('[class*="animate-spin"]', { state: "detached", timeout: 20000 }).catch(() => {
    // Spinner may never appear if data loads instantly — ignore
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
test.describe("T17: Dashboard Filing States", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90000);

  // ── Test 1 ─────────────────────────────────────────────────────────────────
  test('01: Empty state — shows "No Filings Yet" with a start link', async ({ page }) => {
    sharedPassword = "TestPassword123!";
    sharedEmail = await signupTestUser(page);

    // signupTestUser redirects to /threshold; navigate to dashboard before
    // any filing is created.
    await page.goto("/dashboard", { waitUntil: "networkidle" });

    await expect(page.locator("text=No Filings Yet")).toBeVisible({ timeout: 15000 });

    // There should be a link pointing to /threshold (start a filing)
    const startLink = page.locator('a[href="/threshold"]').first();
    await expect(startLink).toBeVisible();
  });

  // ── Test 2 ─────────────────────────────────────────────────────────────────
  test('02: "Start New Filing" link navigates to /threshold', async ({ page }) => {
    await apiLogin(page, sharedEmail, sharedPassword);
    await gotoDashboard(page);

    // Both the header button and the empty-state link go to /threshold
    const startLink = page.locator('a[href="/threshold"]').first();
    await expect(startLink).toBeVisible({ timeout: 10000 });
    await startLink.click();

    await page.waitForURL("**/threshold", { timeout: 15000 });
    await expect(page).toHaveURL(/\/threshold/);
  });

  // ── Test 3 ─────────────────────────────────────────────────────────────────
  test("03: IN_PROGRESS (no accounts) — badge shows In Progress; Resume goes to /personal", async ({
    page,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);

    // Complete threshold — this creates the IN_PROGRESS filing and lands on /personal
    await page.goto("/threshold", { waitUntil: "networkidle" });
    await completeThreshold(page);

    // Now on /personal; navigate to dashboard without completing personal info
    await gotoDashboard(page);

    // Status badge
    await expect(page.locator("text=In Progress")).toBeVisible({ timeout: 15000 });

    // Action button should direct to /personal because accountCount === 0
    const resumeLink = page.locator('a[href="/personal"]');
    await expect(resumeLink).toBeVisible({ timeout: 10000 });
    await expect(resumeLink).toContainText("Resume Filing");
  });

  // ── Test 4 ─────────────────────────────────────────────────────────────────
  test("04: IN_PROGRESS (with accounts) — badge still In Progress; Resume goes to /review", async ({
    page,
    request,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);

    // Complete personal info → /accounts
    await page.goto("/personal", { waitUntil: "networkidle" });
    await completePersonalInfo(page);

    // Select BASIC tier (tier selection screen appears on first /accounts visit)
    const tierBtn = page.locator("button:has-text('Enter accounts manually')");
    try {
      await tierBtn.waitFor({ state: "visible", timeout: 10000 });
      await tierBtn.click();
      // Wait for tier selection to dismiss and Add Account button to appear
      await page.locator("button:has-text('Add Foreign Account')").waitFor({ state: "visible", timeout: 15000 });
    } catch {
      // Tier screen not shown — already selected
    }

    // Add a foreign account
    await addForeignAccount(page, "Dashboard Test Bank AG");

    // Reload dashboard
    await gotoDashboard(page);

    await expect(page.locator("text=In Progress")).toBeVisible({ timeout: 15000 });

    // With at least 1 account the action link goes to /review
    const resumeLink = page.locator('a[href="/review"]');
    await expect(resumeLink).toBeVisible({ timeout: 10000 });
    await expect(resumeLink).toContainText("Resume Filing");

    // Capture filing ID for subsequent tests
    const filingResp = await request.get(`${BASE}/api/filing`, {
      headers: { Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") },
    });
    expect(filingResp.ok()).toBeTruthy();
    const filingBody = await filingResp.json();
    expect(filingBody.data.length).toBeGreaterThan(0);
    sharedFilingId = filingBody.data[0].id;
    expect(sharedFilingId).toBeTruthy();
  });

  // ── Test 5 ─────────────────────────────────────────────────────────────────
  test("05: REVIEWED — badge Ready to Sign; action goes to /sign", async ({
    page,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "REVIEWED");
    await gotoDashboard(page);

    await expect(page.locator("text=Ready to Sign")).toBeVisible({ timeout: 15000 });
    const signLink = page.locator('a[href="/sign"]');
    await expect(signLink).toBeVisible();
    await expect(signLink).toContainText("Review & Sign");
  });

  // ── Test 6 ─────────────────────────────────────────────────────────────────
  test("06: SIGNED — badge Signed; action Complete Payment goes to /payment", async ({
    page,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);

    // Walk the wizard to /sign: go through review → sign
    await page.goto("/review", { waitUntil: "networkidle" });

    // Click through to sign page
    const continueBtn = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueBtn.first()).toBeVisible({ timeout: 15000 });
    await continueBtn.first().click();
    await page.waitForURL("**/sign", { timeout: 30000 });

    // Complete signing — redirects to /payment
    await completeSigning(page, "Test", "User");
    await expect(page).toHaveURL(/\/payment/);

    // Now check dashboard for SIGNED badge
    await gotoDashboard(page);

    await expect(page.getByText("Signed", { exact: true })).toBeVisible({ timeout: 15000 });

    const payLink = page.locator('a[href="/payment"]');
    await expect(payLink).toBeVisible({ timeout: 10000 });
    await expect(payLink).toContainText("Complete Payment");
  });

  // ── Test 7 ─────────────────────────────────────────────────────────────────
  test("07: PAID — badge Processing; action View Confirmation goes to /confirmation", async ({
    page,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "PAID");
    await gotoDashboard(page);

    await expect(page.locator("text=Processing")).toBeVisible({ timeout: 15000 });

    const confirmLink = page.locator('a[href="/confirmation"]').first();
    await expect(confirmLink).toBeVisible({ timeout: 10000 });
    await expect(confirmLink).toContainText("View Confirmation");
  });

  // ── Test 8 ─────────────────────────────────────────────────────────────────
  test("08: SUBMITTED — badge Submitted; action View Status goes to /confirmation", async ({
    page,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "SUBMITTED", {
      submittedAt: new Date().toISOString(),
    });
    await gotoDashboard(page);

    await expect(page.getByText("Submitted", { exact: true })).toBeVisible({ timeout: 15000 });

    const statusLink = page.locator('a[href="/confirmation"]').first();
    await expect(statusLink).toBeVisible({ timeout: 10000 });
    await expect(statusLink).toContainText("View Status");
  });

  // ── Test 9 ─────────────────────────────────────────────────────────────────
  test("09: ACCEPTED — badge Filed in green; BSA tracking ID displayed", async ({
    page,
  }) => {
    const testBsaId = "T-FBX26-99999999";

    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "ACCEPTED", {
      bsaId: testBsaId,
      submittedAt: new Date().toISOString(),
    });
    await gotoDashboard(page);

    // Badge: "Filed" (green variant)
    const badge = page.locator("text=Filed");
    await expect(badge).toBeVisible({ timeout: 15000 });

    // The badge should carry green styling
    const badgeEl = page.locator('span:has-text("Filed")').first();
    const badgeClass = await badgeEl.getAttribute("class");
    expect(badgeClass).toMatch(/green/);

    // BSA Tracking ID box
    await expect(page.locator("text=BSA Tracking ID")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${testBsaId}`)).toBeVisible({ timeout: 10000 });

    // Green box wrapping BSA ID
    const bsaBox = page.locator(".bg-green-50").first();
    await expect(bsaBox).toBeVisible();

    // Action: View Confirmation
    const confirmLink = page.locator('a[href="/confirmation"]').first();
    await expect(confirmLink).toContainText("View Confirmation");
  });

  // ── Test 10 ────────────────────────────────────────────────────────────────
  test("10: REJECTED — badge Needs Attention in red; rejection reason displayed", async ({
    page,
  }) => {
    const reason = "Duplicate filing detected for calendar year 2024";

    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "REJECTED", {
      rejectionReason: reason,
    });
    await gotoDashboard(page);

    // Badge: "Needs Attention"
    const badge = page.locator("text=Needs Attention");
    await expect(badge).toBeVisible({ timeout: 15000 });

    // Badge should carry red styling
    const badgeEl = page.locator('span:has-text("Needs Attention")').first();
    const badgeClass = await badgeEl.getAttribute("class");
    expect(badgeClass).toMatch(/red/);

    // Rejection reason box (red)
    await expect(page.locator("text=Rejection Reason")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${reason}`)).toBeVisible({ timeout: 10000 });

    const rejectionBox = page.locator(".bg-red-50").first();
    await expect(rejectionBox).toBeVisible();

    // Action: Action Required
    const actionLink = page.locator('a[href="/confirmation"]').first();
    await expect(actionLink).toContainText("Action Required");
  });

  // ── Test 11 ────────────────────────────────────────────────────────────────
  test("11: Filing card displays the calendar year", async ({
    page,
  }) => {
    // Reset to IN_PROGRESS so the card is in a stable, readable state
    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "IN_PROGRESS");
    await gotoDashboard(page);

    // The dashboard renders "Tax Year YYYY" for each filing card
    const currentYear = new Date().getFullYear();
    // The filing was created in the current year context; the threshold step
    // defaults to current year. Accept any 4-digit year on the card.
    const yearHeading = page.locator("h2").filter({ hasText: /Tax Year \d{4}/ }).first();
    await expect(yearHeading).toBeVisible({ timeout: 15000 });
  });

  // ── Test 12 ────────────────────────────────────────────────────────────────
  test("12: Filing card shows account count (1 account)", async ({
    page,
  }) => {
    await apiLogin(page, sharedEmail, sharedPassword);
    await seedFilingStatus(page.request, sharedFilingId, "IN_PROGRESS");
    await gotoDashboard(page);

    // The dashboard renders "N account" or "N accounts"
    const accountCount = page.locator("text=/\\d+ accounts?/").first();
    await expect(accountCount).toBeVisible({ timeout: 15000 });

    // We added exactly one account in test 4, so it should read "1 account"
    await expect(accountCount).toContainText("1 account");
  });
});
