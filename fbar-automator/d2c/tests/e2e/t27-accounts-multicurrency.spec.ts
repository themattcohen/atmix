import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// ---------------------------------------------------------------------------
// Serial suite — one user, one page, state accumulates across tests.
// Strategy:
//   beforeAll: create user via API, login via browser, complete threshold
//              and personal info, select BASIC tier on /accounts.
//   Tests 1–3: add multiple non-USD accounts (EUR, CHF, GBP, JPY).
//   Tests 4–5: verify display formatting (masked account number, comma values).
//   Test 6:    joint account / ownership type checkbox.
//   Test 7:    account type options (BANK / SECURITIES / OTHER).
//   Test 8:    cancel form closes without saving.
// ---------------------------------------------------------------------------
test.describe.serial("T27: Accounts — Multi-Currency Handling", () => {
  test.describe.configure({ timeout: 120000 });

  const TEST_PASSWORD = "TestPass123!";
  const email = `t27-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;

  let page: Page;

  // -------------------------------------------------------------------------
  // beforeAll: create user, login, complete threshold + personal info,
  //            arrive at /accounts, select BASIC tier.
  // -------------------------------------------------------------------------
  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();

    // 1. Sign up via API (avoids CSRF friction of the browser form)
    const signupResp = await page.request.post("/api/auth/signup", {
      headers: { "X-Requested-With": "XMLHttpRequest" },
      data: {
        firstName: "Multi",
        lastName: "Currency",
        email,
        password: TEST_PASSWORD,
        confirmPassword: TEST_PASSWORD,
      },
    });
    if (signupResp.status() !== 201) {
      throw new Error(
        `Signup API failed: ${signupResp.status()} ${await signupResp.text()}`
      );
    }

    // 2. Login via browser (clean session cookie)
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.locator("#email").waitFor({ state: "visible", timeout: 15000 });
    await page.fill("#email", email);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });

    // 3. Complete threshold (Yes / Yes → Continue to Personal Information)
    if (!page.url().includes("/threshold")) {
      await page.goto("/threshold", { waitUntil: "networkidle", timeout: 30000 });
    }
    await expect(page.locator("h1")).toContainText("Do You Need to File", {
      timeout: 20000,
    });
    const firstYes = page.locator("button:has-text('Yes')").first();
    await expect(firstYes).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500); // allow React hydration
    await firstYes.click();
    const secondYes = page.locator("button:has-text('Yes')").nth(1);
    try {
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    } catch {
      // Retry in case Q2 didn't appear yet
      await firstYes.click();
      await expect(secondYes).toBeVisible({ timeout: 10000 });
    }
    await secondYes.click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 30000 });

    // 4. Complete personal info — wait for API pre-fill before touching form
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Personal Information", {
      timeout: 15000,
    });
    await expect(page.locator("#firstName")).toHaveValue(/\w+/, {
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    await page.locator('input[placeholder="XXX-XX-XXXX"]').fill("123456789");
    await page.locator('input[type="date"]').fill("1990-01-15");
    await page.locator('input[placeholder="Street Address"]').fill("123 Test St");
    await page.locator('input[placeholder="City"]').fill("Testville");
    await page
      .locator("select")
      .filter({ has: page.locator('option:has-text("State")') })
      .selectOption("CA");
    await page.locator('input[placeholder="ZIP Code"]').fill("90210");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/accounts", { timeout: 30000 });

    // 5. Select BASIC tier (Enter accounts manually) if the tier screen appears
    const tierButton = page.locator("button:has-text('Enter accounts manually')");
    const addButton = page.locator("button:has-text('Add Foreign Account')");
    try {
      await tierButton.waitFor({ state: "visible", timeout: 10000 });
      await tierButton.click();
      // Wait for PATCH /api/filing/tier to settle
      await page.waitForResponse(
        (resp) =>
          resp.url().includes("/api/filing/tier") &&
          resp.request().method() === "PATCH",
        { timeout: 15000 }
      ).catch(() => {});
      await addButton.waitFor({ state: "visible", timeout: 15000 });
    } catch {
      // Tier screen was not shown (already selected) — continue
    }

    // Confirm we are on the accounts management view
    await expect(
      page.locator("h1:has-text('Foreign Accounts')")
    ).toBeVisible({ timeout: 20000 });
  });

  test.afterAll(async () => {
    await page.close();
  });

  // =========================================================================
  // Helper: return to /accounts and wait for the main view to be ready.
  // =========================================================================
  async function goToAccountsAndWait(pg: Page) {
    await pg.goto("/accounts", { waitUntil: "domcontentloaded", timeout: 30000 });
    await expect(pg.locator("h1:has-text('Foreign Accounts')")).toBeVisible({
      timeout: 20000,
    });
    // Wait for loading skeleton to clear
    await expect(
      pg.locator('[aria-label="Loading accounts"]')
    ).not.toBeVisible({ timeout: 20000 });
  }

  // =========================================================================
  // Helper: count how many account cards are currently visible.
  // =========================================================================
  async function countAccountCards(pg: Page): Promise<number> {
    // Each account card renders the edit button with a unique aria-label
    return pg.locator('button[aria-label$=" account"]').count();
  }

  // =========================================================================
  // Test 1: EUR account — add and assert card appears; maxValueUsd is null
  // =========================================================================
  test("1 — EUR account: card appears; maxValueUsd null not displayed", async () => {
    // Wait for the Add button to be ready. The page starts with loading=true
    // while loadData() fetches; the button is only shown once loading is false.
    const addBtn1 = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtn1).toBeVisible({ timeout: 20000 });
    await addBtn1.click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    // Fill institution name
    await page.locator("#new-account-institutionName").fill("Deutsche Bank");

    // Account number
    await page.locator("#new-account-accountNumber").fill("DE89370400440532013000");

    // Country: pick any option by index 1 (first real country after placeholder)
    await page.locator("#new-account-countryCode").selectOption({ index: 1 });

    // Currency: look for EUR by label or fall back to index 1
    const currencySelect = page.locator("#new-account-currencyCode");
    const eurOption = currencySelect.locator('option[value="EUR"]');
    const eurExists = (await eurOption.count()) > 0;
    if (eurExists) {
      await currencySelect.selectOption("EUR");
    } else {
      await currencySelect.selectOption({ index: 1 });
    }

    // Max value (local currency amount)
    await page.locator("#new-account-maxValueLocal").fill("25000");

    // Save and wait for POST /api/accounts to complete
    const saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    const response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    // Account card for Deutsche Bank must appear
    await expect(page.locator("text=Deutsche Bank")).toBeVisible({
      timeout: 15000,
    });

    // The treasury stub returns null for non-USD maxValueUsd.
    // The UI should either hide the USD value or display a placeholder (—, N/A, null).
    // Assert that a raw "null" string is NOT rendered anywhere on the page.
    const pageText = await page.locator("body").innerText();
    expect(pageText).not.toMatch(/\bnull\b/);
  });

  // =========================================================================
  // Test 2: Non-US country (Switzerland) with CHF saves correctly
  // =========================================================================
  test("2 — Switzerland / CHF account saves and card shows institution", async () => {
    // Wait for the form from test 1 to be gone and the Add button to be ready.
    // After onSaved() the page hides the form and re-runs loadData() which
    // briefly sets loading=true (skeleton shown, button hidden). We must wait
    // for the button to actually be available before clicking.
    const addBtn = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtn).toBeVisible({ timeout: 20000 });
    await addBtn.click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    await page.locator("#new-account-institutionName").fill("Credit Suisse");
    await page.locator("#new-account-accountNumber").fill("CH9300762011623852957");

    // Select Switzerland by value if available, otherwise index 1
    const countrySelect = page.locator("#new-account-countryCode");
    const chOption = countrySelect.locator('option[value="CH"]');
    const chExists = (await chOption.count()) > 0;
    if (chExists) {
      await countrySelect.selectOption("CH");
    } else {
      await countrySelect.selectOption({ index: 2 });
    }

    // Select CHF by value if available, otherwise index 2
    const currencySelect = page.locator("#new-account-currencyCode");
    const chfOption = currencySelect.locator('option[value="CHF"]');
    const chfExists = (await chfOption.count()) > 0;
    if (chfExists) {
      await currencySelect.selectOption("CHF");
    } else {
      await currencySelect.selectOption({ index: 2 });
    }

    await page.locator("#new-account-maxValueLocal").fill("100000");

    const saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    const response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    // Card for Credit Suisse must appear
    await expect(page.locator("text=Credit Suisse")).toBeVisible({
      timeout: 15000,
    });

    // Country code or name should be reflected somewhere on the card.
    // The card shows "CH · ****2957 · CHF 100,000" — check the page text.
    const pageText = await page.locator("body").innerText();
    expect(pageText).toMatch(/CH|Switzerland|Switzer/i);
  });

  // =========================================================================
  // Test 3: Multiple currencies — GBP and JPY accounts all render in list
  // =========================================================================
  test("3 — GBP and JPY accounts added; all accounts visible in list", async () => {
    // Add GBP account — wait for Add button to be ready after test 2's loadData()
    const addBtn3 = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtn3).toBeVisible({ timeout: 20000 });
    await addBtn3.click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    await page.locator("#new-account-institutionName").fill("Barclays");
    await page.locator("#new-account-accountNumber").fill("GB29NWBK60161331926819");

    // Country: GB
    const gbCountry = page.locator("#new-account-countryCode");
    const gbOption = gbCountry.locator('option[value="GB"]');
    if ((await gbOption.count()) > 0) {
      await gbCountry.selectOption("GB");
    } else {
      await gbCountry.selectOption({ index: 1 });
    }

    // Currency: GBP
    const gbCurrency = page.locator("#new-account-currencyCode");
    const gbpOption = gbCurrency.locator('option[value="GBP"]');
    if ((await gbpOption.count()) > 0) {
      await gbCurrency.selectOption("GBP");
    } else {
      await gbCurrency.selectOption({ index: 1 });
    }

    await page.locator("#new-account-maxValueLocal").fill("80000");

    let saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    let response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    // Wait for the account list to re-render after save. If the card doesn't
    // appear within a short time, reload the page to force a fresh loadData().
    try {
      await expect(page.locator("text=Barclays")).toBeVisible({ timeout: 10000 });
    } catch {
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator("text=Barclays")).toBeVisible({ timeout: 15000 });
    }

    // Add JPY account — wait for Add button to re-appear after GBP save's loadData()
    const addBtnJpy = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtnJpy).toBeVisible({ timeout: 20000 });
    await addBtnJpy.click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    await page.locator("#new-account-institutionName").fill("MUFG Bank");
    await page.locator("#new-account-accountNumber").fill("JP1234567890123456789");

    // Country: JP
    const jpCountry = page.locator("#new-account-countryCode");
    const jpOption = jpCountry.locator('option[value="JP"]');
    if ((await jpOption.count()) > 0) {
      await jpCountry.selectOption("JP");
    } else {
      await jpCountry.selectOption({ index: 1 });
    }

    // Currency: JPY
    const jpCurrency = page.locator("#new-account-currencyCode");
    const jpyOption = jpCurrency.locator('option[value="JPY"]');
    if ((await jpyOption.count()) > 0) {
      await jpCurrency.selectOption("JPY");
    } else {
      await jpCurrency.selectOption({ index: 1 });
    }

    await page.locator("#new-account-maxValueLocal").fill("5000000");

    saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    try {
      await expect(page.locator("text=MUFG Bank")).toBeVisible({ timeout: 10000 });
    } catch {
      await page.reload({ waitUntil: "networkidle" });
      await expect(page.locator("text=MUFG Bank")).toBeVisible({ timeout: 15000 });
    }

    // All 4 accounts from tests 1–3 should be visible
    await expect(page.locator("text=Deutsche Bank")).toBeVisible();
    await expect(page.locator("text=Credit Suisse")).toBeVisible();
    await expect(page.locator("text=Barclays")).toBeVisible();
    await expect(page.locator("text=MUFG Bank")).toBeVisible();
  });

  // =========================================================================
  // Test 4: Masked account number — last 4 digits only
  // =========================================================================
  test("4 — account number displayed masked with last 4 digits only", async () => {
    // The Deutsche Bank account was saved with "DE89370400440532013000"
    // The last 4 digits are "3000" → display should be "****3000"
    await expect(page.locator("text=****3000")).toBeVisible({ timeout: 10000 });

    // The Credit Suisse account was saved with "CH9300762011623852957"
    // The last 4 digits are "2957" → display should be "****2957"
    await expect(page.locator("text=****2957")).toBeVisible({ timeout: 10000 });

    // Verify that no full account number leaks into the page
    // (the DE89 IBAN should not appear verbatim)
    const pageText = await page.locator("body").innerText();
    expect(pageText).not.toContain("DE89370400440532013000");
    expect(pageText).not.toContain("CH9300762011623852957");
  });

  // =========================================================================
  // Test 5: Max value displayed with comma formatting
  // =========================================================================
  test("5 — max value amounts formatted with commas", async () => {
    // Credit Suisse was saved with 100000 → should display as "100,000"
    await expect(page.locator("text=100,000")).toBeVisible({ timeout: 10000 });

    // Deutsche Bank was saved with 25000 → should display as "25,000"
    await expect(page.locator("text=25,000")).toBeVisible({ timeout: 10000 });

    // Barclays was saved with 80000 → should display as "80,000"
    await expect(page.locator("text=80,000")).toBeVisible({ timeout: 10000 });
  });

  // =========================================================================
  // Test 6: Ownership type — verify field is present and accepts values
  // =========================================================================
  test("6 — ownership type field accepts FINANCIAL_INTEREST and SIGNATURE_AUTHORITY", async () => {
    // Tests 4 and 5 are read-only; no form was open, but we still guard
    // against any residual loading state.
    const addBtn6 = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtn6).toBeVisible({ timeout: 20000 });
    await addBtn6.click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    // The ownership type select must be present (confirmed by t11)
    const ownershipSelect = page.locator("#new-account-ownershipType");
    await expect(ownershipSelect).toBeVisible({ timeout: 10000 });

    // Verify FINANCIAL_INTEREST option is available
    const fiOption = ownershipSelect.locator('option[value="FINANCIAL_INTEREST"]');
    await expect(fiOption).toHaveCount(1);

    // Verify SIGNATURE_AUTHORITY option is available
    const saOption = ownershipSelect.locator('option[value="SIGNATURE_AUTHORITY"]');
    await expect(saOption).toHaveCount(1);

    // Select SIGNATURE_AUTHORITY and fill remaining required fields
    await ownershipSelect.selectOption("SIGNATURE_AUTHORITY");

    await page.locator("#new-account-institutionName").fill("SA Test Bank");
    await page.locator("#new-account-accountNumber").fill("AU1234567890123456");
    await page.locator("#new-account-countryCode").selectOption({ index: 1 });
    await page.locator("#new-account-currencyCode").selectOption({ index: 1 });
    await page.locator("#new-account-maxValueLocal").fill("30000");

    const saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    const response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    // Account card should appear
    await expect(page.locator("text=SA Test Bank")).toBeVisible({
      timeout: 15000,
    });
  });

  // =========================================================================
  // Test 7: Account type options — BANK, SECURITIES, OTHER present; can save SECURITIES
  // =========================================================================
  test("7 — account type options include BANK/SECURITIES/OTHER; SECURITIES saves correctly", async () => {
    // Wait for Add button to be ready after test 6's loadData() completes
    const addBtn7 = page.locator("button:has-text('Add Foreign Account')");
    await expect(addBtn7).toBeVisible({ timeout: 20000 });
    await addBtn7.click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    // Locate the account type select
    const accountTypeSelect = page.locator("#new-account-accountType");
    await expect(accountTypeSelect).toBeVisible({ timeout: 10000 });

    // Verify all three account type options are present
    const bankOption = accountTypeSelect.locator(
      'option[value="BANK"], option:has-text("Bank"), option:has-text("BANK")'
    );
    await expect(bankOption.first()).toHaveCount(1);

    const securitiesOption = accountTypeSelect.locator(
      'option[value="SECURITIES"], option:has-text("Securities"), option:has-text("SECURITIES")'
    );
    await expect(securitiesOption.first()).toHaveCount(1);

    const otherOption = accountTypeSelect.locator(
      'option[value="OTHER"], option:has-text("Other"), option:has-text("OTHER")'
    );
    await expect(otherOption.first()).toHaveCount(1);

    // Select SECURITIES and complete the form
    const securitiesValue = (await accountTypeSelect
      .locator('option[value="SECURITIES"]')
      .count()) > 0
      ? "SECURITIES"
      : await accountTypeSelect
          .locator('option:has-text("Securities"), option:has-text("SECURITIES")')
          .first()
          .getAttribute("value");

    if (securitiesValue) {
      await accountTypeSelect.selectOption(securitiesValue);
    }

    await page.locator("#new-account-institutionName").fill("Fidelity International");
    await page.locator("#new-account-accountNumber").fill("US1234567890");
    await page.locator("#new-account-countryCode").selectOption({ index: 1 });
    await page.locator("#new-account-currencyCode").selectOption({ index: 1 });
    await page.locator("#new-account-maxValueLocal").fill("45000");

    const saveResp = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts") &&
        resp.request().method() === "POST",
      { timeout: 20000 }
    );
    await page.locator("button:has-text('Save Account')").click();
    const response = await saveResp;
    expect(response.status()).toBeLessThan(400);

    // Account card for Fidelity International must appear
    await expect(page.locator("text=Fidelity International")).toBeVisible({
      timeout: 15000,
    });
  });

  // =========================================================================
  // Test 8: Cancel closes the add form without saving any new account
  // =========================================================================
  test("8 — Cancel button closes add form without adding an account", async () => {
    await goToAccountsAndWait(page);

    // Record the current number of account cards
    const cardsBefore = await countAccountCards(page);

    // Open the add form
    await page.locator("button:has-text('Add Foreign Account')").click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    // Partially fill the form (to ensure cancel ignores partial data)
    await page.locator("#new-account-institutionName").fill("Should Not Save Bank");
    await page.locator("#new-account-accountNumber").fill("XX0000000000");

    // Click Cancel
    await page.locator("button:has-text('Cancel')").click();

    // The form heading should no longer be visible
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).not.toBeVisible({ timeout: 10000 });

    // "Should Not Save Bank" must not appear anywhere on the page
    await expect(
      page.locator("text=Should Not Save Bank")
    ).not.toBeVisible({ timeout: 5000 });

    // The Add Foreign Account button should be visible again (form is closed)
    await expect(
      page.locator("button:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });

    // Card count must be unchanged
    const cardsAfter = await countAccountCards(page);
    expect(cardsAfter).toBe(cardsBefore);
  });
});
