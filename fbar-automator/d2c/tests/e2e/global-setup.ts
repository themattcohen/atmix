import { test as setup, expect } from "@playwright/test";

const authFile = "./tests/e2e/.auth/user.json";

setup.setTimeout(60000);

setup("authenticate", async ({ page }) => {
  await page.goto("/login");

  // Wait for React hydration to complete
  const emailInput = page.locator('#email');
  await emailInput.waitFor({ state: "visible", timeout: 15000 });

  // Use click + fill to ensure the input is interactive (post-hydration)
  await emailInput.click();
  await emailInput.fill("debug@example.com");

  const passwordInput = page.locator('#password');
  await passwordInput.click();
  await passwordInput.fill("Debug123!");

  await page.click('button[type="submit"]');

  // Login with bcrypt can take several seconds
  await page.waitForURL(
    /\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/,
    { timeout: 30000 }
  );

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
