import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import path from "path"

const TEST_CSV = path.resolve(__dirname, "../fixtures/simple-statement.csv")

// Seeded admin credentials (from prisma/seed.ts)
const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL("/", { timeout: 20000 })
  } catch {
    // Retry once on transient DB/auth errors
    await page.goto("/login")
    await page.waitForLoadState("networkidle")
    await page.fill('input[name="email"]', ADMIN_EMAIL)
    await page.fill('input[name="password"]', ADMIN_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL("/", { timeout: 20000 })
  }
}

// Shared state across serial tests
let sharedContext: BrowserContext
let overviewUrl: string // e.g., /clients/{id}/2024

test.describe.serial("Filing Status Lifecycle", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120000)
    sharedContext = await browser.newContext()
    const page = await sharedContext.newPage()

    // Login
    await loginAsAdmin(page)

    // Create client
    const ts = Date.now()
    await page.goto("/clients/new")
    await page.waitForLoadState("networkidle")
    await page.locator("select").first().selectOption("INDIVIDUAL")
    await page.getByPlaceholder("Last name or entity name").fill(`LifecycleTest-${ts}`)
    await page.getByPlaceholder("First name").fill("Test")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 30000 })

    // Add filing year 2024
    await page.getByText("Add Year").click()
    await expect(page.getByText("New Filing Year")).toBeVisible({ timeout: 5000 })
    const yearInput = page.locator('input[type="number"]')
    await yearInput.fill("2024")

    await Promise.all([
      page.waitForResponse(
        (resp) => resp.url().includes("/filing-years") && resp.request().method() === "POST",
        { timeout: 15000 }
      ),
      page.getByRole("button", { name: "Create" }).click(),
    ])

    // AddFilingYearForm pushes to /clients/{id}/2024 after creation
    await page.waitForURL(/\/clients\/[a-f0-9-]+\/2024$/, { timeout: 15000 })
    overviewUrl = page.url()

    await page.close()
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  test("1 — Submit disabled with no statements", async () => {
    test.setTimeout(120000)
    const page = await sharedContext.newPage()

    await page.goto(overviewUrl)
    await page.waitForLoadState("networkidle")

    // "Submit for Review" button should be present and disabled
    const submitBtn = page.locator('button:has-text("Submit for Review")')
    await expect(submitBtn).toBeVisible({ timeout: 10000 })
    await expect(submitBtn).toBeDisabled()

    // Verify hint text about needing accounts/statements
    // When totalAccounts === 0: "Add accounts and complete reviews before submitting."
    // When isReadyForReview is false and totalStatements === 0:
    //   "Upload and process at least one statement before submitting for review."
    const hintText = page.locator("text=before submitting")
    await expect(hintText.first()).toBeVisible({ timeout: 5000 })

    await page.close()
  })

  test("2 — Navigate all 4 filing year tabs", async () => {
    test.setTimeout(60000)
    const page = await sharedContext.newPage()

    await page.goto(overviewUrl)
    await page.waitForLoadState("networkidle")

    // Verify we're on the overview page
    expect(page.url()).toMatch(/\/clients\/[a-f0-9-]+\/2024$/)

    const tabNav = page.locator('nav[aria-label="Filing year tabs"]')
    await expect(tabNav).toBeVisible({ timeout: 5000 })

    // Click "Upload" tab
    const uploadTab = tabNav.locator("a", { hasText: "Upload" })
    await uploadTab.click()
    await page.waitForURL(/\/upload/, { timeout: 20000 })
    expect(page.url()).toContain("/upload")

    // Click "Review" tab
    await page.waitForLoadState("networkidle")
    const reviewTab = page.locator('nav[aria-label="Filing year tabs"] a', { hasText: "Review" })
    await reviewTab.click()
    await page.waitForURL(/\/review/, { timeout: 20000 })
    expect(page.url()).toContain("/review")

    // Click "Export" tab
    await page.waitForLoadState("networkidle")
    const exportTab = page.locator('nav[aria-label="Filing year tabs"] a', { hasText: "Export" })
    await exportTab.click()
    await page.waitForURL(/\/export/, { timeout: 20000 })
    expect(page.url()).toContain("/export")

    // Click "Overview" tab
    await page.waitForLoadState("networkidle")
    const overviewTab = page.locator('nav[aria-label="Filing year tabs"] a', { hasText: "Overview" })
    await overviewTab.click()
    await page.waitForURL(/\/clients\/[a-f0-9-]+\/2024$/, { timeout: 20000 })
    expect(page.url()).toMatch(/\/clients\/[a-f0-9-]+\/2024$/)

    await page.close()
  })

  test("3 — Export page shows not-ready state", async () => {
    test.setTimeout(60000)
    const page = await sharedContext.newPage()

    await page.goto(overviewUrl + "/export")
    await page.waitForLoadState("networkidle")

    // Export page should show a status badge with "NOT STARTED" (rendered as "NOT_STARTED" → "NOT STARTED")
    // or an alert about filing not being ready for export
    const notReadyAlert = page.locator('[role="alert"]:not(#__next-route-announcer__)')
    const draftBadge = page.getByText("NOT STARTED")

    // Check for either the alert or the status badge
    const alertVisible = await notReadyAlert.isVisible().catch(() => false)
    const badgeVisible = await draftBadge.isVisible().catch(() => false)

    expect(alertVisible || badgeVisible).toBe(true)

    // Verify the "Filing not ready for export" message if alert is visible
    if (alertVisible) {
      await expect(page.getByText("Filing not ready for export")).toBeVisible({ timeout: 5000 })
    }

    await page.close()
  })

  test("4 — Upload CSV and wait for extraction", async () => {
    test.setTimeout(90000)
    const page = await sharedContext.newPage()

    await page.goto(overviewUrl + "/upload")
    await page.waitForLoadState("networkidle")

    // Upload the CSV file
    const fileInput = page.locator('input[aria-label="File upload input"]')
    await fileInput.setInputFiles(TEST_CSV)

    // Wait for the file name to appear in the table
    await expect(page.getByText("simple-statement.csv").first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Uploading")).not.toBeVisible({ timeout: 60000 })

    // Poll for "Completed" badge
    let completed = false
    const maxWait = 90_000
    const pollInterval = 5_000
    const start = Date.now()

    while (Date.now() - start < maxWait) {
      const badge = page.locator("table").getByText("Completed")
      if (await badge.isVisible().catch(() => false)) {
        completed = true
        break
      }
      const failed = page.locator("table").getByText("Failed")
      if (await failed.isVisible().catch(() => false)) {
        throw new Error("Extraction failed")
      }
      await page.waitForTimeout(pollInterval)
      await page.reload()
      await page.waitForLoadState("networkidle")
    }

    expect(completed).toBe(true)

    await page.close()
  })

  test("5 — Approve account then submit for review", async () => {
    test.setTimeout(60000)
    const page = await sharedContext.newPage()

    // Navigate to review page
    await page.goto(overviewUrl + "/review")
    await page.waitForLoadState("networkidle")

    // Wait for extracted data to appear (account number is masked, use visible text)
    await expect(page.getByText("1 account found across 1 statement")).toBeVisible({ timeout: 10000 })

    // Find the per-account "Approve Account" button and click it
    const approveBtn = page.getByRole("button", { name: /Approve Account/i })
    await approveBtn.scrollIntoViewIfNeeded()
    await expect(approveBtn).toBeEnabled({ timeout: 10000 })
    await approveBtn.click()

    // Wait for approval confirmation
    await expect(page.getByText("Account approved successfully")).toBeVisible({ timeout: 15000 })
    await page.waitForLoadState("networkidle")

    // Navigate to overview page
    await page.goto(overviewUrl)
    await page.waitForLoadState("networkidle")

    // "Submit for Review" button should now be enabled
    const submitBtn = page.locator('button:has-text("Submit for Review")')
    await expect(submitBtn).toBeVisible({ timeout: 10000 })
    await expect(submitBtn).toBeEnabled({ timeout: 10000 })

    // Click "Submit for Review"
    await submitBtn.click()

    // Wait for the status to change — look for "Reviewed" badge or success text
    await expect(
      page.getByText("Reviewed").first()
    ).toBeVisible({ timeout: 15000 })

    // Verify no error message appeared
    const errorText = page.locator("text=Failed to")
    const hasError = await errorText.isVisible().catch(() => false)
    expect(hasError).toBe(false)

    await page.close()
  })
})
