import { test, expect, Page } from "@playwright/test";

const EXISTING_EMAIL = "debug@example.com";
const EXISTING_PASSWORD = "Debug123!";

async function login(page: Page) {
  await page.goto("/login");
  await page.fill("#email", EXISTING_EMAIL);
  await page.fill("#password", EXISTING_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/, { timeout: 15000 });
}

test.describe("Dashboard Page", () => {
  test("loads after login", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("h1")).toContainText("My FBAR Filings");
  });

  test("shows Start New Filing button", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const newFilingBtn = page.locator("text=Start New Filing").or(page.locator("text=Start Your First Filing"));
    await expect(newFilingBtn.first()).toBeVisible();
  });

  test("Start New Filing navigates to threshold", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const newFilingBtn = page.locator('a[href="/threshold"]').first();
    await expect(newFilingBtn).toBeVisible();
    await newFilingBtn.click();
    await page.waitForURL("**/threshold");
    await expect(page).toHaveURL(/\/threshold/);
  });

  test("shows filing cards with status badges (existing user)", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // The existing debug user has a SUBMITTED filing
    // Check for filing cards
    const filingCards = page.locator("text=Tax Year");
    const count = await filingCards.count();
    if (count > 0) {
      // Has filings - check for status badge
      const statusBadge = page.locator("span.rounded-full").first();
      await expect(statusBadge).toBeVisible();
    } else {
      // No filings - should show empty state
      await expect(page.locator("text=No Filings Yet")).toBeVisible();
    }
  });

  test("filing cards have action buttons", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Check if there are filing cards
    const filingCards = page.locator("text=Tax Year");
    const count = await filingCards.count();
    if (count > 0) {
      // Should have action buttons like "View Status", "Resume Filing", etc.
      const actionBtns = page.locator('a').filter({ hasText: /Resume|Continue|View|Action|Complete/ });
      await expect(actionBtns.first()).toBeVisible();
    }
  });

  test("filing card shows account count", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const filingCards = page.locator("text=Tax Year");
    const count = await filingCards.count();
    if (count > 0) {
      // Should show account count like "2 accounts"
      await expect(page.locator("text=account").first()).toBeVisible();
    }
  });

  test("filing card shows filing type", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const filingCards = page.locator("text=Tax Year");
    const count = await filingCards.count();
    if (count > 0) {
      // Should show filing type (original, amended)
      await expect(page.locator("text=original").or(page.locator("text=amended")).first()).toBeVisible();
    }
  });

  test("FBAR Direct logo in header links to dashboard", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    const logo = page.locator('header a[href="/dashboard"]:has-text("FBAR Direct")');
    await expect(logo).toBeVisible();
  });
});

test.describe("Dashboard - Empty State", () => {
  test("new user sees empty state", async ({ page }) => {
    const emptyEmail = `empty-dash-${Date.now()}@test.com`;
    const emptyPassword = "EmptyDash123!";

    // Sign up a new user
    await page.goto("/signup");
    await page.fill("#firstName", "Empty");
    await page.fill("#lastName", "Dashboard");
    await page.fill("#email", emptyEmail);
    await page.fill("#password", emptyPassword);
    await page.fill("#confirmPassword", emptyPassword);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/threshold", { timeout: 15000 });

    // Go to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Should show empty state
    await expect(page.locator("text=No Filings Yet")).toBeVisible();
    await expect(page.locator("text=Start Your First Filing")).toBeVisible();
  });

  test("empty state CTA button navigates to threshold", async ({ page }) => {
    const emptyEmail2 = `empty-cta-${Date.now()}@test.com`;
    const emptyPassword2 = "EmptyCta123!";

    await page.goto("/signup");
    await page.fill("#firstName", "CTA");
    await page.fill("#lastName", "Test");
    await page.fill("#email", emptyEmail2);
    await page.fill("#password", emptyPassword2);
    await page.fill("#confirmPassword", emptyPassword2);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/threshold", { timeout: 15000 });

    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    await page.locator("text=Start Your First Filing").click();
    await page.waitForURL("**/threshold");
    await expect(page).toHaveURL(/\/threshold/);
  });
});

test.describe("Dashboard Navigation", () => {
  test("can navigate between dashboard and wizard pages", async ({ page }) => {
    await login(page);
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");

    // Go to threshold
    await page.locator('a[href="/threshold"]').first().click();
    await page.waitForURL("**/threshold");

    // Navigate back via My Filings in header
    await page.locator("text=My Filings").click();
    await page.waitForURL("**/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
