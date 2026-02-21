import { test, expect, type Page, type BrowserContext } from "@playwright/test"

// ---------------------------------------------------------------------------
// E2E: Treasury Exchange Rates
//
// Validates:
//  1. Exchange Rates settings page (year dropdown, sync, rate table)
//  2. Currency conversion during manual account review using Treasury rates
//  3. Manual rate override for currencies without Treasury data
//
// All tests hit the live Treasury API — nothing is mocked.
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"

test.setTimeout(120_000)

// ---------------------------------------------------------------------------
// Helpers (copied verbatim from manual-account-review.spec.ts)
// ---------------------------------------------------------------------------

async function loginAsAdmin(page: Page) {
  await page.goto("/login")
  await page.waitForLoadState("networkidle")
  await page.fill('input[name="email"]', ADMIN_EMAIL)
  await page.fill('input[name="password"]', ADMIN_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL("/", { timeout: 20000 })
}

/** Create a fresh client and return its URL path (/clients/<id>) */
async function createClient(page: Page, suffix: string): Promise<string> {
  const ts = Date.now()
  await page.goto("/clients/new")
  await page.waitForLoadState("networkidle")
  await page.getByPlaceholder("Last name or entity name").fill(`ManualReview-${suffix}-${ts}`)
  await page.getByPlaceholder("First name").fill("Test")
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 20000 })
  return page.url()
}

/** Expand the accounts section if not already expanded */
async function ensureAccountsExpanded(page: Page) {
  const toggle = page.locator('[data-testid="accounts-toggle"]')
  await expect(toggle).toBeVisible({ timeout: 10000 })
  const expanded = await toggle.getAttribute("aria-expanded")
  if (expanded !== "true") {
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
  }
}

/** Add a foreign account to the current client page */
async function addAccount(
  page: Page,
  bankName: string,
  accountNumber: string,
  country: string
) {
  await ensureAccountsExpanded(page)
  await page.click('button:has-text("Add Account")')
  await page.fill('input[placeholder="Bank name"]', bankName)
  await page.fill('input[placeholder="Account number"]', accountNumber)
  await page.selectOption('select[aria-label="Country"]', country)
  await page.click('button[type="submit"]:has-text("Add")')
  // Wait for form to close
  await expect(page.locator('button:has-text("Add Account")')).toBeVisible({
    timeout: 10000,
  })
}

/** Create a filing year for the current client and return the overview URL */
async function createFilingYear(
  page: Page,
  clientUrl: string,
  year: number
): Promise<string> {
  await page.goto(clientUrl)
  await page.waitForLoadState("networkidle")
  await page.click("text=Add Year")
  const yearInput = page.locator('input[type="number"]')
  await yearInput.clear()
  await yearInput.fill(year.toString())
  await page.click('button:has-text("Create")')
  await page.waitForURL(new RegExp(`/clients/[^/]+/${year}`), { timeout: 10000 })
  return page.url()
}

// ---------------------------------------------------------------------------
// New helper: capture a Treasury exchange rate from the settings page table
// ---------------------------------------------------------------------------

/**
 * Read the rate for a given currency code from the exchange rates table.
 *
 * Table structure (exchange-rates/page.tsx lines 146-154):
 *   td[0] = currencyCode (font-mono)
 *   td[1] = countryName
 *   td[2] = rate.toFixed(4) (right-aligned, font-mono)
 */
async function captureRateFromTable(page: Page, currencyCode: string): Promise<number> {
  const row = page.locator(`tr:has(td:text-is("${currencyCode}"))`)
  const rateCell = row.locator("td").nth(2)
  const rateText = await rateCell.textContent()
  return parseFloat(rateText!.trim())
}

// ===========================================================================
// Group 1: Exchange Rates Settings Page
// ===========================================================================

test.describe.serial("Exchange Rates Settings Page", () => {
  let sharedContext: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    sharedContext = await browser.newContext()
    page = await sharedContext.newPage()
    await loginAsAdmin(page)
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  // -------------------------------------------------------------------------
  // Test 1: Page loads with previous calendar year as default
  // -------------------------------------------------------------------------
  test("loads with correct default year", async () => {
    await page.goto("/settings/exchange-rates")
    await page.waitForLoadState("networkidle")

    const expectedYear = new Date().getFullYear() - 1

    // Year dropdown should default to the previous calendar year
    const yearDropdown = page.getByLabel("Select year")
    await expect(yearDropdown).toBeVisible({ timeout: 10000 })
    await expect(yearDropdown).toHaveValue(expectedYear.toString())

    // Subtitle should mention "Dec 31 rates"
    await expect(
      page.locator("text=Dec 31 rates")
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 2: Year dropdown has 5 options and current year is present but not
  //          selected
  // -------------------------------------------------------------------------
  test("year dropdown has 5 options with current year present but not selected", async () => {
    const yearDropdown = page.getByLabel("Select year")
    const options = yearDropdown.locator("option")

    // Should have exactly 5 year options
    await expect(options).toHaveCount(5)

    // Current year exists as an option
    const currentYear = new Date().getFullYear()
    const currentYearOption = yearDropdown.locator(`option[value="${currentYear}"]`)
    await expect(currentYearOption).toBeAttached()

    // Selected value should be previous year, not current year
    const selectedValue = await yearDropdown.inputValue()
    expect(parseInt(selectedValue, 10)).toBe(currentYear - 1)
  })

  // -------------------------------------------------------------------------
  // Test 3: Sync rates populates the table with live Treasury data
  // -------------------------------------------------------------------------
  test("syncing rates populates table with live Treasury data", async () => {
    // Select 2024 to have a known historical year
    const yearDropdown = page.getByLabel("Select year")
    await yearDropdown.selectOption("2024")
    await page.waitForLoadState("networkidle")

    // Click "Sync Rates"
    await page.click('button:has-text("Sync Rates")')

    // Wait for the success alert
    const successAlert = page.locator('[role="alert"]:has-text("Successfully synced")')
    await expect(successAlert).toBeVisible({ timeout: 30000 })

    // EUR, GBP, and JPY rows should be visible in the table
    await expect(page.locator('tr:has(td:text-is("EUR"))')).toBeVisible()
    await expect(page.locator('tr:has(td:text-is("GBP"))')).toBeVisible()
    await expect(page.locator('tr:has(td:text-is("JPY"))')).toBeVisible()

    // The "X rates loaded" footer should show > 50 rates
    const ratesLoadedText = page.locator("text=/\\d+ rates? loaded/")
    await expect(ratesLoadedText).toBeVisible()
    const loadedText = await ratesLoadedText.textContent()
    const rateCount = parseInt(loadedText!.match(/(\d+)/)?.[1] ?? "0", 10)
    expect(rateCount).toBeGreaterThan(50)
  })

  // -------------------------------------------------------------------------
  // Test 4: Changing year loads different data
  // -------------------------------------------------------------------------
  test("changing year loads different data", async () => {
    // Switch to 2023 — this clears the stale syncMessage from the previous test
    const yearDropdown = page.getByLabel("Select year")
    await yearDropdown.selectOption("2023")
    await page.waitForLoadState("networkidle")

    // Verify heading already shows 2023
    await expect(page.locator("text=Rates for 2023")).toBeVisible({ timeout: 5000 })

    // Ensure any stale sync alert from the previous test is gone
    await expect(
      page.locator('[role="alert"]:has-text("Successfully synced")')
    ).not.toBeVisible({ timeout: 5000 })

    // Click Sync Rates
    await page.click('button:has-text("Sync Rates")')

    // Wait for the NEW success alert for 2023
    await expect(
      page.locator('[role="alert"]:has-text("Successfully synced")')
    ).toBeVisible({ timeout: 30000 })

    // Verify the alert mentions 2023
    await expect(
      page.locator('[role="alert"]:has-text("for 2023")')
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 5: Rate table row structure is correct
  // -------------------------------------------------------------------------
  test("rate table shows correct structure", async () => {
    // Ensure we have 2023 data loaded from the previous test
    const eurRow = page.locator('tr:has(td:text-is("EUR"))')
    await expect(eurRow).toBeVisible()

    const cells = eurRow.locator("td")

    // td[0]: currency code should be "EUR"
    const codeCell = await cells.nth(0).textContent()
    expect(codeCell!.trim()).toBe("EUR")

    // td[1]: country name should be a non-empty string
    const countryCell = await cells.nth(1).textContent()
    expect(countryCell!.trim().length).toBeGreaterThan(0)

    // td[2]: rate should match the format X.XXXX (digits, dot, 4 decimals)
    const rateCell = await cells.nth(2).textContent()
    expect(rateCell!.trim()).toMatch(/^\d+\.\d{4}$/)
  })
})

// ===========================================================================
// Group 2: Treasury Currency Conversion Flow
// ===========================================================================

test.describe.serial("Treasury Currency Conversion Flow", () => {
  let sharedContext: BrowserContext
  let page: Page
  let clientUrl: string
  let filingYearUrl: string
  let eurRate: number
  let gbpRate: number

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    sharedContext = await browser.newContext()
    page = await sharedContext.newPage()
    await loginAsAdmin(page)

    // --- Sync Treasury rates for 2024 and capture EUR / GBP ----------------
    await page.goto("/settings/exchange-rates")
    await page.waitForLoadState("networkidle")

    const yearDropdown = page.getByLabel("Select year")
    await yearDropdown.selectOption("2024")
    await page.waitForLoadState("networkidle")

    await page.click('button:has-text("Sync Rates")')
    await expect(
      page.locator('[role="alert"]:has-text("Successfully synced")')
    ).toBeVisible({ timeout: 30000 })

    eurRate = await captureRateFromTable(page, "EUR")
    gbpRate = await captureRateFromTable(page, "GBP")

    // --- Create a client with three accounts --------------------------------
    clientUrl = await createClient(page, "treasury-test")
    await ensureAccountsExpanded(page)
    await addAccount(page, "Deutsche Bank", "DE123456", "DE")
    await addAccount(page, "HSBC London", "GB789012", "GB")
    await addAccount(page, "US National Bank", "US345678", "US")

    // --- Create filing year 2024 and navigate to the review page ------------
    filingYearUrl = await createFilingYear(page, clientUrl, 2024)
    await page.goto(filingYearUrl + "/review")
    await page.waitForLoadState("networkidle")
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  // -------------------------------------------------------------------------
  // Test 6: Review page shows manual entry cards
  // -------------------------------------------------------------------------
  test("review page shows manual entry cards", async () => {
    // Should show "Manual Account Review" heading (Case 2: no statements)
    await expect(
      page.locator("h3:has-text('Manual Account Review')")
    ).toBeVisible({ timeout: 10000 })

    // Three currency dropdowns — one per account
    const currencyDropdowns = page.locator('select[aria-label="Currency code"]')
    await expect(currencyDropdowns).toHaveCount(3)

    // Three Save buttons
    const saveButtons = page.locator('button:has-text("Save")')
    await expect(saveButtons).toHaveCount(3)
  })

  // -------------------------------------------------------------------------
  // Test 7: USD account saves with rate = 1 (no conversion)
  // -------------------------------------------------------------------------
  test("USD account saves with rate=1", async () => {
    // Scope to the US National Bank card via data-testid
    const usCard = page.locator('[data-testid="review-card-us-national-bank"]')
    const amountInput = usCard.locator('input[type="number"]')
    const currencyDropdown = usCard.locator('select[aria-label="Currency code"]')
    const saveBtn = usCard.locator('button:has-text("Save")')

    await amountInput.fill("50000")
    await currencyDropdown.selectOption("USD")

    // Intercept the POST response
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts/") &&
        resp.url().includes("/review") &&
        resp.request().method() === "POST"
    )
    await saveBtn.click()
    const response = await responsePromise
    const data = await response.json()

    // Exchange rate should be exactly 1 for USD
    expect(parseFloat(data.exchangeRate)).toBe(1)
    expect(data.exchangeRateSource).toBe("TREASURY")

    // maxValueUsd should be $50,000
    const maxValueUsd = parseFloat(data.maxValueUsd)
    expect(maxValueUsd).toBeCloseTo(50000, 2)

    // Card should display the saved USD value
    await expect(usCard.locator("text=$50,000")).toBeVisible({ timeout: 10000 })
  })

  // -------------------------------------------------------------------------
  // Test 8: EUR account converts using the Treasury Dec 31 rate
  // -------------------------------------------------------------------------
  test("EUR account converts using Treasury Dec 31 rate", async () => {
    // Scope to the Deutsche Bank card via data-testid
    const eurCard = page.locator('[data-testid="review-card-deutsche-bank"]')
    const amountInput = eurCard.locator('input[type="number"]')
    const currencyDropdown = eurCard.locator('select[aria-label="Currency code"]')
    const saveBtn = eurCard.locator('button:has-text("Save")')

    await amountInput.fill("10000")
    await currencyDropdown.selectOption("EUR")

    // Intercept the POST response
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts/") &&
        resp.url().includes("/review") &&
        resp.request().method() === "POST"
    )
    await saveBtn.click()
    const response = await responsePromise
    const data = await response.json()

    // Exchange rate should match the captured EUR Treasury rate
    const returnedRate = parseFloat(data.exchangeRate)
    expect(Math.abs(returnedRate - eurRate)).toBeLessThan(0.0001)

    // maxValueUsd should be 10000 / eurRate
    const expectedUsd = 10000 / eurRate
    const actualUsd = parseFloat(data.maxValueUsd)
    expect(Math.abs(actualUsd - expectedUsd)).toBeLessThan(0.01)
  })

  // -------------------------------------------------------------------------
  // Test 9: GBP account converts using the Treasury rate
  // -------------------------------------------------------------------------
  test("GBP account converts using Treasury rate", async () => {
    // Scope to the HSBC London card via data-testid
    const gbpCard = page.locator('[data-testid="review-card-hsbc-london"]')
    const amountInput = gbpCard.locator('input[type="number"]')
    const currencyDropdown = gbpCard.locator('select[aria-label="Currency code"]')
    const saveBtn = gbpCard.locator('button:has-text("Save")')

    await amountInput.fill("25000")
    await currencyDropdown.selectOption("GBP")

    // Intercept the POST response
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts/") &&
        resp.url().includes("/review") &&
        resp.request().method() === "POST"
    )
    await saveBtn.click()
    const response = await responsePromise
    const data = await response.json()

    // Exchange rate should match the captured GBP Treasury rate
    const returnedRate = parseFloat(data.exchangeRate)
    expect(Math.abs(returnedRate - gbpRate)).toBeLessThan(0.0001)

    // maxValueUsd should be 25000 / gbpRate
    const expectedUsd = 25000 / gbpRate
    const actualUsd = parseFloat(data.maxValueUsd)
    expect(Math.abs(actualUsd - expectedUsd)).toBeLessThan(0.01)
  })

  // -------------------------------------------------------------------------
  // Test 10: Export page shows Treasury rate attribution
  // -------------------------------------------------------------------------
  test("export page shows conversion attribution", async () => {
    // Navigate to the export page for this filing year
    await page.goto(filingYearUrl + "/export")
    await page.waitForLoadState("networkidle")

    // The export page should display "Treasury Dec 31, 2024" attribution
    // for accounts that used Treasury rates (see export/page.tsx line 239)
    await expect(
      page.locator("text=Treasury Dec 31, 2024").first()
    ).toBeVisible({ timeout: 15000 })
  })
})

// ===========================================================================
// Group 3: Manual Rate Override
// ===========================================================================

test.describe.serial("Manual Rate Override", () => {
  let sharedContext: BrowserContext
  let page: Page
  let clientUrl: string
  let filingYearUrl: string

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(120_000)
    sharedContext = await browser.newContext()
    page = await sharedContext.newPage()
    await loginAsAdmin(page)

    // Create a client with a Mexican account
    clientUrl = await createClient(page, "manual-rate-test")
    await ensureAccountsExpanded(page)
    await addAccount(page, "Banco Test", "MX123456", "MX")

    // Use a future year to guarantee no Treasury rates exist
    const futureYear = new Date().getFullYear() + 1
    filingYearUrl = await createFilingYear(page, clientUrl, futureYear)

    // Navigate to the filing year's review page
    await page.goto(filingYearUrl + "/review")
    await page.waitForLoadState("networkidle")
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  // -------------------------------------------------------------------------
  // Test 11: Missing Treasury rate triggers the manual rate entry UI
  // -------------------------------------------------------------------------
  test("missing Treasury rate triggers manual rate entry UI", async () => {
    // Scope to the Banco Test card via data-testid
    const card = page.locator('[data-testid="review-card-banco-test"]')
    const amountInput = card.locator('input[type="number"]')
    const currencyDropdown = card.locator('select[aria-label="Currency code"]')
    const saveBtn = card.locator('button:has-text("Save")')

    // Fill amount and select MXN
    await amountInput.fill("50000")
    await currencyDropdown.selectOption("MXN")

    // Click Save — the API should return 422 because no Treasury rate exists
    await saveBtn.click()

    // Error alert should appear with "No exchange rate found"
    await expect(
      card.locator('[role="alert"]:has-text("No exchange rate found")')
    ).toBeVisible({ timeout: 15000 })

    // The yellow "Manual Exchange Rate Required" fieldset should become visible
    const manualRateFieldset = card.locator("fieldset:has-text('Manual Exchange Rate Required')")
    await expect(manualRateFieldset).toBeVisible()

    // Manual rate input and justification input should be visible
    await expect(
      card.locator('input[placeholder="e.g. 1.08"]')
    ).toBeVisible()
    await expect(
      card.locator('input[placeholder="Source of exchange rate"]')
    ).toBeVisible()
  })

  // -------------------------------------------------------------------------
  // Test 12: Submitting a manual rate saves successfully
  // -------------------------------------------------------------------------
  test("submitting manual rate saves successfully", async () => {
    // The card and manual rate UI should still be visible from the previous test
    const card = page.locator('[data-testid="review-card-banco-test"]')

    // Fill in the manual exchange rate and justification
    const manualRateInput = card.locator('input[placeholder="e.g. 1.08"]')
    await manualRateInput.fill("17.2")

    const justificationInput = card.locator('input[placeholder="Source of exchange rate"]')
    await justificationInput.fill("Year-end rate from Banco de Mexico")

    // Find the Save/Update button in this card
    const saveBtn = card.locator('button:has-text("Save"), button:has-text("Update")').first()

    // Intercept the POST response
    const responsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes("/api/accounts/") &&
        resp.url().includes("/review") &&
        resp.request().method() === "POST"
    )
    await saveBtn.click()
    const response = await responsePromise
    const data = await response.json()

    // Source should be MANUAL
    expect(data.exchangeRateSource).toBe("MANUAL")

    // Rate should be 17.2
    const returnedRate = parseFloat(data.exchangeRate)
    expect(returnedRate).toBeCloseTo(17.2, 4)

    // maxValueUsd should be 50000 / 17.2
    const expectedUsd = 50000 / 17.2
    const actualUsd = parseFloat(data.maxValueUsd)
    expect(Math.abs(actualUsd - expectedUsd)).toBeLessThan(0.01)

    // Success banner should appear ("Saved" status)
    await expect(
      card.locator('[role="status"]:has-text("Saved")')
    ).toBeVisible({ timeout: 15000 })
  })
})
