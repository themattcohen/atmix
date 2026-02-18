import { test, expect, type Page } from "@playwright/test"

test.setTimeout(120000)

const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"
let authCookies: any[] = []

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("/", { timeout: 20000 })
}

test.describe("Settings Forms", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAsAdmin(page)
    authCookies = await page.context().cookies()
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies(authCookies)
  })

  test("Save practice info", async ({ page }) => {
    const ts = Date.now()

    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    const practiceInput = page.locator("#practice-name")
    await practiceInput.waitFor({ state: "visible" })

    // Read current value
    const originalName = await practiceInput.inputValue()

    // Clear and type new name
    await practiceInput.clear()
    await practiceInput.fill(`Updated Practice ${ts}`)

    // Click Save Changes (only one such button on the settings page)
    await page.locator('button:has-text("Save Changes")').click()

    // Wait for success alert
    await expect(
      page.locator('div[role="alert"]', { hasText: "Practice settings saved." })
    ).toBeVisible({ timeout: 10000 })

    // Reload and verify persistence
    await page.reload()
    await page.waitForLoadState("networkidle")
    await practiceInput.waitFor({ state: "visible" })
    await expect(practiceInput).toHaveValue(`Updated Practice ${ts}`)

    // Cleanup: restore original name
    await practiceInput.clear()
    await practiceInput.fill(originalName || "Demo Tax Practice")

    await page.locator('button:has-text("Save Changes")').click()

    await expect(
      page.locator('div[role="alert"]', { hasText: "Practice settings saved." })
    ).toBeVisible({ timeout: 10000 })
  })

  test("Invite team member", async ({ page }) => {
    const ts = Date.now()

    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // Click Invite Member
    await page.click('button:has-text("Invite Member")')

    // Verify invite form heading
    await expect(
      page.getByRole("heading", { name: "Invite New Team Member" })
    ).toBeVisible()

    // Fill invite form
    await page.fill("#invite-name", `Test Preparer ${ts}`)
    await page.fill("#invite-email", `preparer-${ts}@example.com`)
    // Leave role as default (PREPARER)

    // Submit
    await page.click('button:has-text("Create Member")')

    // Verify success alert
    await expect(
      page.locator('div[role="alert"]', { hasText: "created successfully" })
    ).toBeVisible({ timeout: 10000 })

    // Verify temp password is shown
    await expect(
      page.getByText("Temporary password (shown only once):")
    ).toBeVisible()

    // Verify copy button exists
    await expect(
      page.locator('button[aria-label="Copy temporary password"]')
    ).toBeVisible()

    // Verify new member appears in team table
    const teamTable = page.locator('table[role="table"]')
    await expect(teamTable.getByText(`Test Preparer ${ts}`)).toBeVisible()
  })

  test("Cancel team invite", async ({ page }) => {
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    // Click Invite Member
    await page.click('button:has-text("Invite Member")')

    // Fill name
    await page.fill("#invite-name", "CancelMember")

    // Click Cancel
    await page.click('button:has-text("Cancel")')

    // Verify invite form is gone
    await expect(
      page.getByRole("heading", { name: "Invite New Team Member" })
    ).not.toBeVisible()

    // Verify CancelMember does NOT appear in the team table
    const teamTable = page.locator('table[role="table"]')
    await expect(teamTable.getByText("CancelMember")).not.toBeVisible()
  })

  test("Password mismatch validation", async ({ page }) => {
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    await page.fill("#current-password", "anything")
    await page.fill("#new-password", "NewPassword123!!")
    await page.fill("#confirm-password", "DifferentPassword!")

    await page.click('button:has-text("Change Password")')

    // Verify mismatch error
    await expect(
      page.locator('div[role="alert"]', { hasText: "do not match" })
    ).toBeVisible({ timeout: 10000 })
  })

  test("Password too short validation", async ({ page }) => {
    await page.goto("/settings")
    await page.waitForLoadState("networkidle")

    await page.fill("#current-password", "anything")
    await page.fill("#new-password", "short")
    await page.fill("#confirm-password", "short")

    // Remove minLength attributes so native browser validation doesn't block
    // and the JS client-side validation fires instead
    await page.evaluate(() => {
      document.querySelector("#new-password")?.removeAttribute("minlength")
      document.querySelector("#confirm-password")?.removeAttribute("minlength")
    })

    await page.click('button:has-text("Change Password")')

    // Verify too-short error from client-side validation
    await expect(
      page.locator('div[role="alert"]', { hasText: "at least 12 characters" })
    ).toBeVisible({ timeout: 10000 })
  })
})
