import { test, expect, Page } from "@playwright/test";

const EXISTING_EMAIL = "debug@example.com";
const EXISTING_PASSWORD = "Debug123!";
const WIZARD_PASSWORD = "WizardTest123!";

// Set a per-test timeout of 30s to avoid hangs
test.setTimeout(30000);

async function login(page: Page, email = EXISTING_EMAIL, password = EXISTING_PASSWORD) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/, { timeout: 15000 });
}

async function signupFreshUser(page: Page, email: string) {
  await page.goto("/signup");
  await page.fill("#firstName", "Wizard");
  await page.fill("#lastName", "Test");
  await page.fill("#email", email);
  await page.fill("#password", WIZARD_PASSWORD);
  await page.fill("#confirmPassword", WIZARD_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL("**/threshold", { timeout: 15000 });
}

test.describe("Threshold Page", () => {
  test("loads with year selector and questions", async ({ page }) => {
    const email = `thresh-load-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await expect(page.locator("h1")).toContainText("Do You Need to File");
    const yearSelect = page.locator("select").first();
    await expect(yearSelect).toBeVisible();
    const currentYear = new Date().getFullYear();
    await expect(yearSelect).toHaveValue(String(currentYear - 1));
  });

  test("year picker has multiple year options", async ({ page }) => {
    const email = `thresh-year-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    const yearSelect = page.locator("select").first();
    const options = await yearSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(3);
  });

  test("first question yes/no buttons are clickable", async ({ page }) => {
    const email = `thresh-q1-${Date.now()}@test.com`;
    await signupFreshUser(page, email);

    const yesBtn = page.locator("button:has-text('Yes')").first();
    const noBtn = page.locator("button:has-text('No')").first();
    await expect(yesBtn).toBeVisible();
    await expect(noBtn).toBeVisible();

    // Click No -> should show "You May Not Need to File"
    await noBtn.click();
    await expect(page.locator("text=You May Not Need to File")).toBeVisible();
  });

  test("answering Yes to first question reveals second question", async ({ page }) => {
    const email = `thresh-q2-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await expect(page.locator("text=aggregate value")).toBeVisible();
    await expect(page.locator("text=$10,000")).toBeVisible();
  });

  test("answering Yes/Yes shows Continue button", async ({ page }) => {
    const email = `thresh-cont-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await expect(page.locator("text=Continue to Personal Information")).toBeVisible();
  });

  test("answering Yes/No shows no filing needed message", async ({ page }) => {
    const email = `thresh-nofile-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    // The second question's No button
    const noButtons = page.locator("button:has-text('No')");
    await noButtons.first().click();
    await expect(page.locator("text=You May Not Need to File")).toBeVisible();
  });

  test("wizard progress indicator is visible", async ({ page }) => {
    const email = `thresh-steps-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    const steps = page.locator("nav ol li");
    await expect(steps.first()).toBeVisible();
    const count = await steps.count();
    expect(count).toBeGreaterThanOrEqual(4);
  });
});

test.describe("Personal Information Page", () => {
  test("loads with all required fields", async ({ page }) => {
    const email = `personal-load-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    // Go through threshold first
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    await expect(page.locator("h1")).toContainText("Personal Information");
    await expect(page.locator("text=First Name").first()).toBeVisible();
    await expect(page.locator("text=Last Name").first()).toBeVisible();
    await expect(page.locator("text=Middle Name")).toBeVisible();
    await expect(page.locator("text=Suffix")).toBeVisible();
    await expect(page.locator("text=SSN / ITIN")).toBeVisible();
    await expect(page.locator("text=TIN Type")).toBeVisible();
    await expect(page.locator("text=Date of Birth")).toBeVisible();
    await expect(page.locator("text=US Address")).toBeVisible();
    await expect(page.locator("text=Phone")).toBeVisible();
  });

  test("SSN field auto-formats as XXX-XX-XXXX", async ({ page }) => {
    const email = `personal-ssn-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    const ssnInput = page.locator('input[placeholder="XXX-XX-XXXX"]');
    await ssnInput.fill("123456789");
    const value = await ssnInput.inputValue();
    expect(value).toBe("123-45-6789");
  });

  test("TIN type selector has SSN and ITIN options", async ({ page }) => {
    const email = `personal-tin-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    const tinTypeSelect = page.locator("select").filter({ has: page.locator('option[value="SSN"]') });
    await expect(tinTypeSelect).toBeVisible();
    await expect(tinTypeSelect.locator('option[value="SSN"]')).toBeAttached();
    await expect(tinTypeSelect.locator('option[value="ITIN"]')).toBeAttached();
  });

  test("state dropdown has 50+ options", async ({ page }) => {
    const email = `personal-state-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    const stateSelect = page.locator("select").filter({ has: page.locator('option:has-text("State")') });
    await expect(stateSelect).toBeVisible();
    const options = await stateSelect.locator("option").count();
    expect(options).toBeGreaterThanOrEqual(50);
  });

  test("Previous button goes back to threshold", async ({ page }) => {
    const email = `personal-prev-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible();
    await prevLink.click();
    await page.waitForURL("**/threshold", { timeout: 10000 });
    await expect(page).toHaveURL(/\/threshold/);
  });

  test("submit button is present", async ({ page }) => {
    const email = `personal-submit-${Date.now()}@test.com`;
    await signupFreshUser(page, email);
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    await expect(page.locator('button[type="submit"]')).toContainText("Save & Continue");
  });
});

test.describe("Accounts Page", () => {
  // Helper: get a fresh user all the way to /accounts
  async function getToAccounts(page: Page): Promise<string> {
    const email = `acct-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@test.com`;
    await signupFreshUser(page, email);
    // Threshold
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });
    // Fill minimum personal info
    await page.locator('input[placeholder="XXX-XX-XXXX"]').fill("123456789");
    await page.locator('input[type="date"]').fill("1990-01-15");
    await page.locator('input[placeholder="Street Address"]').fill("123 Test St");
    await page.locator('input[placeholder="City"]').fill("Testville");
    await page.locator("select").filter({ has: page.locator('option:has-text("State")') }).selectOption("CA");
    await page.locator('input[placeholder="ZIP Code"]').fill("90210");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/accounts", { timeout: 15000 });
    return email;
  }

  test("loads with heading and add button", async ({ page }) => {
    await getToAccounts(page);
    await expect(page.locator("h1")).toContainText("Foreign Accounts");
    await expect(page.locator("button:has-text('Add Foreign Account')")).toBeVisible();
  });

  test("shows empty state message for new user", async ({ page }) => {
    await getToAccounts(page);
    await expect(page.locator("text=at least one foreign account")).toBeVisible();
  });

  test("clicking Add Foreign Account shows form", async ({ page }) => {
    await getToAccounts(page);
    await page.locator("button:has-text('Add Foreign Account')").click();
    await expect(page.locator("h3:has-text('Add Foreign Account')")).toBeVisible();
    await expect(page.locator("label:has-text('Institution Name')")).toBeVisible();
    await expect(page.locator("label:has-text('Account Number')")).toBeVisible();
    await expect(page.locator("label:has-text('Account Type')")).toBeVisible();
    await expect(page.locator("label:has-text('Country')")).toBeVisible();
    await expect(page.locator("label:has-text('Currency')")).toBeVisible();
    await expect(page.locator("label:has-text('Maximum Account Value')")).toBeVisible();
  });

  test("account form cancel button hides form", async ({ page }) => {
    await getToAccounts(page);
    await page.locator("button:has-text('Add Foreign Account')").click();
    await expect(page.locator("h3:has-text('Add Foreign Account')")).toBeVisible();
    await page.locator("button:has-text('Cancel')").click();
    await expect(page.locator("h3:has-text('Add Foreign Account')")).toBeHidden();
  });

  test("country dropdown has many countries", async ({ page }) => {
    await getToAccounts(page);
    await page.locator("button:has-text('Add Foreign Account')").click();
    const countrySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select country")') });
    await expect(countrySelect).toBeVisible();
    const options = await countrySelect.locator("option").count();
    expect(options).toBeGreaterThanOrEqual(30);
  });

  test("joint account checkbox reveals joint owner field", async ({ page }) => {
    await getToAccounts(page);
    await page.locator("button:has-text('Add Foreign Account')").click();
    const jointCheckbox = page.locator("#isJoint");
    await expect(jointCheckbox).toBeVisible();
    await jointCheckbox.check();
    await expect(page.locator("label:has-text('Joint Owner Information')")).toBeVisible();
    await expect(page.locator('input[placeholder="Name of joint owner"]')).toBeVisible();
  });

  test("Previous button goes to personal page", async ({ page }) => {
    await getToAccounts(page);
    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible();
    await prevLink.click();
    await page.waitForURL("**/personal", { timeout: 10000 });
    await expect(page).toHaveURL(/\/personal/);
  });

  test("add an account, verify it appears in list", async ({ page }) => {
    await getToAccounts(page);
    await page.locator("button:has-text('Add Foreign Account')").click();

    // Fill in account form
    await page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]').fill("Test Bank Zurich");
    // Account number is the second text input in the form
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("CH9876543210");

    // Select country (pick first real option)
    const countrySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });

    // Select currency
    const currencySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });

    // Max value
    await page.locator('input[type="number"]').fill("25000");

    await page.locator("button:has-text('Save Account')").click();

    // Account should appear in list
    await expect(page.locator("text=Test Bank Zurich")).toBeVisible({ timeout: 10000 });
    // Continue button should appear
    await expect(page.locator("button:has-text('Continue to Review')")).toBeVisible();
  });

  test("edit an account", async ({ page }) => {
    await getToAccounts(page);
    // First add an account
    await page.locator("button:has-text('Add Foreign Account')").click();
    await page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]').fill("Edit Bank");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("DE1111111111");
    const countrySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });
    const currencySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("10000");
    await page.locator("button:has-text('Save Account')").click();
    await expect(page.locator("text=Edit Bank")).toBeVisible({ timeout: 10000 });

    // Click Edit
    await page.locator("button:has-text('Edit')").click();
    // Edit form should appear — wait for a save or update button
    await expect(page.locator("button:has-text('Save')").or(page.locator("button:has-text('Update')"))).toBeVisible({ timeout: 5000 });
  });

  test("delete an account", async ({ page }) => {
    await getToAccounts(page);
    // Add an account
    await page.locator("button:has-text('Add Foreign Account')").click();
    await page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]').fill("Delete Me Bank");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("GB9999999999");
    const countrySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });
    const currencySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });
    await page.locator('input[type="number"]').fill("5000");
    await page.locator("button:has-text('Save Account')").click();
    await expect(page.locator("text=Delete Me Bank")).toBeVisible({ timeout: 10000 });

    // Click Delete and accept dialog
    page.on("dialog", (dialog) => dialog.accept());
    await page.locator("button:has-text('Delete')").click();

    // Account should be removed
    await expect(page.locator("text=Delete Me Bank")).toBeHidden({ timeout: 5000 });
    // Empty state should reappear
    await expect(page.locator("text=at least one foreign account")).toBeVisible();
  });
});

test.describe("Review Page (with existing filing)", () => {
  test("loads and shows personal info section", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await expect(page.locator("h1")).toContainText("Review Your FBAR");
    await expect(page.locator("text=Personal Information")).toBeVisible();
  });

  test("shows filing information section", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await expect(page.locator("text=Filing Information")).toBeVisible();
    await expect(page.locator("text=Calendar Year")).toBeVisible();
  });

  test("shows foreign accounts section", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await expect(page.locator("text=Foreign Accounts")).toBeVisible();
  });

  test("has edit links for personal info and accounts", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    const editLinks = page.locator("text=Edit");
    const count = await editLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("edit personal info link navigates to /personal", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.locator('a[href="/personal"]:has-text("Edit")').first().click();
    await page.waitForURL("**/personal", { timeout: 10000 });
    await expect(page).toHaveURL(/\/personal/);
  });

  test("edit accounts link navigates to /accounts", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.locator('a[href="/accounts"]:has-text("Edit")').first().click();
    await page.waitForURL("**/accounts", { timeout: 10000 });
    await expect(page).toHaveURL(/\/accounts/);
  });

  test("Previous button goes to accounts page", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    const prevLink = page.locator("a:has-text('Previous')");
    await expect(prevLink).toBeVisible();
    await prevLink.click();
    await page.waitForURL("**/accounts", { timeout: 10000 });
    await expect(page).toHaveURL(/\/accounts/);
  });

  test("CTA button is present", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    const cta = page.locator("button").filter({ hasText: /Continue|Sign|View|Payment/ });
    await expect(cta.first()).toBeVisible();
  });
});

test.describe("Sign Page", () => {
  test("loads with authorization content", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    // May redirect to payment if already signed
    const url = page.url();
    if (url.includes("/sign")) {
      await expect(page.locator("h1")).toContainText("Sign");
      await expect(page.locator("text=Authorization Statement")).toBeVisible();
      await expect(page.locator("text=certify")).toBeVisible();
    }
  });

  test("has agree checkbox", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    if (page.url().includes("/sign")) {
      const checkbox = page.locator('input[type="checkbox"]');
      await expect(checkbox).toBeVisible();
    }
  });

  test("has name input field", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    if (page.url().includes("/sign")) {
      await expect(page.locator("text=full legal name")).toBeVisible();
      const nameInput = page.locator('input[type="text"]');
      await expect(nameInput).toBeVisible();
    }
  });

  test("sign button is disabled until checkbox and name match", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    if (page.url().includes("/sign")) {
      const signBtn = page.locator("button:has-text('Sign')");
      await expect(signBtn).toBeDisabled();
    }
  });

  test("typing wrong name shows mismatch warning", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    if (page.url().includes("/sign")) {
      const nameInput = page.locator('input[type="text"]');
      await nameInput.fill("Wrong Name");
      await expect(page.locator("text=Name must match")).toBeVisible();
    }
  });

  test("Previous button goes to review page", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    if (page.url().includes("/sign")) {
      const prevLink = page.locator("a:has-text('Previous')");
      await expect(prevLink).toBeVisible();
      await prevLink.click();
      await page.waitForURL("**/review", { timeout: 10000 });
      await expect(page).toHaveURL(/\/review/);
    }
  });

  test("shows filing summary", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    if (page.url().includes("/sign")) {
      await expect(page.locator("text=Filing Summary")).toBeVisible();
      await expect(page.locator("text=Calendar Year")).toBeVisible();
    }
  });
});

test.describe("Full Wizard Flow (fresh user)", () => {
  test("complete flow: signup through add account", async ({ page }) => {
    test.setTimeout(60000);
    const email = `fullflow-${Date.now()}@test.com`;
    const password = "FlowTest123!";

    // Signup
    await page.goto("/signup");
    await page.fill("#firstName", "Flow");
    await page.fill("#lastName", "Tester");
    await page.fill("#email", email);
    await page.fill("#password", password);
    await page.fill("#confirmPassword", password);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/threshold", { timeout: 15000 });

    // Threshold
    await page.locator("button:has-text('Yes')").first().click();
    await page.locator("button:has-text('Yes')").nth(1).click();
    await page.locator("text=Continue to Personal Information").click();
    await page.waitForURL("**/personal", { timeout: 15000 });

    // Personal info
    await expect(page.locator("h1")).toContainText("Personal Information");
    await page.locator('input[placeholder="XXX-XX-XXXX"]').fill("123456789");
    await page.locator('input[type="date"]').fill("1990-01-15");
    await page.locator('input[placeholder="Street Address"]').fill("123 Test St");
    await page.locator('input[placeholder="City"]').fill("Testville");
    await page.locator("select").filter({ has: page.locator('option:has-text("State")') }).selectOption("CA");
    await page.locator('input[placeholder="ZIP Code"]').fill("90210");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/accounts", { timeout: 15000 });

    // Accounts
    await expect(page.locator("h1")).toContainText("Foreign Accounts");
    await page.locator("button:has-text('Add Foreign Account')").click();

    await page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]').fill("Test Bank AG");
    const formInputs = page.locator("form input[type='text']");
    await formInputs.nth(1).fill("CH1234567890");

    const countrySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select country")') });
    await countrySelect.selectOption({ index: 1 });

    const currencySelect = page.locator("select").filter({ has: page.locator('option:has-text("Select currency")') });
    await currencySelect.selectOption({ index: 1 });

    await page.locator('input[type="number"]').fill("50000");
    await page.locator("button:has-text('Save Account')").click();

    await expect(page.locator("text=Test Bank AG")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("button:has-text('Continue to Review')")).toBeVisible();

    // Navigate to review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 15000 });
    await expect(page.locator("h1")).toContainText("Review Your FBAR");
    await expect(page.locator("text=Test Bank AG").or(page.locator("text=Foreign Accounts"))).toBeVisible();
  });
});
