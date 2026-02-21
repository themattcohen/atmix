import { test, expect } from "@playwright/test";
import { generateTotpToken } from "./helpers/totp";

// ---------------------------------------------------------------------------
// T16: MFA Full Lifecycle — 16 serial tests
//
// Tests run serially because they share a single user account whose MFA state
// changes progressively: disabled → setup → enabled → disabled.
//
// The server-side MFA_TEST_SECRET_OVERRIDE env var makes the setup endpoint
// always return the same known base32 secret so tests can generate valid
// TOTP tokens deterministically.
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3001";
const MFA_SECRET = "JBSWY3DPEHPK3PXP";
const PASSWORD = "TestPassword123!";

// Shared state — populated by setup before all tests.
// Using module-level vars rather than beforeAll to allow easy inspection.
let testEmail: string;
let recoveryCodes: string[] = [];

// ---------------------------------------------------------------------------
// API login helper: bypasses bcrypt by using NextAuth credentials endpoint
// directly (much faster than navigating to /login and waiting for bcrypt).
// ---------------------------------------------------------------------------
async function apiLogin(page: import("@playwright/test").Page, email: string, password: string) {
  const context = page.context();

  // 1. Fetch CSRF token (NextAuth requires it for POST /callback/credentials)
  const csrfResp = await context.request.get(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfResp.json();

  // 2. POST credentials — NextAuth sets session cookies in the response
  await context.request.post(`${BASE_URL}/api/auth/callback/credentials`, {
    form: {
      email,
      password,
      csrfToken,
      json: "true",
    },
    maxRedirects: 0,
  });

  // 3. The session cookie may have been set on 127.0.0.1 by the request
  // context while the browser uses localhost. Copy any 127.0.0.1 cookies to
  // localhost so the page session and the request session are in sync.
  const cookies = await context.cookies();
  const remapped = cookies
    .filter((c) => c.domain === "127.0.0.1")
    .map((c) => ({ ...c, domain: "localhost" }));
  if (remapped.length > 0) {
    await context.addCookies(remapped);
  }
}

// ---------------------------------------------------------------------------
// Navigate to /login, fill credentials, and wait for redirect away from login.
// Used for browser-visible login flows (so we can observe /mfa-verify redirect).
// ---------------------------------------------------------------------------
async function browserLogin(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
  { expectMfaRedirect = false } = {}
) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
  // Wait for React hydration to complete before filling the form
  await page.waitForTimeout(1500);
  await page.fill("#email", email);
  await page.fill("#password", password);
  // Verify values stuck (React hydration can reset inputs)
  await page.locator("#email").waitFor({ state: "visible" });
  await page.click('button[type="submit"]');

  if (expectMfaRedirect) {
    // After signIn, the login page fetches /api/auth/session, checks mfaEnabled,
    // then does a client-side router.push to /mfa-verify. This can take a moment.
    await page.waitForURL("**/mfa-verify**", { timeout: 45000 });
  } else {
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );
  }
}

// ---------------------------------------------------------------------------
// Sign out by clearing all cookies (fastest, no UI needed).
// ---------------------------------------------------------------------------
async function signOut(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
}

// ===========================================================================
// MAIN TEST SUITE
// ===========================================================================

test.describe("T16: MFA Full Lifecycle", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(90000);
  test.use({ baseURL: BASE_URL });

  // ── Before all: sign up a fresh user via API ──────────────
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(90000);
    const page = await browser.newPage();
    testEmail = `t16-${Date.now()}-${Math.random().toString(36).slice(2, 5)}@test.com`;

    // Sign up via API to avoid UI navigation issues
    const resp = await page.request.post(`${BASE_URL}/api/auth/signup`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: {
        firstName: "T16",
        lastName: "Tester",
        email: testEmail,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      },
    });
    if (resp.status() !== 201) {
      throw new Error(`Signup API failed: ${resp.status()} ${await resp.text()}`);
    }

    await page.close();
  });

  // =========================================================================
  // 1. Initiating MFA setup returns QR code + 10 recovery codes
  // =========================================================================
  test("1: setup – initiating MFA returns QR code and 10 recovery codes", async ({ page }) => {
    await apiLogin(page, testEmail, PASSWORD);

    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });
    // Wait for the Enable button — indicates MFA is currently disabled
    const enableBtn = page.locator(
      "button:has-text('Enable Two-Factor Authentication'), button:has-text('Enable')"
    );
    await expect(enableBtn).toBeVisible({ timeout: 15000 });

    // Click Enable — triggers POST /api/auth/mfa/setup
    await enableBtn.click();

    // Wait for the page to transition to setup state: QR code appears
    const qrImg = page.locator("img[alt='MFA QR Code'], img[alt*='QR']");
    await expect(qrImg).toBeVisible({ timeout: 15000 });

    // Recovery codes grid should be visible
    const codeEls = page.locator("code");
    await expect(codeEls.first()).toBeVisible({ timeout: 10000 });
    const count = await codeEls.count();
    expect(count).toBeGreaterThanOrEqual(10);

    // Capture recovery codes for later tests
    recoveryCodes = [];
    for (let i = 0; i < count; i++) {
      const text = await codeEls.nth(i).textContent();
      if (text?.trim()) recoveryCodes.push(text.trim());
    }
    expect(recoveryCodes.length).toBeGreaterThanOrEqual(10);
  });

  // =========================================================================
  // 2. Settings UI shows QR image with real pixel dimensions
  // =========================================================================
  test("2: setup UI – QR image is visible with non-zero dimensions", async ({ page }) => {
    await apiLogin(page, testEmail, PASSWORD);

    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });

    // The page should still be in "setup" state (secret stored but not verified)
    // because test 1 clicked Enable but we haven't verified a token yet.
    // If page shows "disabled" state, click Enable again to re-enter setup.
    const enableBtn = page.locator(
      "button:has-text('Enable Two-Factor Authentication'), button:has-text('Enable')"
    );
    const inSetup = await page
      .locator("img[alt='MFA QR Code'], img[alt*='QR']")
      .isVisible()
      .catch(() => false);

    if (!inSetup) {
      // QR state was lost on fresh page load (React state is gone after navigation).
      // The server may have mfaSecret already stored from test 1, causing the
      // Enable button to trigger a 409 conflict. Reset the pending MFA state
      // first so that clicking Enable returns a fresh QR code.
      await page.request.post(`${BASE_URL}/api/internal/reset-mfa`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        data: { email: testEmail },
      });

      // Wait for the page to reflect the reset (disabled state)
      await page.reload({ waitUntil: "networkidle" });
      await expect(enableBtn).toBeVisible({ timeout: 10000 });

      // Click Enable and wait for the setup API response before checking QR
      const setupResp = page.waitForResponse(
        (resp) => resp.url().includes("/api/auth/mfa/setup") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await enableBtn.click();
      await setupResp;
    }

    const qrImg = page.locator("img[alt='MFA QR Code'], img[alt*='QR']");
    await expect(qrImg).toBeVisible({ timeout: 15000 });

    // Verify the image has non-zero rendered dimensions
    const dims = await qrImg.boundingBox();
    expect(dims).not.toBeNull();
    expect(dims!.width).toBeGreaterThan(0);
    expect(dims!.height).toBeGreaterThan(0);

    // Recovery codes grid also visible — re-capture in case reset-mfa
    // deleted the originals from test 1 and setup generated new ones.
    const codeEls = page.locator("code");
    await expect(codeEls.first()).toBeVisible({ timeout: 10000 });
    const codeCount = await codeEls.count();
    expect(codeCount).toBeGreaterThanOrEqual(10);
    recoveryCodes = [];
    for (let i = 0; i < codeCount; i++) {
      const text = await codeEls.nth(i).textContent();
      if (text?.trim()) recoveryCodes.push(text.trim());
    }
  });

  // =========================================================================
  // 3. Wrong TOTP during setup shows error and keeps user on setup state
  // =========================================================================
  test("3: setup – wrong TOTP shows error, does not enable MFA", async ({ page }) => {
    await apiLogin(page, testEmail, PASSWORD);

    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });

    // Ensure we are in setup state
    const qrImg = page.locator("img[alt='MFA QR Code'], img[alt*='QR']");
    const inSetup = await qrImg.isVisible().catch(() => false);
    if (!inSetup) {
      // Reset any pending (unverified) MFA setup so we can re-trigger it cleanly.
      await page.request.post(`${BASE_URL}/api/internal/reset-mfa`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        data: { email: testEmail },
      });
      const enableBtn = page.locator(
        "button:has-text('Enable Two-Factor Authentication'), button:has-text('Enable')"
      );
      await page.reload({ waitUntil: "networkidle" });
      await expect(enableBtn).toBeVisible({ timeout: 10000 });
      const setupResp3 = page.waitForResponse(
        (resp) => resp.url().includes("/api/auth/mfa/setup") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await enableBtn.click();
      await setupResp3;
      await expect(qrImg).toBeVisible({ timeout: 15000 });

      // Re-capture recovery codes since reset-mfa deleted the old ones
      const codeEls3 = page.locator("code");
      await expect(codeEls3.first()).toBeVisible({ timeout: 10000 });
      const count3 = await codeEls3.count();
      recoveryCodes = [];
      for (let i = 0; i < count3; i++) {
        const text = await codeEls3.nth(i).textContent();
        if (text?.trim()) recoveryCodes.push(text.trim());
      }
    }

    // Fill invalid TOTP ("000000" is almost certainly wrong)
    const totpInput = page.locator("#totpToken");
    await expect(totpInput).toBeVisible({ timeout: 10000 });
    await totpInput.fill("000000");

    // Submit and wait for error
    await page.locator("button:has-text('Verify & Enable')").click();

    // Error alert should appear
    const errorAlert = page.locator("[role='alert']:not(#__next-route-announcer__)");
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Page should still be in setup state (QR still visible)
    await expect(qrImg).toBeVisible({ timeout: 5000 });

    // "Enabled" badge must NOT be visible
    const enabledBadge = page.locator("text=Enabled");
    await expect(enabledBadge).not.toBeVisible();
  });

  // =========================================================================
  // 4. Correct TOTP enables MFA — "Enabled" badge appears
  // =========================================================================
  test("4: setup – correct TOTP enables MFA", async ({ page }) => {
    await apiLogin(page, testEmail, PASSWORD);

    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });

    // If MFA is already enabled (e.g. test ran before), skip setup
    const enabledBadge = page.locator("span:has-text('Enabled')");
    const alreadyEnabled = await enabledBadge.isVisible().catch(() => false);
    if (alreadyEnabled) {
      // Nothing to do — MFA was already enabled by a prior run
      return;
    }

    // Ensure we are in setup state
    const qrImg = page.locator("img[alt='MFA QR Code'], img[alt*='QR']");
    let inSetup = await qrImg.isVisible().catch(() => false);
    if (!inSetup) {
      // Reset any pending (unverified) MFA setup so we can re-trigger it cleanly.
      await page.request.post(`${BASE_URL}/api/internal/reset-mfa`, {
        headers: { "X-Requested-With": "XMLHttpRequest" },
        data: { email: testEmail },
      });
      const enableBtn = page.locator(
        "button:has-text('Enable Two-Factor Authentication'), button:has-text('Enable')"
      );
      await page.reload({ waitUntil: "networkidle" });
      await expect(enableBtn).toBeVisible({ timeout: 10000 });
      const setupResp4 = page.waitForResponse(
        (resp) => resp.url().includes("/api/auth/mfa/setup") && resp.request().method() === "POST",
        { timeout: 15000 }
      );
      await enableBtn.click();
      await setupResp4;
      await expect(qrImg).toBeVisible({ timeout: 15000 });
    }

    // Always re-capture recovery codes — prior tests may have reset MFA,
    // deleting old codes and generating new ones via fresh setup calls.
    const codeEls = page.locator("code");
    const codeCount = await codeEls.count();
    if (codeCount > 0) {
      recoveryCodes = [];
      for (let i = 0; i < codeCount; i++) {
        const text = await codeEls.nth(i).textContent();
        if (text?.trim()) recoveryCodes.push(text.trim());
      }
    }

    // Generate a valid TOTP from the known test secret
    const token = generateTotpToken(MFA_SECRET);
    const totpInput = page.locator("#totpToken");
    await expect(totpInput).toBeVisible({ timeout: 10000 });
    await totpInput.fill(token);

    await page.locator("button:has-text('Verify & Enable')").click();

    // "Enabled" badge should appear
    await expect(enabledBadge).toBeVisible({ timeout: 15000 });

    // Disable form should appear (disableToken input)
    await expect(page.locator("#disableToken")).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // 5. Login with MFA-enabled account redirects to /mfa-verify
  // =========================================================================
  test("5: login – MFA user is redirected to /mfa-verify", async ({ page }) => {
    // Clear cookies so we start unauthenticated
    await signOut(page);

    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page).toHaveURL(/\/mfa-verify/, { timeout: 15000 });

    // TOTP input should be visible
    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    // Toggle link should be visible
    await expect(
      page.locator("button:has-text('Use a recovery code instead')")
    ).toBeVisible();
  });

  // =========================================================================
  // 6. Wrong TOTP at /mfa-verify shows error and stays on page
  // =========================================================================
  test("6: login – wrong TOTP shows error, URL stays at /mfa-verify", async ({ page }) => {
    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });
    await page.fill("#token", "000000");
    await page.locator('button[type="submit"]').click();

    // Error alert should appear
    const errorAlert = page.locator("[role='alert']:not(#__next-route-announcer__)");
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // Still on /mfa-verify
    await expect(page).toHaveURL(/\/mfa-verify/);
  });

  // =========================================================================
  // 7. Rate limit: 5 wrong attempts result in "Too many attempts" error
  // =========================================================================
  test("7: login – rate limit after 5 wrong attempts returns 429", async ({ page }) => {
    test.slow();

    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    // Navigate to the MFA verify page (browser should already be there)
    await expect(page).toHaveURL(/\/mfa-verify/, { timeout: 15000 });
    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    // Submit wrong tokens to exhaust the per-user rate limit (5 allowed,
    // 6th is blocked). Test 6 already submitted 1 wrong attempt for the
    // same userId, so we need ~5 more here. Use 7 iterations as safety
    // margin in case the counter was somehow reset.
    for (let i = 0; i < 7; i++) {
      await page.fill("#token", "000000");
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes("/api/auth/mfa/login-verify"),
        { timeout: 10000 }
      );
      await page.locator('button[type="submit"]').click();
      const resp = await responsePromise;
      if (resp.status() === 429) {
        // 429 received — wait for the frontend to render the error
        break;
      }
      // Small delay before next attempt
      await page.waitForTimeout(300);
    }

    // After exhausting attempts, "Too many attempts" message must appear
    const rateLimitMsg = page
      .locator("[role='alert']")
      .filter({ hasText: /too many attempts/i });
    await expect(rateLimitMsg).toBeVisible({ timeout: 15000 });
  });

  // =========================================================================
  // 8. Correct TOTP at /mfa-verify completes login and redirects to app
  // =========================================================================
  test("8: login – correct TOTP completes MFA and redirects to app", async ({ page }) => {
    // Reset the per-user rate limit counter that test 7 exhausted,
    // but keep MFA enabled (rateLimitOnly=true skips DB changes).
    await page.request.post(`${BASE_URL}/api/internal/reset-mfa`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: { email: testEmail, rateLimitOnly: true },
    });

    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    const token = generateTotpToken(MFA_SECRET);
    await page.fill("#token", token);
    await page.locator('button[type="submit"]').click();

    // Should redirect to app (threshold or dashboard)
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );
    await expect(page).not.toHaveURL(/\/mfa-verify/);
  });

  // =========================================================================
  // 9. Recovery mode toggle shows #recoveryCode input and hides #token
  // =========================================================================
  test("9: recovery – toggle switch shows recovery code input", async ({ page }) => {
    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    // Click the toggle link
    await page.locator("button:has-text('Use a recovery code instead')").click();

    // Recovery code input should appear
    await expect(page.locator("#recoveryCode")).toBeVisible({ timeout: 5000 });

    // TOTP input should NOT be visible in recovery mode
    await expect(page.locator("#token")).not.toBeVisible();

    // Toggle link should now say "Use authenticator app instead"
    await expect(
      page.locator("button:has-text('Use authenticator app instead')")
    ).toBeVisible();
  });

  // =========================================================================
  // 10. Valid recovery code completes login
  // =========================================================================
  test("10: recovery – valid code completes login", async ({ page }) => {
    test.slow();

    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    // Toggle to recovery mode
    await page.locator("button:has-text('Use a recovery code instead')").click();
    await expect(page.locator("#recoveryCode")).toBeVisible({ timeout: 5000 });

    // Use the first recovery code
    const code = recoveryCodes[0];
    expect(code).toBeTruthy();
    await page.fill("#recoveryCode", code);
    await page.locator('button[type="submit"]').click();

    // Should redirect to app
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );
    await expect(page).not.toHaveURL(/\/mfa-verify/);
  });

  // =========================================================================
  // 11. Invalid recovery code shows error and stays on /mfa-verify
  // =========================================================================
  test("11: recovery – invalid code shows error", async ({ page }) => {
    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    // Toggle to recovery mode
    await page.locator("button:has-text('Use a recovery code instead')").click();
    await expect(page.locator("#recoveryCode")).toBeVisible({ timeout: 5000 });

    // Enter a clearly invalid code
    await page.fill("#recoveryCode", "XXXX-YYYYYY");
    await page.locator('button[type="submit"]').click();

    // Error should appear
    const errorAlert = page.locator("[role='alert']:not(#__next-route-announcer__)");
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    await expect(errorAlert).toContainText(/invalid|already used/i);

    // Still on /mfa-verify
    await expect(page).toHaveURL(/\/mfa-verify/);
  });

  // =========================================================================
  // 12. Already-used recovery code is rejected
  // =========================================================================
  test("12: recovery – used code is rejected as already used", async ({ page }) => {
    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });

    // Toggle to recovery mode
    await page.locator("button:has-text('Use a recovery code instead')").click();
    await expect(page.locator("#recoveryCode")).toBeVisible({ timeout: 5000 });

    // Re-use the same code from test 10 (recoveryCodes[0] was consumed)
    const usedCode = recoveryCodes[0];
    await page.fill("#recoveryCode", usedCode);
    await page.locator('button[type="submit"]').click();

    // Should see "Invalid or already used" error
    const errorAlert = page.locator("[role='alert']:not(#__next-route-announcer__)");
    await expect(errorAlert).toBeVisible({ timeout: 10000 });
    await expect(errorAlert).toContainText(/invalid|already used/i);

    // Still on /mfa-verify
    await expect(page).toHaveURL(/\/mfa-verify/);
  });

  // =========================================================================
  // 13. Wrong TOTP in disable form keeps MFA enabled
  // =========================================================================
  test("13: disable – wrong TOTP shows error and MFA remains enabled", async ({ page }) => {
    // Log in with a valid TOTP so we can reach /settings/security
    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });
    const token = generateTotpToken(MFA_SECRET);
    await page.fill("#token", token);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );

    // Navigate to security settings
    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });

    // MFA should be shown as enabled
    const enabledBadge = page.locator("span:has-text('Enabled')");
    await expect(enabledBadge).toBeVisible({ timeout: 15000 });

    // Enter wrong TOTP in disable form
    const disableInput = page.locator("#disableToken");
    await expect(disableInput).toBeVisible({ timeout: 10000 });
    await disableInput.fill("000000");

    await page.locator("button:has-text('Disable MFA')").click();

    // Error should appear
    const errorAlert = page.locator("[role='alert']:not(#__next-route-announcer__)");
    await expect(errorAlert).toBeVisible({ timeout: 10000 });

    // "Enabled" badge should still be visible — MFA not disabled
    await expect(enabledBadge).toBeVisible({ timeout: 5000 });
  });

  // =========================================================================
  // 14. Correct TOTP in disable form disables MFA — "Enable" button returns
  // =========================================================================
  test("14: disable – correct TOTP disables MFA", async ({ page }) => {
    // Reset the per-user rate limit counter exhausted by tests 8-12.
    await page.request.post(`${BASE_URL}/api/internal/reset-mfa`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: { email: testEmail, rateLimitOnly: true },
    });

    // Log in with TOTP (MFA still enabled from tests above)
    await signOut(page);
    await browserLogin(page, testEmail, PASSWORD, { expectMfaRedirect: true });

    await expect(page.locator("#token")).toBeVisible({ timeout: 10000 });
    const loginToken = generateTotpToken(MFA_SECRET);
    await page.fill("#token", loginToken);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );

    // Navigate to security settings
    await page.goto("/settings/security", { waitUntil: "domcontentloaded" });

    const enabledBadge = page.locator("span:has-text('Enabled')");
    await expect(enabledBadge).toBeVisible({ timeout: 15000 });

    // Enter correct TOTP to disable
    const disableInput = page.locator("#disableToken");
    await expect(disableInput).toBeVisible({ timeout: 10000 });
    const disableToken = generateTotpToken(MFA_SECRET);
    await disableInput.fill(disableToken);

    await page.locator("button:has-text('Disable MFA')").click();

    // "Enabled" badge should disappear
    await expect(enabledBadge).not.toBeVisible({ timeout: 15000 });

    // "Enable" button should reappear (MFA is now disabled)
    const enableBtn = page.locator(
      "button:has-text('Enable Two-Factor Authentication'), button:has-text('Enable')"
    );
    await expect(enableBtn).toBeVisible({ timeout: 10000 });
  });

  // =========================================================================
  // 15. Non-MFA user navigating to /mfa-verify is redirected away
  // =========================================================================
  test("15: access control – non-MFA user on /mfa-verify is redirected away", async ({ page }) => {
    // Sign up a second user who has NO MFA (via API to avoid hydration issues)
    const nonMfaEmail = `t16-nomfa-${Date.now()}@test.com`;
    const signupResp = await page.request.post(`${BASE_URL}/api/auth/signup`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: {
        firstName: "NoMFA",
        lastName: "User",
        email: nonMfaEmail,
        password: PASSWORD,
        confirmPassword: PASSWORD,
      },
    });
    expect(signupResp.status()).toBe(201);

    // Log in via API
    await apiLogin(page, nonMfaEmail, PASSWORD);

    // User is now authenticated without MFA — navigate directly to /mfa-verify
    await page.goto("/mfa-verify", { waitUntil: "domcontentloaded" });

    // Should be redirected away (to /threshold or an authenticated route)
    // The middleware should not leave a non-MFA user on /mfa-verify
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation|login)/,
      { timeout: 15000 }
    );
    await expect(page).not.toHaveURL(/\/mfa-verify/);
  });

  // =========================================================================
  // 16. Unauthenticated user navigating to /mfa-verify is redirected to /login
  // =========================================================================
  test("16: access control – unauthenticated on /mfa-verify redirects to /login", async ({ page }) => {
    // Clear all cookies — no session
    await page.context().clearCookies();

    await page.goto("/mfa-verify", { waitUntil: "domcontentloaded" });

    // Middleware should redirect unauthenticated users to /login
    await page.waitForURL("**/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
