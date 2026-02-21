import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// ---------------------------------------------------------------------------
// Serial suite — each test builds on state from the previous.
// One user, one browser page, shared across all 9 tests.
// ---------------------------------------------------------------------------
test.describe.serial("T18: Personal Info Form — Edge Cases", () => {
  test.describe.configure({ timeout: 90000 });

  const TEST_PASSWORD = "TestPass123!";
  const email = `t18-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  let page: Page;

  // -------------------------------------------------------------------------
  // Setup: create user, complete threshold, arrive at /personal
  // -------------------------------------------------------------------------
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // Sign up via API (avoids CSRF friction of the browser signup form)
    const resp = await page.request.post("/api/auth/signup", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: {
        firstName: "Edge",
        lastName: "Tester",
        email,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      },
    });
    if (resp.status() !== 201) {
      throw new Error(`Signup API failed: ${resp.status()} ${await resp.text()}`);
    }

    // Login via browser
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", email);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });

    // Navigate to threshold if needed
    if (!page.url().includes("/threshold")) {
      await page.goto("/threshold", { waitUntil: "networkidle", timeout: 30000 });
    }

    // Complete threshold — wait for React hydration first
    const firstYes = page.locator("button:has-text('Yes')").first();
    await expect(firstYes).toBeVisible({ timeout: 30000 });
    await page.waitForTimeout(2000);
    await firstYes.click();

    const secondYes = page.locator("button:has-text('Yes')").nth(1);
    try {
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    } catch {
      await firstYes.click();
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    }
    await secondYes.click();

    const continueBtn = page.locator("text=Continue to Personal Information");
    await expect(continueBtn).toBeVisible({ timeout: 15000 });
    await continueBtn.click();
    await page.waitForURL("**/personal", { timeout: 30000, waitUntil: "domcontentloaded" });

    // Wait for form data to load
    await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30000 });
    await page.waitForTimeout(1500);
  });

  test.afterAll(async () => {
    await page.close();
  });

  // =========================================================================
  // Helper: navigate back to /personal and wait for form to be ready
  // =========================================================================
  async function goToPersonalAndWait(pg: Page) {
    await pg.goto("/personal", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(pg.locator("h1")).toContainText("Personal Information", { timeout: 15000 });
    // Wait for /api/user to populate fields
    await expect(pg.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30000 });
    await pg.waitForTimeout(1500);
  }

  // =========================================================================
  // Helper: fill all required fields so form submission succeeds
  // =========================================================================
  async function fillRequiredFields(
    pg: Page,
    opts?: {
      tin?: string;
      dob?: string;
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    }
  ) {
    const {
      tin = "123456789",
      dob = "1990-06-15",
      street = "456 Edge Case Ave",
      city = "Testburg",
      state = "NY",
      zip = "10001",
    } = opts ?? {};

    // Wait for state dropdown to populate
    await pg.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15000 }
    );

    // TIN: focus first to dismiss any existing mask, then fill
    await pg.locator("#tin").focus();
    await pg.locator("#tin").fill(tin);

    // DOB: set via native setter so React controlled input reacts properly
    await pg.locator("#dateOfBirth").evaluate((el: HTMLInputElement, value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")!.set!;
      setter.call(el, value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, dob);

    await pg.locator("#street").fill(street);
    await pg.locator("#city").fill(city);
    await pg.locator("#state").selectOption(state);
    await pg.locator("#zip").fill(zip);
  }

  // =========================================================================
  // Test 1: Return filer — form pre-fills from /api/user data
  // =========================================================================
  test("Return filer: form pre-fills from /api/user data", async () => {
    // We are already on /personal from beforeAll. Fill and save the form.
    await fillRequiredFields(page);

    // Submit via Enter key while TIN is focused to avoid blur masking
    await page.locator("#tin").focus();
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });
    await expect(page).toHaveURL(/\/accounts/);

    // Return to /personal and verify pre-fills
    await goToPersonalAndWait(page);

    // Name fields pre-filled from signup
    await expect(page.locator("#firstName")).toHaveValue("Edge");
    await expect(page.locator("#lastName")).toHaveValue("Tester");

    // TIN should be masked (was saved from the submission above)
    const tinValue = await page.locator("#tin").inputValue();
    expect(tinValue).toMatch(/^\*{3}-\*{2}-\d{4}$/);

    // DOB should be pre-filled
    const dobValue = await page.locator("#dateOfBirth").inputValue();
    expect(dobValue).toBe("1990-06-15");

    // Address fields should be pre-filled
    await expect(page.locator("#street")).toHaveValue("456 Edge Case Ave");
    await expect(page.locator("#city")).toHaveValue("Testburg");
    await expect(page.locator("#zip")).toHaveValue("10001");
  });

  // =========================================================================
  // Test 2: ITIN type — selecting ITIN works with 9XX format
  // =========================================================================
  test("ITIN type: selecting ITIN works with 9XX format", async () => {
    await goToPersonalAndWait(page);

    // Switch TIN type to ITIN
    await page.locator("#tinType").selectOption("ITIN");
    await expect(page.locator("#tinType")).toHaveValue("ITIN");

    // Fill with a 9XX ITIN (first digit must be 9)
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("912345678");

    // Submit via Enter while TIN is focused
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });
    await expect(page).toHaveURL(/\/accounts/);

    // Return and verify ITIN type persisted
    await goToPersonalAndWait(page);
    await expect(page.locator("#tinType")).toHaveValue("ITIN");
  });

  // =========================================================================
  // Test 3: Phone — optional, accepts digits, persists
  // =========================================================================
  test("Phone: optional, accepts digits", async () => {
    await goToPersonalAndWait(page);

    // Fill the phone field
    await page.locator("#phone").fill("2125551234");

    // Submit (TIN is still masked but the form should carry through)
    // Focus TIN first to clear mask, then submit
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });
    await expect(page).toHaveURL(/\/accounts/);

    // Return and verify phone persisted
    await goToPersonalAndWait(page);
    const phoneValue = await page.locator("#phone").inputValue();
    expect(phoneValue).toMatch(/2125551234/);
  });

  // =========================================================================
  // Test 4: Middle name — saved and retrieved on return
  // =========================================================================
  test("Middle name: saved and retrieved on return", async () => {
    await goToPersonalAndWait(page);

    await page.locator("#middleName").fill("James");

    // Focus TIN to clear mask, then submit
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });

    // Return and verify middle name persisted
    await goToPersonalAndWait(page);
    await expect(page.locator("#middleName")).toHaveValue("James");
  });

  // =========================================================================
  // Test 5: Suffix — Jr/Sr/II/III accepted and persisted
  // =========================================================================
  test("Suffix: Jr/Sr/II/III accepted", async () => {
    await goToPersonalAndWait(page);

    const suffixLocator = page.locator("#suffix");

    // Determine if suffix is a select or a text input
    const tagName = await suffixLocator.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === "select") {
      await suffixLocator.selectOption("Jr");
    } else {
      // Text input
      await suffixLocator.fill("Jr");
    }

    // Focus TIN to clear mask, then submit
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });

    // Return and verify suffix persisted
    await goToPersonalAndWait(page);
    const suffixValue = await page.locator("#suffix").inputValue();
    expect(suffixValue).toBe("Jr");
  });

  // =========================================================================
  // Test 6: TIN unmasks on focus after blur
  // =========================================================================
  test("TIN unmasks on focus after blur", async () => {
    await goToPersonalAndWait(page);

    const tinInput = page.locator("#tin");

    // Focus and type a fresh TIN value
    await tinInput.focus();
    await tinInput.fill("123456789");

    // Verify the field auto-formats to dashes while focused
    await expect(tinInput).toHaveValue("123-45-6789");

    // Blur the field — masking should apply
    await tinInput.blur();
    await page.waitForTimeout(300); // Allow mask animation/state update
    const maskedValue = await tinInput.inputValue();
    expect(maskedValue).toMatch(/^\*{3}-\*{2}-\d{4}$/);

    // Focus the field again — mask should be removed, showing full or editable value
    await tinInput.focus();
    await page.waitForTimeout(300); // Allow unmask state update
    const unmaskedValue = await tinInput.inputValue();
    // After focusing, either the full formatted value is shown or the field is editable.
    // The unmasked value should not still be the masked pattern.
    expect(unmaskedValue).not.toMatch(/^\*{3}-\*{2}-\d{4}$/);
  });

  // =========================================================================
  // Test 7: ZIP+4 format (90210-1234) accepted
  // =========================================================================
  test("ZIP+4 format (90210-1234) accepted", async () => {
    await goToPersonalAndWait(page);

    await page.locator("#zip").fill("90210-1234");

    // Focus TIN to clear mask, then submit
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });
    await expect(page).toHaveURL(/\/accounts/);

    // Return and verify ZIP+4 persisted
    await goToPersonalAndWait(page);
    await expect(page.locator("#zip")).toHaveValue("90210-1234");
  });

  // =========================================================================
  // Test 8: Street2 (apt/unit) optional, accepted and persisted
  // =========================================================================
  test("Street2 (apt/unit) optional accepted", async () => {
    await goToPersonalAndWait(page);

    await page.locator("#street2").fill("Apt 4B");

    // Focus TIN to clear mask, then submit
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.keyboard.press("Enter");
    await page.waitForURL("**/accounts", { timeout: 30000 });

    // Return and verify street2 persisted
    await goToPersonalAndWait(page);
    await expect(page.locator("#street2")).toHaveValue("Apt 4B");
  });

  // =========================================================================
  // Test 9: Save without changes succeeds
  // =========================================================================
  test("Save without changes succeeds", async () => {
    await goToPersonalAndWait(page);

    // The form is pre-filled from all previous saves.
    // TIN shows as masked — focus it to clear the mask so the submit won't
    // reject the masked placeholder, then submit via Enter.
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.keyboard.press("Enter");

    await page.waitForURL("**/accounts", { timeout: 30000 });
    await expect(page).toHaveURL(/\/accounts/);
  });
});
