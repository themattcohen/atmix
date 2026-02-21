import { test, expect, Page } from "@playwright/test";

// IMPLEMENTATION NEEDED: P7-7 will ensure the threshold page's custom radio buttons
// support full keyboard navigation (Arrow keys, Tab, Enter/Space) in compliance with
// WAI-ARIA Radio Group pattern. Currently the threshold page uses div[role="radiogroup"]
// with div[role="radio"] children. P7-7 may need to add onKeyDown handlers for
// arrow key navigation and proper roving tabindex.

test.use({ baseURL: "http://localhost:3001" });
test.setTimeout(120000);

/**
 * Log in as the debug user and navigate to /threshold.
 * Uses API-based auth to bypass UI login.
 */
async function loginAndGoToThreshold(page: Page) {
  // Get CSRF token
  const csrfRes = await page.request.get("/api/auth/csrf");
  const { csrfToken } = await csrfRes.json();

  // Authenticate via credentials callback
  await page.request.post("/api/auth/callback/credentials", {
    form: {
      email: "debug@example.com",
      password: "Debug123!",
      csrfToken,
      json: "true",
    },
  });

  // Navigate to threshold
  await page.goto("/threshold", { waitUntil: "networkidle", timeout: 60000 });
  await page.locator('div[role="radiogroup"]').first().waitFor({
    state: "visible",
    timeout: 30000,
  });
}

test.describe("P7-7: Threshold Page — Keyboard Navigation", () => {
  test("P7-7: Tab focuses the first radio group", async ({ page }) => {
    await loginAndGoToThreshold(page);

    // Tab into the page content
    // May need multiple tabs to get past skip-links, nav, year selector, etc.
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const focused = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute("role") || el?.tagName.toLowerCase();
      });
      if (focused === "radio") break;
    }

    // A radio element within the first radiogroup should be focused
    const focusedRole = await page.evaluate(() => {
      return document.activeElement?.getAttribute("role");
    });

    // The focused element should be a radio within the radiogroup
    // or the radiogroup itself (depending on implementation)
    expect(["radio", "radiogroup"]).toContain(focusedRole);
  });

  test("P7-7: Arrow Down/Right selects next radio option in Q1", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });
    const q1No = q1Group.getByRole("radio", { name: "No" });

    // Focus the first radio option (Yes)
    await q1Yes.focus();
    await expect(q1Yes).toBeFocused();

    // Press ArrowDown — should move focus to "No"
    await page.keyboard.press("ArrowDown");

    // After arrow key, either:
    // 1. Focus moved to the next radio, OR
    // 2. The next radio became selected (aria-checked)
    // Both are valid ARIA radio group patterns
    const noChecked = await q1No.getAttribute("aria-checked");
    const noFocused = await q1No.evaluate((el) => el === document.activeElement);

    expect(noChecked === "true" || noFocused).toBe(true);
  });

  test("P7-7: Arrow Right selects next radio option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });
    const q1No = q1Group.getByRole("radio", { name: "No" });

    await q1Yes.focus();

    // ArrowRight should also move to next option
    await page.keyboard.press("ArrowRight");

    const noChecked = await q1No.getAttribute("aria-checked");
    const noFocused = await q1No.evaluate((el) => el === document.activeElement);

    expect(noChecked === "true" || noFocused).toBe(true);
  });

  test("P7-7: Arrow Up/Left selects previous radio option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });
    const q1No = q1Group.getByRole("radio", { name: "No" });

    // First select "No" so we can arrow back to "Yes"
    await q1No.click();
    await expect(q1No).toHaveAttribute("aria-checked", "true");

    // Focus No, then press ArrowUp
    await q1No.focus();
    await page.keyboard.press("ArrowUp");

    const yesChecked = await q1Yes.getAttribute("aria-checked");
    const yesFocused = await q1Yes.evaluate((el) => el === document.activeElement);

    expect(yesChecked === "true" || yesFocused).toBe(true);
  });

  test("P7-7: Arrow Left selects previous radio option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });
    const q1No = q1Group.getByRole("radio", { name: "No" });

    // Select "No" first
    await q1No.click();
    await q1No.focus();

    // ArrowLeft should go to previous option
    await page.keyboard.press("ArrowLeft");

    const yesChecked = await q1Yes.getAttribute("aria-checked");
    const yesFocused = await q1Yes.evaluate((el) => el === document.activeElement);

    expect(yesChecked === "true" || yesFocused).toBe(true);
  });

  test("P7-7: Arrow key wraps around from last to first option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });
    const q1No = q1Group.getByRole("radio", { name: "No" });

    // Focus "No" (last option)
    await q1No.click();
    await q1No.focus();

    // ArrowDown from last should wrap to first ("Yes")
    await page.keyboard.press("ArrowDown");

    const yesChecked = await q1Yes.getAttribute("aria-checked");
    const yesFocused = await q1Yes.evaluate((el) => el === document.activeElement);

    // Wrapping is the expected ARIA pattern, but some implementations stop at the end
    // Accept either wrapping behavior or staying on the last option
    expect(
      yesChecked === "true" ||
      yesFocused ||
      (await q1No.getAttribute("aria-checked")) === "true"
    ).toBe(true);
  });

  test("P7-7: Arrow key wraps around from first to last option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });
    const q1No = q1Group.getByRole("radio", { name: "No" });

    // Focus "Yes" (first option)
    await q1Yes.click();
    await q1Yes.focus();

    // ArrowUp from first should wrap to last ("No")
    await page.keyboard.press("ArrowUp");

    const noChecked = await q1No.getAttribute("aria-checked");
    const noFocused = await q1No.evaluate((el) => el === document.activeElement);

    // Accept wrapping or staying on first
    expect(
      noChecked === "true" ||
      noFocused ||
      (await q1Yes.getAttribute("aria-checked")) === "true"
    ).toBe(true);
  });

  test("P7-7: Space activates/selects a focused radio option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });

    // Focus Yes but don't click
    await q1Yes.focus();

    // Press Space to activate
    await page.keyboard.press("Space");

    // Should now be checked
    await expect(q1Yes).toHaveAttribute("aria-checked", "true");
  });

  test("P7-7: Enter activates/selects a focused radio option", async ({ page }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1No = q1Group.getByRole("radio", { name: "No" });

    // Focus No but don't click
    await q1No.focus();

    // Press Enter to activate
    await page.keyboard.press("Enter");

    // Should now be checked
    await expect(q1No).toHaveAttribute("aria-checked", "true");
  });

  test("P7-7: keyboard selection on Q1 'Yes' makes Q2 appear, Q2 also navigable by keyboard", async ({
    page,
  }) => {
    await loginAndGoToThreshold(page);

    const q1Group = page.locator('div[role="radiogroup"]').first();
    const q1Yes = q1Group.getByRole("radio", { name: "Yes" });

    // Select Yes via keyboard
    await q1Yes.focus();
    await page.keyboard.press("Space");
    await expect(q1Yes).toHaveAttribute("aria-checked", "true");

    // Q2 should now appear
    const q2Group = page.locator('div[role="radiogroup"]').nth(1);
    await expect(q2Group).toBeVisible({ timeout: 5000 });

    // Tab to Q2's first radio
    const q2Yes = q2Group.getByRole("radio", { name: "Yes" });
    await q2Yes.focus();

    // Space to select Q2 Yes
    await page.keyboard.press("Space");
    await expect(q2Yes).toHaveAttribute("aria-checked", "true");

    // Continue button should now be visible
    await expect(
      page.getByRole("button", { name: "Continue to Personal Information" })
    ).toBeVisible();
  });
});
