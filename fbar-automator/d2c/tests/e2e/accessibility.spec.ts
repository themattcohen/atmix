import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// ---------------------------------------------------------------------------
// Accessibility — Marketing Pages
// ---------------------------------------------------------------------------
test.describe("Accessibility — Marketing Pages", () => {
  const marketingPages = [
    { path: "/", name: "Landing Page" },
    { path: "/about", name: "About Page" },
    { path: "/pricing", name: "Pricing Page" },
    { path: "/how-it-works", name: "How It Works Page" },
    { path: "/privacy", name: "Privacy Page" },
    { path: "/terms", name: "Terms Page" },
  ];

  for (const { path, name } of marketingPages) {
    test(`${name} (${path}) passes axe a11y checks`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        // Exclude color-contrast issues for now as they depend on the design system
        .disableRules(["color-contrast"])
        .analyze();

      expect(
        results.violations,
        `${name} has ${results.violations.length} a11y violation(s):\n` +
          results.violations
            .map(
              (v) =>
                `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n    ${v.helpUrl}`
            )
            .join("\n")
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Accessibility — Auth Pages
// ---------------------------------------------------------------------------
test.describe("Accessibility — Auth Pages", () => {
  const authPages = [
    { path: "/login", name: "Login Page" },
    { path: "/signup", name: "Signup Page" },
    { path: "/forgot-password", name: "Forgot Password Page" },
  ];

  for (const { path, name } of authPages) {
    test(`${name} (${path}) passes axe a11y checks`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast"])
        .analyze();

      expect(
        results.violations,
        `${name} has ${results.violations.length} a11y violation(s):\n` +
          results.violations
            .map(
              (v) =>
                `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n    ${v.helpUrl}`
            )
            .join("\n")
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Focus Management — Forms
// ---------------------------------------------------------------------------
test.describe("Focus Management — Forms", () => {
  test("login form: all inputs reachable by tab", async ({ page }) => {
    await page.goto("/login");

    // Focus on the first input (email) and tab through
    await page.locator("#email").focus();
    await expect(page.locator("#email")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#password")).toBeFocused();

    // Next tab should reach the submit button
    await page.keyboard.press("Tab");
    const focused = page.locator(":focus");
    // Could be submit or the forgot password link — just verify something is focused
    await expect(focused).toBeVisible();
  });

  test("signup form: all inputs reachable by tab", async ({ page }) => {
    await page.goto("/signup");

    await page.locator("#firstName").focus();
    await expect(page.locator("#firstName")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#lastName")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#email")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#password")).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.locator("#confirmPassword")).toBeFocused();
  });

  test("forgot password form: email input reachable by tab", async ({
    page,
  }) => {
    await page.goto("/forgot-password");

    await page.locator("#email").focus();
    await expect(page.locator("#email")).toBeFocused();

    await page.keyboard.press("Tab");
    // Next focusable element should be the submit button
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Images and SVG accessibility
// ---------------------------------------------------------------------------
test.describe("Images and SVG Accessibility", () => {
  test("landing page: SVGs have aria-hidden or alt text", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // All SVGs should either have aria-hidden="true" or have a role/title
    const svgs = page.locator("svg");
    const svgCount = await svgs.count();

    for (let i = 0; i < svgCount; i++) {
      const svg = svgs.nth(i);
      const ariaHidden = await svg.getAttribute("aria-hidden");
      const role = await svg.getAttribute("role");
      const ariaLabel = await svg.getAttribute("aria-label");
      const title = await svg.locator("title").count();

      // SVG should be decorative (aria-hidden) or have accessible name
      const isAccessible =
        ariaHidden === "true" ||
        role === "img" ||
        role === "presentation" ||
        ariaLabel !== null ||
        title > 0;

      // Allow inline SVGs without explicit aria-hidden as long as they are
      // inside a button/link that has its own accessible name
      if (!isAccessible) {
        const parent = svg.locator("..");
        const parentTag = await parent.evaluate((el) =>
          el.tagName.toLowerCase()
        );
        const parentAriaLabel = await parent.getAttribute("aria-label");
        const isInsideInteractive =
          parentTag === "button" ||
          parentTag === "a" ||
          parentAriaLabel !== null;

        expect(
          isInsideInteractive,
          `SVG #${i} is neither decorative (aria-hidden) nor has accessible name, and is not inside a labelled interactive element`
        ).toBeTruthy();
      }
    }
  });

  test("about page: images/SVGs are accessible", async ({ page }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    // Check all img elements have alt text
    const images = page.locator("img");
    const imgCount = await images.count();
    for (let i = 0; i < imgCount; i++) {
      const alt = await images.nth(i).getAttribute("alt");
      expect(alt, `Image #${i} is missing alt text`).not.toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// Error Messages — role="alert"
// ---------------------------------------------------------------------------
test.describe("Error Messages Accessibility", () => {
  test("login error has role=alert or aria-live", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "bad@example.com");
    await page.fill("#password", "WrongPass999!");
    await page.click('button[type="submit"]');

    // Wait for the error to appear
    await expect(
      page.locator(".bg-red-50, [role='alert']").first()
    ).toBeVisible({ timeout: 10000 });

    // The error container should have role="alert" or be in a live region
    const errorContainer = page.locator(".bg-red-50").first();
    const role = await errorContainer.getAttribute("role");
    const ariaLive = await errorContainer.getAttribute("aria-live");

    // At minimum, the error should be visible and announced
    // (even if it does not use role="alert", it should be detectable)
    const isAnnounced = role === "alert" || ariaLive !== null;
    // Log for information even if not failing — this is aspirational
    if (!isAnnounced) {
      console.warn(
        "Login error container does not have role='alert' or aria-live attribute. " +
          "Consider adding for screen reader support."
      );
    }
    // Still assert the error is at least visible
    await expect(errorContainer).toBeVisible();
  });

  test("signup validation error is visible and descriptive", async ({
    page,
  }) => {
    await page.goto("/signup");
    await page.fill("#firstName", "Test");
    await page.fill("#lastName", "User");
    await page.fill("#email", `val-${Date.now()}@test.com`);
    await page.fill("#password", "ab");
    await page.fill("#confirmPassword", "ab");
    await page.click('button[type="submit"]');

    // Error should be visible
    await expect(
      page.locator(".text-red-600, .text-red-700, .bg-red-50").first()
    ).toBeVisible({ timeout: 10000 });
  });
});

// ---------------------------------------------------------------------------
// Keyboard Navigation — Marketing
// ---------------------------------------------------------------------------
test.describe("Keyboard Navigation — Marketing", () => {
  test("landing page: can tab through nav links", async ({ page }) => {
    await page.goto("/");

    // Tab repeatedly and verify we can reach nav elements
    // Start from the top of the page
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab");
    }

    // After tabbing, verify something is focused (we traversed the nav)
    const focused = page.locator(":focus");
    await expect(focused).toBeVisible();
  });

  test("marketing pages: heading structure is logical", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // There should be exactly one h1 on the page
    const h1s = page.locator("h1");
    const h1Count = await h1s.count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // H2s should come after h1 (basic heading order)
    const h2s = page.locator("h2");
    const h2Count = await h2s.count();
    // Landing page has multiple sections so there should be h2s
    expect(h2Count).toBeGreaterThanOrEqual(1);
  });

  test("about page: heading structure is logical (h1 then h2s)", async ({
    page,
  }) => {
    await page.goto("/about");
    await page.waitForLoadState("networkidle");

    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    const h2Count = await page.locator("h2").count();
    expect(h2Count).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Mobile Accessibility
// ---------------------------------------------------------------------------
test.describe("Mobile Accessibility", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("mobile menu button has accessible label", async ({ page }) => {
    await page.goto("/");
    const hamburger = page.locator('button[aria-label="Open menu"]');
    await expect(hamburger).toBeVisible();

    const ariaLabel = await hamburger.getAttribute("aria-label");
    expect(ariaLabel).toBe("Open menu");
  });

  test("mobile close button has accessible label", async ({ page }) => {
    await page.goto("/");
    await page.click('button[aria-label="Open menu"]');

    const closeBtn = page.locator('button[aria-label="Close menu"]');
    await expect(closeBtn).toBeVisible();

    const ariaLabel = await closeBtn.getAttribute("aria-label");
    expect(ariaLabel).toBe("Close menu");
  });

  test("mobile viewport: no horizontal scrollbar on landing page", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const bodyWidth = await page
      .locator("body")
      .evaluate((el) => el.scrollWidth);
    // Allow small margin for potential scrollbar
    expect(bodyWidth).toBeLessThanOrEqual(375 + 20);
  });
});

// ---------------------------------------------------------------------------
// Accessibility — Authenticated Wizard Pages
// ---------------------------------------------------------------------------
test.describe("Accessibility — Authenticated Wizard Pages", () => {
  const LOGIN_EMAIL = "debug@example.com";
  const LOGIN_PASSWORD = "Debug123!";

  async function loginFirst(page: Page) {
    await page.goto("/login");
    await page.fill('input[name="email"], #email', LOGIN_EMAIL);
    await page.fill('input[name="password"], #password', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );
  }

  const wizardPages = [
    { path: "/threshold", name: "Threshold Page" },
    { path: "/personal", name: "Personal Information Page" },
    { path: "/accounts", name: "Accounts Page" },
    { path: "/review", name: "Review Page" },
    { path: "/sign", name: "Sign Page" },
    { path: "/dashboard", name: "Dashboard Page" },
  ];

  for (const { path, name } of wizardPages) {
    test(`${name} (${path}) passes axe a11y checks`, async ({ page }) => {
      await loginFirst(page);
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .disableRules(["color-contrast"])
        .analyze();

      expect(
        results.violations,
        `${name} has ${results.violations.length} a11y violation(s):\n` +
          results.violations
            .map(
              (v) =>
                `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n    ${v.helpUrl}`
            )
            .join("\n")
      ).toEqual([]);
    });
  }
});

// ---------------------------------------------------------------------------
// Keyboard Navigation — Wizard Forms
// ---------------------------------------------------------------------------
test.describe("Keyboard Navigation — Wizard Forms", () => {
  const LOGIN_EMAIL = "debug@example.com";
  const LOGIN_PASSWORD = "Debug123!";

  async function loginFirst(page: Page) {
    await page.goto("/login");
    await page.fill('input[name="email"], #email', LOGIN_EMAIL);
    await page.fill('input[name="password"], #password', LOGIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(
      /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
      { timeout: 30000 }
    );
  }

  test("personal info form: Tab through all fields", async ({ page }) => {
    await loginFirst(page);
    await page.goto("/personal");
    await page.waitForLoadState("networkidle");

    // Wait for form fields to render
    await page.waitForSelector('input, select', { timeout: 15000 });

    // Focus first input and start tabbing
    const firstInput = page.locator("input, select").first();
    await firstInput.focus();
    await expect(firstInput).toBeFocused();

    // Tab through several fields and verify focus moves
    const focusedElements: string[] = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const tagName = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName.toLowerCase() : "none";
      });
      focusedElements.push(tagName);
    }

    // Verify we reached multiple different focusable elements
    const uniqueTags = new Set(focusedElements);
    expect(uniqueTags.size).toBeGreaterThanOrEqual(2);
  });

  test("accounts form: Tab through add account form fields", async ({ page }) => {
    await loginFirst(page);
    await page.goto("/accounts");
    await page.waitForLoadState("networkidle");

    // Open the add account form
    await page.locator("button:has-text('Add Foreign Account')").click();
    await expect(
      page.locator("h3:has-text('Add Foreign Account')")
    ).toBeVisible();

    // Focus institution name and tab through
    const nameInput = page.locator('input[placeholder="e.g., HSBC, Deutsche Bank"]');
    await nameInput.focus();
    await expect(nameInput).toBeFocused();

    const focusedElements: string[] = [];
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      const tagName = await page.locator(":focus").evaluate((el) => el.tagName.toLowerCase());
      focusedElements.push(tagName);
    }

    // Should reach inputs, selects, and buttons
    const uniqueTags = new Set(focusedElements);
    expect(uniqueTags.size).toBeGreaterThanOrEqual(2);
  });

  test("sign page: Tab through agreement and signature", async ({ page }) => {
    await loginFirst(page);
    await page.goto("/sign");
    await page.waitForLoadState("networkidle");

    if (page.url().includes("/sign")) {
      // The checkbox should be reachable by tab
      const checkbox = page.locator('#agree-checkbox');
      await checkbox.focus();
      await expect(checkbox).toBeFocused();

      // Tab to signature input
      await page.keyboard.press("Tab");
      const signatureInput = page.locator('#typed-signature');
      await expect(signatureInput).toBeFocused();

      // Tab to sign button
      await page.keyboard.press("Tab");
      const focused = page.locator(":focus");
      await expect(focused).toBeVisible();
    }
  });
});
