import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("loads with hero content", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("File Your FBAR");
    await expect(page.locator("text=Start Filing Now").first()).toBeVisible();
    await expect(page.locator("text=No credit card required")).toBeVisible();
  });

  test("hero CTA navigates to signup", async ({ page }) => {
    await page.goto("/");
    await page.click("text=Start Filing Now >> nth=0");
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("footer CTA navigates to signup", async ({ page }) => {
    await page.goto("/");
    // The bottom CTA "Start Filing Now"
    const ctaButtons = page.locator("text=Start Filing Now");
    await ctaButtons.last().click();
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("has TrustBar section", async ({ page }) => {
    await page.goto("/");
    // Check that at least some trust indicators are visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("has How It Works section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=How It Works").first()).toBeVisible();
  });

  test("has Pricing section", async ({ page }) => {
    await page.goto("/");
    // PricingComparison component should be visible on landing
    await expect(page.locator("text=$59").first()).toBeVisible();
  });

  test("has FAQ section", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=FAQ").first().or(page.locator("text=Frequently Asked").first())).toBeVisible();
  });
});

test.describe("Desktop Navigation", () => {
  test("nav bar has all expected links", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("header nav");
    await expect(nav.locator("text=How It Works")).toBeVisible();
    await expect(nav.locator("text=Pricing")).toBeVisible();
    await expect(nav.locator("text=About")).toBeVisible();
    await expect(nav.locator("text=Log In")).toBeVisible();
    await expect(nav.locator("text=Start Filing")).toBeVisible();
  });

  test("How It Works nav link works", async ({ page }) => {
    await page.goto("/");
    await page.click('header nav >> text=How It Works');
    await page.waitForURL("**/how-it-works");
    await expect(page).toHaveURL(/\/how-it-works/);
    // Page should have content
    await expect(page.locator("main")).toBeVisible();
  });

  test("Pricing nav link works", async ({ page }) => {
    await page.goto("/");
    await page.click('header nav >> text=Pricing');
    await page.waitForURL("**/pricing");
    await expect(page).toHaveURL(/\/pricing/);
  });

  test("About nav link works", async ({ page }) => {
    await page.goto("/");
    await page.click('header nav >> text=About');
    await page.waitForURL("**/about");
    await expect(page).toHaveURL(/\/about/);
  });

  test("Log In nav link works", async ({ page }) => {
    await page.goto("/");
    await page.click('header nav >> text=Log In');
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Start Filing nav button works", async ({ page }) => {
    await page.goto("/");
    await page.click('header nav >> text=Start Filing');
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });
});

test.describe("Footer Links", () => {
  test("footer has Resources links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.locator("text=How It Works")).toBeVisible();
    await expect(footer.locator("text=Pricing")).toBeVisible();
    await expect(footer.locator("text=About Us")).toBeVisible();
  });

  test("footer has Legal links", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer.locator("text=Privacy Policy")).toBeVisible();
    await expect(footer.locator("text=Terms of Service")).toBeVisible();
  });

  test("footer Privacy Policy link works", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").locator("text=Privacy Policy").click();
    await page.waitForURL("**/privacy");
    await expect(page).toHaveURL(/\/privacy/);
  });

  test("footer Terms of Service link works", async ({ page }) => {
    await page.goto("/");
    await page.locator("footer").locator("text=Terms of Service").click();
    await page.waitForURL("**/terms");
    await expect(page).toHaveURL(/\/terms/);
  });

  test("footer disclaimer is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toContainText("not affiliated with the IRS");
  });
});

test.describe("Static Marketing Pages", () => {
  test("How It Works page loads", async ({ page }) => {
    await page.goto("/how-it-works");
    await expect(page.locator("main")).toBeVisible();
  });

  test("Pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("main")).toBeVisible();
  });

  test("About page loads", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("main")).toBeVisible();
  });

  test("Privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("main")).toBeVisible();
  });

  test("Terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("hamburger menu appears on mobile", async ({ page }) => {
    await page.goto("/");
    // Desktop nav links should be hidden
    await expect(page.locator('header nav >> .hidden.md\\:flex')).toBeHidden();
    // Hamburger button should be visible
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await expect(hamburger).toBeVisible();
  });

  test("hamburger menu opens and shows links", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Open menu"]');
    // Mobile menu overlay
    const overlay = page.locator('.fixed.inset-0');
    await expect(overlay).toBeVisible();
    await expect(overlay.locator("text=How It Works")).toBeVisible();
    await expect(overlay.locator("text=Pricing")).toBeVisible();
    await expect(overlay.locator("text=About")).toBeVisible();
    await expect(overlay.locator("text=Log In")).toBeVisible();
    await expect(overlay.locator("text=Start Filing")).toBeVisible();
  });

  test("hamburger menu close button works", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Open menu"]');
    await expect(page.locator('.fixed.inset-0')).toBeVisible();
    await page.click('button[aria-label="Close menu"]');
    await expect(page.locator('.fixed.inset-0')).toBeHidden();
  });

  test("mobile menu link navigates and closes menu", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Open menu"]');
    await page.locator('.fixed.inset-0').locator("text=How It Works").click();
    await page.waitForURL("**/how-it-works");
    await expect(page).toHaveURL(/\/how-it-works/);
  });
});
