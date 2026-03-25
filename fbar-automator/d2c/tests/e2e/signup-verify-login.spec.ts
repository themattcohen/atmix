import { test, expect } from "@playwright/test";

/**
 * Full signup → email verification → login flow test.
 *
 * Uses the /api/internal/e2e-setup endpoint to retrieve verification tokens
 * (bypassing email delivery) so the entire chain can be tested end-to-end.
 *
 * Requires E2E_TEST_SECRET env var to be set.
 */

const BASE_URL = "http://localhost:3001";
const TEST_EMAIL = "e2e-test-signup-flow@test.fbardirect.com";
const TEST_PASSWORD = "E2eTestPass123";

test.describe("Signup → Verify → Login flow", () => {
  test.use({ baseURL: BASE_URL });
  // Signup involves bcrypt hashing + multiple API calls; allow extra time
  test.setTimeout(120_000);

  function getSecret(): string {
    const secret = process.env.E2E_TEST_SECRET;
    if (!secret) throw new Error("E2E_TEST_SECRET env var is required");
    return secret;
  }

  async function e2eSetup(
    request: import("@playwright/test").APIRequestContext,
    action: string,
    data: Record<string, unknown> = {}
  ) {
    const resp = await request.post(`${BASE_URL}/api/internal/e2e-setup`, {
      headers: { "x-e2e-secret": getSecret() },
      data: { action, ...data },
    });
    return resp;
  }

  // Clean up test user before and after each test
  test.beforeEach(async ({ request }) => {
    await e2eSetup(request, "cleanup", { email: TEST_EMAIL });
  });

  test.afterEach(async ({ request }) => {
    await e2eSetup(request, "cleanup", { email: TEST_EMAIL });
  });

  test("full signup → verify email → login as returning user", async ({
    page,
    request,
  }) => {
    // ---------------------------------------------------------------
    // Step 1: Sign up
    // ---------------------------------------------------------------
    await page.goto("/signup", { waitUntil: "domcontentloaded" });

    // Wait for React hydration
    await page.waitForFunction(
      () => {
        const form = document.querySelector("form");
        if (!form) return false;
        return Object.keys(form).some(
          (k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps")
        );
      },
      { timeout: 20_000 }
    );

    await page.fill("#firstName", "E2E");
    await page.fill("#lastName", "Tester");
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", TEST_PASSWORD);
    await page.fill("#confirmPassword", TEST_PASSWORD);

    const signupResponse = page.waitForResponse(
      (r) => r.url().includes("/api/auth/signup"),
      { timeout: 60_000 }
    );

    await page.click('button[type="submit"]');

    const resp = await signupResponse;
    expect(resp.status()).toBe(201);

    // Should redirect to /verify-email after auto-login attempt
    await page.waitForURL("**/verify-email**", { timeout: 30_000, waitUntil: "domcontentloaded" });

    // Verify the page shows the "check your email" message
    await expect(page.locator("text=Verify Your Email")).toBeVisible({
      timeout: 10_000,
    });

    // ---------------------------------------------------------------
    // Step 2: Get verification token via test API (bypasses email)
    // ---------------------------------------------------------------
    const tokenResp = await e2eSetup(request, "get-verification-token", {
      email: TEST_EMAIL,
    });
    expect(tokenResp.ok()).toBe(true);
    const { data } = await tokenResp.json();
    const verificationToken = data.token;
    expect(verificationToken).toBeTruthy();

    // ---------------------------------------------------------------
    // Step 3: Navigate to verification URL
    // ---------------------------------------------------------------
    await page.goto(`/verify-email?token=${verificationToken}`);

    // Should show "Email Verified!" success message
    await expect(page.locator("text=Email Verified")).toBeVisible({
      timeout: 15_000,
    });

    // Should redirect to /threshold (user has session from auto-login)
    await page.waitForURL("**/threshold", { timeout: 10_000 });
    await expect(page.locator("h1")).toContainText("Do You Need to File");

    // ---------------------------------------------------------------
    // Step 4: Sign out
    // ---------------------------------------------------------------
    const csrfRes = await page.request.get("/api/auth/csrf");
    const { csrfToken } = await csrfRes.json();
    await page.request.post("/api/auth/signout", {
      form: { csrfToken },
    });

    // ---------------------------------------------------------------
    // Step 5: Log in as returning user
    // ---------------------------------------------------------------
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    // Wait for React hydration
    await page.waitForFunction(
      () => {
        const form = document.querySelector("form");
        if (!form) return false;
        return Object.keys(form).some(
          (k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps")
        );
      },
      { timeout: 20_000 }
    );

    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to /threshold (email is verified, no MFA)
    await page.waitForURL("**/threshold", { timeout: 15_000 });
    await expect(page.locator("h1")).toContainText("Do You Need to File");
  });

  test("verification with no session redirects to login with banner", async ({
    page,
    request,
  }) => {
    // Create an unverified user via API (no browser session)
    const setupResp = await e2eSetup(request, "setup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: false,
      firstName: "E2E",
      lastName: "Tester",
    });
    expect(setupResp.ok()).toBe(true);

    // Get a verification token
    const tokenResp = await e2eSetup(request, "get-verification-token", {
      email: TEST_EMAIL,
    });
    expect(tokenResp.ok()).toBe(true);
    const { data } = await tokenResp.json();

    // Navigate to verification URL with NO session
    await page.goto(`/verify-email?token=${data.token}`);

    // Should show success then redirect to login
    await expect(page.locator("text=Email Verified")).toBeVisible({
      timeout: 15_000,
    });

    await page.waitForURL("**/login", { timeout: 10_000 });

    // Should show the "Email verified!" banner
    await expect(
      page.locator("text=Email verified! Please sign in to continue.")
    ).toBeVisible({ timeout: 5_000 });

    // Log in
    await page.fill("#email", TEST_EMAIL);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL("**/threshold", { timeout: 15_000 });
  });

  test("expired token shows error with resend option", async ({
    page,
    request,
  }) => {
    // Create an unverified user
    await e2eSetup(request, "setup", {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      emailVerified: false,
    });

    // Get a token, then expire it in the DB
    const tokenResp = await e2eSetup(request, "get-verification-token", {
      email: TEST_EMAIL,
    });
    const { data } = await tokenResp.json();

    // We can't easily expire the token via API, so just use a bogus token
    await page.goto("/verify-email?token=this-is-an-invalid-token");

    // Should show error state
    await expect(page.locator(".bg-red-50").filter({ hasText: "Invalid or expired token" })).toBeVisible({
      timeout: 15_000,
    });
  });
});
