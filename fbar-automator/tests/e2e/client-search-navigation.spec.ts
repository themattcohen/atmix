import { test, expect, type Page } from "@playwright/test"

test.setTimeout(120000)

const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"
let authCookies: any[] = []

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("/", { timeout: 20000 })
}

async function createClient(page: Page, lastName: string): Promise<string> {
  await page.goto("/clients/new")
  await page.waitForLoadState("networkidle")
  await page.getByPlaceholder("Last name or entity name").fill(lastName)
  await page.getByPlaceholder("First name").fill("Test")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 30000 })
  return lastName
}

async function createFilingYear(page: Page, year: string) {
  await page.getByText("Add Year").click()
  await expect(page.getByText("New Filing Year")).toBeVisible({ timeout: 5000 })
  const yearInput = page.locator('input[type="number"]')
  await yearInput.fill(year)
  await page.getByRole("button", { name: "Create" }).click()
  await page.waitForURL(new RegExp(`/clients/[a-f0-9-]+/${year}`), {
    timeout: 15000,
  })
}

test.describe("Client Search & Navigation", () => {
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    await loginAsAdmin(page)
    const state = await context.storageState()
    authCookies = state.cookies
    await context.close()
  })

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authCookies)
  })

  test("Search filters clients", async ({ page }) => {
    const ts = Date.now()
    const alphaName = `SearchAlpha-${ts}`
    const betaName = `SearchBeta-${ts}`

    // Create two clients with distinct names
    await createClient(page, alphaName)
    await createClient(page, betaName)

    // Navigate to clients list and search for alpha
    await page.goto("/clients")
    await page.waitForLoadState("networkidle")
    await page.fill('input[name="search"]', "SearchAlpha")
    await page.press('input[name="search"]', "Enter")
    await page.waitForLoadState("networkidle")

    // Alpha should be visible, Beta should not
    await expect(page.getByText(alphaName)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(betaName)).not.toBeVisible()
  })

  test("Non-matching search shows empty", async ({ page }) => {
    await page.goto("/clients")
    await page.waitForLoadState("networkidle")
    await page.fill('input[name="search"]', "zzz-nonexistent-xyz-9999")
    await page.press('input[name="search"]', "Enter")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByText("No clients found matching")
    ).toBeVisible({ timeout: 10000 })
  })

  test("Back link from upload page via Overview tab", async ({ page }) => {
    const ts = Date.now()
    await createClient(page, `NavBack-${ts}`)

    // Now on the client detail page — create a filing year
    await createFilingYear(page, "2024")

    // We should be on /clients/{id}/2024 (overview)
    await page.waitForLoadState("networkidle")
    const overviewUrl = page.url()
    expect(overviewUrl).toMatch(/\/clients\/[a-f0-9-]+\/2024$/)

    // Navigate to upload via the filing year tabs
    const uploadTab = page.locator('nav[aria-label="Filing year tabs"] a', { hasText: "Upload" })
    await expect(uploadTab).toBeVisible({ timeout: 10000 })
    await uploadTab.click()
    await page.waitForURL(/\/upload/, { timeout: 20000 })
    expect(page.url()).toContain("/upload")

    // Navigate back to overview via the Overview tab
    await page.waitForLoadState("networkidle")
    const overviewTab = page.locator('nav[aria-label="Filing year tabs"] a', { hasText: "Overview" })
    await expect(overviewTab).toBeVisible({ timeout: 10000 })
    await overviewTab.click()
    await page.waitForURL(/\/clients\/[a-f0-9-]+\/2024$/, { timeout: 20000 })
    expect(page.url()).not.toContain("/upload")
  })

  test("Review page empty state CTA", async ({ page }) => {
    const ts = Date.now()
    await createClient(page, `ReviewCTA-${ts}`)

    // Create a filing year
    await createFilingYear(page, "2024")

    // Navigate to the review tab
    await page.waitForLoadState("networkidle")
    const reviewTab = page.locator('nav[aria-label="Filing year tabs"] a', { hasText: "Review" })
    await expect(reviewTab).toBeVisible({ timeout: 10000 })
    await reviewTab.click()
    await page.waitForURL(/\/review/, { timeout: 20000 })

    // Verify empty state text
    await expect(
      page.getByText("No accounts yet")
    ).toBeVisible({ timeout: 10000 })

    // Verify "Go to Upload" link and click it
    const goToUpload = page.getByText("Go to Upload")
    await expect(goToUpload).toBeVisible()
    await goToUpload.click()
    await page.waitForURL(/\/upload/, { timeout: 20000 })
    expect(page.url()).toContain("/upload")
  })
})
