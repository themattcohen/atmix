import { test, expect } from "@playwright/test"

// Shared auth cookies — registered once in beforeAll, reused in every test.
let authCookies: any[] = []

test.describe("Upload and Review", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const email = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

    // Register — retry with backoff for rate limit resilience
    let registered = false
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/register")
      await page.fill('input[name="practiceName"]', "Upload Practice")
      await page.fill('input[name="name"]', "Upload Tester")
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

  async function createClient(page: any) {
    await page.goto("/clients/new")
    await page.fill('input[placeholder="Last name or entity name"]', "Upload")
    await page.fill('input[placeholder="First name"]', "Test")
    await page.click('button[type="submit"]')
    await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 10000 })
  }

  test("should create client successfully", async ({ page }) => {
    await createClient(page)
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
  })

  test("should show filing years list", async ({ page }) => {
    await createClient(page)
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
  })

  test("should show settings with practice info", async ({ page }) => {
    await createClient(page)
    await page.goto("/settings")
    await expect(page.locator("text=Practice Information")).toBeVisible()
    await expect(page.locator("text=API Configuration")).toBeVisible()
    await expect(page.locator("text=Team Members")).toBeVisible()
  })

  test("should navigate to settings page", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.locator("text=Practice Information")).toBeVisible()
  })
})
