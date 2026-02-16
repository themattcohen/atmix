import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------
test.describe("Landing Page", () => {
  test("loads with hero content and CTA button", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("File Your FBAR");
    await expect(
      page.locator("text=Start Filing Now").first()
    ).toBeVisible();
    await expect(page.locator("text=No credit card required")).toBeVisible();
  });

  test("hero CTA navigates to signup", async ({ page }) => {
    await page.goto("/");
    await page.locator("text=Start Filing Now").first().click();
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("footer CTA navigates to signup", async ({ page }) => {
    await page.goto("/");
    const ctaButtons = page.locator("text=Start Filing Now");
    await ctaButtons.last().click();
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });

  test("has How It Works section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator("text=How It Works").first()
    ).toBeVisible();
  });

  test("has Pricing section with $59 price", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=$59").first()).toBeVisible();
  });

  test("has FAQ section", async ({ page }) => {
    await page.goto("/");
    await expect(
      page
        .locator("text=FAQ")
        .first()
        .or(page.locator("text=Frequently Asked").first())
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Static Marketing Pages — each loads and has correct heading/content
// ---------------------------------------------------------------------------
test.describe("Static Marketing Pages", () => {
  test("About page loads with heading", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("h1")).toContainText(
      "The Trustworthy FBAR Filing Alternative"
    );
    await expect(page.locator("text=Why We Built FBAR Direct")).toBeVisible();
  });

  test("Pricing page loads with pricing info", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("h1")).toContainText(
      "Simple, Transparent Pricing"
    );
    await expect(page.locator("text=$59")).toBeVisible();
    await expect(
      page.locator("text=No hidden fees")
    ).toBeVisible();
  });

  test("How It Works page loads with steps", async ({ page }) => {
    await page.goto("/how-it-works", { timeout: 30000 });
    await expect(page.locator("h1")).toContainText(
      "How FBAR Direct Works"
    );
    await expect(
      page.locator("text=Check If You Need to File")
    ).toBeVisible();
    await expect(
      page.locator("text=We Submit to FinCEN")
    ).toBeVisible();
  });

  test("Privacy page loads with policy content", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1")).toContainText("Privacy Policy");
    await expect(
      page.locator("text=We never sell your data")
    ).toBeVisible();
    await expect(
      page.locator("text=Information We Collect")
    ).toBeVisible();
  });

  test("Terms page loads with terms content", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1")).toContainText("Terms of Service");
    await expect(
      page.locator("text=Agreement to Terms")
    ).toBeVisible();
    await expect(
      page.locator("text=Limitation of Liability")
    ).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Desktop Navigation
// ---------------------------------------------------------------------------
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

  test("How It Works nav link navigates correctly", async ({ page }) => {
    await page.goto("/");
    await page.click("header nav >> text=How It Works");
    await page.waitForURL("**/how-it-works");
    await expect(page).toHaveURL(/\/how-it-works/);
    await expect(page.locator("h1")).toContainText("How FBAR Direct Works");
  });

  test("Pricing nav link navigates correctly", async ({ page }) => {
    await page.goto("/");
    await page.click("header nav >> text=Pricing");
    await page.waitForURL("**/pricing");
    await expect(page).toHaveURL(/\/pricing/);
  });

  test("About nav link navigates correctly", async ({ page }) => {
    await page.goto("/");
    await page.click("header nav >> text=About");
    await page.waitForURL("**/about");
    await expect(page).toHaveURL(/\/about/);
  });

  test("Log In nav link navigates to login page", async ({ page }) => {
    await page.goto("/");
    await page.click("header nav >> text=Log In");
    await page.waitForURL("**/login");
    await expect(page).toHaveURL(/\/login/);
  });

  test("Start Filing nav button navigates to signup", async ({ page }) => {
    await page.goto("/");
    await page.click("header nav >> text=Start Filing");
    await page.waitForURL("**/signup");
    await expect(page).toHaveURL(/\/signup/);
  });
});

// ---------------------------------------------------------------------------
// Footer Links
// ---------------------------------------------------------------------------
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

  test("footer Privacy Policy link navigates to /privacy", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("footer").locator("text=Privacy Policy").click();
    await page.waitForURL("**/privacy");
    await expect(page).toHaveURL(/\/privacy/);
  });

  test("footer Terms of Service link navigates to /terms", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator("footer").locator("text=Terms of Service").click();
    await page.waitForURL("**/terms");
    await expect(page).toHaveURL(/\/terms/);
  });

  test("footer disclaimer is present", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toContainText(
      "not affiliated with the IRS"
    );
  });
});

// ---------------------------------------------------------------------------
// Mobile Navigation
// ---------------------------------------------------------------------------
test.describe("Mobile Navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("hamburger menu appears on mobile", async ({ page }) => {
    await page.goto("/");
    const hamburger = page.locator('button[aria-label="Toggle navigation menu"]');
    await expect(hamburger).toBeVisible();
  });

  test("hamburger menu opens and shows all links", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Toggle navigation menu"]');
    const overlay = page.locator(".fixed.inset-0");
    await expect(overlay).toBeVisible();
    await expect(overlay.locator("text=How It Works")).toBeVisible();
    await expect(overlay.locator("text=Pricing")).toBeVisible();
    await expect(overlay.locator("text=About")).toBeVisible();
    await expect(overlay.locator("text=Log In")).toBeVisible();
    await expect(overlay.locator("text=Start Filing")).toBeVisible();
  });

  test("hamburger menu close button works", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Toggle navigation menu"]');
    await expect(page.locator(".fixed.inset-0")).toBeVisible();
    await page.click('button[aria-label="Close menu"]');
    await expect(page.locator(".fixed.inset-0")).toBeHidden();
  });

  test("mobile menu link navigates and closes menu", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Toggle navigation menu"]');
    await page
      .locator(".fixed.inset-0")
      .locator("text=How It Works")
      .click();
    await page.waitForURL("**/how-it-works");
    await expect(page).toHaveURL(/\/how-it-works/);
  });
});
