import { test, expect, Page } from "@playwright/test";
import {
  signupTestUser,
  completeThreshold,
  completePersonalInfo,
  addForeignAccount,
  completeSigning,
} from "./helpers/auth";

// IMPLEMENTATION NEEDED: P7-6 relies on all wizard steps functioning end-to-end.
// This test validates the complete happy path: signup -> threshold -> personal ->
// accounts -> review -> sign -> payment. All steps must transition correctly and
// data must persist across steps.

test.use({ baseURL: "http://localhost:3001" });
test.setTimeout(300000); // 5 minutes for the full flow

test.describe("P7-6: Wizard Happy Path — Full End-to-End Flow", () => {
  test("P7-6: complete wizard flow from signup to payment page", async ({ page }) => {
    // Step 1: Sign up a new user
    const email = await signupTestUser(page);
    expect(email).toContain("@");

    // Should land on /threshold after signup
    await expect(page).toHaveURL(/\/threshold/);

    // Step 2: Complete threshold (Yes/Yes)
    await completeThreshold(page);

    // Should navigate to /personal
    await expect(page).toHaveURL(/\/personal/);

    // Step 3: Complete personal information
    await completePersonalInfo(page);

    // Should navigate to /accounts
    await expect(page).toHaveURL(/\/accounts/);

    // Step 4: Add a foreign account
    await addForeignAccount(page, "Happy Path Bank AG");

    // Verify the account appears in the list
    await expect(page.locator("text=Happy Path Bank AG")).toBeVisible();

    // Click Continue to Review
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });

    // Step 5: Review page — verify data is present
    await expect(page).toHaveURL(/\/review/);
    await expect(page.locator("h1")).toContainText("Review", { timeout: 15000 });

    // Personal info should be visible on review
    await expect(page.locator("text=Test User").first()).toBeVisible({ timeout: 15000 });

    // Account info should be visible on review
    await expect(page.locator("text=Happy Path Bank AG").first()).toBeVisible();

    // Step 6: Continue to Sign
    const continueToSign = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await expect(continueToSign.first()).toBeVisible();
    await expect(continueToSign.first()).toBeEnabled();
    await continueToSign.first().click();
    await page.waitForURL("**/sign", { timeout: 30000 });

    // Step 7: Complete signing
    await expect(page).toHaveURL(/\/sign/);
    await completeSigning(page, "Test", "User");

    // Should navigate to /payment
    await expect(page).toHaveURL(/\/payment/);
  });

  test("P7-6: each wizard step transitions to the next correctly", async ({ page }) => {
    await signupTestUser(page);

    // Verify threshold -> personal transition
    await expect(page).toHaveURL(/\/threshold/);
    await completeThreshold(page);
    await expect(page).toHaveURL(/\/personal/);

    // Verify personal -> accounts transition
    await completePersonalInfo(page);
    await expect(page).toHaveURL(/\/accounts/);

    // Verify accounts -> review transition
    await addForeignAccount(page);
    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });
    await expect(page).toHaveURL(/\/review/);

    // Verify review -> sign transition
    const continueBtn = page.locator(
      "button:has-text('Continue to Sign'), button:has-text('Everything Looks Correct')"
    );
    await continueBtn.first().click();
    await page.waitForURL("**/sign", { timeout: 30000 });
    await expect(page).toHaveURL(/\/sign/);
  });

  test("P7-6: data persists across steps — personal info visible on review", async ({ page }) => {
    await signupTestUser(page);
    await completeThreshold(page);
    await completePersonalInfo(page);
    await addForeignAccount(page, "Persistence Test Bank");

    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });

    // Personal info persisted from earlier steps should appear on review
    // The helper fills: firstName=Test, lastName=User, SSN ending in 6789,
    // address=123 Test St, city=Testville, state=CA, zip=90210
    await expect(page.locator("text=Test User").first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator("text=6789").first()).toBeVisible();
    await expect(page.locator("text=123 Test St").first()).toBeVisible();

    // Account persisted
    await expect(page.locator("text=Persistence Test Bank").first()).toBeVisible();
  });

  test("P7-6: can navigate back and forward within the wizard", async ({ page }) => {
    await signupTestUser(page);
    await completeThreshold(page);
    await completePersonalInfo(page);
    await addForeignAccount(page);

    await page.locator("button:has-text('Continue to Review')").click();
    await page.waitForURL("**/review", { timeout: 30000 });

    // From review, click Edit on personal info
    const editPersonal = page.locator('a[href="/personal"]:has-text("Edit")').first();
    await expect(editPersonal).toBeVisible();
    await editPersonal.click();
    await page.waitForURL("**/personal", { timeout: 15000 });
    await expect(page).toHaveURL(/\/personal/);

    // Go back to review
    await page.goBack();
    await page.waitForURL("**/review", { timeout: 15000 });
    await expect(page).toHaveURL(/\/review/);

    // From review, click Edit on accounts
    const editAccounts = page.locator('a[href="/accounts"]:has-text("Edit")').first();
    await expect(editAccounts).toBeVisible();
    await editAccounts.click();
    await page.waitForURL("**/accounts", { timeout: 15000 });
    await expect(page).toHaveURL(/\/accounts/);

    // Go back to review again
    await page.goBack();
    await page.waitForURL("**/review", { timeout: 15000 });
    await expect(page).toHaveURL(/\/review/);
  });
});
