import { test, expect } from "@playwright/test";
import { loginAsTestUser, signupTestUser } from "./helpers/auth";

// ---------------------------------------------------------------------------
// P5-3: MFA (Multi-Factor Authentication) E2E Tests
//
// IMPLEMENTATION NEEDED: P5-3 will create:
//
// 1. Frontend pages:
//    - /settings/security  — MFA setup/disable UI with QR code display
//    - /mfa-verify         — TOTP input page shown after login when MFA is enabled
//
// 2. API routes tested by these E2E flows:
//    - POST /api/auth/mfa/setup   -> returns QR code + recovery codes
//    - POST /api/auth/mfa/verify  -> verifies TOTP and marks session as MFA-verified
//    - POST /api/auth/mfa/disable -> disables MFA with TOTP confirmation
//    - POST /api/auth/mfa/recovery -> authenticates with recovery code
//
// 3. Auth flow changes:
//    - After login, if user.mfaEnabled, redirect to /mfa-verify before app access
//    - /mfa-verify page has TOTP input + "Use recovery code" link
//    - After successful MFA verify, redirect to /threshold (or app)
//
// 4. Settings page:
//    - /settings/security shows MFA status (enabled/disabled)
//    - Enable button triggers /api/auth/mfa/setup, shows QR code + recovery codes
//    - Disable button requires TOTP confirmation
//
// NOTE: Because E2E tests cannot generate real TOTP tokens, tests that require
// actual TOTP verification will need a test helper or a known test secret.
// Options:
//   a) Use a test-mode endpoint that accepts a fixed TOTP for test users
//   b) Seed a known TOTP secret and generate valid tokens in the test
//   c) Use a test environment variable to bypass TOTP verification
//
// IMPLEMENTATION NEEDED: P5-3 should expose a test helper or seed mechanism
// for E2E TOTP verification.
// ---------------------------------------------------------------------------

test.describe("MFA Flows (P5-3)", () => {
  // Extend timeout for MFA flows which involve multiple page navigations
  test.setTimeout(60_000);

  // ── MFA Setup Flow ─────────────────────────────────────────────────────────

  test("P5-3: MFA setup shows QR code on /settings/security", async ({ page }) => {
    // IMPLEMENTATION NEEDED: /settings/security page with MFA setup UI
    await loginAsTestUser(page);

    // Navigate to security settings
    await page.goto("/settings/security");
    await page.waitForLoadState("domcontentloaded");

    // Should show MFA section with "Enable" button (MFA currently disabled)
    const enableButton = page.locator("button:has-text('Enable'), button:has-text('Set Up')");
    await expect(enableButton).toBeVisible({ timeout: 10000 });

    // Click enable — should trigger API call and show QR code
    await enableButton.click();

    // QR code should be displayed (as an img or canvas)
    const qrImage = page.locator("img[alt*='QR'], canvas, [data-testid='mfa-qr-code']");
    await expect(qrImage).toBeVisible({ timeout: 10000 });

    // Recovery codes should be displayed
    const recoveryCodes = page.locator("[data-testid='recovery-codes'], .recovery-codes");
    await expect(recoveryCodes).toBeVisible({ timeout: 5000 });
  });

  test("P5-3: MFA setup displays recovery codes that user can copy/save", async ({ page }) => {
    // IMPLEMENTATION NEEDED: Recovery codes display after MFA setup initiation
    await loginAsTestUser(page);
    await page.goto("/settings/security");
    await page.waitForLoadState("domcontentloaded");

    const enableButton = page.locator("button:has-text('Enable'), button:has-text('Set Up')");
    await enableButton.click();

    // Should show multiple recovery codes (at least 8)
    const codeElements = page.locator("[data-testid='recovery-code']");
    const count = await codeElements.count();
    expect(count).toBeGreaterThanOrEqual(8);

    // Each code should contain visible text
    for (let i = 0; i < Math.min(count, 3); i++) {
      const text = await codeElements.nth(i).textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });

  // ── MFA Verification on Login ──────────────────────────────────────────────

  test.skip("P5-3: login with MFA enabled redirects to /mfa-verify", async ({ page }) => {
    // IMPLEMENTATION NEEDED: This test requires a user with MFA already enabled.
    // Either seed such a user or enable MFA via setup flow first.
    //
    // For this test, we assume a test user with MFA enabled exists.
    // The test user credentials would be set up in a test fixture.

    // IMPLEMENTATION NEEDED: create/use a user with MFA enabled
    // await loginAsTestUser(page, "mfa-user@test.com", "MfaTestPassword1!");

    await page.goto("/login");

    // IMPLEMENTATION NEEDED: fill in MFA-enabled user credentials
    // await page.fill("#email", "mfa-user@test.com");
    // await page.fill("#password", "MfaTestPassword1!");
    // await page.click('button[type="submit"]');

    // After successful password auth, should redirect to MFA verification
    // await page.waitForURL("**/mfa-verify", { timeout: 15000 });
    // await expect(page).toHaveURL(/\/mfa-verify/);

    // Should see TOTP input field
    // const totpInput = page.locator("input[name='token'], input[name='totp'], #mfa-token");
    // await expect(totpInput).toBeVisible();

    // Should see "Use recovery code" link
    // const recoveryLink = page.locator("text=recovery code");
    // await expect(recoveryLink).toBeVisible();
  });

  test.skip("P5-3: entering correct TOTP on /mfa-verify redirects to app", async ({ page }) => {
    // IMPLEMENTATION NEEDED: login as MFA-enabled user, enter correct TOTP
    //
    // Steps:
    // 1. Login as MFA-enabled user -> redirected to /mfa-verify
    // 2. Enter correct TOTP (from known test secret)
    // 3. Click verify button
    // 4. Should redirect to /threshold or /dashboard
    //
    // await loginAsTestUser(page, "mfa-user@test.com", "MfaTestPassword1!");
    // await page.waitForURL("**/mfa-verify", { timeout: 15000 });
    // await page.fill("#mfa-token", validTotpToken);
    // await page.click('button[type="submit"]');
    // await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 15000 });
  });

  test.skip("P5-3: entering incorrect TOTP on /mfa-verify shows error", async ({ page }) => {
    // IMPLEMENTATION NEEDED: login as MFA-enabled user, enter wrong TOTP
    //
    // await loginAsTestUser(page, "mfa-user@test.com", "MfaTestPassword1!");
    // await page.waitForURL("**/mfa-verify", { timeout: 15000 });
    // await page.fill("#mfa-token", "000000");
    // await page.click('button[type="submit"]');
    // await expect(page.locator(".text-red-600, .bg-red-50, [role='alert']")).toBeVisible();
    // await expect(page).toHaveURL(/\/mfa-verify/); // stays on page
  });

  // ── Recovery Code Usage ────────────────────────────────────────────────────

  test.skip("P5-3: using recovery code on /mfa-verify succeeds", async ({ page }) => {
    // IMPLEMENTATION NEEDED: login as MFA-enabled user, use recovery code
    //
    // Steps:
    // 1. Login as MFA-enabled user -> redirected to /mfa-verify
    // 2. Click "Use recovery code" link
    // 3. Enter a valid recovery code
    // 4. Click verify/submit
    // 5. Should redirect to /threshold or /dashboard
    //
    // await loginAsTestUser(page, "mfa-user@test.com", "MfaTestPassword1!");
    // await page.waitForURL("**/mfa-verify", { timeout: 15000 });
    // await page.locator("text=recovery code").click();
    // await page.fill("#recovery-code", validRecoveryCode);
    // await page.click('button[type="submit"]');
    // await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 15000 });
  });

  test.skip("P5-3: using invalid recovery code on /mfa-verify shows error", async ({ page }) => {
    // IMPLEMENTATION NEEDED:
    //
    // await loginAsTestUser(page, "mfa-user@test.com", "MfaTestPassword1!");
    // await page.waitForURL("**/mfa-verify", { timeout: 15000 });
    // await page.locator("text=recovery code").click();
    // await page.fill("#recovery-code", "INVALID-CODE-9999");
    // await page.click('button[type="submit"]');
    // await expect(page.locator(".text-red-600, .bg-red-50, [role='alert']")).toBeVisible();
    // await expect(page).toHaveURL(/\/mfa-verify/);
  });

  // ── MFA Disable Flow ───────────────────────────────────────────────────────

  test.skip("P5-3: disabling MFA on /settings/security requires TOTP confirmation", async ({ page }) => {
    // IMPLEMENTATION NEEDED: login as MFA-enabled user (after MFA verify),
    // navigate to settings, disable MFA
    //
    // Steps:
    // 1. Login as MFA-enabled user -> complete MFA verification
    // 2. Navigate to /settings/security
    // 3. Click "Disable MFA" button
    // 4. Prompted for TOTP confirmation
    // 5. Enter correct TOTP
    // 6. MFA disabled, UI updates to show "Enable" button
    //
    // await loginAsTestUser(page, "mfa-user@test.com", "MfaTestPassword1!");
    // await page.waitForURL("**/mfa-verify");
    // await page.fill("#mfa-token", validTotpToken);
    // await page.click('button[type="submit"]');
    // await page.waitForURL(/\/(threshold|dashboard)/);
    // await page.goto("/settings/security");
    //
    // const disableBtn = page.locator("button:has-text('Disable')");
    // await expect(disableBtn).toBeVisible();
    // await disableBtn.click();
    //
    // // Should prompt for TOTP confirmation
    // const confirmInput = page.locator("#confirm-totp, input[name='confirmToken']");
    // await expect(confirmInput).toBeVisible();
    // await confirmInput.fill(validTotpToken);
    // await page.locator("button:has-text('Confirm'), button:has-text('Disable MFA')").click();
    //
    // // Should show success and MFA status should be disabled
    // await expect(page.locator("text=MFA has been disabled")).toBeVisible({ timeout: 5000 });
    // const enableBtn = page.locator("button:has-text('Enable'), button:has-text('Set Up')");
    // await expect(enableBtn).toBeVisible();
  });

  // ── Non-MFA User ───────────────────────────────────────────────────────────

  test("P5-3: non-MFA user login -> no MFA redirect, goes straight to app", async ({ page }) => {
    // A normal user without MFA should NOT be redirected to /mfa-verify
    await loginAsTestUser(page);

    // Should land on threshold or dashboard, NOT on /mfa-verify
    await expect(page).not.toHaveURL(/\/mfa-verify/);
    await expect(page).toHaveURL(/\/(threshold|dashboard|personal|accounts|review|sign|payment|confirmation)/);
  });

  test.skip("P5-3: non-MFA user accessing /mfa-verify directly -> redirect away", async ({ page }) => {
    // IMPLEMENTATION NEEDED: /mfa-verify should only be accessible when
    // MFA is pending. Non-MFA users should be redirected away.
    // await loginAsTestUser(page);
    // await page.goto("/mfa-verify");
    // Should redirect to threshold/dashboard since MFA is not enabled
    // IMPLEMENTATION NEEDED: verify redirect behavior
    // await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 10000 });
    // await expect(page).not.toHaveURL(/\/mfa-verify/);
  });

  // ── Settings Page Access ───────────────────────────────────────────────────

  test("P5-3: /settings/security shows MFA status for non-MFA user", async ({ page }) => {
    // IMPLEMENTATION NEEDED: /settings/security page exists and shows MFA status
    await loginAsTestUser(page);
    await page.goto("/settings/security");
    await page.waitForLoadState("domcontentloaded");

    // Should show that MFA is currently disabled
    const statusText = page.locator("text=disabled, text=not enabled, text=Off");
    // IMPLEMENTATION NEEDED: verify the exact text shown for disabled state
    // await expect(statusText).toBeVisible();

    // Should show "Enable" or "Set Up" button
    const enableButton = page.locator("button:has-text('Enable'), button:has-text('Set Up')");
    await expect(enableButton).toBeVisible({ timeout: 10000 });
  });

  test("P5-3: unauthenticated user accessing /settings/security -> redirect to login", async ({ page }) => {
    // IMPLEMENTATION NEEDED: /settings/* routes require auth
    await page.goto("/settings/security");
    await page.waitForURL("**/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/login/);
  });
});
