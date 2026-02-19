import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// Dev server is slow (Next.js compiles routes on demand). Allow extra time.
test.setTimeout(60_000);

const TEST_PASSWORD = "TestPassword123!";

/**
 * Create user via API, login via browser, navigate through threshold to /personal.
 */
async function getToPersonalPage(page: Page): Promise<void> {
  const email = `t10-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  // Create user via signup API
  const response = await page.request.post("/api/auth/signup", {
    data: {
      firstName: "Test",
      lastName: "User",
      email,
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
    },
  });
  if (response.status() !== 201) {
    throw new Error(`Signup API failed: ${response.status()} ${await response.text()}`);
  }

  // Login via browser
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
  await page.fill("#email", email);
  await page.fill("#password", TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30_000 });

  // Navigate to threshold if needed
  if (!page.url().includes("/threshold")) {
    await page.goto("/threshold", { timeout: 30_000, waitUntil: "networkidle" });
  }

  // Complete threshold — wait for React hydration first
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2000);
  await firstYes.click();

  // After clicking Yes on Q1, Q2 should appear. Retry click if needed.
  const secondYes = page.locator("button:has-text('Yes')").nth(1);
  try {
    await expect(secondYes).toBeVisible({ timeout: 10_000 });
  } catch {
    await firstYes.click();
    await expect(secondYes).toBeVisible({ timeout: 10_000 });
  }
  await secondYes.click();

  const continueBtn = page.locator("text=Continue to Personal Information");
  await expect(continueBtn).toBeVisible({ timeout: 15_000 });
  await continueBtn.click();
  await page.waitForURL("**/personal", { timeout: 30_000, waitUntil: "domcontentloaded" });

  // Wait for form to render
  await expect(page.locator("h1")).toContainText("Personal Information", {
    timeout: 10_000,
  });

  // Wait for API data to load — firstName gets pre-filled from user record.
  await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30_000 });
  await page.waitForTimeout(1500); // Extra settle time for React re-renders
}

test.describe("Personal Information Wizard Step — Antagonistic Tests", () => {
  test.describe.configure({ retries: 1 }); // API-based auth has transient MissingCSRF failures
  test("all expected form fields render on /personal", async ({ page }) => {
    await getToPersonalPage(page);

    // Heading
    await expect(page.locator("h1")).toContainText("Personal Information");

    // Name fields (pre-filled from user record)
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#firstName")).toHaveValue("Test");
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#lastName")).toHaveValue("User");

    // Middle name and suffix (optional)
    await expect(page.locator("#middleName")).toBeVisible();
    await expect(page.locator("#suffix")).toBeVisible();

    // TIN type selector (SSN/ITIN dropdown)
    const tinType = page.locator("#tinType");
    await expect(tinType).toBeVisible();
    await expect(tinType.locator("option")).toHaveCount(2);
    await expect(tinType.locator("option").nth(0)).toHaveText("SSN");
    await expect(tinType.locator("option").nth(1)).toHaveText("ITIN");

    // SSN/ITIN input
    await expect(page.locator("#tin")).toBeVisible();
    await expect(page.locator("#tin")).toHaveAttribute("maxLength", "11");

    // Date of birth
    await expect(page.locator("#dateOfBirth")).toBeVisible();
    await expect(page.locator("#dateOfBirth")).toHaveAttribute("type", "date");

    // Address fields
    await expect(page.locator("#street")).toBeVisible();
    await expect(page.locator("#street2")).toBeVisible();
    await expect(page.locator("#city")).toBeVisible();
    await expect(page.locator("#state")).toBeVisible();
    await expect(page.locator("#zip")).toBeVisible();
    await expect(page.locator("#zip")).toHaveAttribute("maxLength", "10");

    // Phone (optional)
    await expect(page.locator("#phone")).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: "Save & Continue to Accounts" })
    ).toBeVisible();
  });

  test("state dropdown has 50+ options (all US states + territories)", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    const stateSelect = page.locator("#state");
    // Wait for select to be visible and have options (React hydration + data load)
    await expect(stateSelect).toBeVisible({ timeout: 15_000 });
    // Wait for options to populate (useEffect loads data async)
    await page.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15_000 }
    );

    const options = stateSelect.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(51);

    await expect(options.first()).toHaveText("Select state");
    // Verify placeholder option has empty value via attribute (toHaveValue only works on inputs)
    await expect(options.first()).toHaveAttribute("value", "");

    const values = await stateSelect.locator("option").allTextContents();
    expect(values).toContain("CA");
    expect(values).toContain("NY");
    expect(values).toContain("TX");
  });

  test("submit empty form triggers browser validation (required fields)", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    // Clear the pre-filled name fields (must use triple-click + delete to clear React controlled inputs)
    await page.locator("#firstName").click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.locator("#lastName").click({ clickCount: 3 });
    await page.keyboard.press("Backspace");

    // Clear the TIN if pre-filled
    await page.locator("#tin").focus();
    await page.locator("#tin").click({ clickCount: 3 });
    await page.keyboard.press("Backspace");

    await page
      .getByRole("button", { name: "Save & Continue to Accounts" })
      .click();

    // Should still be on /personal (validation prevented navigation)
    await expect(page).toHaveURL(/\/personal/);
  });

  test("submit with names but missing TIN triggers browser validation on TIN", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    await page
      .getByRole("button", { name: "Save & Continue to Accounts" })
      .click();

    await expect(page).toHaveURL(/\/personal/);

    const msg = await page
      .locator("#tin")
      .evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(msg.length).toBeGreaterThan(0);
  });

  test("SSN input auto-formats digits with dashes", async ({ page }) => {
    await getToPersonalPage(page);

    const tinInput = page.locator("#tin");
    await tinInput.focus();
    await tinInput.fill("123456789");

    await expect(tinInput).toHaveValue("123-45-6789");
  });

  test("SSN masks on blur after entry", async ({ page }) => {
    await getToPersonalPage(page);

    const tinInput = page.locator("#tin");
    await tinInput.focus();
    await tinInput.fill("123456789");
    await expect(tinInput).toHaveValue("123-45-6789");

    await tinInput.blur();
    await expect(tinInput).toHaveValue("***-**-6789");
  });

  test("TIN type can be toggled between SSN and ITIN", async ({ page }) => {
    await getToPersonalPage(page);

    const tinType = page.locator("#tinType");
    await expect(tinType).toHaveValue("SSN");

    await tinType.selectOption("ITIN");
    await expect(tinType).toHaveValue("ITIN");

    await tinType.selectOption("SSN");
    await expect(tinType).toHaveValue("SSN");
  });

  test("fill valid data and submit redirects to /accounts", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await getToPersonalPage(page);

    // Wait for state dropdown to have options (useEffect data load)
    await page.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15_000 }
    );

    // Fill address fields
    await page.locator("#street").fill("123 Test St");
    await page.locator("#city").fill("Testville");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zip").fill("90210");

    // Set date of birth via evaluate (Playwright fill on type=date can be unreliable)
    await page.locator("#dateOfBirth").evaluate(
      (el: HTMLInputElement) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )!.set!;
        nativeInputValueSetter.call(el, '1990-01-15');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    );

    // Fill TIN last — focus first, type digits, then submit via keyboard (Enter)
    // to avoid the blur event that masks the TIN value before form submission
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123-45-6789");

    // Submit via Enter key while TIN is still focused — this avoids blur masking
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/accounts/, { timeout: 30_000 });
  });

  test("invalid ZIP code format triggers server-side validation error", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.locator("#dateOfBirth").fill("1990-01-15");
    await page.locator("#street").fill("123 Test St");
    await page.locator("#city").fill("Testville");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zip").fill("ABCDE");

    await page
      .getByRole("button", { name: "Save & Continue to Accounts" })
      .click();

    await expect(page).toHaveURL(/\/personal/);
    await expect(page.locator('[role="alert"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("submit button shows 'Saving...' while request is in flight", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    // Wait for state dropdown to populate
    await page.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15_000 }
    );

    await page.locator("#tin").focus();
    await page.locator("#tin").pressSequentially("123456789", { delay: 20 });
    await page.locator("#dateOfBirth").fill("1990-01-15");
    await page.locator("#street").fill("123 Test St");
    await page.locator("#city").fill("Testville");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zip").fill("90210");

    // Intercept API to add delay so we can observe loading state
    await page.route("**/api/user", async (route) => {
      if (route.request().method() === "PUT") {
        await new Promise((r) => setTimeout(r, 3000));
      }
      await route.continue();
    });

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // After click, button should show "Saving..." and be disabled
    await expect(submitBtn).toContainText("Saving", { timeout: 5000 });
    await expect(submitBtn).toBeDisabled();
  });
});
