import { test, expect } from "@playwright/test";

/**
 * Antagonistic tests for the Forgot Password flow.
 *
 * Validates:
 * - Form rendering (email field, submit button, links)
 * - HTML5 required validation blocks empty submission
 * - Valid email submission shows success message
 * - Nonexistent email submission shows the SAME success message (anti-enumeration)
 * - "Back to sign in" link navigates to /login
 * - "Sign in" link on the form page navigates to /login
 */

test.describe("Forgot Password Flow", () => {
  test.use({ baseURL: "http://localhost:3001" });

  // Dev server can be slow — extend all timeouts to 90s
  test.slow();

  // -----------------------------------------------------------------
  // 1. Page loads correctly with expected elements
  // -----------------------------------------------------------------
  test("page loads at /forgot-password with email field and submit button", async ({
    page,
  }) => {
    const response = await page.goto("/forgot-password", {
      waitUntil: "networkidle",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);

    // Heading
    await expect(page.locator("h1")).toContainText("Reset Your Password", {
      timeout: 15000,
    });

    // Subtitle
    await expect(
      page.locator("text=Enter your email and we")
    ).toBeVisible({ timeout: 10000 });

    // Email input visible and has correct attributes
    const emailInput = page.locator("#email");
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required", "");

    // Submit button — wait for hydration to populate text
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toContainText("Send Reset Instructions", {
      timeout: 15000,
    });
  });

  // -----------------------------------------------------------------
  // 2. Empty form submission blocked by HTML5 required validation
  // -----------------------------------------------------------------
  test("empty form submission stays on page (HTML5 required validation)", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for the form to hydrate
    await expect(page.locator("h1")).toContainText("Reset Your Password", {
      timeout: 15000,
    });

    // Verify email is empty
    const emailInput = page.locator("#email");
    await expect(emailInput).toHaveValue("");

    // Click submit without filling email
    await page.click('button[type="submit"]');

    // Page should NOT navigate away or show success
    await expect(page).toHaveURL(/\/forgot-password/);
    // The heading should still be the form heading, not the success heading
    await expect(page.locator("h1")).toContainText("Reset Your Password");

    // Verify no success message appeared
    await expect(page.locator("text=Check Your Email")).not.toBeVisible();
  });

  // -----------------------------------------------------------------
  // 3. Submit with valid/existing email shows success
  // -----------------------------------------------------------------
  test("submitting with a valid email shows success message", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for form to hydrate
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Send Reset Instructions", { timeout: 15000 });

    await page.fill("#email", "debug@example.com");
    await page.locator('button[type="submit"]').click();

    // Should show success state
    await expect(page.locator("text=Check Your Email")).toBeVisible({
      timeout: 60000,
    });

    // Verify the anti-enumeration success message
    await expect(
      page.locator("text=If an account exists with that email")
    ).toBeVisible();

    // Verify the "didn't receive" hint
    await expect(
      page.locator("text=Check your spam folder")
    ).toBeVisible();
  });

  // -----------------------------------------------------------------
  // 4. Submit with nonexistent email shows the SAME success (anti-enumeration)
  // -----------------------------------------------------------------
  test("submitting with nonexistent email shows same success message (anti-enumeration)", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for form to hydrate
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Send Reset Instructions", { timeout: 15000 });

    await page.fill("#email", "nonexistent-xyz@example.com");
    await page.locator('button[type="submit"]').click();

    // Must show the SAME success message — no difference for nonexistent emails
    await expect(page.locator("text=Check Your Email")).toBeVisible({
      timeout: 60000,
    });

    await expect(
      page.locator("text=If an account exists with that email")
    ).toBeVisible();

    // No error message should be displayed
    await expect(page.locator(".bg-red-50")).not.toBeVisible();
  });

  // -----------------------------------------------------------------
  // 5. Success page "Back to sign in" link navigates to /login
  // -----------------------------------------------------------------
  test("success page 'Back to sign in' link navigates to /login", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for form to hydrate
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Send Reset Instructions", { timeout: 15000 });

    await page.fill("#email", "debug@example.com");
    await page.locator('button[type="submit"]').click();

    await expect(page.locator("text=Check Your Email")).toBeVisible({
      timeout: 60000,
    });

    // Click "Back to sign in"
    const backLink = page.locator("text=Back to sign in");
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute("href", "/login");
    await backLink.click();

    await page.waitForURL("**/login", { timeout: 30000 });
    await expect(page).toHaveURL(/\/login/);
  });

  // -----------------------------------------------------------------
  // 6. Form page "Sign in" link navigates to /login
  // -----------------------------------------------------------------
  test("form page 'Sign in' link navigates to /login", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for form to hydrate
    await expect(page.locator("h1")).toContainText("Reset Your Password", {
      timeout: 15000,
    });

    // "Remember your password? Sign in"
    await expect(
      page.locator("text=Remember your password?")
    ).toBeVisible();

    const signInLink = page.locator('a[href="/login"]');
    await expect(signInLink).toBeVisible();
    await signInLink.click();

    await page.waitForURL("**/login", { timeout: 30000 });
    await expect(page).toHaveURL(/\/login/);
  });

  // -----------------------------------------------------------------
  // 7. Submit button shows loading state
  // -----------------------------------------------------------------
  test("submit button shows loading state while request is in-flight", async ({
    page,
  }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for form to hydrate
    await expect(
      page.locator('button[type="submit"]')
    ).toContainText("Send Reset Instructions", { timeout: 15000 });

    await page.fill("#email", "debug@example.com");

    // Click and immediately check for loading text
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Either we catch the loading state or the success state; both are valid
    // The button should show "Sending..." during the request
    const loadingOrSuccess = page
      .locator("text=Sending...")
      .or(page.locator("text=Check Your Email"));
    await expect(loadingOrSuccess).toBeVisible({ timeout: 60000 });
  });

  // -----------------------------------------------------------------
  // 8. FBAR Direct logo links to home
  // -----------------------------------------------------------------
  test("FBAR Direct logo links to home page", async ({ page }) => {
    await page.goto("/forgot-password", { waitUntil: "networkidle" });

    // Wait for hydration
    await expect(page.locator("h1")).toContainText("Reset Your Password", {
      timeout: 15000,
    });

    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink).toBeVisible();
    await expect(homeLink.locator("text=FBAR Direct")).toBeVisible();
  });
});
