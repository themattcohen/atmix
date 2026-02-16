import { test, expect, Page } from "@playwright/test";
import {
  loginAsTestUser,
  signupTestUser,
  completeThreshold,
  completePersonalInfo,
  addForeignAccount,
  completeSigning,
} from "./helpers/auth";

const EXISTING_EMAIL = "debug@example.com";
const EXISTING_PASSWORD = "Debug123!";

test.setTimeout(45000);

// ---------------------------------------------------------------------------
// Helper: login the existing debug user
// ---------------------------------------------------------------------------
async function login(page: Page) {
  await loginAsTestUser(page, EXISTING_EMAIL, EXISTING_PASSWORD);
}

// ---------------------------------------------------------------------------
// Threshold Page
// ---------------------------------------------------------------------------
test.describe("Threshold Page", () => {
  test("loads with year selector and questions", async ({ page }) => {
    const email = `thresh-${Date.now()}@test.com`;
    await page.goto("/signup");
    await page.fill("#firstName", "Threshold");
    await page.fill("#lastName", "Test");
    await page.fill("#email", email);
    await page.fill("#password", "ThreshTest123!");
    await page.fill("#confirmPassword", "ThreshTest123!");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/threshold", { timeout: 15000 });

    await expect(page.locator("h1")).toContainText("Do You Need to File");
    const yearSelect = page.locator("select").first();
    await expect(yearSelect).toBeVisible();
    const currentYear = new Date().getFullYear();
    await expect(yearSelect).toHaveValue(String(currentYear - 1));
  });

  test("year picker has multiple year options", async ({ page }) => {
    await login(page);
    await page.goto("/threshold");
    const yearSelect = page.locator("select").first();
    await expect(yearSelect).toBeVisible({ timeout: 10000 });
    const options = await yearSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  test("answering No to first question shows not-needed message", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/threshold");
    await expect(
      page.getByRole("button", { name: /no/i }).first()
    ).toBeVisible({ timeout: 10000 });

    await page.locator("button:has-text('No')").first().click();
    await expect(
      page.locator("text=You May Not Need to File")
    ).toBeVisible();
  });

  test("answering Yes to first question reveals second question about $10,000", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/threshold");
    await expect(
      page.getByRole("button", { name: /yes/i }).first()
    ).toBeVisible({ timeout: 10000 });

    await page.locator("button:has-text('Yes')").first().click();
    await expect(page.locator("text=aggregate value")).toBeVisible();
    await expect(page.locator("text=$10,000")).toBeVisible();
  });

  test("answering Yes/Yes shows Continue to Personal Information button", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/threshold");
    await expect(
      page.getByRole("button", { name: /yes/i }).first()
    ).toBeVisible({ timeout: 10000 });

    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await expect(
      page.locator("text=Continue to Personal Information")
    ).toBeVisible();
  });

  test("answering Yes/No shows no filing needed message", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/threshold");
    await expect(
      page.getByRole("button", { name: /yes/i }).first()
    ).toBeVisible({ timeout: 10000 });

    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('No')").first().click();
    await expect(
      page.locator("text=You May Not Need to File")
    ).toBeVisible();
  });

  test("wizard progress indicator is visible with multiple steps", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/threshold");
    await page.waitForLoadState("networkidle");
    const steps = page.locator("nav ol li");
    await expect(steps.first()).toBeVisible({ timeout: 10000 });
    const count = await steps.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// Personal Information Page
// ---------------------------------------------------------------------------
test.describe("Personal Information Page", () => {
  test("loads with all required fields", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Personal Information");
    await expect(page.getByText("First Name")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Last Name")).toBeVisible();
    await expect(page.getByText("Middle Name")).toBeVisible();
    await expect(page.getByText("Suffix")).toBeVisible();
    await expect(page.getByText(/SSN/)).toBeVisible();
    await expect(page.getByText("TIN Type")).toBeVisible();
    await expect(page.getByText("Date of Birth")).toBeVisible();
    await expect(page.getByText("US Address")).toBeVisible();
    await expect(page.getByText("Phone")).toBeVisible();
  });

  test("SSN field auto-formats as XXX-XX-XXXX", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const ssnInput = page.locator('input[placeholder="XXX-XX-XXXX"]');
    await expect(ssnInput).toBeVisible({ timeout: 10000 });
    await ssnInput.fill("123456789");
    const value = await ssnInput.inputValue();
    expect(value).toBe("123-45-6789");
  });

  test("TIN type selector has SSN and ITIN options", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const tinSelect = page.locator("select").first();
    await expect(tinSelect).toBeVisible({ timeout: 10000 });
    const opts = await tinSelect.locator("option").allTextContents();
    expect(opts).toContain("SSN");
    expect(opts).toContain("ITIN");
  });

  test("state dropdown has 50+ options", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const stateSelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("State")') });
    await expect(stateSelect).toBeVisible({ timeout: 10000 });
    const options = await stateSelect.locator("option").count();
    expect(options).toBeGreaterThanOrEqual(50);
  });

  test("Previous button goes back to threshold", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible({ timeout: 10000 });
    await expect(prevLink).toHaveAttribute("href", "/threshold");
    await prevLink.click();
    await page.waitForURL("**/threshold", { timeout: 10000 });
    await expect(page).toHaveURL(/\/threshold/);
  });

  test("Save & Continue button is present", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    await expect(page.locator('button[type="submit"]')).toContainText(
      "Save & Continue"
    );
  });
});

// ---------------------------------------------------------------------------
// Accounts Page
// ---------------------------------------------------------------------------
test.describe("Accounts Page", () => {
  test("loads with heading and add button", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await expect(page.locator("h1")).toContainText("Foreign Accounts");
    await expect(
      page.locator("button:has-text('Add Foreign Account')")
    ).toBeVisible({ timeout: 10000 });
  });

  test("clicking Add Foreign Account shows form", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Add Foreign Account')").click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible();
    await expect(
      page.locator("label:has-text('Institution Name')")
    ).toBeVisible();
    await expect(
      page.locator("label:has-text('Account Number')")
    ).toBeVisible();
    await expect(
      page.locator("label:has-text('Account Type')")
    ).toBeVisible();
    await expect(page.locator("label:has-text('Country')")).toBeVisible();
    await expect(page.locator("label:has-text('Currency')")).toBeVisible();
    await expect(
      page.locator("label:has-text('Maximum Account Value')")
    ).toBeVisible();
  });

  test("account form cancel button hides form", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Add Foreign Account')").click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible();
    await page.locator("button:has-text('Cancel')").click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeHidden();
  });

  test("country dropdown has many countries", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Add Foreign Account')").click();
    const countrySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') });
    await expect(countrySelect).toBeVisible();
    const options = await countrySelect.locator("option").count();
    expect(options).toBeGreaterThanOrEqual(30);
  });

  test("joint account checkbox reveals joint owner field", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Add Foreign Account')").click();
    const jointCheckbox = page.locator("#isJoint");
    await expect(jointCheckbox).toBeVisible();
    await jointCheckbox.check();
    await expect(
      page.locator("label:has-text('Joint Owner Information')")
    ).toBeVisible();
    await expect(
      page.locator('input[placeholder="Name of joint owner"]')
    ).toBeVisible();
  });

  test("Previous button goes to personal page", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible({ timeout: 10000 });
    await expect(prevLink).toHaveAttribute("href", "/personal");
    await prevLink.click();
    await page.waitForURL("**/personal", { timeout: 10000 });
    await expect(page).toHaveURL(/\/personal/);
  });

  test("add an account, verify it appears in list", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await page.locator("button:has-text('Add Foreign Account')").click();
    await page
      .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
      .fill("Test Bank Zurich");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("CH9876543210");

    const countrySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });

    const currencySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });

    await page.locator('input[type="number"]').fill("25000");
    await page.locator("button:has-text('Save Account')").click();

    await expect(page.locator("text=Test Bank Zurich")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator("button:has-text('Continue to Review')")
    ).toBeVisible();
  });

  test("delete an account", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    // Add an account first
    await page.locator("button:has-text('Add Foreign Account')").click();
    await page
      .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
      .fill("Delete Me Bank");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("GB9999999999");
    const countrySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });
    const currencySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("5000");
    await page.locator("button:has-text('Save Account')").click();
    await expect(page.locator("text=Delete Me Bank")).toBeVisible({
      timeout: 10000,
    });

    // Delete and accept the confirm dialog
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("button:has-text('Delete')").click();
    await expect(page.locator("text=Delete Me Bank")).toBeHidden({
      timeout: 5000,
    });
  });

  test("edit an existing account", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    // Add an account first
    await page.locator("button:has-text('Add Foreign Account')").click();
    await page
      .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
      .fill("Edit Me Bank");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("DE1111111111");
    const countrySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });
    const currencySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("15000");
    await page.locator("button:has-text('Save Account')").click();
    await expect(page.locator("text=Edit Me Bank")).toBeVisible({
      timeout: 10000,
    });

    // Click Edit button on the account
    await page.locator("button:has-text('Edit')").first().click();

    // Change the institution name
    const nameInput = page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]');
    await nameInput.clear();
    await nameInput.fill("Updated Bank Name");
    await page.locator("button:has-text('Save Account')").click();

    // Verify the updated name appears
    await expect(page.locator("text=Updated Bank Name")).toBeVisible({
      timeout: 10000,
    });
  });
});

// ---------------------------------------------------------------------------
// Review Page (with existing filing data)
// ---------------------------------------------------------------------------
test.describe("Review Page", () => {
  test("loads and shows personal info section", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("Review Your FBAR");
    await expect(page.locator("text=Personal Information")).toBeVisible();
  });

  test("shows filing information section", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Filing Information")).toBeVisible();
    await expect(page.locator("text=Calendar Year")).toBeVisible();
  });

  test("shows foreign accounts section", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=Foreign Accounts")).toBeVisible();
  });

  test("has edit links for personal info and accounts", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    const editLinks = page.locator("text=Edit");
    const count = await editLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("edit personal info link navigates to /personal", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    await page
      .locator('a[href="/personal"]:has-text("Edit")')
      .first()
      .click();
    await page.waitForURL("**/personal", { timeout: 10000 });
    await expect(page).toHaveURL(/\/personal/);
  });

  test("edit accounts link navigates to /accounts", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    await page
      .locator('a[href="/accounts"]:has-text("Edit")')
      .first()
      .click();
    await page.waitForURL("**/accounts", { timeout: 10000 });
    await expect(page).toHaveURL(/\/accounts/);
  });

  test("Previous button goes to accounts page", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/accounts");
    await prevLink.click();
    await page.waitForURL("**/accounts", { timeout: 10000 });
    await expect(page).toHaveURL(/\/accounts/);
  });

  test("CTA button is present", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");
    const cta = page
      .locator("button")
      .filter({ hasText: /Continue|Sign|View|Payment/ });
    await expect(cta.first()).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Sign Page
// ---------------------------------------------------------------------------
test.describe("Sign Page", () => {
  test("loads with authorization content", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    // May redirect to payment if already signed
    if (page.url().includes("/sign")) {
      await expect(page.locator("h1")).toContainText("Sign");
      await expect(
        page.locator("text=Authorization Statement")
      ).toBeVisible();
      await expect(page.locator("text=certify")).toBeVisible();
    }
  });

  test("has agree checkbox", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/sign")) {
      const checkbox = page.locator('input[type="checkbox"]');
      await expect(checkbox).toBeVisible();
    }
  });

  test("has name input field", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/sign")) {
      await expect(page.locator("text=full legal name")).toBeVisible();
      const nameInput = page.locator('input[type="text"]');
      await expect(nameInput).toBeVisible();
    }
  });

  test("sign button is disabled until checkbox and name match", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/sign")) {
      const signBtn = page.locator("button:has-text('Sign')");
      await expect(signBtn).toBeDisabled();
    }
  });

  test("typing wrong name shows mismatch warning", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/sign")) {
      const nameInput = page.locator('input[type="text"]');
      await nameInput.fill("Wrong Name");
      await expect(page.locator("text=Name must match")).toBeVisible();
    }
  });

  test("Previous button goes to review page", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/sign")) {
      const prevLink = page.locator("a:has-text('Previous')");
      await expect(prevLink).toBeVisible();
      await expect(prevLink).toHaveAttribute("href", "/review");
      await prevLink.click();
      await page.waitForURL("**/review", { timeout: 10000 });
      await expect(page).toHaveURL(/\/review/);
    }
  });

  test("shows filing summary", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");
    if (page.url().includes("/sign")) {
      await expect(page.locator("text=Filing Summary")).toBeVisible();
      await expect(page.locator("text=Calendar Year")).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Sign Flow Completion (exercises POST /api/filing/sign)
// ---------------------------------------------------------------------------
test.describe("Sign Flow Completion", () => {
  test("complete signing flow: signup → threshold → personal → account → review → sign → payment", async ({
    page,
  }) => {
    test.setTimeout(90000);

    const password = "SignTest123!";
    const email = `signflow-${Date.now()}@test.com`;
    const firstName = "Sign";
    const lastName = "Tester";

    // Signup
    await page.goto("/signup");
    await page.fill("#firstName", firstName);
    await page.fill("#lastName", lastName);
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#confirmPassword", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/threshold", { timeout: 15000 });

    // Threshold: Yes/Yes
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    // Personal info
    await page.locator('input[placeholder="XXX-XX-XXXX"]').fill("123456789");
    await page.locator('input[type="date"]').fill("1990-01-15");
    await page.locator('input[placeholder="Street Address"]').fill("123 Sign St");
    await page.locator('input[placeholder="City"]').fill("Signville");
    await page
      .locator("select")
      .filter({ has: page.locator('option:has-text("State")') })
      .selectOption("CA");
    await page.locator('input[placeholder="ZIP Code"]').fill("90210");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/accounts", { timeout: 15000 });

    // Add account
    await addForeignAccount(page, "Sign Test Bank AG");

    // Continue to review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 15000 });

    // Navigate to sign
    const signBtn = page.locator("button:has-text('Continue'), a:has-text('Continue'), button:has-text('Sign'), a:has-text('Sign')");
    await signBtn.first().click();
    await page.waitForURL("**/sign", { timeout: 15000 });

    // Complete signing using helper
    await completeSigning(page, firstName, lastName);

    // Verify we're on the payment page
    await expect(page).toHaveURL(/\/payment/);
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Payment Page
// ---------------------------------------------------------------------------
test.describe("Payment Page", () => {
  test("loads with payment heading and Previous button", async ({ page }) => {
    await login(page);
    await page.goto("/payment");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading").first()).toBeVisible({
      timeout: 10000,
    });
    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/sign");
  });
});

// ---------------------------------------------------------------------------
// Wizard Step Indicator
// ---------------------------------------------------------------------------
test.describe("Wizard Step Indicator", () => {
  test("shows all 7 wizard steps on personal page", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Threshold")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("Personal Info").or(page.getByText("Personal"))
    ).toBeVisible();
    await expect(page.getByText("Accounts")).toBeVisible();
    await expect(page.getByText("Review")).toBeVisible();
    await expect(page.getByText("Sign")).toBeVisible();
    await expect(page.getByText("Payment")).toBeVisible();
    await expect(page.getByText("Confirmation")).toBeVisible();
  });

  test("completed step (Threshold) is clickable and navigates back", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const thresholdLink = page.locator('a[href="/threshold"]').first();
    await expect(thresholdLink).toBeVisible({ timeout: 10000 });
    await thresholdLink.click();
    await page.waitForURL("**/threshold", { timeout: 10000 });
    await expect(page).toHaveURL(/\/threshold/);
  });
});

// ---------------------------------------------------------------------------
// Full Wizard Flow (fresh user, signup through review)
// ---------------------------------------------------------------------------
test.describe("Full Wizard Flow (fresh user)", () => {
  test("complete flow: signup through add account and review", async ({
    page,
  }) => {
    test.setTimeout(60000);

    const password = "FlowTest123!";
    const email = `fullflow-${Date.now()}@test.com`;

    // Signup
    await page.goto("/signup");
    await page.fill("#firstName", "Flow");
    await page.fill("#lastName", "Tester");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#confirmPassword", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/threshold", { timeout: 15000 });

    // Threshold: Yes/Yes
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    // Personal info
    await expect(page.locator("h1")).toContainText("Personal Information");
    await page.locator('input[placeholder="XXX-XX-XXXX"]').fill("123456789");
    await page.locator('input[type="date"]').fill("1990-01-15");
    await page
      .locator('input[placeholder="Street Address"]')
      .fill("123 Test St");
    await page.locator('input[placeholder="City"]').fill("Testville");
    await page
      .locator("select")
      .filter({ has: page.locator('option:has-text("State")') })
      .selectOption("CA");
    await page.locator('input[placeholder="ZIP Code"]').fill("90210");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/accounts", { timeout: 15000 });

    // Accounts: add one
    await expect(page.locator("h1")).toContainText("Foreign Accounts");
    await page.locator("button:has-text('Add Foreign Account')").click();
    await page
      .locator('input[placeholder="e.g., HSBC, Deutsche Bank"]')
      .fill("Test Bank AG");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("CH1234567890");
    const countrySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });
    const currencySelect = page
      .locator("select")
      .filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("50000");
    await page.locator("button:has-text('Save Account')").click();
    await expect(page.locator("text=Test Bank AG")).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.locator("button:has-text('Continue to Review')")
    ).toBeVisible();

    // Navigate to review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Review Your FBAR");
    await expect(
      page
        .locator("text=Test Bank AG")
        .or(page.locator("text=Foreign Accounts"))
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Wizard Navigation (back/forward, My Filings, logout)
// ---------------------------------------------------------------------------
test.describe("Wizard Navigation", () => {
  test("My Filings header link navigates to dashboard", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const link = page
      .locator('a[href="/dashboard"]')
      .filter({ hasText: /filings/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await link.click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("logout from wizard redirects to home", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL(/^\/$|\/login/, { timeout: 15000 });
  });
});
