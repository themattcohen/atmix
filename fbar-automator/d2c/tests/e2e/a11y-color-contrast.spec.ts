import { test, expect, Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// IMPLEMENTATION NEEDED: P7-9 will fix all color contrast issues across the D2C app
// so that the color-contrast axe rule passes on all pages.
// Currently, accessibility.spec.ts disables color-contrast via .disableRules(["color-contrast"]).
// After P7-9, this dedicated test file validates that color-contrast passes everywhere.

test.describe("P7-9: Color Contrast — Marketing Pages", () => {
  const marketingPages = [
    { path: "/", name: "Landing Page" },
    { path: "/about", name: "About Page" },
    { path: "/pricing", name: "Pricing Page" },
    { path: "/how-it-works", name: "How It Works Page" },
    { path: "/privacy", name: "Privacy Page" },
    { path: "/terms", name: "Terms Page" },
  ];

  for (const { path, name } of marketingPages) {
    test(`P7-9: ${name} (${path}) passes axe color-contrast check`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2aa"])
        .withRules(["color-contrast"])
        .analyze();

      expect(
        results.violations,
        `${name} has ${results.violations.length} color-contrast violation(s):\n` +
          results.violations
            .map(
              (v) =>
                `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n` +
                v.nodes
                  .map((n) => `    Element: ${n.html.slice(0, 120)}`)
                  .join("\n")
            )
            .join("\n")
      ).toEqual([]);
    });
  }
});

test.describe("P7-9: Color Contrast — Auth Pages", () => {
  const authPages = [
    { path: "/login", name: "Login Page" },
    { path: "/signup", name: "Signup Page" },
    { path: "/forgot-password", name: "Forgot Password Page" },
  ];

  for (const { path, name } of authPages) {
    test(`P7-9: ${name} (${path}) passes axe color-contrast check`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("load");
      // Wait for React hydration — auth pages are client components
      await page.locator("form").waitFor({ state: "visible", timeout: 15000 });

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2aa"])
        .withRules(["color-contrast"])
        .analyze();

      expect(
        results.violations,
        `${name} has ${results.violations.length} color-contrast violation(s):\n` +
          results.violations
            .map(
              (v) =>
                `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n` +
                v.nodes
                  .map((n) => `    Element: ${n.html.slice(0, 120)}`)
                  .join("\n")
            )
            .join("\n")
      ).toEqual([]);
    });
  }
});

test.describe("P7-9: Color Contrast — Authenticated Wizard Pages", () => {
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
    test(`P7-9: ${name} (${path}) passes axe color-contrast check`, async ({ page }) => {
      await loginFirst(page);
      await page.goto(path);
      await page.waitForLoadState("load");

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2aa"])
        .withRules(["color-contrast"])
        .analyze();

      expect(
        results.violations,
        `${name} has ${results.violations.length} color-contrast violation(s):\n` +
          results.violations
            .map(
              (v) =>
                `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n` +
                v.nodes
                  .map((n) => `    Element: ${n.html.slice(0, 120)}`)
                  .join("\n")
            )
            .join("\n")
      ).toEqual([]);
    });
  }
});

test.describe("P7-9: Color Contrast — Error States", () => {
  test("P7-9: login error message passes color-contrast check", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "bad@example.com");
    await page.fill("#password", "WrongPass999!");
    await page.click('button[type="submit"]');

    // Wait for error to appear
    await expect(
      page.locator(".bg-red-50, [role='alert']").first()
    ).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa"])
      .withRules(["color-contrast"])
      .analyze();

    expect(
      results.violations,
      `Login error state has ${results.violations.length} color-contrast violation(s):\n` +
        results.violations
          .map(
            (v) =>
              `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n` +
              v.nodes
                .map((n) => `    Element: ${n.html.slice(0, 120)}`)
                .join("\n")
          )
          .join("\n")
    ).toEqual([]);
  });

  test("P7-9: signup validation error passes color-contrast check", async ({ page }) => {
    await page.goto("/signup");
    await page.fill("#firstName", "Test");
    await page.fill("#lastName", "User");
    await page.fill("#email", `contrast-${Date.now()}@test.com`);
    await page.fill("#password", "ab");
    await page.fill("#confirmPassword", "ab");
    await page.click('button[type="submit"]');

    // Wait for validation error
    await expect(
      page.locator(".text-red-600, .text-red-700, .bg-red-50").first()
    ).toBeVisible({ timeout: 10000 });

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2aa"])
      .withRules(["color-contrast"])
      .analyze();

    expect(
      results.violations,
      `Signup error state has ${results.violations.length} color-contrast violation(s):\n` +
        results.violations
          .map(
            (v) =>
              `  - ${v.id}: ${v.description} (${v.nodes.length} node(s))\n` +
              v.nodes
                .map((n) => `    Element: ${n.html.slice(0, 120)}`)
                .join("\n")
          )
          .join("\n")
    ).toEqual([]);
  });
});
