import { test, expect } from "@playwright/test"

test.describe("B2B Review Page Tests", () => {
  test("should login and navigate to review page", async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = []
    page.on("console", msg => {
      if (msg.type() === "error") {
        consoleErrors.push(`Console Error: ${msg.text()}`)
      }
    })

    // Capture network errors
    page.on("response", response => {
      if (response.status() >= 400) {
        console.log(`HTTP ${response.status()}: ${response.url()}`)
      }
    })

    // Step 1: Login
    console.log("Step 1: Navigating to login page...")
    await page.goto("http://localhost:3000/login")
    await page.waitForLoadState("domcontentloaded")
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })

    console.log("Taking snapshot of login page...")
    await page.screenshot({ path: "test-results/01-login-page.png", fullPage: true })

    console.log("Filling login form...")
    await page.fill('input#email', "admin@demo.com")
    await page.fill('input#password', "admin123")

    console.log("Clicking login button...")
    // Wait for navigation after clicking submit
    const navigationPromise = page.waitForURL(/\/(?!login)/, { timeout: 15000 })
    await page.click('button[type="submit"]')

    console.log("Waiting for navigation after login...")
    try {
      await navigationPromise
      console.log("Navigation successful, current URL:", page.url())
    } catch (error) {
      console.log("Navigation timeout or failed, current URL:", page.url())
      // Take screenshot to see what happened
      await page.screenshot({ path: "test-results/02-login-failed.png", fullPage: true })
      // Check for error messages
      const errorText = await page.textContent("body")
      console.log("Page contains 'Invalid':", errorText?.includes("Invalid"))
      console.log("Page contains 'error':", errorText?.toLowerCase().includes("error"))
    }

    await page.waitForTimeout(1000)
    await page.screenshot({ path: "test-results/02-after-login.png", fullPage: true })

    // Step 2: Navigate to Review Page
    console.log("\nStep 2: Navigating to review page...")
    await page.goto("http://localhost:3000/clients/655eeb60-ab8c-4144-898a-a03c82a9cc6b/2025/review")
    await page.waitForLoadState("networkidle")
    await page.waitForTimeout(2000) // Give it time to render

    console.log("Taking snapshot of review page...")
    await page.screenshot({ path: "test-results/03-review-page-initial.png", fullPage: true })

    // Step 3: Verify Layout
    console.log("\nStep 3: Verifying layout...")

    // Check for account cards
    const accountCards = await page.locator('[data-testid*="account-card"], .account-card, [class*="account"]').count()
    console.log(`Found ${accountCards} potential account card elements`)

    // Look for summary header
    const summaryText = await page.textContent("body")
    console.log("\nSearching for key elements in page text:")
    console.log("- Contains 'UBS':", summaryText?.includes("UBS"))
    console.log("- Contains 'Credit Suisse':", summaryText?.includes("Credit Suisse"))
    console.log("- Contains 'RBC':", summaryText?.includes("RBC"))
    console.log("- Contains 'account':", summaryText?.includes("account"))
    console.log("- Contains 'balance':", summaryText?.includes("balance"))
    console.log("- Contains 'coverage':", summaryText?.includes("coverage"))

    // Check for old statement selector (should be gone)
    const statementSelector = await page.locator('select[name*="statement"], select[id*="statement"]').count()
    console.log(`\nStatement selector dropdown found: ${statementSelector} (should be 0)`)

    // Look for timeline blocks
    const timelineElements = await page.locator('[class*="timeline"], [data-testid*="timeline"], [class*="month"]').count()
    console.log(`Timeline-related elements found: ${timelineElements}`)

    // Step 4: Test Interactions
    console.log("\nStep 4: Testing interactions...")

    // Try to find Balance History button/toggle
    const balanceHistoryButton = await page.locator('button:has-text("Balance History"), [data-testid*="balance-history"], button:has-text("balance")').first()
    const balanceButtonExists = await balanceHistoryButton.count() > 0
    console.log(`Balance History button found: ${balanceButtonExists}`)

    if (balanceButtonExists) {
      console.log("Clicking Balance History button...")
      await balanceHistoryButton.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: "test-results/04-balance-history-expanded.png", fullPage: true })
    }

    // Try to find Source Statements toggle
    const sourceStatementsButton = await page.locator('button:has-text("Source Statements"), [data-testid*="source-statements"], button:has-text("source")').first()
    const sourceButtonExists = await sourceStatementsButton.count() > 0
    console.log(`Source Statements button found: ${sourceButtonExists}`)

    if (sourceButtonExists) {
      console.log("Clicking Source Statements button...")
      await sourceStatementsButton.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: "test-results/05-source-statements-expanded.png", fullPage: true })
    }

    // Try to find View Statements button
    const viewStatementsButton = await page.locator('button:has-text("View Statements"), [data-testid*="view-statements"]').first()
    const viewButtonExists = await viewStatementsButton.count() > 0
    console.log(`View Statements button found: ${viewButtonExists}`)

    if (viewButtonExists) {
      console.log("Clicking View Statements button...")
      await viewStatementsButton.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: "test-results/06-after-view-statements.png", fullPage: true })
    }

    // Step 5: Test Approve
    console.log("\nStep 5: Testing approve functionality...")

    const approveButton = await page.locator('button:has-text("Approve"), [data-testid*="approve"]').first()
    const approveButtonExists = await approveButton.count() > 0
    console.log(`Approve button found: ${approveButtonExists}`)

    if (approveButtonExists) {
      console.log("Clicking Approve button...")
      await approveButton.click()
      await page.waitForTimeout(1000)
      await page.screenshot({ path: "test-results/07-after-approve.png", fullPage: true })

      // Check for success banner
      const successBanner = await page.locator('[role="alert"], .alert, [class*="success"], [class*="banner"]').count()
      console.log(`Success/error banner found: ${successBanner}`)
    }

    // Step 6: Final Screenshots
    console.log("\nStep 6: Taking final screenshots...")
    await page.screenshot({ path: "test-results/08-final-full-page.png", fullPage: true })

    // Get page HTML for analysis
    const pageHTML = await page.content()
    const htmlPath = "test-results/09-page-html.html"
    require("fs").writeFileSync(htmlPath, pageHTML)
    console.log(`\nPage HTML saved to: ${htmlPath}`)

    console.log("\n=== TEST COMPLETE ===")
    console.log(`Console Errors Found: ${consoleErrors.length}`)
    if (consoleErrors.length > 0) {
      console.log("Console Errors:")
      consoleErrors.forEach(err => console.log(`  - ${err}`))
    }
    console.log("Check test-results/ directory for all screenshots and HTML")
  })
})
