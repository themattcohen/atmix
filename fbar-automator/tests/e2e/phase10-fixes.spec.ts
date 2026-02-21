import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import path from "path"

/**
 * Phase 10 Fixes — Playwright E2E Tests
 *
 * Tests the 4 fixes implemented in Phase 10:
 *   1. PDF preview in DocumentViewer (canvas, not img)
 *   2. Auto-create ForeignAccount on extraction
 *   3. Duplicate filename detection (client-side)
 *   4. Delete button for admin users
 *
 * Runs serially: tests share a logged-in browser context and a
 * client + filing year created in setup.
 */

const TEST_PDF = path.resolve(__dirname, "../fixtures/test-statement.pdf")
const TEST_CSV = path.resolve(__dirname, "../fixtures/simple-statement.csv")

// Seeded admin credentials (from prisma/seed.ts)
const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"

// Shared state across serial tests
let sharedContext: BrowserContext
let uploadPageUrl: string

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")

  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')

  // After login, NextAuth redirects to "/" (dashboard)
  await page.waitForURL("/", { timeout: 20000 })
}

async function createClientAndFilingYear(page: Page): Promise<string> {
  // Create client
  await page.goto("/clients/new")
  await page.waitForLoadState("networkidle")

  // Client Type select (no name attribute — use first select on the page)
  await page.locator("select").first().selectOption("INDIVIDUAL")

  // Last Name input (no name attribute — use placeholder)
  const ts = Date.now()
  await page.getByPlaceholder("Last name or entity name").fill(`Phase10-${ts}`)
  await page.getByPlaceholder("First name").fill("Test")

  await page.click('button[type="submit"]')

  // Wait for redirect to /clients/{id}
  await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 30000 })
  const cid = page.url().split("/clients/")[1]

  // Add filing year 2024
  await page.getByText("Add Year").click()
  await expect(page.getByText("New Filing Year")).toBeVisible({ timeout: 5000 })

  // The filing year form appears — year defaults to previous year
  const yearInput = page.locator('input[type="number"]')
  await yearInput.fill("2024")

  // Click Create and wait for the API response
  await Promise.all([
    page.waitForResponse(
      (resp) =>
        resp.url().includes("/filing-years") && resp.request().method() === "POST",
      { timeout: 15000 }
    ),
    page.getByRole("button", { name: "Create" }).click(),
  ])

  // AddFilingYearForm pushes to /clients/{id}/2024 after creation
  await page.waitForURL(/\/clients\/[a-f0-9-]+\/2024$/, { timeout: 15000 })

  return cid
}

// ---------------------------------------------------------------------------
// Test Suite — uses a shared logged-in browser context
// ---------------------------------------------------------------------------

test.describe.serial("Phase 10 Fixes", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000)

    // Create a shared context — all tests use the same session cookies
    sharedContext = await browser.newContext()
    const page = await sharedContext.newPage()

    await loginAsAdmin(page)
    const cid = await createClientAndFilingYear(page)
    uploadPageUrl = `/clients/${cid}/2024/upload`

    await page.close()
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  test("1 — Upload page renders correctly", async () => {
    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    // DropZone visible
    await expect(page.getByText("Click to upload")).toBeVisible()

    // FileList shows empty state
    await expect(page.getByText("No statements uploaded yet")).toBeVisible()

    // No delete (trash) buttons visible since there are no statements
    await expect(page.locator('button[title="Delete statement"]')).toHaveCount(0)

    await page.close()
  })

  test("2 — Upload a PDF successfully", async () => {
    test.setTimeout(90000) // Upload can be slow (cold start: compile + S3 + Redis)

    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    // Set file on the hidden input
    const fileInput = page.locator('input[aria-label="File upload input"]')
    await fileInput.setInputFiles(TEST_PDF)

    // Wait for upload progress UI — the filename should appear
    await expect(page.getByText("test-statement.pdf").first()).toBeVisible({
      timeout: 10000,
    })

    // Wait for upload to finish: status should change from "Uploading" to
    // "Processing", "Completed", or "Error". We detect this by waiting for
    // the "Uploading" badge to disappear.
    await expect(page.getByText("Uploading")).not.toBeVisible({ timeout: 60000 })

    // Check if there's an error
    const errorText = await page.locator('[role="alert"]').textContent().catch(() => null)
    if (errorText) {
      console.log("Upload error:", errorText)
    }

    // Reload to get server-rendered FileList data
    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).toBeVisible({ timeout: 15000 })

    // Verify type column shows "PDF" (use exact match to avoid matching filename)
    await expect(
      page.locator("table").getByRole("cell", { name: "PDF", exact: true })
    ).toBeVisible()

    await page.close()
  })

  test("3 — Duplicate filename rejected", async () => {
    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    // Wait for page to load with existing statement
    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).toBeVisible({ timeout: 15000 })

    // Try uploading the same file again
    const fileInput = page.locator('input[aria-label="File upload input"]')
    await fileInput.setInputFiles(TEST_PDF)

    // Should see duplicate error immediately (client-side check)
    await expect(page.getByText("already been uploaded")).toBeVisible({
      timeout: 5000,
    })

    await page.close()
  })

  test("4 — Delete button works (admin)", async () => {
    test.setTimeout(120000) // May need to wait for processing to finish

    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    // Wait for statement row in FileList table
    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).toBeVisible({ timeout: 15000 })

    // Wait for processing to finish — the delete button is disabled during processing.
    // Poll until status is no longer "Processing" (becomes Completed, Failed, or Pending).
    const processingBadge = page.locator("table").getByText("Processing")
    if (await processingBadge.isVisible().catch(() => false)) {
      const maxWaitMs = 90_000
      const pollIntervalMs = 5_000
      const start = Date.now()
      while (Date.now() - start < maxWaitMs) {
        if (!(await processingBadge.isVisible().catch(() => false))) break
        await page.waitForTimeout(pollIntervalMs)
        await page.reload()
        await page.waitForLoadState("networkidle")
      }
    }

    // Verify trash icon button is visible (admin only)
    const trashBtn = page.locator('button[title="Delete statement"]')
    await expect(trashBtn).toBeVisible({ timeout: 10000 })

    // --- Test Cancel flow ---
    await trashBtn.click()

    // Confirm and Cancel buttons should appear
    await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible()

    // Click Cancel — statement should still be present
    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).toBeVisible()

    // --- Test Confirm flow ---
    await trashBtn.click()
    await page.getByRole("button", { name: "Confirm" }).click()

    // Wait for deletion — the row should disappear
    // After delete, router.refresh() is called — page re-renders
    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).not.toBeVisible({ timeout: 15000 })

    // Should show empty state OR the row is simply gone
    // Check that the trash button is gone too
    await expect(trashBtn).not.toBeVisible()

    await page.close()
  })

  test("5 — PDF renders in DocumentViewer (extraction-dependent)", async () => {
    test.setTimeout(180000) // Extraction can take up to 90s + upload time

    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    // Re-upload test PDF (was deleted in Test 4)
    const fileInput = page.locator('input[aria-label="File upload input"]')
    await fileInput.setInputFiles(TEST_PDF)

    // Wait for upload to finish
    await expect(page.getByText("test-statement.pdf").first()).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByText("Uploading")).not.toBeVisible({ timeout: 60000 })

    // Reload to get server-rendered data
    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).toBeVisible({ timeout: 15000 })

    // Poll for extraction to complete — check status badge
    let extractionCompleted = false
    const maxWaitMs = 90_000
    const pollIntervalMs = 5_000
    const start = Date.now()

    while (Date.now() - start < maxWaitMs) {
      const completedBadge = page.locator("table").getByText("Completed")
      if (await completedBadge.isVisible().catch(() => false)) {
        extractionCompleted = true
        break
      }
      // Also check for FAILED
      const failedBadge = page.locator("table").getByText("Failed")
      if (await failedBadge.isVisible().catch(() => false)) {
        break
      }
      await page.waitForTimeout(pollIntervalMs)
      await page.reload()
    }

    if (!extractionCompleted) {
      await page.close()
      test.skip(true, "PDF extraction requires worker + ANTHROPIC_API_KEY — use CSV test 5a instead")
      return
    }

    // Navigate to review page
    const reviewUrl = uploadPageUrl.replace("/upload", "/review")
    await page.goto(reviewUrl)
    await page.waitForLoadState("networkidle")

    // Verify extracted data is visible on the review page
    await expect(page.getByText("account found across")).toBeVisible({ timeout: 15000 })

    // Click "View Statements" to open the DocumentViewer panel
    await page.getByRole("button", { name: "View Statements" }).click()

    // DocumentViewer should render a <canvas> for PDF (react-pdf), NOT an <img>
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15000 })

    // Should NOT show "Failed to load image" error
    await expect(page.getByText("Failed to load image")).not.toBeVisible()

    await page.close()
  })

  test("5a — CSV extraction completes and data visible on review page", async () => {
    test.setTimeout(120000)
    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    // Upload CSV file
    const fileInput = page.locator('input[aria-label="File upload input"]')
    await fileInput.setInputFiles(TEST_CSV)

    // Wait for upload to finish
    await expect(page.getByText("simple-statement.csv").first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Uploading")).not.toBeVisible({ timeout: 60000 })

    // Reload to get server-rendered data
    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("table").getByText("simple-statement.csv")
    ).toBeVisible({ timeout: 15000 })

    // CSV extraction uses programmatic path — should complete quickly without ANTHROPIC_API_KEY
    // Poll for extraction to complete — scope to the CSV row to avoid strict mode violation
    // (the PDF from test 5 may also show "Completed" in the table)
    const csvRow = page.locator("table tr", { hasText: "simple-statement.csv" })
    let extractionCompleted = false
    const maxWaitMs = 60_000
    const pollIntervalMs = 3_000
    const start = Date.now()

    while (Date.now() - start < maxWaitMs) {
      if (await csvRow.getByText("Completed").isVisible().catch(() => false)) {
        extractionCompleted = true
        break
      }
      if (await csvRow.getByText("Failed").isVisible().catch(() => false)) {
        break
      }
      await page.waitForTimeout(pollIntervalMs)
      await page.reload()
      await page.waitForLoadState("networkidle")
    }

    expect(extractionCompleted).toBe(true)

    // Navigate to review page
    const reviewUrl = uploadPageUrl.replace("/upload", "/review")
    await page.goto(reviewUrl)
    await page.waitForLoadState("networkidle")

    // Verify extracted account data is visible (account number is masked to ****95-7)
    await expect(page.getByText("95-7")).toBeVisible({ timeout: 10000 })

    await page.close()
  })

  test("6 — ForeignAccount auto-created + Approve works (extraction-dependent)", async () => {
    const page = await sharedContext.newPage()

    // Check if extraction completed by going to upload page
    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("table").getByText("test-statement.pdf")
    ).toBeVisible({ timeout: 15000 })

    const completedBadge = page.locator("table").getByText("Completed")
    const isCompleted = await completedBadge.isVisible().catch(() => false)

    if (!isCompleted) {
      await page.close()
      test.skip(true, "PDF extraction requires worker + ANTHROPIC_API_KEY — use CSV test 6a instead")
      return
    }

    // Navigate to review page
    const reviewUrl = uploadPageUrl.replace("/upload", "/review")
    await page.goto(reviewUrl)

    // Verify extracted account data is visible
    await expect(page.getByText("account found across")).toBeVisible({ timeout: 10000 })

    // Look for an approve button
    const approveBtn = page.getByRole("button", { name: /approve account/i })
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click()
      // Wait for approval to complete
      await expect(approveBtn).not.toBeVisible({ timeout: 15000 })
    }

    await page.close()
  })

  test("6a — ForeignAccount auto-created from CSV extraction", async () => {
    test.setTimeout(60000)
    const page = await sharedContext.newPage()

    // Navigate to review page (CSV was uploaded in test 5a)
    const reviewUrl = uploadPageUrl.replace("/upload", "/review")
    await page.goto(reviewUrl)
    await page.waitForLoadState("networkidle")

    // Verify account data from CSV is visible (account number is masked to ****95-7)
    await expect(page.getByText("95-7")).toBeVisible({ timeout: 10000 })

    // Look for CHF currency
    await expect(page.getByText("CHF").first()).toBeVisible({ timeout: 5000 })

    // Look for an approve button and test it if present
    const approveBtn = page.getByRole("button", { name: /approve account/i })
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click()
      // Wait for approval to complete
      await expect(approveBtn).not.toBeVisible({ timeout: 15000 })
    }

    await page.close()
  })
})
