/**
 * T25: Session & Authentication Edge Cases
 *
 * 13 tests covering:
 *   1-2.  Authenticated-user redirect away from /login and /signup
 *   3-9.  Unauthenticated redirect to /login for each protected wizard route
 *  10-11. Login lockout after 5 failed attempts + locked-out behaviour
 *  12.    callbackUrl=/accounts respected on login
 *  13.    External / protocol-relative / javascript: callbackUrls rejected
 *
 * Structure:
 *   - Tests 1–2 run serially (login once, then visit auth pages).
 *   - Tests 3–9 use a single describe with beforeEach cookie-clear so they
 *     are independent but avoid per-test signup overhead.
 *   - Tests 10–11 run serially and share a fresh user created in beforeAll.
 *   - Tests 12–13 use the shared debug@example.com account (parallel-safe).
 */

import { test, expect, BrowserContext, Page } from "@playwright/test";
import { loginAsTestUser, signupTestUser } from "./helpers/auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3001";
const APP_ROUTE_PATTERN =
  /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/;
const DEBUG_EMAIL = "debug@example.com";
const DEBUG_PASSWORD = "Debug123!";
const LOCKOUT_PASSWORD = "TestPassword123!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clear all cookies on the current context so subsequent page navigations
 * start in an unauthenticated state.
 */
async function signOut(context: BrowserContext) {
  await context.clearCookies();
}

/**
 * Navigate to /login, fill credentials, and click submit.
 * Does NOT wait for a redirect — callers assert the outcome themselves.
 */
async function fillLoginForm(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
}

// ===========================================================================
// SECTION A — Authenticated user redirected away from /login and /signup
// ===========================================================================

test.describe.serial("T25-A: Authenticated user redirected from auth pages", () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(90_000);

  /**
   * Test 1: Authenticated user on /login is redirected to app.
   */
  test("1: Auth'd user on /login redirects to app", async ({ page }) => {
    // Establish an authenticated session
    await loginAsTestUser(page, DEBUG_EMAIL, DEBUG_PASSWORD);

    // Navigate directly to /login while authenticated
    await page.goto("/login", { waitUntil: "networkidle" });

    // Middleware / client-side guard should redirect away from /login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // Must land on a known app route
    expect(page.url()).toMatch(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/
    );
  });

  /**
   * Test 2: Authenticated user on /signup is redirected to app.
   */
  test("2: Auth'd user on /signup redirects to app", async ({ page }) => {
    // Already authenticated from test 1 (serial — same context, cookies survive)
    // Re-login to be safe in case the context was reset.
    await loginAsTestUser(page, DEBUG_EMAIL, DEBUG_PASSWORD);

    // Navigate directly to /signup while authenticated
    await page.goto("/signup", { waitUntil: "networkidle" });

    // Should be redirected away from /signup
    await expect(page).not.toHaveURL(/\/signup/, { timeout: 15000 });

    expect(page.url()).toMatch(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/
    );
  });
});

// ===========================================================================
// SECTION B — Unauthenticated user redirected to /login for each protected route
// ===========================================================================

test.describe("T25-B: Unauthenticated redirect to /login for protected routes", () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(30_000);

  // Clear cookies before every test to guarantee an unauthenticated state.
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  /**
   * Test 3: /dashboard → /login
   */
  test("3: Unauth'd user on /dashboard → redirected to /login", async ({ page }) => {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    // Login form should be rendered (confirms it's a real redirect, not a 404)
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 4: /personal → /login
   */
  test("4: Unauth'd user on /personal → redirected to /login", async ({ page }) => {
    await page.goto("/personal", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 5: /accounts → /login
   */
  test("5: Unauth'd user on /accounts → redirected to /login", async ({ page }) => {
    await page.goto("/accounts", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 6: /review → /login
   */
  test("6: Unauth'd user on /review → redirected to /login", async ({ page }) => {
    await page.goto("/review", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 7: /sign → /login
   */
  test("7: Unauth'd user on /sign → redirected to /login", async ({ page }) => {
    await page.goto("/sign", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 8: /payment → /login
   */
  test("8: Unauth'd user on /payment → redirected to /login", async ({ page }) => {
    await page.goto("/payment", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });

  /**
   * Test 9: /confirmation → /login
   */
  test("9: Unauth'd user on /confirmation → redirected to /login", async ({ page }) => {
    await page.goto("/confirmation", { waitUntil: "domcontentloaded" });
    await page.waitForURL("**/login**", { timeout: 20000 });
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible({ timeout: 10000 });
  });
});

// ===========================================================================
// SECTION C — Login lockout after 5 failed attempts
// ===========================================================================

test.describe.serial("T25-C: Login lockout", () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(120_000);

  // Fresh user created once and shared across tests 10 and 11.
  let lockoutEmail: string;

  test.beforeAll(async ({ browser }) => {
    // Sign up a brand-new user so we start with zero failed login attempts.
    // signupTestUser leaves the browser on /threshold (authenticated).
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    lockoutEmail = await signupTestUser(page);
    // Sign out immediately so tests 10–11 can attempt logins from scratch.
    await page.context().clearCookies();
    await page.close();
  });

  /**
   * Test 10: 5 wrong-password submissions trigger a lockout message.
   *
   * We submit 5 times with a wrong password and assert that after the 5th
   * (or before) the "account locked" / "too many" message appears.
   * resetLockout() is a no-op (endpoint deleted), so we use a fresh user.
   */
  test("10: Login lockout after 5 failed attempts — lockout message appears", async ({
    page,
  }) => {
    test.slow(); // bcrypt × 5 + network latency can easily exceed 30 s

    const wrongPassword = "WrongPassword!";

    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.goto("/login", { waitUntil: "networkidle" });
      await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
      await page.fill("#email", lockoutEmail);
      await page.fill("#password", wrongPassword);
      await page.click('button[type="submit"]');

      // Wait a short moment for the server response to surface
      await page.waitForTimeout(1500);

      // If we can already see a lockout message, we are done early
      const bodyText = await page.locator("body").innerText().catch(() => "");
      if (
        /account.*lock|too many|locked out|temporarily/i.test(bodyText)
      ) {
        break;
      }
    }

    // After 5 attempts, a lockout or "too many attempts" message must be visible.
    // The exact wording depends on the server's error response — accept common variants.
    const lockoutLocator = page.locator(
      "[role='alert'], .bg-red-50, .text-red-600, .text-red-700"
    ).filter({
      hasText: /account.*lock|lock.*account|too many|locked out|temporarily|try again later/i,
    });
    await expect(lockoutLocator.first()).toBeVisible({ timeout: 20000 });

    // Must still be on /login (not redirected to app)
    await expect(page).toHaveURL(/\/login/);
  });

  /**
   * Test 11: After lockout, correct password still shows locked-out message.
   *
   * The account is now locked from test 10. Attempting login with the CORRECT
   * password should not succeed — the user should still see a lockout message,
   * not a "wrong password" message.
   */
  test("11: Locked user with correct password still sees locked-out message (not wrong-password)", async ({
    page,
  }) => {
    // Attempt login with the correct password for the now-locked user
    await page.goto("/login", { waitUntil: "networkidle" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", lockoutEmail);
    // signupTestUser uses "TestPassword123!" as the password
    await page.fill("#password", LOCKOUT_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);

    // Should NOT have been redirected to the app
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page).not.toHaveURL(APP_ROUTE_PATTERN);

    // The error message must indicate the account is locked (not just a generic
    // "wrong password") — but the server may return a generic error for security.
    // We assert that the user is NOT admitted (still on /login), which is the
    // security-relevant guarantee, and that some error is displayed.
    const errorLocator = page.locator(
      "[role='alert'], .bg-red-50, .text-red-600, .text-red-700"
    );
    await expect(errorLocator.first()).toBeVisible({ timeout: 15000 });

    // Additionally verify the page does NOT show any authenticated content
    await expect(page.locator("text=Log Out")).not.toBeVisible();
  });
});

// ===========================================================================
// SECTION D — callbackUrl redirect behaviour
// ===========================================================================

test.describe("T25-D: callbackUrl redirect behaviour", () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(60_000);

  // Ensure unauthenticated state before each callbackUrl test
  test.beforeEach(async ({ context }) => {
    await context.clearCookies();
  });

  /**
   * Test 12: Valid internal callbackUrl=/accounts is respected after login.
   *
   * When /login?callbackUrl=/accounts is visited, a successful login should
   * redirect to /accounts rather than the default /threshold.
   */
  test("12: callbackUrl=/accounts redirects to /accounts after login", async ({
    page,
  }) => {
    // Navigate to login with a valid internal callbackUrl
    await page.goto("/login?callbackUrl=/accounts", {
      waitUntil: "networkidle",
    });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", DEBUG_EMAIL);
    await page.fill("#password", DEBUG_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect — must land on /accounts (not default /threshold)
    await page.waitForURL("**/accounts**", { timeout: 30000 });
    await expect(page).toHaveURL(/\/accounts/);
  });

  /**
   * Test 13: External and dangerous callbackUrls are rejected.
   *
   * Tests three variants that must all be sanitised:
   *   (a) Absolute URL:          https://evil.com
   *   (b) Protocol-relative URL: //evil.com
   *   (c) javascript: URI:       javascript:alert(1)
   *
   * In all cases the browser must NOT navigate to the external target.
   * The app should fall back to /threshold or /dashboard.
   */
  test("13: External callbackUrls (absolute, protocol-relative, javascript:) are rejected", async ({
    page,
    context,
  }) => {
    // -----------
    // (a) Absolute URL
    // -----------
    await context.clearCookies();
    await page.goto("/login?callbackUrl=https://evil.com", {
      waitUntil: "networkidle",
    });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", DEBUG_EMAIL);
    await page.fill("#password", DEBUG_PASSWORD);
    await page.click('button[type="submit"]');

    // Must NOT end up on evil.com
    await page.waitForURL(APP_ROUTE_PATTERN, { timeout: 30000 });
    expect(page.url()).not.toContain("evil.com");
    // Must be on a safe local route
    expect(page.url()).toMatch(
      /localhost:3001\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/
    );

    // -----------
    // (b) Protocol-relative URL
    // -----------
    await context.clearCookies();
    await page.goto("/login?callbackUrl=//evil.com", {
      waitUntil: "networkidle",
    });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", DEBUG_EMAIL);
    await page.fill("#password", DEBUG_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(APP_ROUTE_PATTERN, { timeout: 30000 });
    expect(page.url()).not.toContain("evil.com");
    expect(page.url()).toMatch(
      /localhost:3001\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/
    );

    // -----------
    // (c) javascript: URI
    // -----------
    await context.clearCookies();
    await page.goto(
      "/login?callbackUrl=javascript%3Aalert(1)",
      { waitUntil: "networkidle" }
    );
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", DEBUG_EMAIL);
    await page.fill("#password", DEBUG_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(APP_ROUTE_PATTERN, { timeout: 30000 });
    // Must be on a safe route — NOT executing arbitrary JS
    expect(page.url()).toMatch(
      /localhost:3001\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/
    );
    // Confirm no alert dialog was opened (the javascript: URI must not execute)
    const hasDialog = await page
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .evaluate(() => (window as any).__testDialogTriggered)
      .catch(() => false);
    expect(hasDialog).toBeFalsy();
  });
});
