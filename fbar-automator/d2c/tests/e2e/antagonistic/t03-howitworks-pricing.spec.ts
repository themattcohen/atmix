import { test, expect } from "@playwright/test";

test.describe("HowItWorks + Pricing sections — antagonistic tests", () => {
  test.use({ baseURL: "http://localhost:3001" });

  // Allow extra time for dev server cold starts
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { timeout: 45_000 });
    await page.waitForLoadState("domcontentloaded");
  });

  // -------------------------------------------------------
  // 1. Landing page loads at all
  // -------------------------------------------------------
  test("landing page loads successfully on port 3001", async ({ page }) => {
    await expect(page).toHaveURL("/");
    // The page should have a meaningful title or at least an h1
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  // -------------------------------------------------------
  // 2. HowItWorks section renders with step numbers + descriptions
  // -------------------------------------------------------
  test("HowItWorks section renders with all three steps", async ({ page }) => {
    const section = page.locator("#how-to-file");
    await section.scrollIntoViewIfNeeded();

    // Section heading
    await expect(
      section.getByRole("heading", { name: "How to file with FBAR Direct" })
    ).toBeVisible();

    // Step 1
    const step1Heading = section.getByRole("heading", {
      name: "1. Enter your information",
    });
    await expect(step1Heading).toBeVisible();
    await expect(
      section.getByText("Provide your personal details and foreign account")
    ).toBeVisible();
    await expect(section.getByText("5–10 minutes")).toBeVisible();

    // Step 2
    const step2Heading = section.getByRole("heading", {
      name: "2. Review and sign",
    });
    await expect(step2Heading).toBeVisible();
    await expect(
      section.getByText("Review your filing for accuracy")
    ).toBeVisible();
    await expect(section.getByText("Form 114a")).toBeVisible();

    // Step 3
    const step3Heading = section.getByRole("heading", {
      name: "3. We submit to FinCEN",
    });
    await expect(step3Heading).toBeVisible();
    await expect(
      section.getByText("transmitted directly to FinCEN")
    ).toBeVisible();
    await expect(section.getByText("BSA tracking ID")).toBeVisible();
  });

  test("HowItWorks step numbers are sequential and visually distinct", async ({
    page,
  }) => {
    const section = page.locator("#how-to-file");
    await section.scrollIntoViewIfNeeded();

    // All three step headings must be h3 elements with correct numbering
    const stepHeadings = section.locator("h3");
    await expect(stepHeadings).toHaveCount(3);

    const texts = await stepHeadings.allTextContents();
    expect(texts[0]).toContain("1.");
    expect(texts[1]).toContain("2.");
    expect(texts[2]).toContain("3.");

    // Each step heading should be bold (font-bold class)
    for (let i = 0; i < 3; i++) {
      const heading = stepHeadings.nth(i);
      await expect(heading).toHaveCSS("font-weight", "700");
    }
  });

  // -------------------------------------------------------
  // 3. Pricing section renders with $59 price + feature bullets
  // -------------------------------------------------------
  test("Pricing section displays $59.00 price", async ({ page }) => {
    const section = page.locator("#pricing");
    await section.scrollIntoViewIfNeeded();

    // Section heading
    await expect(
      section.getByRole("heading", { name: "Filing Fee" })
    ).toBeVisible();

    // Price amount
    await expect(section.getByText("$59.00")).toBeVisible();

    // Context for the price
    await expect(
      section.getByText("FinCEN Form 114 (per filing):")
    ).toBeVisible();
  });

  test("Pricing section lists all included features", async ({ page }) => {
    const section = page.locator("#pricing");
    await section.scrollIntoViewIfNeeded();

    // "Fee includes:" label
    await expect(section.getByText("Fee includes:")).toBeVisible();

    // All four bullet items
    const bullets = section.locator("ul li");
    await expect(bullets).toHaveCount(4);

    const expectedBullets = [
      "FinCEN Form 114 preparation and review",
      "Direct electronic submission to FinCEN",
      "BSA tracking ID confirmation",
      "Secure record retention",
    ];

    for (const bulletText of expectedBullets) {
      await expect(section.getByText(bulletText)).toBeVisible();
    }
  });

  test("Pricing section shows disclaimer about per-year fee", async ({
    page,
  }) => {
    const section = page.locator("#pricing");
    await section.scrollIntoViewIfNeeded();

    await expect(
      section.getByText("Fee covers one FinCEN Form 114 for one calendar year")
    ).toBeVisible();
    await expect(
      section.getByText("No hidden fees or subscription requirements")
    ).toBeVisible();
  });

  // -------------------------------------------------------
  // 4. CTA button in Pricing redirects to /signup
  // -------------------------------------------------------
  test("'Begin Filing' CTA in Pricing section navigates to /signup", async ({
    page,
  }) => {
    const section = page.locator("#pricing");
    await section.scrollIntoViewIfNeeded();

    const ctaButton = section.getByRole("link", { name: /Begin Filing/i });
    await expect(ctaButton).toBeVisible();

    // Verify href before clicking
    await expect(ctaButton).toHaveAttribute("href", "/signup");

    // Click and verify navigation
    await ctaButton.click();
    await page.waitForURL("**/signup");
    expect(page.url()).toContain("/signup");
  });

  // -------------------------------------------------------
  // 5. Text readability — no overlapping or invisible text
  // -------------------------------------------------------
  test("HowItWorks text is readable (non-zero dimensions, visible)", async ({
    page,
  }) => {
    const section = page.locator("#how-to-file");
    await section.scrollIntoViewIfNeeded();

    // Section itself should have non-zero dimensions
    const sectionBox = await section.boundingBox();
    expect(sectionBox).not.toBeNull();
    expect(sectionBox!.width).toBeGreaterThan(100);
    expect(sectionBox!.height).toBeGreaterThan(100);

    // Check each paragraph has non-zero size and is not transparent
    const paragraphs = section.locator("p");
    const pCount = await paragraphs.count();
    expect(pCount).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < pCount; i++) {
      const p = paragraphs.nth(i);
      const box = await p.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(50);
      expect(box!.height).toBeGreaterThan(10);

      // Text should not be transparent (opacity 0 or color fully transparent)
      const opacity = await p.evaluate(
        (el) => window.getComputedStyle(el).opacity
      );
      expect(parseFloat(opacity)).toBeGreaterThan(0);

      const color = await p.evaluate(
        (el) => window.getComputedStyle(el).color
      );
      // color should not be rgba(0,0,0,0) or transparent
      expect(color).not.toBe("rgba(0, 0, 0, 0)");
      expect(color).not.toBe("transparent");
    }
  });

  test("Pricing text is readable (non-zero dimensions, visible)", async ({
    page,
  }) => {
    const section = page.locator("#pricing");
    await section.scrollIntoViewIfNeeded();

    const sectionBox = await section.boundingBox();
    expect(sectionBox).not.toBeNull();
    expect(sectionBox!.width).toBeGreaterThan(100);
    expect(sectionBox!.height).toBeGreaterThan(100);

    // Price text specifically must be visible and have readable size
    const priceText = section.getByText("$59.00");
    const priceBox = await priceText.boundingBox();
    expect(priceBox).not.toBeNull();
    expect(priceBox!.width).toBeGreaterThan(10);
    expect(priceBox!.height).toBeGreaterThan(10);

    // Bullet list items should have non-zero dimensions
    const bullets = section.locator("ul li");
    const bulletCount = await bullets.count();
    for (let i = 0; i < bulletCount; i++) {
      const bullet = bullets.nth(i);
      const box = await bullet.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(50);
      expect(box!.height).toBeGreaterThan(10);
    }

    // CTA button should be visible and have adequate click target size
    const cta = section.getByRole("link", { name: /Begin Filing/i });
    const ctaBox = await cta.boundingBox();
    expect(ctaBox).not.toBeNull();
    // Minimum touch target: 44x44 is WCAG recommendation, but we'll check for reasonableness
    expect(ctaBox!.width).toBeGreaterThan(40);
    expect(ctaBox!.height).toBeGreaterThan(30);
  });

  test("HowItWorks and Pricing sections do not overlap each other", async ({
    page,
  }) => {
    const howItWorks = page.locator("#how-to-file");
    const pricing = page.locator("#pricing");

    const howBox = await howItWorks.boundingBox();
    const pricingBox = await pricing.boundingBox();

    expect(howBox).not.toBeNull();
    expect(pricingBox).not.toBeNull();

    // HowItWorks should end before Pricing starts (no vertical overlap)
    // howBox bottom (y + height) should be <= pricingBox top (y)
    const howBottom = howBox!.y + howBox!.height;
    expect(howBottom).toBeLessThanOrEqual(pricingBox!.y + 1); // 1px tolerance
  });
});
