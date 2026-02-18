import { test, expect } from "@playwright/test"

// Generous timeout for CI environments
test.setTimeout(120000)

// Shared auth cookies — registered once in beforeAll, reused in every test.
// This avoids hitting the 5-req/min auth rate limit.
let authCookies: any[] = []

async function createClient(page: any, lastName = "FlowClient") {
  await page.goto("/clients/new")
  await page.fill('input[placeholder="Last name or entity name"]', lastName)
  await page.fill('input[placeholder="First name"]', "Test")
  await page.click('button[type="submit"]')
  // Wait for client detail page to load
  await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 10000 })
}

test.describe("Client Flow UX", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const email = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

    // Register — retry with backoff for rate limit resilience
    let registered = false
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/register")
      await page.fill('input[name="practiceName"]', "Flow Test Practice")
      await page.fill('input[name="name"]', "Flow Tester")
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

    // Persist auth cookies for all tests in this describe block
    const state = await context.storageState()
    authCookies = state.cookies
    await context.close()
  })

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authCookies)
  })

  test("should show Filing Years before Foreign Accounts", async ({ page }) => {
    await createClient(page)
    const filingYears = page.locator("text=Filing Years").first()
    const foreignAccounts = page.locator('[data-testid="accounts-toggle"]')
    await expect(filingYears).toBeVisible({ timeout: 10000 })
    await expect(foreignAccounts).toBeVisible()
    const fyBox = await filingYears.boundingBox()
    const faBox = await foreignAccounts.boundingBox()
    expect(fyBox!.y).toBeLessThan(faBox!.y)
  })

  test("should show accounts section collapsed when empty", async ({ page }) => {
    await createClient(page)
    const toggle = page.locator('[data-testid="accounts-toggle"]')
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await expect(toggle).toContainText("(0)")
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  test("should expand and collapse accounts section", async ({ page }) => {
    await createClient(page)
    const toggle = page.locator('[data-testid="accounts-toggle"]')
    await expect(toggle).toBeVisible({ timeout: 10000 })
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
    await expect(page.locator("text=No foreign accounts yet")).toBeVisible()
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "false")
  })

  test("should show filing years empty state", async ({ page }) => {
    await createClient(page)
    await expect(
      page.locator("text=Get started by adding a filing year above")
    ).toBeVisible({ timeout: 10000 })
  })

  test("should redirect to filing year overview after creation", async ({ page }) => {
    await createClient(page)
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
    await page.click("text=Add Year")
    const yearInput = page.locator('input[type="number"]')
    await yearInput.clear()
    await yearInput.fill("2024")
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/clients\/[^/]+\/2024/, { timeout: 10000 })
    await expect(page.locator("text=Filing Year 2024")).toBeVisible()
  })

  test("should highlight Upload step when no statements", async ({ page }) => {
    await createClient(page)
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
    await page.click("text=Add Year")
    const yearInput = page.locator('input[type="number"]')
    await yearInput.clear()
    await yearInput.fill("2024")
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/clients\/[^/]+\/2024/, { timeout: 10000 })
    await expect(
      page.locator("text=Start here — upload bank statements")
    ).toBeVisible()
  })

  test("should show Submit for Review button as disabled", async ({ page }) => {
    await createClient(page)
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
    await page.click("text=Add Year")
    const yearInput = page.locator('input[type="number"]')
    await yearInput.clear()
    await yearInput.fill("2024")
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/clients\/[^/]+\/2024/, { timeout: 10000 })
    const submitBtn = page.locator('button:has-text("Submit for Review")')
    await expect(submitBtn).toBeVisible({ timeout: 10000 })
    await expect(submitBtn).toBeDisabled()
  })

  test("should navigate to review page and show empty state", async ({ page }) => {
    await createClient(page)
    await expect(page.locator("text=Filing Years")).toBeVisible({ timeout: 10000 })
    await page.click("text=Add Year")
    const yearInput = page.locator('input[type="number"]')
    await yearInput.clear()
    await yearInput.fill("2024")
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/clients\/[^/]+\/2024/, { timeout: 10000 })
    await page.click("text=Review")
    await page.waitForTimeout(2000)
    await expect(
      page.locator("text=No completed extractions to review")
    ).toBeVisible({ timeout: 10000 })
  })
})
