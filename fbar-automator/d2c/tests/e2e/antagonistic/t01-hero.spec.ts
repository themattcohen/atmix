import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Antagonistic tests for Landing Page Hero + DeadlineBanner.
 *
 * These tests verify the core above-the-fold experience:
 * - DeadlineBanner visibility and content
 * - Hero headline, subtitle, description
 * - "Begin Filing" CTA button visibility and navigation
 * - Page reload stability (no console errors)
 */

test.describe("Landing Page Hero + DeadlineBanner", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  // Dev server can be slow; give each test plenty of room
  test.use({
    baseURL: "http://localhost:3001",
    navigationTimeout: 60000,
  });

  test("page loads at /", async ({ page }) => {
    const response = await page.goto("/", {
      waitUntil: "domcontentloaded",
    });
    expect(response).not.toBeNull();
    expect(response!.status()).toBeLessThan(400);
    // Wait for h1 to confirm the page actually rendered
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
  });

  test("DeadlineBanner renders with deadline-related text", async ({
    page,
  }) => {
    // Load page and clear any previous dismissal so the banner shows
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() =>
      localStorage.removeItem("fbar-deadline-dismissed")
    );
    await page.reload({ waitUntil: "domcontentloaded" });

    // The banner text should contain deadline info
    const bannerText = page.locator("text=FBAR Filing Deadline");
    await expect(bannerText).toBeVisible({ timeout: 15000 });

    // Verify key deadline details
    const bannerContainer = bannerText.locator("..");
    const fullText = await bannerContainer.textContent();
    expect(fullText).toContain("April");
    expect(fullText).toContain("2026");
  });

  test("Hero headline is visible and mentions FBAR-related content", async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const headline = page.locator("h1");
    await expect(headline).toBeVisible({ timeout: 15000 });

    const headlineText = await headline.textContent();
    expect(headlineText).toBeTruthy();
    // The headline should reference foreign bank accounts
    expect(headlineText!.toLowerCase()).toContain("foreign bank");
  });

  test("Hero subtitle/description text is visible", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Subtitle: "FinCEN Form 114 | Secure Electronic Filing Service"
    const subtitle = page.locator("text=FinCEN Form 114");
    await expect(subtitle.first()).toBeVisible({ timeout: 15000 });

    // Description paragraph about filing electronically
    const description = page.locator("text=File your FBAR electronically");
    await expect(description).toBeVisible({ timeout: 10000 });
  });

  test('"Begin Filing" CTA button is visible in the hero section', async ({
    page,
  }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // The hero section contains a "Begin Filing" link/button
    const heroSection = page.locator("main section").first();
    await expect(heroSection).toBeVisible({ timeout: 15000 });
    const cta = heroSection.locator("text=Begin Filing");
    await expect(cta).toBeVisible();

    // Verify it is styled as a link pointing to /threshold
    await expect(cta).toHaveAttribute("href", "/threshold");
  });

  test("clicking Begin Filing CTA redirects to /threshold", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Target the hero section specifically (first section inside main)
    // There are multiple "Begin Filing" links on the page (hero + pricing)
    const heroSection = page.locator("main section").first();
    await expect(heroSection).toBeVisible({ timeout: 15000 });
    const heroBeginFiling = heroSection.locator("text=Begin Filing");
    await expect(heroBeginFiling).toBeVisible();

    // Use Promise.all to avoid race: start waiting for navigation before clicking
    await Promise.all([
      page.waitForURL("**/threshold", {
        timeout: 60000,
        waitUntil: "domcontentloaded",
      }),
      heroBeginFiling.click(),
    ]);
    expect(page.url()).toContain("/threshold");
  });

  test("navigating back to / loads without console errors", async ({
    page,
  }) => {
    const consoleErrors: ConsoleMessage[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg);
      }
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Verify the page loaded successfully
    const headline = page.locator("h1");
    await expect(headline).toBeVisible({ timeout: 15000 });

    // Filter out known benign errors (e.g., favicon 404, third-party scripts)
    const realErrors = consoleErrors.filter((msg) => {
      const text = msg.text();
      // Ignore favicon errors and Next.js HMR noise
      if (text.includes("favicon")) return false;
      if (text.includes("hmr") || text.includes("HMR")) return false;
      if (text.includes("DevTools")) return false;
      // Ignore hydration warnings that are common in dev mode
      if (text.includes("Hydration")) return false;
      return true;
    });

    expect(
      realErrors,
      `Unexpected console errors: ${realErrors.map((e) => e.text()).join("; ")}`
    ).toHaveLength(0);
  });
});
