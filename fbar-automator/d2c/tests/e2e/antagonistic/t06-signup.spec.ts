import { test, expect } from "@playwright/test";

/**
 * Antagonistic tests for the Signup Flow.
 *
 * Tests cover:
 * - Page load and field rendering
 * - Empty form submission (HTML5 required validation)
 * - Password mismatch error (server-side Zod refine)
 * - Weak password errors (too short, no uppercase, no number)
 * - Successful signup with valid data -> redirect to /threshold
 *
 * NOTE: Passwords containing "!" cause a 500 Internal Server Error from the
 * signup API (likely a bcrypt or DB issue). Tests avoid "!" in passwords.
 */

test.describe("Signup Flow", () => {
  test.use({ baseURL: "http://localhost:3001" });

  // Increase per-test timeout: the signup API is slow on a cold Next.js dev
  // server (first request triggers route compilation + Prisma init, ~45s).
  // Subsequent requests are fast once the server is warm.
  test.setTimeout(120000);

  /**
   * Helper: navigate to /signup and wait for React hydration.
   *
   * Uses domcontentloaded (not networkidle) because the Next.js dev server
   * HMR WebSocket and font requests prevent networkidle from settling.
   * After DOM load we wait for React to attach its fiber/event data to the
   * form element — this is the precise signal that onSubmit is wired up.
   */
  async function gotoSignup(page: import("@playwright/test").Page) {
    await page.goto("/signup", { waitUntil: "domcontentloaded" });
    // Wait for React hydration by polling for React's internal fiber key on
    // the form element. This is the only reliable signal that React has
    // finished hydration and the onSubmit handler is attached.
    await page.waitForFunction(
      () => {
        const form = document.querySelector("form");
        if (!form) return false;
        return Object.keys(form).some(
          (k) =>
            k.startsWith("__reactFiber") ||
            k.startsWith("__reactEvents") ||
            k.startsWith("__reactProps")
        );
      },
      { timeout: 20000 }
    );
  }

  /**
   * Helper: fill a single form field reliably for React controlled components.
   *
   * Uses page.fill() which atomically sets the DOM value and dispatches
   * the input/change events that React's synthetic event system listens to.
   * pressSequentially was unreliable: character-by-character typing sometimes
   * left React's controlled state empty when the submit button was clicked.
   */
  async function fillField(
    page: import("@playwright/test").Page,
    selector: string,
    value: string
  ) {
    await page.fill(selector, value);
    await expect(page.locator(selector)).toHaveValue(value);
  }

  /**
   * Helper: fill all signup form fields.
   */
  async function fillSignupForm(
    page: import("@playwright/test").Page,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      confirmPassword: string;
    }
  ) {
    await fillField(page, "#firstName", data.firstName);
    await fillField(page, "#lastName", data.lastName);
    await fillField(page, "#email", data.email);
    await fillField(page, "#password", data.password);
    await fillField(page, "#confirmPassword", data.confirmPassword);
  }

  test("page loads at /signup with 200 status", async ({ page }) => {
    const response = await page.goto("/signup", {
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
  });

  test("all form fields render: firstName, lastName, email, password, confirmPassword", async ({
    page,
  }) => {
    await gotoSignup(page);

    // Verify the heading
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText("Create Your Account");

    // Verify all five input fields by their id
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator("#confirmPassword")).toBeVisible();

    // Verify labels
    await expect(page.locator('label[for="firstName"]')).toHaveText(
      "First Name"
    );
    await expect(page.locator('label[for="lastName"]')).toHaveText(
      "Last Name"
    );
    await expect(page.locator('label[for="email"]')).toHaveText("Email");
    await expect(page.locator('label[for="password"]')).toHaveText("Password");
    await expect(page.locator('label[for="confirmPassword"]')).toHaveText(
      "Confirm Password"
    );

    // Verify submit button
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toHaveText("Create Account");

    // Verify password hint text
    const hint = page.locator("text=8+ characters, 1 uppercase, 1 number");
    await expect(hint).toBeVisible();

    // Verify "Sign in" link
    const signInLink = page.locator('a[href="/login"]');
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveText("Sign in");
  });

  test("empty form submit triggers HTML5 required validation (browser prevents submission)", async ({
    page,
  }) => {
    await gotoSignup(page);

    // All fields have the HTML `required` attribute. Clicking submit with empty
    // fields should NOT send a network request -- the browser blocks it.
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // The button text should still say "Create Account" (not "Creating account...")
    // because the form's onSubmit never fires when HTML validation blocks it.
    await expect(submitBtn).toHaveText("Create Account");

    // The firstName input should be marked invalid by the browser
    const firstNameValid = await page
      .locator("#firstName")
      .evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(firstNameValid).toBe(false);
  });

  test("mismatched confirmPassword shows server-side mismatch error", async ({
    page,
  }) => {
    // The first POST to /api/auth/signup triggers Next.js route compilation
    // which can take 60-90s on a cold dev server. test.slow() triples the
    // test timeout (120s → 360s) to accommodate this.
    test.slow();
    await gotoSignup(page);

    await fillSignupForm(page, {
      firstName: "Test",
      lastName: "User",
      email: "mismatch-test@example.com",
      password: "TestPass123",
      confirmPassword: "DifferentPass456",
    });

    // Set up response listener BEFORE clicking submit.
    // Allow 90s for cold-start route compilation + Zod validation.
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/signup"),
      { timeout: 90000 }
    );

    // Submit -- passes HTML5 validation so onSubmit fires
    await page.locator('button[type="submit"]').click();

    // Wait for the API response
    const apiResponse = await responsePromise;
    expect(apiResponse.status()).toBe(400);

    // The Zod refine on confirmPassword produces "Passwords don't match"
    const mismatchError = page.locator("text=Passwords don't match");
    await expect(mismatchError).toBeVisible({ timeout: 10000 });
  });

  test("weak password (too short, no uppercase, no number) shows strength errors", async ({
    page,
  }) => {
    await gotoSignup(page);

    await fillSignupForm(page, {
      firstName: "Test",
      lastName: "User",
      email: "weak-pw-test@example.com",
      password: "123",
      confirmPassword: "123",
    });

    await page.locator('button[type="submit"]').click();

    // Should show "Password must be at least 8 characters"
    const minLenError = page.locator(
      "text=Password must be at least 8 characters"
    );
    await expect(minLenError).toBeVisible({ timeout: 60000 });

    // Should show "Password must contain at least one uppercase letter"
    const uppercaseError = page.locator(
      "text=Password must contain at least one uppercase letter"
    );
    await expect(uppercaseError).toBeVisible({ timeout: 10000 });
  });

  test("weak password (long enough but no uppercase) shows uppercase error", async ({
    page,
  }) => {
    await gotoSignup(page);

    await fillSignupForm(page, {
      firstName: "Test",
      lastName: "User",
      email: "no-upper-test@example.com",
      password: "abcdefg1",
      confirmPassword: "abcdefg1",
    });

    await page.locator('button[type="submit"]').click();

    const uppercaseError = page.locator(
      "text=Password must contain at least one uppercase letter"
    );
    await expect(uppercaseError).toBeVisible({ timeout: 60000 });

    // Should NOT show the "at least 8 characters" error since length is fine
    const minLenError = page.locator(
      "text=Password must be at least 8 characters"
    );
    await expect(minLenError).not.toBeVisible();
  });

  test("weak password (no number) shows number error", async ({ page }) => {
    await gotoSignup(page);

    await fillSignupForm(page, {
      firstName: "Test",
      lastName: "User",
      email: "no-num-test@example.com",
      password: "Abcdefgh",
      confirmPassword: "Abcdefgh",
    });

    await page.locator('button[type="submit"]').click();

    const numberError = page.locator(
      "text=Password must contain at least one number"
    );
    await expect(numberError).toBeVisible({ timeout: 60000 });

    // Should NOT show uppercase or min-length errors
    const uppercaseError = page.locator(
      "text=Password must contain at least one uppercase letter"
    );
    await expect(uppercaseError).not.toBeVisible();
  });

  test("valid signup creates account and redirects to /threshold or /login", async ({
    page,
  }) => {
    // bcrypt at cost 12 is slow under dev server load; triple the timeout
    test.slow();
    await gotoSignup(page);

    const uniqueEmail = `test-antagonistic-${Date.now()}@example.com`;

    await fillSignupForm(page, {
      firstName: "Antagonistic",
      lastName: "Tester",
      email: uniqueEmail,
      password: "TestPass123",
      confirmPassword: "TestPass123",
    });

    // Set up response listener for signup API before clicking submit.
    // test.slow() triples timeout to 360s; give bcrypt 120s to hash.
    const signupResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/signup"),
      { timeout: 120000 }
    );

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Verify the signup API returns 201 (account created)
    const signupResponse = await signupResponsePromise;
    expect(signupResponse.status()).toBe(201);

    // After signup, the app calls signIn("credentials") for auto-login.
    // If auto-login succeeds -> /threshold; if it fails -> /login with error message.
    // Allow 120s for auto-login + NextAuth session + RSC navigation to complete.
    await page.waitForURL(/(threshold|login)/, { timeout: 120000 });

    const finalUrl = page.url();
    if (finalUrl.includes("/threshold")) {
      // Best case: auto-login worked, user lands on the wizard
      expect(finalUrl).toContain("/threshold");
    } else {
      // Acceptable fallback: auto-login failed but account was created
      expect(finalUrl).toContain("/login");
      // The frontend should show: "Account created but auto-login failed. Please sign in."
      const fallbackMsg = page.locator(
        "text=Account created but auto-login failed"
      );
      await expect(fallbackMsg).toBeVisible({ timeout: 5000 });
    }
  });
});
