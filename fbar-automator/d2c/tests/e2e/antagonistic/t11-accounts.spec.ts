import { test, expect, type Page } from "@playwright/test";

/**
 * Antagonistic tests for the Accounts wizard step.
 *
 * Tests the full CRUD lifecycle of foreign accounts:
 * - Adding a new foreign account via the form
 * - Editing an existing account (pre-fill verification + update)
 * - Deleting an account with confirmation dialog
 * - Continue to review with at least one account
 *
 * Uses the seeded debug@example.com user.
 */

/**
 * Log in via the NextAuth callback API and inject the session cookie into the browser.
 * This is much faster than browser-based login because it skips client-side React rendering.
 * The bcrypt-heavy auth flow still runs server-side, but we only wait for the HTTP response.
 */
async function apiLogin(page: Page, email = "debug@example.com", password = "Debug123!") {
  // Use 127.0.0.1 to avoid IPv6 resolution issues (::1 can get ECONNREFUSED)
  const baseURL = "http://127.0.0.1:3001";
  const context = page.context();

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      // 1. Get CSRF token
      const csrfResp = await context.request.get(`${baseURL}/api/auth/csrf`);
      const { csrfToken } = await csrfResp.json();

      // 2. POST credentials to callback endpoint
      const callbackResp = await context.request.post(
        `${baseURL}/api/auth/callback/credentials`,
        {
          form: { email, password, csrfToken, json: "true" },
          maxRedirects: 0,
        }
      );

      // 3. Extract session cookies — check both localhost and 127.0.0.1
      const cookies = await context.cookies([baseURL, "http://localhost:3001"]);
      const sessionCookie = cookies.find((c) => c.name.includes("session-token"));

      if (!sessionCookie) {
        throw new Error(`No session cookie after login attempt ${attempt}`);
      }

      // Ensure session cookie is also available for localhost domain (browser uses localhost)
      if (sessionCookie.domain === "127.0.0.1") {
        await context.addCookies([
          { ...sessionCookie, domain: "localhost" },
        ]);
      }

      // Login succeeded — the cookie is set on the context
      return;
    } catch (err) {
      if (attempt === 3) throw new Error(`API login failed after 3 attempts: ${err}`);
      // Wait before retry
      await page.waitForTimeout(5_000);
    }
  }
}

test.describe("Accounts Wizard Step - Add, Edit, Delete foreign accounts", () => {
  test.use({ baseURL: "http://localhost:3001" });

  test("full accounts CRUD lifecycle", async ({ page }) => {
    test.setTimeout(300_000); // 5 minutes — bcrypt under concurrent load is very slow

    // Accept dialogs (for delete confirmation) throughout the test
    page.on("dialog", (dialog) => dialog.accept());

    // ── SETUP: Login as debug user via API and navigate to /accounts ──

    await apiLogin(page);
    await page.goto("/accounts", { waitUntil: "domcontentloaded", timeout: 60_000 });

    // ── TEST 1: Page heading visible ──

    // Debug: check what URL we actually landed on
    console.log("[t11] Current URL after goto /accounts:", page.url());
    await page.screenshot({ path: "test-results/t11-debug-after-goto.png" });

    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 30_000 });

    // Wait for loading skeletons to disappear (API calls complete)
    await expect(
      page.locator('[aria-label="Loading accounts"]')
    ).not.toBeVisible({ timeout: 30_000 });

    // Defensive: import banner should not be visible (seeded user has accounts for default year)
    await expect(page.locator('[data-testid="import-banner"]')).not.toBeVisible({ timeout: 5000 });

    // Handle tier selector (shown when user has no accounts yet)
    const tierButton = page.locator("button:has-text('Enter accounts manually')");
    if (await tierButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await tierButton.click();
    }

    // ── TEST 2: "Add Foreign Account" button is visible ──

    const addBtn = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtn).toBeVisible({ timeout: 10_000 });

    // ── TEST 3: Click "Add Foreign Account" -> form appears with expected fields ──

    await addBtn.click();

    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10_000 });

    await expect(page.locator("#new-account-institutionName")).toBeVisible();
    await expect(page.locator("#new-account-accountNumber")).toBeVisible();
    await expect(page.locator("#new-account-countryCode")).toBeVisible();
    await expect(page.locator("#new-account-currencyCode")).toBeVisible();
    await expect(page.locator("#new-account-maxValueLocal")).toBeVisible();
    await expect(page.locator("#new-account-ownershipType")).toBeVisible();

    // ── TEST 4: Fill form and save -> account card appears ──

    // Use a unique bank name to avoid conflicts with other test runs
    const bankName = `TestBank-${Date.now()}`;
    const updatedBankName = `Updated-${Date.now()}`;

    await page.locator("#new-account-institutionName").fill(bankName);
    await page.locator("#new-account-accountNumber").fill("CH1234567890");
    await page.locator("#new-account-countryCode").selectOption({ index: 1 });
    await page.locator("#new-account-currencyCode").selectOption({ index: 1 });
    await page.locator("#new-account-maxValueLocal").fill("50000");

    // Save and wait for the API response
    const saveResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/accounts") && resp.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.status()).toBeLessThan(400);

    // Wait for the data to reload (page re-fetches accounts after save)
    await page.waitForTimeout(1_000);

    // Card should appear with the bank name
    await expect(
      page.locator(`text=${bankName}`)
    ).toBeVisible({ timeout: 30_000 });

    // "Add Foreign Account" button should be visible again (form closed)
    await expect(
      page.locator("button:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10_000 });

    // ── TEST 5: Account card shows correct information ──

    // Should show masked last 4 digits
    await expect(
      page.locator("text=****7890").last()
    ).toBeVisible({ timeout: 5_000 });

    // Should show formatted max value
    await expect(
      page.locator("text=50,000").last()
    ).toBeVisible({ timeout: 5_000 });

    // ── TEST 6: Edit -> form pre-fills with saved data ──

    // Click Edit on the specific account card we just added
    const editBtn = page.locator(`button[aria-label="Edit ${bankName} account"]`);
    await expect(editBtn).toBeVisible({ timeout: 5_000 });
    await editBtn.click();

    await expect(
      page.locator("h3:has-text('Edit Account')")
    ).toBeVisible({ timeout: 10_000 });

    // Institution name should be pre-filled
    const editNameInput = page.locator("input[placeholder='e.g., HSBC, Deutsche Bank']").first();
    await expect(editNameInput).toHaveValue(bankName, { timeout: 5_000 });

    // Account number should show masked value
    const editAccountNum = page.locator("input[id*='accountNumber']").first();
    await expect(editAccountNum).toHaveValue(/^\*\*\*\*7890$/, { timeout: 5_000 });

    // ── TEST 7: Change institution name -> save -> card shows updated name ──

    await editNameInput.clear();
    await editNameInput.fill(updatedBankName);

    const saveChangesBtn = page.locator("button:has-text('Save Changes')");
    await saveChangesBtn.scrollIntoViewIfNeeded();

    // Wait for the PUT API response
    const editResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/accounts/") && resp.request().method() === "PUT",
      { timeout: 30_000 }
    );
    await saveChangesBtn.click();
    const editResponse = await editResponsePromise;
    expect(editResponse.status()).toBeLessThan(400);

    // Wait for the edit form to close
    await expect(saveChangesBtn).not.toBeVisible({ timeout: 15_000 });

    // Wait for the updated card to appear
    await expect(
      page.locator(`text=${updatedBankName}`)
    ).toBeVisible({ timeout: 15_000 });

    // Old name should be gone
    await expect(
      page.locator(`text=${bankName}`)
    ).not.toBeVisible({ timeout: 5_000 });

    // ── TEST 8: Delete account -> confirm dialog -> account removed ──

    const deleteBtn = page.locator(`button[aria-label="Delete ${updatedBankName} account"]`);
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
    await deleteBtn.click();

    // Account card should disappear
    await expect(
      page.locator(`text=${updatedBankName}`)
    ).not.toBeVisible({ timeout: 10_000 });

    // ── TEST 9: Add a new account for the Continue flow ──

    await page.locator("button:has-text('Add Foreign Account')").click();

    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10_000 });

    const finalBankName = `FinalBank-${Date.now()}`;
    await page.locator("#new-account-institutionName").fill(finalBankName);
    await page.locator("#new-account-accountNumber").fill("DE9876543210");
    await page.locator("#new-account-countryCode").selectOption({ index: 1 });
    await page.locator("#new-account-currencyCode").selectOption({ index: 1 });
    await page.locator("#new-account-maxValueLocal").fill("75000");

    await page.locator("button:has-text('Save Account')").click();

    await expect(
      page.locator(`text=${finalBankName}`)
    ).toBeVisible({ timeout: 30_000 });

    // ── TEST 10: Click Continue -> redirects to /review ──

    const continueReviewBtn = page.locator("button:has-text('Continue to Review')");
    await expect(continueReviewBtn).toBeVisible({ timeout: 10_000 });

    await continueReviewBtn.click();

    await page.waitForURL("**/review", { timeout: 15_000 });
    expect(page.url()).toContain("/review");
  });
});
