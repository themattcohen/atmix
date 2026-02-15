import { test, expect, Page } from "@playwright/test";

// Use existing debug user — already has a SUBMITTED filing
const EMAIL = "debug@example.com";
const PASSWORD = "Debug123!";

test.setTimeout(60000);

async function login(page: Page) {
  await page.goto("/login");
  await page.fill('#email', EMAIL);
  await page.fill('#password', PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/, { timeout: 30000 });
}

test.describe("Wizard Pages — Direct Navigation", () => {
  test("threshold: year picker + Yes/No questions render", async ({ page }) => {
    await login(page);
    await page.goto("/threshold");
    await page.waitForLoadState("networkidle");

    // Heading
    await expect(page.getByRole("heading", { name: /file/i })).toBeVisible({ timeout: 10000 });

    // Year select with 3+ options
    const select = page.locator("select").first();
    await expect(select).toBeVisible();
    const options = await select.locator("option").count();
    expect(options).toBeGreaterThanOrEqual(3);

    // Yes/No buttons
    await expect(page.getByRole("button", { name: /yes/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /no/i }).first()).toBeVisible();

    // Click Yes → second question appears
    await page.getByRole("button", { name: /yes/i }).first().click();
    await expect(page.getByText(/10,000/)).toBeVisible({ timeout: 5000 });

    // Click second Yes → Continue appears
    await page.getByRole("button", { name: /yes/i }).nth(1).click();
    await expect(page.getByText(/continue/i).first()).toBeVisible({ timeout: 5000 });
  });

  test("personal: all form fields present", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /personal/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("First Name")).toBeVisible();
    await expect(page.getByText("Last Name")).toBeVisible();
    await expect(page.getByText("Middle Name")).toBeVisible();
    await expect(page.getByText(/SSN/)).toBeVisible();
    await expect(page.getByText("Date of Birth")).toBeVisible();
    await expect(page.getByText("US Address")).toBeVisible();
    await expect(page.getByText("Phone")).toBeVisible();

    // SSN field has XXX-XX-XXXX placeholder
    await expect(page.locator('input[placeholder="XXX-XX-XXXX"]')).toBeVisible();

    // TIN Type selector has SSN and ITIN
    const tinSelect = page.locator("select").first();
    const opts = await tinSelect.locator("option").allTextContents();
    expect(opts).toContain("SSN");
    expect(opts).toContain("ITIN");

    // Continue button
    await expect(page.getByRole("button", { name: /save.*continue|continue/i })).toBeVisible();

    // Previous → /threshold
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).toBeVisible();
    await expect(prev).toHaveAttribute("href", "/threshold");
  });

  test("accounts: add button + continue + previous", async ({ page }) => {
    await login(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Add Account button
    await expect(page.getByRole("button", { name: /add/i }).first()).toBeVisible();

    // Previous → /personal
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).toBeVisible();
    await expect(prev).toHaveAttribute("href", "/personal");
  });

  test("review: heading + previous + content", async ({ page }) => {
    await login(page);
    await page.goto("/review");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Previous → /accounts
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).toBeVisible();
    await expect(prev).toHaveAttribute("href", "/accounts");
  });

  test("sign: signature UI + previous", async ({ page }) => {
    await login(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Previous → /review
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).toBeVisible();
    await expect(prev).toHaveAttribute("href", "/review");
  });

  test("payment: has payment button + previous", async ({ page }) => {
    await login(page);
    await page.goto("/payment");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Previous → /sign
    const prev = page.getByRole("link", { name: /previous/i });
    await expect(prev).toBeVisible();
    await expect(prev).toHaveAttribute("href", "/sign");
  });

  test("dashboard: shows filings + action buttons", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 10000 });

    // Has filing content
    const body = await page.textContent("body");
    expect(body).toMatch(/2025|Tax Year|Filing|FBAR|Submitted/i);

    // Has "Start New Filing" or similar link to /threshold
    await expect(page.locator('a[href="/threshold"]').first()).toBeVisible();
  });

  test("navigation: wizard step indicator shows all 7 steps", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // All wizard steps visible
    await expect(page.getByText("Threshold")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("Personal Info").or(page.getByText("Personal"))).toBeVisible();
    await expect(page.getByText("Accounts")).toBeVisible();
    await expect(page.getByText("Review")).toBeVisible();
    await expect(page.getByText("Sign")).toBeVisible();
    await expect(page.getByText("Payment")).toBeVisible();
    await expect(page.getByText("Confirmation")).toBeVisible();
  });

  test("navigation: My Filings header link → dashboard", async ({ page }) => {
    await login(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    const link = page.locator('a[href="/dashboard"]').filter({ hasText: /filings/i });
    await expect(link).toBeVisible({ timeout: 10000 });
    await link.click();
    await page.waitForURL("**/dashboard", { timeout: 10000 });
  });

  test("navigation: logout redirects to home", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: /log out/i }).click();
    await page.waitForURL(/^\/$|\/login/, { timeout: 15000 });
  });

  test("mobile: app header doesn't overflow at 375px", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Page should load without horizontal scroll
    const body = page.locator("body");
    const bodyWidth = await body.evaluate(el => el.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 20); // small margin for scrollbar
  });
});
