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

test.describe("Settings Sub-Pages", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage()
    await loginAsAdmin(page)
    authCookies = await page.context().cookies()
    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.context().addCookies(authCookies)
  })

  test("Exchange rates page loads with UI elements", async ({ page }) => {
    await page.goto("/settings/exchange-rates")
    await page.waitForLoadState("networkidle")

    const yearSelector = page.locator('select[aria-label="Select year"]')
    await expect(yearSelector).toBeVisible()

    const syncButton = page.locator('button:has-text("Sync Rates")')
    await expect(syncButton).toBeVisible()

    const eurText = page.getByText("EUR")
    await expect(eurText.first()).toBeVisible()
  })

  test("Change exchange rate year", async ({ page }) => {
    await page.goto("/settings/exchange-rates")
    await page.waitForLoadState("networkidle")

    const yearSelector = page.locator('select[aria-label="Select year"]')
    await expect(yearSelector).toBeVisible()

    await yearSelector.selectOption("2024")
    await page.waitForLoadState("networkidle")

    const eurText2024 = page.getByText("EUR")
    await expect(eurText2024.first()).toBeVisible()

    await yearSelector.selectOption("2025")
    await page.waitForLoadState("networkidle")

    const eurText2025 = page.getByText("EUR")
    await expect(eurText2025.first()).toBeVisible()
  })

  test("Data retention page loads with form", async ({ page }) => {
    await page.goto("/settings/data-retention")
    await page.waitForLoadState("networkidle")

    const statementRetention = page.locator("#statementRetentionDays")
    await expect(statementRetention).toBeVisible()

    const auditLogRetention = page.locator("#auditLogRetentionDays")
    await expect(auditLogRetention).toBeVisible()

    const inactiveClientArchive = page.locator("#inactiveClientArchiveDays")
    await expect(inactiveClientArchive).toBeVisible()

    const saveButton = page.locator('button:has-text("Save Settings")')
    await expect(saveButton).toBeVisible()
  })

  test("Save data retention settings", async ({ page }) => {
    await page.goto("/settings/data-retention")
    await page.waitForLoadState("networkidle")

    const statementRetention = page.locator("#statementRetentionDays")
    await expect(statementRetention).toBeVisible()

    await statementRetention.clear()
    await statementRetention.fill("365")

    const auditLogRetention = page.locator("#auditLogRetentionDays")
    await auditLogRetention.clear()
    await auditLogRetention.fill("730")

    const inactiveClientArchive = page.locator("#inactiveClientArchiveDays")
    await inactiveClientArchive.clear()
    await inactiveClientArchive.fill("180")

    const saveButton = page.locator('button:has-text("Save Settings")')
    await saveButton.click()

    // Success message is a green <p> element, not role="alert"
    await expect(
      page.getByText("Retention settings saved.")
    ).toBeVisible({ timeout: 10000 })

    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(page.locator("#statementRetentionDays")).toHaveValue("365")
    await expect(page.locator("#auditLogRetentionDays")).toHaveValue("730")
    await expect(page.locator("#inactiveClientArchiveDays")).toHaveValue("180")
  })
})
