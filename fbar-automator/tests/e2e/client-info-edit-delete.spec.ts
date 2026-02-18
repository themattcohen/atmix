import { test, expect, type Page } from "@playwright/test"

// Generous timeout for CI environments
test.setTimeout(120000)

const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"

// Shared auth cookies — login once in beforeAll, reused in every test.
// The admin@demo.com account is seeded with isAdmin=true, which is required
// to see the Delete client button.
let authCookies: any[] = []

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("/", { timeout: 20000 })
}

async function createClient(page: Page, lastName: string) {
  await page.goto("/clients/new")
  await page.waitForLoadState("networkidle")
  const ts = Date.now()
  const uniqueLastName = `${lastName}-${ts}`
  await page.getByPlaceholder("Last name or entity name").fill(uniqueLastName)
  await page.getByPlaceholder("First name").fill("Test")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 30000 })
  return uniqueLastName
}

test.describe("Client Info Edit/Delete", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)
    const state = await context.storageState()
    authCookies = state.cookies
    await context.close()
  })

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authCookies)
  })

  test("should enter edit mode and cancel without changes", async ({ page }) => {
    const lastName = await createClient(page, "EditCancel")

    // Enter edit mode
    await page.click('button[aria-label="Edit client"]')

    // Confirm edit mode is active
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible({ timeout: 10000 })

    // Cancel
    await page.locator('button:has-text("Cancel")').first().click()

    // Original name should still be displayed
    await expect(page.locator(`text=${lastName}`).first()).toBeVisible({ timeout: 10000 })

    // No app-level alert should be present (exclude Next.js route announcer)
    await expect(page.locator('div[role="alert"]:not(#__next-route-announcer__)')).not.toBeVisible()
  })

  test("should edit client last name and save successfully", async ({ page }) => {
    await createClient(page, "EditSave")

    const newLastName = `UpdatedName-${Date.now()}`

    // Enter edit mode
    await page.click('button[aria-label="Edit client"]')
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible({ timeout: 10000 })

    // Locate the Last Name input via its label element.
    // The label text is "Last Name *" rendered as a plain <label> without a for/id pair,
    // so we find the parent <div> that contains that label and then target its <input>.
    const lastNameSection = page.locator('div').filter({ hasText: /^Last Name \*$/ }).first()
    const lastNameInput = lastNameSection.locator("input")
    await lastNameInput.clear()
    await lastNameInput.fill(newLastName)

    // Save
    await page.locator('button:has-text("Save Changes")').click()

    // Success alert (exclude Next.js route announcer)
    const alert = page.locator('div[role="alert"]:not(#__next-route-announcer__)')
    await expect(alert).toBeVisible({ timeout: 15000 })
    await expect(alert).toContainText("Client updated successfully")

    // Reload and confirm the new name persists
    await page.reload()
    await page.waitForLoadState("networkidle")
    await expect(page.locator(`text=${newLastName}`).first()).toBeVisible({ timeout: 10000 })
  })

  test("should show delete confirmation and cancel without deleting", async ({ page }) => {
    const lastName = await createClient(page, "DeleteCancel")
    const currentUrl = page.url()

    // Open delete confirmation
    await page.click('button[aria-label="Delete client"]')

    // Confirmation text should appear
    await expect(
      page.locator("text=Are you sure you want to delete this client?")
    ).toBeVisible({ timeout: 10000 })

    // Cancel the deletion
    await page.locator('button:has-text("Cancel")').first().click()

    // Should still be on the same client page
    await expect(page).toHaveURL(currentUrl)

    // Client name should still be visible
    await expect(page.locator(`text=${lastName}`).first()).toBeVisible({ timeout: 10000 })
  })

  test("should delete client and redirect to clients list", async ({ page }) => {
    const lastName = await createClient(page, "DeleteConfirm")

    // Open delete confirmation
    await page.click('button[aria-label="Delete client"]')

    // Confirmation text should appear
    await expect(
      page.locator("text=Are you sure you want to delete this client?")
    ).toBeVisible({ timeout: 10000 })

    // Confirm deletion
    await page.locator('button:has-text("Delete Client")').click()

    // Should redirect to /clients
    await page.waitForURL("/clients", { timeout: 20000 })

    // The deleted client's name should not appear in the list
    await expect(page.locator(`text=${lastName}`)).not.toBeVisible()
  })

  test("should disable Save Changes when Last Name is cleared", async ({ page }) => {
    await createClient(page, "SaveDisabled")

    // Enter edit mode
    await page.click('button[aria-label="Edit client"]')
    await expect(page.locator('button:has-text("Save Changes")')).toBeVisible({ timeout: 10000 })

    // Clear the Last Name input
    const lastNameSection = page.locator('div').filter({ hasText: /^Last Name \*$/ }).first()
    const lastNameInput = lastNameSection.locator("input")
    await lastNameInput.clear()

    // Save Changes should be disabled
    await expect(page.locator('button:has-text("Save Changes")')).toBeDisabled()
  })
})
