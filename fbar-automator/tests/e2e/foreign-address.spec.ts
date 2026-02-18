import { test, expect } from "@playwright/test"

// Generous timeout for CI environments
test.setTimeout(120000)

// Shared auth cookies — registered once in beforeAll, reused in every test.
// This avoids hitting the 5-req/min auth rate limit.
let authCookies: any[] = []

async function createClientWithUSAddress(page: any) {
  await page.goto("/clients/new")
  await page.fill('input[placeholder="Last name or entity name"]', "TestClient")
  await page.fill('input[placeholder="First name"]', "John")
  // US Address is default
  await page.fill('input[placeholder="Street address"]', "123 Main St")
  await page.fill('input[placeholder="City"]', "New York")
  await page.locator("fieldset >> select").selectOption("NY")
  await page.fill('input[placeholder="ZIP code"]', "10001")
  await page.click('button[type="submit"]')
  await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 10000 })
}

async function createClientWithForeignAddress(page: any) {
  await page.goto("/clients/new")
  await page.fill('input[placeholder="Last name or entity name"]', "ForeignClient")
  await page.fill('input[placeholder="First name"]', "Jane")
  // Switch to Foreign Address
  await page.locator('input[name="addressMode"][value="foreign"]').check()
  await expect(page.locator('input[placeholder="State / Province"]')).toBeVisible()
  await page.fill('input[placeholder="Street address"]', "10 Downing St")
  await page.fill('input[placeholder="City"]', "London")
  await page.fill('input[placeholder="State / Province"]', "England")
  await page.fill('input[placeholder="Postal code"]', "SW1A 2AA")
  await page.locator("fieldset >> select").selectOption("GB")
  await page.click('button[type="submit"]')
  await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 10000 })
}

test.describe("Foreign Address", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    const email = `addr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`

    // Register — retry with backoff for rate limit resilience
    let registered = false
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto("/register")
      await page.fill('input[name="practiceName"]', "Address Test Practice")
      await page.fill('input[name="name"]', "Address Tester")
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

  test("should create client with US address", async ({ page }) => {
    await createClientWithUSAddress(page)
    await expect(page.locator("text=TestClient")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=123 Main St")).toBeVisible()
    await expect(page.locator("text=New York")).toBeVisible()
  })

  test("should create client with foreign address", async ({ page }) => {
    await createClientWithForeignAddress(page)
    await expect(page.locator("text=ForeignClient")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=10 Downing St")).toBeVisible()
    await expect(page.locator("text=London")).toBeVisible()
    await expect(page.locator("text=United Kingdom")).toBeVisible()
  })

  test("should toggle between US and foreign address on new client form", async ({
    page,
  }) => {
    await page.goto("/clients/new")
    await expect(
      page.locator('input[name="addressMode"][value="us"]')
    ).toBeChecked()
    await page.fill('input[placeholder="Street address"]', "US Street")
    await page.locator('input[name="addressMode"][value="foreign"]').check()
    await expect(
      page.locator('input[name="addressMode"][value="foreign"]')
    ).toBeChecked()
    await expect(
      page.locator('input[placeholder="State / Province"]')
    ).toBeVisible()
    await expect(page.locator('input[placeholder="Postal code"]')).toBeVisible()
    await page.fill('input[placeholder="Last name or entity name"]', "ToggleTest")
    await page.fill('input[placeholder="Street address"]', "Foreign Street")
    await page.fill('input[placeholder="City"]', "Paris")
    await page.fill('input[placeholder="State / Province"]', "Ile-de-France")
    await page.fill('input[placeholder="Postal code"]', "75001")
    await page.locator("fieldset >> select").selectOption("FR")
    await page.click('button[type="submit"]')
    await expect(page.locator("text=ToggleTest")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=France")).toBeVisible()
  })

  test("should edit client from US to foreign address", async ({ page }) => {
    await createClientWithUSAddress(page)
    await expect(page.locator("text=123 Main St")).toBeVisible({ timeout: 10000 })
    await page.click('button[aria-label="Edit client"]')
    await page.locator('input[name="addressMode"][value="foreign"]').check()
    await expect(
      page.locator('input[placeholder="State / Province"]')
    ).toBeVisible()
    await page.fill('input[placeholder="Street address"]', "5 Rue de Rivoli")
    await page.fill('input[placeholder="City"]', "Paris")
    await page.fill('input[placeholder="State / Province"]', "Ile-de-France")
    await page.fill('input[placeholder="Postal code"]', "75001")
    await page.locator("fieldset >> select").selectOption("FR")
    await page.click("text=Save Changes")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=5 Rue de Rivoli")).toBeVisible({
      timeout: 10000,
    })
    await expect(page.locator("text=France")).toBeVisible()
  })

  test("should edit client from foreign to US address", async ({ page }) => {
    await createClientWithForeignAddress(page)
    await expect(page.locator("text=10 Downing St")).toBeVisible({
      timeout: 10000,
    })
    await page.click('button[aria-label="Edit client"]')
    await page.locator('input[name="addressMode"][value="us"]').check()
    await expect(page.locator('input[placeholder="ZIP code"]')).toBeVisible()
    await page.fill('input[placeholder="Street address"]', "456 Oak Ave")
    await page.fill('input[placeholder="City"]', "Chicago")
    await page.locator("fieldset >> select").selectOption("IL")
    await page.fill('input[placeholder="ZIP code"]', "60601")
    await page.click("text=Save Changes")
    await page.waitForTimeout(2000)
    await expect(page.locator("text=456 Oak Ave")).toBeVisible({ timeout: 10000 })
    await expect(page.locator("text=Chicago")).toBeVisible()
  })
})
