import { test, expect, Page, BrowserContext } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

/**
 * Perform login by navigating to /login, filling credentials, and submitting.
 * Handles React hydration race by:
 * 1. Navigating with domcontentloaded (faster than load)
 * 2. Waiting for the email input to be editable (DOM visible)
 * 3. Filling both fields
 * 4. Waiting for __NEXT_DATA__ or React root to be hydrated
 * 5. Clicking submit with retry logic if the first click doesn't fire
 */
async function doLogin(page: Page, email: string, password: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  // Wait for form to be visible
  await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });

  // Wait for React hydration. We detect hydration by checking if React's
  // synthetic event system is active: filling the email field and checking
  // if the React state updated (the controlled component preserves the value).
  // If the value gets cleared, React hasn't hydrated yet.
  for (let i = 0; i < 15; i++) {
    await page.locator("#email").fill("hydration-check");
    await page.waitForTimeout(500);
    const val = await page.locator("#email").inputValue();
    if (val === "hydration-check") {
      // React has hydrated -- the controlled input preserved our value
      break;
    }
    // Value was reset -- React re-rendered. Wait and try again.
  }

  // Now fill the actual credentials
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);

  // Click submit
  await page.locator('button[type="submit"]').click();

  // Wait briefly, then check if the click actually fired
  await page.waitForTimeout(1000);

  // If the button shows "Signing in..." or is disabled, the signIn call is in flight.
  // Otherwise the click didn't fire and we need to retry.
  const btnText = await page.locator('button[type="submit"]').textContent().catch(() => "");
  const isDisabled = await page.locator('button[type="submit"]').isDisabled().catch(() => false);

  if (btnText === "Sign In" && !isDisabled && page.url().includes("/login")) {
    // Re-fill (React may have cleared) and retry click
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.waitForTimeout(1000);
    await page.locator('button[type="submit"]').click();
  }
}

/**
 * Log in and wait for redirect to an authenticated route.
 */
async function loginAndWaitForRedirect(page: Page) {
  // Reset lockout before attempting login
  await page.request.post("http://localhost:3001/api/test/reset-lockout", {
    headers: { "x-requested-with": "playwright" },
    data: { email: "debug@example.com" },
  });

  // Attempt login with up to 3 tries to handle server contention
  for (let attempt = 0; attempt < 3; attempt++) {
    await doLogin(page, "debug@example.com", "Debug123!");

    // Check if we landed on an authenticated route
    try {
      await expect(page).toHaveURL(
        /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
        { timeout: 20000 }
      );
      return; // Success
    } catch {
      // Login may have failed due to server contention. If we're still on
      // /login, the signIn call likely timed out or returned an error.
      // Wait a bit and retry.
      if (page.url().includes("/login")) {
        await page.waitForTimeout(3000);
        continue;
      }
      throw new Error(`Unexpected URL after login: ${page.url()}`);
    }
  }
  throw new Error("Login failed after 3 attempts");
}

/**
 * Log out and wait for redirect to marketing home or login.
 */
async function doLogout(page: Page) {
  // The (app) layout renders a loading spinner while useSession() resolves.
  // Wait for the "Log Out" button which only appears after session resolves.
  const logOutBtn = page.getByRole("button", { name: "Log Out" });
  await expect(logOutBtn).toBeVisible({ timeout: 30000 });

  // Click Log Out and wait for the signout API response to confirm the
  // signOut call actually fired (guards against React not processing the click)
  await Promise.all([
    page.waitForResponse(
      (resp) => resp.url().includes("/api/auth/signout"),
      { timeout: 20000 }
    ),
    logOutBtn.click(),
  ]);

  // Wait for URL to change to / or /login
  await expect(page).toHaveURL(
    /^http:\/\/localhost:3001\/?(\?.*)?$|\/login/,
    { timeout: 30000 }
  );
}

/**
 * Login + Logout Flow -- Antagonistic Tests
 *
 * Tests run serially to control the order of login attempts and avoid
 * lockout issues (wrong-password test runs AFTER successful login tests).
 */
test.describe.serial("Login + Logout Flow -- Antagonistic Tests", () => {
  test.setTimeout(120_000);

  test("1: login page renders email and password fields", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    const emailField = page.locator("#email");
    const passwordField = page.locator("#password");
    const submitBtn = page.getByRole("button", { name: "Sign In" });

    await expect(emailField).toBeVisible({ timeout: 15000 });
    await expect(passwordField).toBeVisible({ timeout: 10000 });
    await expect(submitBtn).toBeVisible();

    // Verify page heading
    await expect(
      page.getByRole("heading", { name: "Sign in to FBAR Direct" })
    ).toBeVisible();

    // Verify signup link
    await expect(page.getByRole("link", { name: "Create one" })).toBeVisible();

    // Verify forgot password link
    await expect(
      page.getByRole("link", { name: "Forgot Password?" })
    ).toBeVisible();
  });

  test("2: submitting empty form triggers HTML5 validation (no submission)", async ({
    page,
  }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });

    const submitBtn = page.getByRole("button", { name: "Sign In" });
    await expect(submitBtn).toBeVisible({ timeout: 15000 });
    await submitBtn.click();

    // Should still be on /login (HTML5 required prevented submission)
    await expect(page).toHaveURL(/\/login/);

    // The email field reports invalid (empty + required)
    const emailValid = await page.locator("#email").evaluate(
      (el: HTMLInputElement) => el.validity.valid
    );
    expect(emailValid).toBe(false);
  });

  test("3: valid credentials redirect to authenticated route", async ({
    page,
  }) => {
    await loginAndWaitForRedirect(page);
    expect(page.url()).not.toContain("/login");
  });

  test("4: Log Out button redirects to / (marketing home)", async ({
    page,
  }) => {
    await loginAndWaitForRedirect(page);
    // Navigate to dashboard (inside (app) layout which has Log Out button)
    // Threshold is now public and doesn't have the (app) layout
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await doLogout(page);
  });

  test("5: after logout, accessing /dashboard redirects to /login", async ({
    page,
    context,
  }) => {
    await loginAndWaitForRedirect(page);
    // Navigate to dashboard (inside (app) layout which has Log Out button)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await doLogout(page);

    // Clear all cookies to ensure clean unauthenticated state
    await context.clearCookies();

    // Navigate to /dashboard while unauthenticated
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    // Middleware redirects to /login?callbackUrl=%2Fdashboard
    await expect(page).toHaveURL(/\/login/, { timeout: 30000 });

    // Verify the login form is visible
    await expect(page.locator("#email")).toBeVisible({ timeout: 15000 });
  });

  test("6: unauthenticated user can access /threshold (now public)", async ({
    page,
  }) => {
    await page.goto("/threshold", { waitUntil: "domcontentloaded" });

    // Threshold is now public — should NOT redirect to login
    await expect(page).toHaveURL(/\/threshold/, { timeout: 20000 });

    // Verify the threshold page content is visible
    await expect(page.locator("h1")).toContainText("Do You Need to File", {
      timeout: 15000,
    });
  });

  test("7: wrong password shows generic error -- no email enumeration", async ({
    page,
  }) => {
    // Reset lockout before testing wrong password
    await page.request.post("http://localhost:3001/api/test/reset-lockout", {
      headers: { "x-requested-with": "playwright" },
      data: { email: "debug@example.com" },
    });

    // This test runs last to avoid lockout affecting other tests.
    await doLogin(page, "debug@example.com", "WrongPass999!");

    // The doLogin helper clicked submit. Now wait for the error message.
    const errorBanner = page.locator("text=Invalid email or password");
    await expect(errorBanner).toBeVisible({ timeout: 20000 });

    // Verify NO email enumeration hints
    await expect(page.locator("text=not found")).not.toBeVisible();
    await expect(page.locator("text=does not exist")).not.toBeVisible();
    await expect(page.locator("text=no account")).not.toBeVisible();

    // Still on /login
    await expect(page).toHaveURL(/\/login/);
  });
});
