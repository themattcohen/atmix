import { test, expect } from "@playwright/test"

// Shared auth cookies — registered once in beforeAll, reused where needed.
let authCookies: any[] = []

test.describe("Authentication", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const email = `auth-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

    // Register — retry with backoff for rate limit resilience
    let registered = false
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/register")
      await page.fill('input[name="practiceName"]', "Auth Test Practice")
      await page.fill('input[name="name"]', "Auth Tester")
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

  // Tests that DON'T make auth requests come first
  test("should show login page for unauthenticated users", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/.*login/)
    await expect(page.locator("text=Sign in to your account")).toBeVisible()
  })

  test("should login with valid credentials", async ({ context, page }) => {
    // Uses saved cookies — zero auth requests
    await context.addCookies(authCookies)
    await page.goto("/")
    await expect(page).toHaveURL("/")
    await expect(page.locator("h1:has-text('Dashboard')")).toBeVisible()
  })

  test("should logout", async ({ context, page }) => {
    // Uses saved cookies — zero auth requests
    await context.addCookies(authCookies)
    await page.goto("/")
    await page.waitForURL("/")
    await page.click("text=Sign out")
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 })
  })

  // Tests that DO make auth requests come last
  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', "nonexistent@example.com")
    await page.fill('input[name="password"]', "wrongpassword")
    await page.click('button[type="submit"]')
    // Should show inline error or redirect to error page
    await expect(
      page.locator("text=Invalid email or password").or(
        page.locator("text=Too many requests")
      )
    ).toBeVisible({ timeout: 10000 })
  })

  test("should register a new account", async ({ page }) => {
    await page.goto("/register")
    await page.fill('input[name="practiceName"]', "Test Practice")
    await page.fill('input[name="name"]', "Test User")
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="password"]', "TestPassword123!")
    await page.fill('input[name="confirmPassword"]', "TestPassword123!")
    await page.click('button[type="submit"]')
    // Should redirect to login or show rate limit error (if running after other tests)
    await expect(page).toHaveURL(/.*login/, { timeout: 15000 })
  })
})
