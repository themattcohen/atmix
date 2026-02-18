import { test, expect } from "@playwright/test"

// Shared auth cookies — registered once in beforeAll, reused in every test.
let authCookies: any[] = []

test.describe("Client Management", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const email = `client-test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

    // Register — retry with backoff for rate limit resilience
    let registered = false
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/register")
      await page.fill('input[name="practiceName"]', "Client Test Practice")
      await page.fill('input[name="name"]', "Client Tester")
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', "TestPassword123!")
      await page.fill('input[name="confirmPassword"]', "TestPassword123!")
      await page.click('button[type="submit"]')
      try {
        await page.waitForURL(/.*login/, { timeout: 10000 })
        registered = true
        break
      } catch {
        if (attempt < 2) await page.waitForTimeout(30000)
      }
    }
    if (!registered) throw new Error("Registration failed after 3 attempts (rate limit)")

    // Login — retry with backoff for rate limit resilience
    let loggedIn = false
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await page.goto("/login")
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', "TestPassword123!")
      await page.click('button[type="submit"]')
      try {
        await page.waitForURL("/", { timeout: 10000 })
        loggedIn = true
        break
      } catch {
        if (attempt < 2) await page.waitForTimeout(30000)
      }
    }
    if (!loggedIn) throw new Error("Login failed after 3 attempts (rate limit)")

    const state = await context.storageState()
    authCookies = state.cookies
    await context.close()
  })

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authCookies)
  })

  test("should show empty clients page", async ({ page }) => {
    await page.goto("/clients")
    await expect(page.locator("text=No clients")).toBeVisible()
  })

  test("should create a new client", async ({ page }) => {
    await page.goto("/clients/new")
    await page.fill('input[placeholder="Last name or entity name"]', "Smith")
    await page.fill('input[placeholder="First name"]', "John")
    await page.click('button[type="submit"]')
    // Should navigate to client detail
    await expect(page.locator("text=Smith")).toBeVisible({ timeout: 10000 })
  })

  test("should navigate to client detail", async ({ page }) => {
    // Create client first
    await page.goto("/clients/new")
    await page.fill('input[placeholder="Last name or entity name"]', "Detail")
    await page.fill('input[placeholder="First name"]', "Test")
    await page.click('button[type="submit"]')
    await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 10000 })

    // Should show client detail sections
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="accounts-toggle"]')).toBeVisible({ timeout: 10000 })
  })

  test("should show dashboard with stats", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("text=Total Clients")).toBeVisible()
    await expect(page.locator("text=Active Accounts")).toBeVisible()
    await expect(page.locator("text=Active Filings")).toBeVisible()
  })

  test("should navigate sidebar links", async ({ page }) => {
    await page.goto("/")
    // Dashboard — use sidebar nav link specifically
    const sidebar = page.locator("nav")
    await sidebar.locator("text=Dashboard").click()
    await expect(page).toHaveURL("/")

    // Clients
    await sidebar.locator("text=Clients").click()
    await expect(page).toHaveURL("/clients")

    // Settings
    await sidebar.locator("text=Settings").click()
    await expect(page).toHaveURL("/settings")
  })
})
