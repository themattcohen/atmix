import { test, expect, Page } from "@playwright/test";
import { seedFilingStatus } from "./helpers/auth";

test.use({ baseURL: "http://localhost:3001" });

/**
 * T20: Confirmation page state machine tests
 *
 * Tests the /confirmation page across all possible states:
 *   loading → verifying_payment → paid → submitting → submitted → accepted → rejected → error
 *
 * Strategy:
 *   - Tests 1–3: Fresh user or no signed filing (no seedFilingStatus needed)
 *   - Tests 5–7: Create a user with a signed filing, fetch its ID, then seed different statuses
 *   - Test 4:    Skipped (SDTM submission is a stub)
 *   - Test 8:    Loading spinner (transient — tested with a short-timeout assertion)
 *
 * All tests are serial and share one browser page after setup.
 */

const TEST_PASSWORD = "TestPass123!";
const NAV_TIMEOUT = 90000;
const WAIT = 60000;

// ---------------------------------------------------------------------------
// Local helpers (same robust patterns as T-12, T-13, T-15)
// ---------------------------------------------------------------------------

async function robustSignup(
  page: Page,
  opts: { firstName: string; lastName: string; password: string }
): Promise<string> {
  const email = `t20-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  const response = await page.request.post("/api/auth/signup", {
    headers: { "X-Requested-With": "XMLHttpRequest" },
    data: {
      firstName: opts.firstName,
      lastName: opts.lastName,
      email,
      password: opts.password,
      confirmPassword: opts.password,
    },
  });
  if (response.status() !== 201) {
    throw new Error(
      `Signup API failed: ${response.status()} ${await response.text()}`
    );
  }

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

async function doThreshold(page: Page) {
  if (!page.url().includes("/threshold")) {
    await page.goto("/threshold", {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT,
    });
  }
  await expect(page.locator("h1")).toContainText("Do You Need to File", {
    timeout: NAV_TIMEOUT,
  });
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1500);
  await firstYes.click();
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

async function doPersonalInfo(page: Page) {
  await page.waitForLoadState("networkidle", {
    timeout: NAV_TIMEOUT,
  } as never);
  await expect(page.locator("h1")).toContainText("Personal Information", {
    timeout: NAV_TIMEOUT,
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
  await page.waitForURL("**/accounts", { timeout: NAV_TIMEOUT });
}

async function doAddAccount(page: Page, bankName = "Test Bank AG") {
  const tierButton = page.locator("button:has-text('Enter accounts manually')");
  const addButton = page.locator("button:has-text('Add Foreign Account')");
  try {
    await tierButton.waitFor({ state: "visible", timeout: 10000 });
    await tierButton.click();
    await addButton.waitFor({ state: "visible", timeout: 15000 });
  } catch {
    // Tier selector not shown — user already chose a tier
  }
  await addButton.click();
  await page
    .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
    .fill(bankName);
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
  await expect(page.locator(`text=${bankName}`)).toBeVisible({
    timeout: NAV_TIMEOUT,
  });
}

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

/**
 * Fetch the ID of the most recent filing for the authenticated user.
 * Uses page.request so session cookies are included automatically.
 */
async function getFilingId(page: Page): Promise<string> {
  const res = await page.request.get("/api/filing");
  expect(res.status()).toBe(200);
  const body = await res.json();
  // /api/filing returns { data: [...] }
  const filings: Array<{ id: string; status: string }> = body.data ?? body;
  expect(Array.isArray(filings)).toBe(true);
  expect(filings.length).toBeGreaterThan(0);
  return filings[0].id;
}

// ===========================================================================
// SERIAL TEST GROUP 1: Error and payment-verification states
// These tests do NOT require a signed filing.
// ===========================================================================
test.describe.serial("T20-A: Confirmation error + payment-verification states", () => {
  test.setTimeout(600000); // 10 minutes for the group

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------------
  // Test 1: Fresh user with no filing — expect error state
  // -------------------------------------------------------------------------
  test("T20-1: no filing — error state with 'Try Again' and 'Go to Dashboard' visible", async () => {
    // Sign up a brand-new user. They have no filing yet.
    await robustSignup(page, {
      firstName: "Conf",
      lastName: "Error",
      password: TEST_PASSWORD,
    });

    // Navigate directly to /confirmation (no session_id, no filing)
    await page.goto("/confirmation");
    await page.waitForLoadState("domcontentloaded");

    // The page fetches /api/filing which returns [] for a new user.
    // loadFiling() returns null → setStatus("error") with "No filing found..."
    // Allow extra time for the fetch + React render.
    const errorHeading = page.locator("h1:has-text('Something Went Wrong')");
    await expect(errorHeading).toBeVisible({ timeout: 20000 });

    // Both action buttons must be present
    const tryAgainBtn = page.locator("button:has-text('Try Again')");
    await expect(tryAgainBtn).toBeVisible({ timeout: WAIT });

    const dashboardLink = page.locator("a:has-text('Go to Dashboard')");
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });

  // -------------------------------------------------------------------------
  // Test 2: Fake session_id — page shows "Verifying Payment" immediately
  // -------------------------------------------------------------------------
  test("T20-2: fake session_id — 'Verifying Payment' state visible", async () => {
    // Reuse the same logged-in user from T20-1 (still no filing).
    // Navigate with a fake Stripe session_id.
    await page.goto("/confirmation?session_id=fake_session_id_t20");
    await page.waitForLoadState("domcontentloaded");

    // The page sets status = "verifying_payment" immediately on mount
    // because sessionId is truthy, before any fetch resolves.
    const verifyHeading = page.locator("h1:has-text('Verifying Payment')");
    await expect(verifyHeading).toBeVisible({ timeout: 20000 });

    // Spinner should also be visible
    const spinner = page.locator(".animate-spin").first();
    await expect(spinner).toBeVisible({ timeout: WAIT });
  });

  // -------------------------------------------------------------------------
  // Test 3: Wait for the 30-second polling timeout on a fake session_id
  // -------------------------------------------------------------------------
  test("T20-3: fake session_id — after 30s polling timeout, error state + dashboard link", async () => {
    test.slow(); // Increases the individual test timeout by 3× (from 600s group timeout)

    // Navigate with a fake session_id — kicks off 15 × 2s polling loop.
    await page.goto("/confirmation?session_id=fake_session_id_t20_timeout");
    await page.waitForLoadState("domcontentloaded");

    // Verifying payment should appear first
    const verifyHeading = page.locator("h1:has-text('Verifying Payment')");
    await expect(verifyHeading).toBeVisible({ timeout: 20000 });

    // After 30 seconds all polling attempts will have exhausted (15 × 2s = 30s).
    // The page then calls loadFiling() which also returns null for this user
    // (no filing exists), so it falls through to the error state.
    const errorHeading = page.locator("h1:has-text('Something Went Wrong')");
    await expect(errorHeading).toBeVisible({ timeout: 60000 }); // Up to 60s total

    // Dashboard link must be visible in the error state
    const dashboardLink = page.locator("a:has-text('Go to Dashboard')");
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });
});

// ===========================================================================
// SERIAL TEST GROUP 2: Status-seeded states (SUBMITTED, ACCEPTED, REJECTED)
// These tests create one user with a signed filing, then seed different statuses.
// ===========================================================================
test.describe.serial("T20-B: Seeded filing statuses (submitted, accepted, rejected)", () => {
  test.setTimeout(600000); // 10 minutes for the group

  let page: Page;
  let filingId: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------------
  // Setup: create a user and complete the full wizard through signing
  // -------------------------------------------------------------------------
  test("setup: signup and complete wizard through signing to get a SIGNED filing", async () => {
    await robustSignup(page, {
      firstName: "Test",
      lastName: "User",
      password: TEST_PASSWORD,
    });

    // Complete the full wizard: threshold → personal → accounts → review → sign
    await doThreshold(page);
    await doPersonalInfo(page);
    await doAddAccount(page, "Confirmation Test Bank");
    await doSign(page);

    // We should now be on /payment — filing is in SIGNED status
    await expect(page).toHaveURL(/\/payment/, { timeout: WAIT });

    // Fetch the filing ID for later use in seedFilingStatus
    filingId = await getFilingId(page);
    expect(filingId).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Test 4: PAID → SDTM auto-submit — SKIPPED (stub)
  // -------------------------------------------------------------------------
  test.skip("T20-4: PAID → auto-submit (SDTM submission is a stub)", async () => {
    // IMPLEMENTATION NEEDED: P4-3 — /api/sdtm/submit is a stub that does not
    // actually submit to FinCEN. Until real SDTM submission is wired up, this
    // transition cannot be tested end-to-end.
  });

  // -------------------------------------------------------------------------
  // Test 5: SUBMITTED status — heading, filing ID, and date visible
  // -------------------------------------------------------------------------
  test("T20-5: SUBMITTED — heading + filing ID + submission date visible", async () => {
    const submittedAt = new Date().toISOString();

    await seedFilingStatus(page.request, filingId, "SUBMITTED", { submittedAt });

    await page.goto("/confirmation");
    await page.waitForLoadState("domcontentloaded");

    // The page fetches /api/filing, sees status SUBMITTED, and renders:
    //   h1 "FBAR Submitted to FinCEN" + a details block with Filing ID + Submitted date
    const heading = page.locator("h1:has-text('FBAR Submitted to FinCEN')");
    await expect(heading).toBeVisible({ timeout: 20000 });

    // Filing ID (UUID) should appear in the details block
    const filingIdText = page.locator(`text=${filingId}`);
    await expect(filingIdText).toBeVisible({ timeout: WAIT });

    // Submission date should be formatted and visible
    const submittedDate = page.locator("text=Submitted:");
    await expect(submittedDate).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // Test 6: ACCEPTED status — BSA tracking ID + download link visible
  // -------------------------------------------------------------------------
  test("T20-6: ACCEPTED — BSA tracking ID in green box + download link (if form114aUrl set)", async () => {
    const bsaId = "T-FBX26-00000051";

    await seedFilingStatus(page.request, filingId, "ACCEPTED", { bsaId });

    await page.goto("/confirmation");
    await page.waitForLoadState("domcontentloaded");

    // Accepted heading
    const heading = page.locator(
      "h1:has-text('Your FBAR Has Been Filed Successfully')"
    );
    await expect(heading).toBeVisible({ timeout: 20000 });

    // BSA tracking ID displayed in large green box
    const bsaIdText = page.locator(`text=${bsaId}`);
    await expect(bsaIdText).toBeVisible({ timeout: WAIT });

    // The green box container: bg-green-50 border-green-500
    const greenBox = page.locator(".bg-green-50.border-green-500");
    await expect(greenBox).toBeVisible();

    // Download link for Form 114a is rendered only when filing.form114aUrl is set.
    // The seed-status API does not set form114aUrl, so we check for either the
    // download link (if the sign step generated one) OR skip that assertion.
    // We always verify the filing ID appears in the details block.
    const filingIdText = page.locator(`text=${filingId}`);
    await expect(filingIdText).toBeVisible();

    // If a download link exists, verify it points to the form114a endpoint
    const downloadLink = page.locator(
      'a:has-text("Download Form 114a")'
    );
    const downloadCount = await downloadLink.count();
    if (downloadCount > 0) {
      await expect(downloadLink.first()).toHaveAttribute(
        "href",
        new RegExp(`/api/filing/form114a\\?id=${filingId}`)
      );
    }
  });

  // -------------------------------------------------------------------------
  // Test 7: REJECTED status — rejection reason in red box
  // -------------------------------------------------------------------------
  test("T20-7: REJECTED — rejection reason in red box (role=alert or red styling)", async () => {
    const rejectionReason =
      "Invalid account number format for account at row 3.";

    await seedFilingStatus(page.request, filingId, "REJECTED", { rejectionReason });

    await page.goto("/confirmation");
    await page.waitForLoadState("domcontentloaded");

    // Rejected heading
    const heading = page.locator(
      "h1:has-text('Submission Needs Attention')"
    );
    await expect(heading).toBeVisible({ timeout: 20000 });

    // Rejection reason text visible
    const rejectionText = page.locator(`text=${rejectionReason}`);
    await expect(rejectionText).toBeVisible({ timeout: WAIT });

    // Red box container: bg-red-50 border-red-200
    const redBox = page.locator(".bg-red-50.border-red-200");
    await expect(redBox).toBeVisible();

    // "Rejection Reason:" label
    const rejectionLabel = page.locator("text=Rejection Reason:");
    await expect(rejectionLabel).toBeVisible();

    // Dashboard link available so user can take action
    const dashboardLink = page.locator("a:has-text('Go to Dashboard')");
    await expect(dashboardLink).toBeVisible();
    await expect(dashboardLink).toHaveAttribute("href", "/dashboard");
  });
});

// ===========================================================================
// SERIAL TEST GROUP 3: Transient loading state
// ===========================================================================
test.describe.serial("T20-C: Transient loading state on initial mount", () => {
  test.setTimeout(120000); // 2 minutes — loading resolves quickly

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  // -------------------------------------------------------------------------
  // Test 8: Loading state — spinner visible on initial navigation
  // -------------------------------------------------------------------------
  test("T20-8: loading state — spinner or loading text visible on initial mount", async () => {
    // Sign up a fresh user for a clean slate
    await robustSignup(page, {
      firstName: "Load",
      lastName: "Test",
      password: TEST_PASSWORD,
    });

    // Intercept the /api/filing call and delay it so the loading state
    // is held long enough to assert. We do this before navigating.
    await page.route("/api/filing", async (route) => {
      // Delay the response by 2 seconds to keep loading state visible
      await page.waitForTimeout(2000);
      await route.continue();
    });

    // Navigate — the page starts in "loading" status immediately
    const gotoPromise = page.goto("/confirmation");

    // Assert the loading spinner (or Suspense fallback spinner) is visible
    // before the API response resolves.
    const loadingSpinner = page.locator(".animate-spin").first();
    await expect(loadingSpinner).toBeVisible({ timeout: 5000 });

    // Wait for the goto to complete so cleanup is tidy
    await gotoPromise;

    // Remove the route intercept so subsequent tests are not affected
    await page.unroute("/api/filing");

    // After the delay resolves, the page should move out of loading.
    // With no filing, it ends up in error state — verify we're not stuck.
    const stillLoading = page.locator("text=Loading your filing status...");
    // Give 10s; it should disappear as the fetch completes
    await expect(stillLoading).toBeHidden({ timeout: 10000 });
  });
});
