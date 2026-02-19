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
  await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 30000 })
}

test.describe("Client Flow UX", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    // Register — retry with fresh email each attempt to avoid duplicate errors
    let registeredEmail = ""
    for (let attempt = 0; attempt < 3; attempt++) {
      const email = `flow-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
      await page.goto("/register")
      await page.fill('input[name="practiceName"]', "Flow Test Practice")
      await page.fill('input[name="name"]', "Flow Tester")
      await page.fill('input[name="email"]', email)
      await page.fill('input[name="password"]', "TestPassword123!")
      await page.fill('input[name="confirmPassword"]', "TestPassword123!")
      await page.click('button[type="submit"]')
      try {
        await page.waitForURL(/.*login/, { timeout: 15000 })
        registeredEmail = email
        break
      } catch {
        if (attempt < 2) await page.waitForTimeout(30000)
      }
    }
    if (!registeredEmail) throw new Error("Registration failed after 3 attempts (rate limit)")

    // Login — skip if already on dashboard (auto-login from registration)
    let loggedIn = false
    const currentUrl = page.url()
    if (currentUrl.endsWith("/") || currentUrl.includes("/clients") || currentUrl.includes("/dashboard")) {
      loggedIn = true
    }
    for (let attempt = 0; attempt < 3 && !loggedIn; attempt++) {
      if (attempt > 0) await page.goto("/login")
      // If redirected away from login (already authenticated), we're done
      if (!page.url().includes("/login")) {
        loggedIn = true
        break
      }
      await page.fill('input[name="email"]', registeredEmail)
      await page.fill('input[name="password"]', "TestPassword123!")
      await page.click('button[type="submit"]')
      try {
        await page.waitForURL("/", { timeout: 15000 })
        loggedIn = true
        break
      } catch {
        // Check if we ended up on any authenticated page
        if (!page.url().includes("/login") && !page.url().includes("/register")) {
          loggedIn = true
          break
        }
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
      page.locator("text=No accounts yet")
    ).toBeVisible({ timeout: 10000 })
  })

  test("should show workflow checklist with step 1 highlighted on fresh client", async ({ page }) => {
    await createClient(page)
    const checklist = page.locator('[data-testid="workflow-checklist"]')
    await expect(checklist).toBeVisible({ timeout: 10000 })
    // Step 1 should be visible and not checked
    const step1 = page.locator('[data-testid="workflow-step-1"]')
    await expect(step1).toBeVisible()
    await expect(step1).toContainText("Add a filing year")
    await expect(step1).toContainText("Create a filing year to start the FBAR process")
    // Step 1 circle should have blue highlight (current step)
    const circle = step1.locator("span").first()
    await expect(circle).toHaveClass(/bg-blue-100/)
  })

  test("should show step 1 complete after adding filing year", async ({ page }) => {
    await createClient(page)
    await expect(page.locator('[data-testid="workflow-checklist"]')).toBeVisible({ timeout: 10000 })
    // Capture client URL for later navigation (avoids Next.js router cache)
    const clientUrl = page.url()
    // Add a filing year
    await page.click("text=Add Year")
    const yearInput = page.locator('input[type="number"]')
    await yearInput.clear()
    await yearInput.fill("2024")
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/clients\/[^/]+\/2024/, { timeout: 30000 })
    // Navigate back to client detail page via direct URL (avoids stale cache)
    await page.goto(clientUrl)
    await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 15000 })
    // Step 1 should now have green check
    const step1 = page.locator('[data-testid="workflow-step-1"]')
    await expect(step1).toBeVisible()
    await expect(step1).toContainText("Filing year created")
    const check1 = step1.locator("span").first()
    await expect(check1).toHaveClass(/bg-green-100/)
    // Step 2 should now be highlighted as current
    const step2 = page.locator('[data-testid="workflow-step-2"]')
    const circle2 = step2.locator("span").first()
    await expect(circle2).toHaveClass(/bg-blue-100/)
  })

  test("should show steps 1-2 complete after adding account", async ({ page }) => {
    await createClient(page)
    await expect(page.locator('[data-testid="workflow-checklist"]')).toBeVisible({ timeout: 10000 })
    // Capture client URL for later navigation (avoids Next.js router cache)
    const clientUrl = page.url()
    // Add a filing year
    await page.click("text=Add Year")
    const yearInput = page.locator('input[type="number"]')
    await yearInput.clear()
    await yearInput.fill("2024")
    await page.click('button:has-text("Create")')
    await page.waitForURL(/\/clients\/[^/]+\/2024/, { timeout: 30000 })
    // Navigate back to client detail page via direct URL (avoids stale cache)
    await page.goto(clientUrl)
    await expect(page.locator("text=Client Details")).toBeVisible({ timeout: 15000 })
    // Add an account — click the "Add Account" button (in the accounts section header)
    const addAccountBtn = page.locator('button:has-text("Add Account")')
    await addAccountBtn.click()
    // Wait for the inline form to appear
    await expect(page.locator("text=New Foreign Account")).toBeVisible({ timeout: 5000 })
    await page.fill('input[placeholder="Bank name"]', "Test Bank")
    await page.fill('input[placeholder="Account number"]', "123456789")
    // Submit via the form's Add button (inside the account form)
    await page.locator('form button[type="submit"]:has-text("Add")').click()
    // Wait for the account toggle to reflect the new account count
    await expect(page.locator('[data-testid="accounts-toggle"]')).toContainText("(1)", { timeout: 30000 })
    // Reload to get fresh server-rendered data for the checklist
    await page.goto(clientUrl)
    await expect(page.locator('[data-testid="workflow-checklist"]')).toBeVisible({ timeout: 15000 })
    // Steps 1 and 2 should be complete
    const step1 = page.locator('[data-testid="workflow-step-1"]')
    const check1 = step1.locator("span").first()
    await expect(check1).toHaveClass(/bg-green-100/)
    const step2 = page.locator('[data-testid="workflow-step-2"]')
    await expect(step2).toContainText("1 account added")
    const check2 = step2.locator("span").first()
    await expect(check2).toHaveClass(/bg-green-100/)
    // Step 3 should be highlighted as current
    const step3 = page.locator('[data-testid="workflow-step-3"]')
    const circle3 = step3.locator("span").first()
    await expect(circle3).toHaveClass(/bg-blue-100/)
  })
})
