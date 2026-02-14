import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("should show login page for unauthenticated users", async ({ page }) => {
    await page.goto("/")
    // Should redirect to /login
    await expect(page).toHaveURL(/.*login/)
    await expect(page.locator("h1, h2")).toContainText(/sign in|log in/i)
  })

  test("should register a new account", async ({ page }) => {
    await page.goto("/register")
    await page.fill('input[name="practiceName"]', "Test Practice")
    await page.fill('input[name="name"]', "Test User")
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`)
    await page.fill('input[name="password"]', "TestPassword123!")
    await page.click('button[type="submit"]')
    // Should redirect to login after successful registration
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 })
  })

  test("should login with valid credentials", async ({ page }) => {
    // First register
    const email = `e2e-${Date.now()}@example.com`
    await page.goto("/register")
    await page.fill('input[name="practiceName"]', "E2E Practice")
    await page.fill('input[name="name"]', "E2E User")
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', "TestPassword123!")
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*login/)

    // Then login
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', "TestPassword123!")
    await page.click('button[type="submit"]')
    // Should redirect to dashboard
    await expect(page).toHaveURL("/", { timeout: 10000 })
    await expect(page.locator("text=Dashboard")).toBeVisible()
  })

  test("should reject invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.fill('input[name="email"]', "nonexistent@example.com")
    await page.fill('input[name="password"]', "wrongpassword")
    await page.click('button[type="submit"]')
    // Should show error
    await expect(page.locator("text=Invalid")).toBeVisible({ timeout: 5000 })
  })

  test("should logout", async ({ page }) => {
    // Login first (reuse the pattern)
    const email = `logout-${Date.now()}@example.com`
    await page.goto("/register")
    await page.fill('input[name="practiceName"]', "Logout Practice")
    await page.fill('input[name="name"]', "Logout User")
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', "TestPassword123!")
    await page.click('button[type="submit"]')
    await page.waitForURL(/.*login/)
    await page.fill('input[name="email"]', email)
    await page.fill('input[name="password"]', "TestPassword123!")
    await page.click('button[type="submit"]')
    await page.waitForURL("/")

    // Click sign out
    await page.click("text=Sign out")
    await expect(page).toHaveURL(/.*login/, { timeout: 10000 })
  })
})
