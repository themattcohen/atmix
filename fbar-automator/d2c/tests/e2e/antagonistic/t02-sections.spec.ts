import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

test.describe("Landing Page Sections: TrustBar + WhoNeedsToFile + WhatYouNeed", () => {
  // Increase timeout to handle slow dev server recompilation between tests
  test.setTimeout(60_000);

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
  });

  // ─────────────────────────────────────────────────
  // TrustBar Section
  // ─────────────────────────────────────────────────

  test("TrustBar renders all three trust indicators", async ({ page }) => {
    // The TrustBar is a section with three checkmark-prefixed trust badges
    const trustBar = page.locator("section").filter({ hasText: "FinCEN-Registered BSA E-Filer" });
    await expect(trustBar).toBeVisible();

    await expect(trustBar.getByText("FinCEN-Registered BSA E-Filer")).toBeVisible();
    await expect(trustBar.getByText("AES-256 Encryption")).toBeVisible();
    await expect(trustBar.getByText("Direct FinCEN Submission")).toBeVisible();
  });

  test("TrustBar trust indicators contain checkmark prefix", async ({ page }) => {
    // Each trust badge should be prefixed with a checkmark character
    const badges = page.locator("section").filter({ hasText: "FinCEN-Registered BSA E-Filer" }).locator("span");
    const allBadges = await badges.all();
    // Filter to only badges that contain a checkmark
    let checkmarkCount = 0;
    for (const badge of allBadges) {
      const text = await badge.textContent();
      if (text && text.includes("\u2713")) {
        checkmarkCount++;
      }
    }
    expect(checkmarkCount).toBe(3);
  });

  test("TrustBar is positioned after Hero section", async ({ page }) => {
    const allSections = page.locator("section");
    const count = await allSections.count();
    expect(count).toBeGreaterThanOrEqual(2);

    // TrustBar contains FinCEN text - find its index
    let trustBarIndex = -1;
    for (let i = 0; i < count; i++) {
      const text = await allSections.nth(i).textContent();
      if (text && text.includes("FinCEN-Registered BSA E-Filer")) {
        trustBarIndex = i;
        break;
      }
    }
    // TrustBar should appear after at least one other section (Hero)
    expect(trustBarIndex).toBeGreaterThan(0);
  });

  // ─────────────────────────────────────────────────
  // WhoNeedsToFile Section
  // ─────────────────────────────────────────────────

  test("WhoNeedsToFile section renders with correct heading", async ({ page }) => {
    const section = page.locator("#who-must-file");
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();

    const heading = section.locator("h2");
    await expect(heading).toHaveText("Who must file an FBAR?");
  });

  test("WhoNeedsToFile displays Bank Secrecy Act explanation", async ({ page }) => {
    const section = page.locator("#who-must-file");
    await section.scrollIntoViewIfNeeded();

    // Verify the introductory paragraph about the Bank Secrecy Act
    await expect(
      section.getByText("The Bank Secrecy Act requires you to file an FBAR")
    ).toBeVisible();
    // Verify the $10,000 threshold is mentioned - use .first() because it appears in
    // both the intro paragraph and the "Aggregate Value" list item
    await expect(
      section.getByText("$10,000", { exact: false }).first()
    ).toBeVisible();
  });

  test("WhoNeedsToFile lists all filing requirements", async ({ page }) => {
    const section = page.locator("#who-must-file");
    await section.scrollIntoViewIfNeeded();

    // Verify "Filing Requirements" subheading
    await expect(section.getByText("Filing Requirements")).toBeVisible();

    // Verify all four requirement categories
    await expect(section.getByText("Citizens & Residents:")).toBeVisible();
    await expect(section.getByText("Aggregate Value > $10,000:")).toBeVisible();
    await expect(section.getByText("Entities:")).toBeVisible();
    await expect(section.getByText("Signature Authority:")).toBeVisible();
  });

  test("WhoNeedsToFile shows penalties warning box", async ({ page }) => {
    const section = page.locator("#who-must-file");
    await section.scrollIntoViewIfNeeded();

    // Verify penalties section
    await expect(section.getByText("Penalties for Failure to File")).toBeVisible();
    // Verify specific penalty amounts are mentioned
    await expect(section.getByText("$16,000", { exact: false })).toBeVisible();
    await expect(section.getByText("$100,000", { exact: false })).toBeVisible();
    // Verify the legal source citation
    await expect(section.getByText("31 USC 5321")).toBeVisible();
  });

  test("WhoNeedsToFile includes United States Person definition", async ({ page }) => {
    const section = page.locator("#who-must-file");
    await section.scrollIntoViewIfNeeded();

    // The heading uses curly quotes via &ldquo; and &rdquo;
    await expect(
      section.getByText(/United States Person.*Definition/)
    ).toBeVisible();
    // Verify definition content
    await expect(
      section.getByText("citizen or resident of the United States", { exact: false })
    ).toBeVisible();
  });

  // ─────────────────────────────────────────────────
  // WhatYouNeed Section
  // ─────────────────────────────────────────────────

  test("WhatYouNeed section renders with correct heading", async ({ page }) => {
    const heading = page.getByRole("heading", { name: "What you will need to file" });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();
  });

  test("WhatYouNeed lists all personal information items", async ({ page }) => {
    const heading = page.getByRole("heading", { name: "Personal Information" });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    const section = page.locator("section").filter({ hasText: "What you will need to file" });

    // Verify all personal info items
    await expect(section.getByText("Full legal name")).toBeVisible();
    await expect(section.getByText("SSN or ITIN")).toBeVisible();
    await expect(section.getByText("Date of birth")).toBeVisible();
    await expect(section.getByText("Current mailing address")).toBeVisible();
    await expect(section.getByText("Email and phone number")).toBeVisible();
  });

  test("WhatYouNeed lists all foreign account detail items", async ({ page }) => {
    const heading = page.getByRole("heading", { name: "Foreign Account Details" });
    await heading.scrollIntoViewIfNeeded();
    await expect(heading).toBeVisible();

    const section = page.locator("section").filter({ hasText: "What you will need to file" });

    // Verify the "For each account" intro text
    await expect(section.getByText("For each account you are reporting:")).toBeVisible();

    // Verify all account detail items
    await expect(section.getByText("Financial institution name")).toBeVisible();
    await expect(section.getByText("Account number")).toBeVisible();
    await expect(section.getByText("Maximum value during the calendar year")).toBeVisible();
    await expect(section.getByText("Type of account (Bank, Securities, Other)")).toBeVisible();
    await expect(section.getByText("Address of the financial institution")).toBeVisible();
  });

  test("WhatYouNeed displays note about not needing bank statements", async ({ page }) => {
    const section = page.locator("section").filter({ hasText: "What you will need to file" });
    await section.scrollIntoViewIfNeeded();

    await expect(
      section.getByText("Enter account details manually")
    ).toBeVisible();
    await expect(
      section.getByText("upload bank statements and let AI extract them automatically", { exact: false })
    ).toBeVisible();
  });

  // ─────────────────────────────────────────────────
  // Cross-Section: No broken images / missing icons
  // ─────────────────────────────────────────────────

  test("No broken images exist in TrustBar, WhoNeedsToFile, or WhatYouNeed sections", async ({ page }) => {
    // Wait for network activity to settle
    await page.waitForLoadState("networkidle");

    // Find all img elements on the page
    const images = page.locator("img");
    const imgCount = await images.count();

    // For each image, verify it has a valid src and loaded correctly
    for (let i = 0; i < imgCount; i++) {
      const img = images.nth(i);
      const src = await img.getAttribute("src");
      const alt = await img.getAttribute("alt");

      // Every image should have a src attribute
      expect(src, `Image at index ${i} (alt="${alt}") should have a src`).toBeTruthy();

      // Check that the image actually loaded (naturalWidth > 0 means loaded)
      const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
      expect(
        naturalWidth,
        `Image at index ${i} (src="${src}", alt="${alt}") should have loaded (naturalWidth > 0)`
      ).toBeGreaterThan(0);
    }
  });

  test("All three sections are present in correct DOM order", async ({ page }) => {
    const allSections = page.locator("section");
    const count = await allSections.count();

    let trustBarIdx = -1;
    let whoNeedsIdx = -1;
    let whatYouNeedIdx = -1;

    for (let i = 0; i < count; i++) {
      const text = await allSections.nth(i).textContent();
      if (text && text.includes("FinCEN-Registered BSA E-Filer")) trustBarIdx = i;
      if (text && text.includes("Who must file an FBAR")) whoNeedsIdx = i;
      if (text && text.includes("What you will need to file")) whatYouNeedIdx = i;
    }

    // All three sections must exist
    expect(trustBarIdx, "TrustBar section must exist").toBeGreaterThanOrEqual(0);
    expect(whoNeedsIdx, "WhoNeedsToFile section must exist").toBeGreaterThanOrEqual(0);
    expect(whatYouNeedIdx, "WhatYouNeed section must exist").toBeGreaterThanOrEqual(0);

    // They must appear in this order: TrustBar < WhoNeedsToFile < WhatYouNeed
    expect(trustBarIdx, "TrustBar before WhoNeedsToFile").toBeLessThan(whoNeedsIdx);
    expect(whoNeedsIdx, "WhoNeedsToFile before WhatYouNeed").toBeLessThan(whatYouNeedIdx);
  });
});
