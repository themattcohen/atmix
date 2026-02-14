import { test, expect } from "@playwright/test"

// Helper to login before each test
async function loginAsNewUser(page: any) {
  const email = `client-test-${Date.now()}@example.com`
  await page.goto("/register")
  await page.fill('input[name="practiceName"]', "Client Test Practice")
  await page.fill('input[name="name"]', "Client Tester")
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', "TestPassword123!")
  await page.click('button[type="submit"]')
  await page.waitForURL(/.*login/)
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', "TestPassword123!")
  await page.click('button[type="submit"]')
  await page.waitForURL("/")
}

test.describe("Client Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsNewUser(page)
  })

  test("should show empty clients page", async ({ page }) => {
    await page.goto("/clients")
    await expect(page.locator("text=No clients")).toBeVisible()
  })

  test("should create a new client", async ({ page }) => {
    await page.goto("/clients/new")
    // Fill form - test for the presence of key form fields
    await page.selectOption('select[name="type"]', "INDIVIDUAL")
    await page.fill('input[name="lastName"]', "Smith")
    await page.fill('input[name="firstName"]', "John")
    await page.click('button[type="submit"]')
    // Should navigate to client detail
    await expect(page.locator("text=Smith")).toBeVisible({ timeout: 10000 })
  })

  test("should navigate to client detail", async ({ page }) => {
    // Create client first via API
    await page.goto("/clients/new")
    await page.selectOption('select[name="type"]', "INDIVIDUAL")
    await page.fill('input[name="lastName"]', "Detail")
    await page.fill('input[name="firstName"]', "Test")
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // Should show client information
    await expect(page.locator("text=Client Information")).toBeVisible()
    await expect(page.locator("text=Foreign Accounts")).toBeVisible()
    await expect(page.locator("text=Filing Years")).toBeVisible()
  })

  test("should show dashboard with stats", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("text=Total Clients")).toBeVisible()
    await expect(page.locator("text=Active Accounts")).toBeVisible()
    await expect(page.locator("text=Active Filings")).toBeVisible()
  })

  test("should navigate sidebar links", async ({ page }) => {
    // Dashboard
    await page.click("text=Dashboard")
    await expect(page).toHaveURL("/")

    // Clients
    await page.click("text=Clients")
    await expect(page).toHaveURL("/clients")

    // Settings
    await page.click("text=Settings")
    await expect(page).toHaveURL("/settings")
  })
})
