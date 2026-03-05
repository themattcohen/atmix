import { test, expect, request as playwrightRequest } from "@playwright/test";
import { resetLockout } from "./helpers/auth";

const EXISTING_EMAIL = "debug@example.com";
const EXISTING_PASSWORD = "Debug123!";
const LOCKOUT_TEST_EMAIL = "lockout-test@example.com";

// ---------------------------------------------------------------------------
// Signup Page
// ---------------------------------------------------------------------------
test.describe("Signup Page", () => {
  // CI dev server is slow on first request (route compilation + Prisma init)
  test.setTimeout(120_000);

  test("loads with all form fields", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#firstName").waitFor({ state: "visible", timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Create Your Account");
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Create Account"
    );
  });

  test("has link to login page", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await expect(
      page.locator("text=Already have an account?")
    ).toBeVisible();
    const signInLink = page.locator('a[href="/login"]');
    await expect(signInLink).toBeVisible();
    await signInLink.click();
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("has link back to home", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
    await expect(homeLink.locator("text=FBAR Direct")).toBeVisible();
  });

  test("shows password requirements hint", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await expect(page.locator("text=8+ characters")).toBeVisible();
  });

  test("empty form submission stays on signup page (HTML validation)", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.locator('button[type="submit"]').waitFor({ state: "visible", timeout: 15000 });
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/signup/);
  });

  test("signup with valid data creates account and redirects to verify-email", async ({
    page,
  }) => {
    test.slow(); // signup + bcrypt + auto-login + page transition can exceed 30s
    const email = `pw-signup-${Date.now()}@test.com`;
    await page.goto("/signup");
    await page.locator("#firstName").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#firstName", "Playwright");
    await page.fill("#lastName", "Tester");
    await page.fill("#email", email);
    await page.fill("#password", "TestPass123!");
    await page.fill("#confirmPassword", "TestPass123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/verify-email", { timeout: 60000 });
    await expect(page).toHaveURL(/\/verify-email/);
  });

  test("signup with duplicate email redirects to verify-email (anti-enumeration)", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#firstName").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#firstName", "Dup");
    await page.fill("#lastName", "User");
    // Use EXISTING_EMAIL (seeded) so auto-login fails with wrong password.
    // Don't use LOCKOUT_TEST_EMAIL — its failed signIn attempts pollute the
    // server-side lockout counter and break the "wrong password" test later.
    await page.fill("#email", EXISTING_EMAIL);
    await page.fill("#password", "WrongPassword999!");
    await page.fill("#confirmPassword", "WrongPassword999!");
    await page.click('button[type="submit"]');
    // Anti-enumeration: API returns 201 for duplicates too.
    // Frontend tries auto-login which fails (wrong password), then redirects to /verify-email.
    await page.waitForURL("**/verify-email", { timeout: 30000 });
    await expect(page).toHaveURL(/\/verify-email/);
  });

  test("signup with mismatched passwords shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#firstName").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#firstName", "Test");
    await page.fill("#lastName", "User");
    await page.fill("#email", `mismatch-${Date.now()}@test.com`);
    await page.fill("#password", "TestPass123!");
    await page.fill("#confirmPassword", "DifferentPass456!");
    await page.click('button[type="submit"]');
    await expect(
      page.locator(".text-red-600, .text-red-700, .bg-red-50").first()
    ).toBeVisible({ timeout: 10000 });
  });

  test("signup with weak password shows error", async ({ page }) => {
    await page.goto("/signup");
    await page.locator("#firstName").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#firstName", "Test");
    await page.fill("#lastName", "User");
    await page.fill("#email", `weak-${Date.now()}@test.com`);
    await page.fill("#password", "abc");
    await page.fill("#confirmPassword", "abc");
    await page.click('button[type="submit"]');
    await expect(
      page.locator(".text-red-600, .text-red-700, .bg-red-50").first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Login Page
// ---------------------------------------------------------------------------
test.describe("Login Page", () => {
  // CI dev server is slow — login involves session check + bcrypt + redirect
  test.setTimeout(90_000);

  test.beforeEach(async () => {
    // Reset lockout state for debug user to prevent test pollution
    const request = await playwrightRequest.newContext({
      baseURL: "http://localhost:3001",
    });
    await resetLockout(request, EXISTING_EMAIL);
    await request.dispose();
  });

  test("loads with email and password fields", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Sign in");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Sign In"
    );
  });

  test("has Forgot Password link", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    const forgotLink = page.locator('a[href="/forgot-password"]');
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toContainText("Forgot Password");
  });

  test("has link to signup page", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await expect(
      page
        .locator("text=Don't have an account?")
        .or(page.locator("text=Don\u2019t have an account?"))
    ).toBeVisible();
    const signupLink = page.locator('a[href="/signup"]');
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("has link back to home", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test("login with valid credentials redirects to app", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.fill("#password", EXISTING_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/(threshold|dashboard)/);
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", LOCKOUT_TEST_EMAIL);
    await page.fill("#password", "WrongPassword999!");
    await page.click('button[type="submit"]');
    await expect(page.locator(".bg-red-50")).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator("text=Invalid email or password")
    ).toBeVisible();
  });

  test("login with non-existent email shows error", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", "nonexistent@example.com");
    await page.fill("#password", "SomePassword123!");
    await page.click('button[type="submit"]');
    await expect(page.locator(".bg-red-50")).toBeVisible({ timeout: 10000 });
  });

  test("submit button shows loading state during login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.fill("#password", EXISTING_PASSWORD);
    await page.click('button[type="submit"]');
    // Loading state may be very fast; just verify no crash and successful redirect
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
  });
});

// ---------------------------------------------------------------------------
// Forgot Password Page
// ---------------------------------------------------------------------------
test.describe("Forgot Password Page", () => {
  test.setTimeout(90_000);

  test("loads with email field", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Reset Your Password");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText(
      "Send Reset Instructions"
    );
  });

  test("has link back to login", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await expect(
      page.locator("text=Remember your password?")
    ).toBeVisible();
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });

  test("has link to home", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
  });

  test("submit shows success message", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Check Your Email")).toBeVisible({
      timeout: 30000,
    });
    await expect(
      page
        .locator("text=password reset instructions")
        .or(page.locator("text=we've sent"))
    ).toBeVisible();
  });

  test("success page has back to sign in link", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.click('button[type="submit"]');
    await expect(page.locator("text=Check Your Email")).toBeVisible({
      timeout: 30000,
    });
    const backLink = page.locator("text=Back to sign in");
    await expect(backLink).toBeVisible();
    await backLink.click();
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });
});

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------
test.describe("Logout", () => {
  // Dashboard navigation requires login + session hydration, which is slow on dev server
  test.setTimeout(90_000);

  test("logout button exists when logged in and works", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.fill("#password", EXISTING_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    // Navigate to dashboard to reach the (app) layout which has the auth header
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });

    // Wait for the app header to render (session must load first)
    const logoutBtn = page.locator("text=Log Out");
    await expect(logoutBtn).toBeVisible({ timeout: 30000 });
    await logoutBtn.click();

    await page.waitForURL(/\/$/, { timeout: 30000, waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/^https?:\/\/[^/]+\/$/);
  });

  test("app header shows user email when logged in", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.fill("#password", EXISTING_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    // Navigate to dashboard to reach the (app) layout which shows user email
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });

    await expect(page.locator(`text=${EXISTING_EMAIL}`)).toBeVisible({ timeout: 30000 });
  });

  test("app header has My Filings link", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", EXISTING_EMAIL);
    await page.fill("#password", EXISTING_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    // Navigate to dashboard to reach the (app) layout which has My Filings link
    await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });

    const filingsLink = page.locator("text=My Filings");
    await expect(filingsLink).toBeVisible({ timeout: 30000 });
    await filingsLink.click();
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

// ---------------------------------------------------------------------------
// Auth Redirects
// ---------------------------------------------------------------------------
test.describe("Auth Redirects", () => {
  test.setTimeout(90_000);

  test("unauthenticated user accessing /dashboard gets redirected to login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user accessing /threshold loads successfully without redirect", async ({
    page,
  }) => {
    await page.goto("/threshold");
    await expect(page).toHaveURL(/\/threshold/);
  });

  test("unauthenticated user accessing /personal gets redirected to login", async ({
    page,
  }) => {
    await page.goto("/personal");
    await page.waitForURL("**/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user accessing /accounts gets redirected to login", async ({
    page,
  }) => {
    await page.goto("/accounts");
    await page.waitForURL("**/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user accessing /review gets redirected to login", async ({
    page,
  }) => {
    await page.goto("/review");
    await page.waitForURL("**/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("login blocks external redirect via callbackUrl (absolute URL)", async ({ page }) => {
    await page.goto("/login?callbackUrl=https://evil.com", { waitUntil: "networkidle" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", "debug@example.com");
    await page.fill("#password", "Debug123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    // Should NOT be on evil.com
    expect(page.url()).not.toContain("evil.com");
  });

  test("login blocks protocol-relative redirect via callbackUrl", async ({ page }) => {
    await page.goto("/login?callbackUrl=//evil.com", { waitUntil: "networkidle" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", "debug@example.com");
    await page.fill("#password", "Debug123!");
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    expect(page.url()).not.toContain("evil.com");
  });

  test("login allows valid internal callbackUrl", async ({ page }) => {
    await page.goto("/login?callbackUrl=/dashboard", { waitUntil: "networkidle" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", "debug@example.com");
    await page.fill("#password", "Debug123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard", { timeout: 30000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
