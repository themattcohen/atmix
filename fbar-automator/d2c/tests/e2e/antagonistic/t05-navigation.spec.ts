import { test, expect, Page } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// Increase timeout — dev server is slow under test load + networkidle waits
test.setTimeout(90_000);

/**
 * Navigate to landing page and wait for React hydration.
 * The marketing layout is a "use client" component, so we need
 * to wait until React has hydrated the page and event handlers
 * are attached. We use domcontentloaded (not networkidle) because
 * the Next.js dev server HMR WebSocket prevents networkidle from
 * settling. Instead we wait for the nav to be interactive.
 */
async function gotoLandingHydrated(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // Wait for React hydration — nav buttons need to be interactive
  await page.locator("nav[aria-label='Main navigation']").waitFor({ state: "visible", timeout: 15000 });
}

/**
 * Open the mobile menu reliably. Clicks the hamburger and waits for
 * the dialog to appear. If the first click fires before hydration
 * completes (React swallows it), retries up to 5 times with
 * increasing delays.
 */
async function openMobileMenu(page: Page) {
  const hamburger = page.getByRole("button", { name: "Open menu" });
  const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

  for (let attempt = 0; attempt < 5; attempt++) {
    await hamburger.click();
    try {
      await expect(mobileMenu).toBeVisible({ timeout: 5_000 });
      return; // success
    } catch {
      // Dialog didn't appear — React may not have hydrated yet.
      // Wait with increasing backoff and retry.
      await page.waitForTimeout(500 * (attempt + 1));
    }
  }
  // Final attempt — let it fail with full error
  await expect(mobileMenu).toBeVisible({ timeout: 10_000 });
}

// =============================================================
// Desktop Navigation Tests (1280x720 — default Playwright viewport)
// =============================================================

test.describe("Desktop Navigation", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("nav links are visible on desktop", async ({ page }) => {
    await gotoLandingHydrated(page);

    // Desktop nav container should be visible
    const desktopNav = page.locator("nav[aria-label='Main navigation'] .hidden.md\\:flex");
    await expect(desktopNav).toBeVisible();

    // All expected links present and visible
    await expect(desktopNav.getByText("Who Must File")).toBeVisible();
    await expect(desktopNav.getByText("How to File")).toBeVisible();
    await expect(desktopNav.getByText("Pricing")).toBeVisible();
    await expect(desktopNav.getByText("FAQ")).toBeVisible();
    await expect(desktopNav.getByText("Log In")).toBeVisible();
    await expect(desktopNav.getByText("Begin Filing")).toBeVisible();
  });

  test("hamburger menu button is NOT visible on desktop", async ({ page }) => {
    await gotoLandingHydrated(page);

    const hamburger = page.getByRole("button", { name: "Open menu" });
    await expect(hamburger).toBeHidden();
  });

  test("'Who Must File' link scrolls to correct section", async ({ page }) => {
    await gotoLandingHydrated(page);

    const link = page.locator("nav[aria-label='Main navigation']").getByText("Who Must File");
    await link.click();

    await expect(page).toHaveURL(/\/#who-must-file/);
    await expect(page.locator("#who-must-file")).toBeVisible();
  });

  test("'How to File' link scrolls to correct section", async ({ page }) => {
    await gotoLandingHydrated(page);

    const link = page.locator("nav[aria-label='Main navigation']").getByText("How to File");
    await link.click();

    await expect(page).toHaveURL(/\/#how-to-file/);
    await expect(page.locator("#how-to-file")).toBeVisible();
  });

  test("'Pricing' link scrolls to correct section", async ({ page }) => {
    await gotoLandingHydrated(page);

    const link = page.locator("nav[aria-label='Main navigation']").getByText("Pricing").first();
    await link.click();

    await expect(page).toHaveURL(/\/#pricing/);
    await expect(page.locator("#pricing")).toBeVisible();
  });

  test("'FAQ' link scrolls to correct section", async ({ page }) => {
    await gotoLandingHydrated(page);

    const link = page.locator("nav[aria-label='Main navigation']").getByText("FAQ").first();
    await link.click();

    await expect(page).toHaveURL(/\/#faq/);
    await expect(page.locator("#faq")).toBeVisible();
  });

  test("'Log In' navigates to /login", async ({ page }) => {
    await gotoLandingHydrated(page);

    const loginLink = page.locator("nav[aria-label='Main navigation']").getByText("Log In");
    await loginLink.click();

    await page.waitForURL("**/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("'Begin Filing' navigates to /signup", async ({ page }) => {
    await gotoLandingHydrated(page);

    const beginFilingLink = page.locator("nav[aria-label='Main navigation']").getByText("Begin Filing");
    await beginFilingLink.click();

    await page.waitForURL("**/signup", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("FBAR Direct logo links back to home", async ({ page }) => {
    await page.goto("/about", { waitUntil: "domcontentloaded" });
    await page.locator("nav[aria-label='Main navigation']").waitFor({ state: "visible", timeout: 15000 });

    const logo = page.locator("nav[aria-label='Main navigation']").getByText("FBAR Direct");
    await logo.click();

    await page.waitForURL(/\/$/, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/$/);
  });
});

// =============================================================
// Mobile Navigation Tests (375x667 — iPhone SE viewport)
// =============================================================

test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("desktop nav links are hidden at mobile viewport", async ({ page }) => {
    await gotoLandingHydrated(page);

    const desktopNav = page.locator("nav[aria-label='Main navigation'] .hidden.md\\:flex");
    await expect(desktopNav).toBeHidden();
  });

  test("hamburger menu button is visible at mobile viewport", async ({ page }) => {
    await gotoLandingHydrated(page);

    const hamburger = page.getByRole("button", { name: "Open menu" });
    await expect(hamburger).toBeVisible();
  });

  test("clicking hamburger opens mobile menu with all links", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    // All nav links should be present in the mobile menu
    await expect(mobileMenu.getByText("Who Must File")).toBeVisible();
    await expect(mobileMenu.getByText("How to File")).toBeVisible();
    await expect(mobileMenu.getByText("Pricing")).toBeVisible();
    await expect(mobileMenu.getByText("FAQ")).toBeVisible();
    await expect(mobileMenu.getByText("Log In")).toBeVisible();
    await expect(mobileMenu.getByText("Begin Filing")).toBeVisible();
  });

  test("mobile menu close button works", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });
    const closeBtn = page.getByRole("button", { name: "Close menu" });

    // Ensure close button is visible and actionable before clicking
    await expect(closeBtn).toBeVisible({ timeout: 5_000 });
    await closeBtn.click();
    await expect(mobileMenu).not.toBeVisible({ timeout: 10_000 });
  });

  test("Escape key closes mobile menu", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    await page.keyboard.press("Escape");
    await expect(mobileMenu).toBeHidden();
  });

  test("clicking a hash link in mobile menu closes menu and navigates", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    // Click 'Who Must File' link
    await mobileMenu.getByText("Who Must File").click();

    // Menu should close
    await expect(mobileMenu).toBeHidden();

    // URL should have the hash
    await expect(page).toHaveURL(/\/#who-must-file/);

    // Section should be visible
    await expect(page.locator("#who-must-file")).toBeVisible();
  });

  test("clicking 'Pricing' in mobile menu closes menu and scrolls", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    await mobileMenu.getByText("Pricing").click();

    await expect(mobileMenu).toBeHidden();
    await expect(page).toHaveURL(/\/#pricing/);
    await expect(page.locator("#pricing")).toBeVisible();
  });

  test("clicking 'Log In' in mobile menu navigates to /login", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    await mobileMenu.getByText("Log In").click();

    await page.waitForURL("**/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/login$/);
  });

  test("clicking 'Begin Filing' in mobile menu navigates to /signup", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    await mobileMenu.getByText("Begin Filing").click();

    await page.waitForURL("**/signup", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("focus is trapped/managed in mobile menu", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(mobileMenu).toBeVisible();

    // After opening, focus should be inside the mobile menu
    // The component focuses the first focusable element
    const focused = page.locator(":focus");
    const focusedInMenu = await focused.evaluate((el) => {
      const dialog = el.closest("[role='dialog']");
      return dialog !== null;
    });
    expect(focusedInMenu).toBe(true);
  });

  test("after closing mobile menu, focus returns to hamburger button", async ({ page }) => {
    await gotoLandingHydrated(page);
    await openMobileMenu(page);

    const mobileMenu = page.getByRole("dialog", { name: "Navigation menu" });

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(mobileMenu).toBeHidden();

    // Focus should return to the hamburger button
    const hamburger = page.getByRole("button", { name: "Open menu" });
    await expect(hamburger).toBeFocused();
  });
});
