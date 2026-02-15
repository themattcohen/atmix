import { test, expect, Page } from "@playwright/test";

const UNIQUE = Date.now();
const EMAIL = `wiz-focused-${UNIQUE}@test.com`;
const PASSWORD = "WizFocus123!";

test.setTimeout(60000);

async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.fill('[name="email"], #email', email);
  await page.fill('[name="password"], #password', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/, { timeout: 30000 });
}

test.describe.serial("Wizard Flow — Full E2E", () => {
  test("Step 0: signup → lands on threshold", async ({ page }) => {
    await page.goto("/signup");
    await page.fill('[name="firstName"], #firstName', "Focus");
    await page.fill('[name="lastName"], #lastName', "Test");
    await page.fill('[name="email"], #email', EMAIL);
    await page.fill('[name="password"], #password', PASSWORD);
    await page.fill('[name="confirmPassword"], #confirmPassword', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30000 });
    await expect(page).toHaveURL(/\/(threshold|dashboard)/);
  });

  test("Step 1: threshold — year picker, Yes/Yes → Continue to Personal", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/threshold");
    await page.waitForLoadState("networkidle");

    // Year selector exists with multiple options
    const select = page.locator("select").first();
    await expect(select).toBeVisible({ timeout: 10000 });
    const options = await select.locator("option").allTextContents();
    expect(options.length).toBeGreaterThanOrEqual(3);

    // Q1: Had foreign accounts? → Yes
    await page.getByRole("button", { name: /yes/i }).first().click();
    await expect(page.getByText(/10,000/)).toBeVisible({ timeout: 5000 });

    // Q2: Exceeded threshold? → Yes
    const yesBtns = page.getByRole("button", { name: /yes/i });
    await yesBtns.nth(1).click();

    // Continue button → navigate to /personal
    const continueBtn = page.getByRole("button", { name: /continue/i }).or(page.getByRole("link", { name: /continue/i }));
    await expect(continueBtn.first()).toBeVisible({ timeout: 5000 });
    await continueBtn.first().click();
    await page.waitForURL("**/personal", { timeout: 15000 });
  });

  test("Step 2: personal info — all fields rendered, Previous button works", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // Page heading
    await expect(page.getByRole("heading", { name: /personal/i })).toBeVisible({ timeout: 10000 });

    // Form fields exist (using text content since labels are divs, not <label> elements)
    await expect(page.getByText("First Name")).toBeVisible();
    await expect(page.getByText("Last Name")).toBeVisible();
    await expect(page.getByText("Middle Name")).toBeVisible();
    await expect(page.getByText(/SSN/)).toBeVisible();
    await expect(page.getByText("Date of Birth")).toBeVisible();
    await expect(page.getByText("US Address")).toBeVisible();
    await expect(page.getByText("Phone")).toBeVisible();

    // SSN placeholder shows XXX-XX-XXXX format
    const ssnInput = page.locator('input[placeholder="XXX-XX-XXXX"]');
    await expect(ssnInput).toBeVisible();

    // Type SSN digits
    await ssnInput.fill("");
    await ssnInput.type("123456789", { delay: 30 });
    const val = await ssnInput.inputValue();
    // Check it contains the digits (may or may not auto-format)
    expect(val.replace(/\D/g, "")).toContain("123456789");

    // TIN type selector (SSN/ITIN)
    const tinSelect = page.locator("select").first();
    const tinOptions = await tinSelect.locator("option").allTextContents();
    expect(tinOptions).toContain("SSN");
    expect(tinOptions).toContain("ITIN");

    // Continue button
    await expect(page.getByRole("button", { name: /save.*continue|continue.*accounts/i })).toBeVisible();

    // Previous link → /threshold
    const prevLink = page.getByRole("link", { name: /previous/i });
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/threshold");
  });

  test("Step 3: accounts — add button, empty state, Previous", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    // Page heading
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Add Account button
    const addBtn = page.getByRole("button", { name: /add/i }).or(page.getByRole("link", { name: /add/i }));
    await expect(addBtn.first()).toBeVisible();

    // Previous link → /personal
    const prevLink = page.getByRole("link", { name: /previous/i });
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/personal");

    // Continue button exists
    const continueBtn = page.getByRole("button", { name: /continue/i }).or(page.getByRole("link", { name: /continue/i }));
    await expect(continueBtn.first()).toBeVisible();
  });

  test("Step 4: review — shows content, Previous", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");

    // Some heading
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Previous link → /accounts
    const prevLink = page.getByRole("link", { name: /previous/i });
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/accounts");
  });

  test("Step 5: sign — has signature UI, Previous", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");

    // Some heading
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Previous link → /review
    const prevLink = page.getByRole("link", { name: /previous/i });
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", "/review");
  });

  test("Step 6: dashboard — existing user sees filings", async ({ page }) => {
    await loginAs(page, "debug@example.com", "Debug123!");
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Dashboard heading
    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Shows some filing info
    const body = await page.textContent("body");
    const hasFilingContent = body!.includes("2025") || body!.includes("Tax Year") || body!.includes("Filing") || body!.includes("FBAR");
    expect(hasFilingContent).toBeTruthy();

    // Start New Filing button exists
    const newFilingLink = page.locator('a[href="/threshold"]');
    await expect(newFilingLink.first()).toBeVisible();
  });

  test("Navigation: wizard steps are clickable for completed steps", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // Step 1 (Threshold) should be clickable since we completed it
    const thresholdLink = page.locator('a[href="/threshold"]').first();
    await expect(thresholdLink).toBeVisible({ timeout: 10000 });
    await thresholdLink.click();
    await page.waitForURL("**/threshold", { timeout: 10000 });
    await expect(page).toHaveURL(/\/threshold/);
  });

  test("Navigation: header My Filings → dashboard", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // My Filings link in header
    const myFilingsLink = page.locator('a[href="/dashboard"]', { hasText: /filings/i });
    await expect(myFilingsLink).toBeVisible({ timeout: 10000 });
    await myFilingsLink.click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("Navigation: logout works", async ({ page }) => {
    await loginAs(page, EMAIL, PASSWORD);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // Log Out button
    const logoutBtn = page.getByRole("button", { name: /log out/i });
    await expect(logoutBtn).toBeVisible({ timeout: 10000 });
    await logoutBtn.click();

    // Should redirect to marketing page or login
    await page.waitForURL(/^\/$|\/login/, { timeout: 15000 });
  });
});
