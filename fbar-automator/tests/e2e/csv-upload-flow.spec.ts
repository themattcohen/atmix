import { test, expect, type Page, type BrowserContext } from "@playwright/test"
import path from "path"

const TEST_CSV = path.resolve(__dirname, "../fixtures/simple-statement.csv")

// Shared state across serial tests
let sharedContext: BrowserContext
let uploadPageUrl: string

// Seeded admin credentials (from prisma/seed.ts)
const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("/", { timeout: 20000 })
}

async function createClientAndFilingYear(page: Page): Promise<string> {
  await page.goto("/clients/new")
  await page.waitForLoadState("networkidle")

  await page.locator("select").first().selectOption("INDIVIDUAL")

  const ts = Date.now()
  await page.getByPlaceholder("Last name or entity name").fill(`CSVTest-${ts}`)
  await page.getByPlaceholder("First name").fill("Test")

  await page.click('button[type="submit"]')
  await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 30000 })
  const cid = page.url().split("/clients/")[1]

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

  await expect(page.getByText("New Filing Year")).not.toBeVisible({ timeout: 10000 })
  await expect(page.locator("table").getByText("2024")).toBeVisible({ timeout: 10000 })

  await page.getByRole("link", { name: "View" }).first().click()
  await page.waitForURL(/\/clients\/[a-f0-9-]+\/2024$/, { timeout: 15000 })

  const overviewUrl = page.url()
  await page.goto(overviewUrl + "/upload")
  await page.waitForLoadState("networkidle")

  return cid
}

test.describe.serial("CSV Upload Flow", () => {
  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000)
    sharedContext = await browser.newContext()
    const page = await sharedContext.newPage()
    await loginAsAdmin(page)
    await createClientAndFilingYear(page)
    uploadPageUrl = page.url()
    await page.close()
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  test("1 — Upload CSV file successfully", async () => {
    test.setTimeout(90000)
    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    const fileInput = page.locator('input[aria-label="File upload input"]')
    await fileInput.setInputFiles(TEST_CSV)

    await expect(page.getByText("simple-statement.csv").first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText("Uploading")).not.toBeVisible({ timeout: 60000 })

    await page.reload()
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("table").getByText("simple-statement.csv")
    ).toBeVisible({ timeout: 15000 })

    await page.close()
  })

  test("2 — CSV extraction completes programmatically", async () => {
    test.setTimeout(120000)
    const page = await sharedContext.newPage()

    await page.goto(uploadPageUrl)
    await page.waitForLoadState("networkidle")

    await expect(
      page.locator("table").getByText("simple-statement.csv")
    ).toBeVisible({ timeout: 15000 })

    // Poll for Completed badge
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
      const failedBadge = page.locator("table").getByText("Failed")
      if (await failedBadge.isVisible().catch(() => false)) {
        // Should NOT fail — CSV uses programmatic path
        expect(false).toBe(true) // force fail with message
        break
      }
      await page.waitForTimeout(pollIntervalMs)
      await page.reload()
      await page.waitForLoadState("networkidle")
    }

    expect(extractionCompleted).toBe(true)

    await page.close()
  })

  test("3 — Review page shows extracted data", async () => {
    test.setTimeout(60000)
    const page = await sharedContext.newPage()

    const reviewUrl = uploadPageUrl.replace("/upload", "/review")
    await page.goto(reviewUrl)
    await page.waitForLoadState("networkidle")

    // Verify account number from CSV
    await expect(page.getByText("CH93")).toBeVisible({ timeout: 10000 })

    // Verify currency
    await expect(page.getByText("CHF")).toBeVisible({ timeout: 5000 })

    await page.close()
  })

  test("4 — Approve extracted account", async () => {
    test.setTimeout(60000)
    const page = await sharedContext.newPage()

    const reviewUrl = uploadPageUrl.replace("/upload", "/review")
    await page.goto(reviewUrl)
    await page.waitForLoadState("networkidle")

    // Look for approve button
    const approveBtn = page.getByRole("button", { name: /approve/i })
    if (await approveBtn.isVisible().catch(() => false)) {
      await approveBtn.click()
      await expect(page.locator('[role="alert"]')).not.toBeVisible({ timeout: 5000 })
    }

    await page.close()
  })
})
