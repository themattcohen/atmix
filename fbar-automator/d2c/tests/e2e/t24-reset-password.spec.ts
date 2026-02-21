/**
 * T24: Reset Password Page States
 *
 * 6 tests covering the /reset-password page:
 *   1. Missing token — "invalid link" error message shown, no usable form
 *   2. Fake token — form submits, API returns error (invalid/expired token)
 *   3. Passwords don't match — client-side validation error
 *   4. Password too short — client-side validation error (< 8 characters)
 *   5. Input types are password (not text)
 *   6. Full happy-path flow — SKIPPED (requires DB token seeding endpoint)
 *
 * Tests 1–5 are fully runnable without any DB setup.
 * Test 2 exercises the real POST /api/auth/reset-password endpoint with a
 * fake token so the API path is covered even without a seeded token.
 */

import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_URL = "http://localhost:3001";

/** A syntactically plausible but definitely invalid reset token. */
const FAKE_TOKEN = "fake-invalid-token-12345";

/** Valid password that satisfies all requirements (8+ chars). */
const VALID_PASSWORD = "NewPassword123!";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Locate the primary password input on /reset-password.
 * Tries #password first (most specific), then name="password" as a fallback.
 */
function passwordInput(page: import("@playwright/test").Page) {
  return page.locator('input[name="password"], #password').first();
}

/**
 * Locate the confirm-password input on /reset-password.
 * Tries #confirmPassword first, then name="confirmPassword" as a fallback.
 */
function confirmPasswordInput(page: import("@playwright/test").Page) {
  return page.locator('input[name="confirmPassword"], #confirmPassword').first();
}

/**
 * Locate any visible error / alert element on the page.
 * Matches role=alert, red Tailwind text/background classes.
 */
function errorLocator(page: import("@playwright/test").Page) {
  return page.locator(
    "[role='alert'], .text-red-500, .text-red-600, .text-red-700, .bg-red-50"
  ).first();
}

// ===========================================================================
// T24: Reset Password Page
// ===========================================================================

test.describe("T24: Reset Password Page", () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(30_000);

  // -------------------------------------------------------------------------
  // Test 1 — Missing token: "invalid link" message
  // -------------------------------------------------------------------------
  /**
   * When /reset-password is visited without a `token` query parameter the page
   * must immediately surface an error communicating that the link is
   * invalid or has expired.  No usable form (or a form with a visible error
   * banner) should be rendered.
   */
  test("1: Missing token — shows 'invalid link' error, no usable form", async ({
    page,
  }) => {
    await page.goto("/reset-password");

    // The page must not show a blank screen — wait for it to settle.
    await page.waitForLoadState("domcontentloaded");

    // Expect some error text about an invalid or expired link.
    const errorText = page.locator("body");
    await expect(errorText).toContainText(
      /invalid|expired|missing|not found|no token/i,
      { timeout: 10000 }
    );

    // Either the form is absent, or there is a visible error banner.
    // Either way, the user must not be able to submit a usable form silently.
    const submitBtn = page.locator('button[type="submit"]');
    const hasSubmitButton = await submitBtn.isVisible().catch(() => false);

    if (hasSubmitButton) {
      // If a form is present there must be a clearly visible error banner
      // so the user understands the link is unusable.
      await expect(errorLocator(page)).toBeVisible({ timeout: 5000 });
    }
    // If no submit button at all that also satisfies the test — the form was
    // not rendered, which is acceptable behaviour.
  });

  // -------------------------------------------------------------------------
  // Test 2 — Fake token: error on submit
  // -------------------------------------------------------------------------
  /**
   * When a syntactically valid but non-existent token is supplied, the page
   * renders the password form.  On submission the API responds with an error
   * (invalid or expired token) which must be surfaced to the user.
   */
  test("2: Fake token — form submits, API returns error (invalid/expired token)", async ({
    page,
  }) => {
    await page.goto(`/reset-password?token=${FAKE_TOKEN}`);
    await page.waitForLoadState("domcontentloaded");

    // The password form must be visible.
    await expect(passwordInput(page)).toBeVisible({ timeout: 10000 });
    await expect(confirmPasswordInput(page)).toBeVisible({ timeout: 10000 });

    // Fill both fields with a valid password so client-side validation passes.
    await passwordInput(page).fill(VALID_PASSWORD);
    await confirmPasswordInput(page).fill(VALID_PASSWORD);

    // Submit the form.
    await page.locator('button[type="submit"]').click();

    // The API must reject the fake token.  An error message must appear.
    await expect(errorLocator(page)).toBeVisible({ timeout: 15000 });

    // Verify the error text is about the token being invalid/expired, not
    // an unrelated server error.  Accept common phrasings.
    await expect(page.locator("body")).toContainText(
      /invalid|expired|not found|token/i,
      { timeout: 5000 }
    );

    // The user must stay on the reset-password page (not redirected to login).
    await expect(page).toHaveURL(/\/reset-password/);
  });

  // -------------------------------------------------------------------------
  // Test 3 — Passwords don't match: inline validation error
  // -------------------------------------------------------------------------
  /**
   * When the password and confirm-password fields contain different values,
   * submitting (or blurring) must trigger a client-side validation error
   * explaining that the passwords do not match.
   */
  test("3: Passwords don't match — shows mismatch validation error", async ({
    page,
  }) => {
    // Use any token string — we never reach the API call here.
    await page.goto("/reset-password?token=some-token");
    await page.waitForLoadState("domcontentloaded");

    await expect(passwordInput(page)).toBeVisible({ timeout: 10000 });

    await passwordInput(page).fill(VALID_PASSWORD);
    await confirmPasswordInput(page).fill("DifferentPassword123!");

    // Submit or blur to trigger validation.
    await page.locator('button[type="submit"]').click();

    // A validation error about non-matching passwords must appear.
    const matchError = page.locator("body");
    await expect(matchError).toContainText(
      /match|do not match|passwords must match|confirm/i,
      { timeout: 10000 }
    );

    // Alternative: also accept a visible red element anywhere on the page.
    // (Belt-and-suspenders — the text assertion above is the primary check.)
  });

  // -------------------------------------------------------------------------
  // Test 4 — Password too short: validation error
  // -------------------------------------------------------------------------
  /**
   * A password with fewer than 8 characters must be rejected with a validation
   * error explaining the minimum length requirement before any API call is made.
   */
  test("4: Password too short — shows minimum-length validation error", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=some-token");
    await page.waitForLoadState("domcontentloaded");

    await expect(passwordInput(page)).toBeVisible({ timeout: 10000 });

    // "short" is only 5 characters — well below the 8-character minimum.
    await passwordInput(page).fill("short");
    await confirmPasswordInput(page).fill("short");

    await page.locator('button[type="submit"]').click();

    // A validation error about password length must appear.
    await expect(page.locator("body")).toContainText(
      /8|minimum|at least|too short|characters/i,
      { timeout: 10000 }
    );
  });

  // -------------------------------------------------------------------------
  // Test 5 — Input types are "password" (not "text")
  // -------------------------------------------------------------------------
  /**
   * Both password fields must have type="password" so that the browser masks
   * the entered characters.  Using type="text" would be a security defect.
   */
  test("5: Password inputs have type='password' (characters are masked)", async ({
    page,
  }) => {
    await page.goto("/reset-password?token=any-token");
    await page.waitForLoadState("domcontentloaded");

    await expect(passwordInput(page)).toBeVisible({ timeout: 10000 });
    await expect(confirmPasswordInput(page)).toBeVisible({ timeout: 10000 });

    // Assert type="password" on both inputs.
    await expect(passwordInput(page)).toHaveAttribute("type", "password");
    await expect(confirmPasswordInput(page)).toHaveAttribute("type", "password");
  });

  // -------------------------------------------------------------------------
  // Test 6 — Full happy-path flow (SKIPPED — needs DB token seeding endpoint)
  // -------------------------------------------------------------------------
  /**
   * A complete reset-password flow would require:
   *   1. Creating a user account.
   *   2. Seeding a valid PasswordResetToken row into the database via a test
   *      helper endpoint (e.g. POST /api/test/seed-reset-token).
   *   3. Navigating to /reset-password?token={seeded-token}.
   *   4. Filling in the new password and submitting.
   *   5. Asserting the success message is shown with a link back to /login.
   *
   * This test is skipped until a seed endpoint for reset tokens is available.
   */
  test.skip("6: Full flow with seeded token — success message with link to login", async ({
    page,
  }) => {
    // Step 1: Would create a user via signupTestUser() or the API directly.
    // Step 2: Would POST to /api/test/seed-reset-token to get a valid token.
    // const { token } = await seedResetToken(userEmail);

    // Step 3: Navigate to the reset page with the real token.
    // await page.goto(`/reset-password?token=${token}`);
    // await page.waitForLoadState("domcontentloaded");

    // Step 4: Fill and submit.
    // await passwordInput(page).fill(VALID_PASSWORD);
    // await confirmPasswordInput(page).fill(VALID_PASSWORD);
    // await page.locator('button[type="submit"]').click();

    // Step 5: Success message + link to login.
    // await expect(page.locator("body")).toContainText(
    //   /password.*reset|success|updated/i,
    //   { timeout: 15000 }
    // );
    // const loginLink = page.locator('a[href="/login"]');
    // await expect(loginLink).toBeVisible();
    // await loginLink.click();
    // await page.waitForURL("**/login");
    // await expect(page).toHaveURL(/\/login/);
  });
});
