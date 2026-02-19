import { test, expect, type Page, type BrowserContext } from "@playwright/test"

// ---------------------------------------------------------------------------
// E2E: Manual Account Review (no-statement path)
//
// Tests the flow where a preparer adds accounts manually (without uploading
// any bank statements) and enters financial data on the review page.
// ---------------------------------------------------------------------------

const ADMIN_EMAIL = "admin@demo.com"
const ADMIN_PASSWORD = "admin123"

test.setTimeout(120000)

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

test.describe.serial("Manual Account Review", () => {
  let sharedContext: BrowserContext
  let clientUrl: string
  let filingYearUrl: string

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(90000)
    sharedContext = await browser.newContext()
    const page = await sharedContext.newPage()
    await loginAsAdmin(page)

    // Create client with two manual accounts
    clientUrl = await createClient(page, "flow")
    await addAccount(page, "Swiss Bank AG", "CH12345678", "CH")
    await addAccount(page, "UK Bank PLC", "GB98765432", "GB")

    // Create a filing year
    filingYearUrl = await createFilingYear(page, clientUrl, 2024)
    await page.close()
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  test("Review page shows manual entry cards for accounts without statements", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(filingYearUrl + "/review")
      await page.waitForLoadState("networkidle")

      // Should show "Manual Account Review" heading (Case 2: no statements, has accounts)
      await expect(
        page.locator("h3:has-text('Manual Account Review')")
      ).toBeVisible({ timeout: 10000 })

      // Both accounts should be visible
      await expect(page.locator("text=Swiss Bank AG")).toBeVisible()
      await expect(page.locator("text=UK Bank PLC")).toBeVisible()

      // Each card should have a "Maximum Account Value" label
      const amountInputs = page.locator('label:has-text("Maximum Account Value")')
      await expect(amountInputs).toHaveCount(2)

      // Each card should have a currency dropdown
      const currencyDropdowns = page.locator('select[aria-label="Currency code"]')
      await expect(currencyDropdowns).toHaveCount(2)

      // Save buttons should be present
      const saveButtons = page.locator('button:has-text("Save")')
      await expect(saveButtons).toHaveCount(2)
    } finally {
      await page.close()
    }
  })

  test("Save manual amount with USD currency", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(filingYearUrl + "/review")
      await page.waitForLoadState("networkidle")

      // Find the first card (Swiss Bank) and fill in amount
      const firstCard = page.locator("text=Swiss Bank AG").locator("..").locator("..").locator("..")
      // Use the first amount input on the page
      const amountInput = page.locator('input[type="number"]').first()
      await amountInput.fill("50000")

      // Currency should default to USD — keep it
      const firstSaveBtn = page.locator('button:has-text("Save")').first()
      await firstSaveBtn.click()

      // Wait for save — "Saved" banner should appear
      await expect(
        page.locator("text=Saved").first()
      ).toBeVisible({ timeout: 15000 })

      // Should show USD amount
      await expect(
        page.locator("text=$50,000.00 USD").first()
      ).toBeVisible({ timeout: 5000 })
    } finally {
      await page.close()
    }
  })

  test("Save second account with GBP currency", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(filingYearUrl + "/review")
      await page.waitForLoadState("networkidle")

      // First card should show "Saved" (from previous test)
      await expect(
        page.locator("text=Saved").first()
      ).toBeVisible({ timeout: 10000 })

      // Find the second card's inputs (UK Bank PLC)
      // Get all amount inputs — second one should be for UK Bank
      const amountInputs = page.locator('input[type="number"]')
      const secondAmountInput = amountInputs.nth(1)
      await secondAmountInput.fill("25000")

      // Select GBP for the second card
      const currencyDropdowns = page.locator('select[aria-label="Currency code"]')
      await currencyDropdowns.nth(1).selectOption("GBP")

      // Click the second Save button
      const saveButtons = page.locator('button:has-text("Save"), button:has-text("Update")')
      // Find the one that says "Save" (not "Update" which is the first card)
      const secondSaveBtn = page.locator('button:has-text("Save")').first()
      await secondSaveBtn.click()

      // Both cards should now show "Saved"
      const savedBanners = page.locator('[role="status"]:has-text("Saved")')
      await expect(savedBanners).toHaveCount(2, { timeout: 15000 })
    } finally {
      await page.close()
    }
  })

  test("isValueUnknown checkbox disables amount input", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(filingYearUrl + "/review")
      await page.waitForLoadState("networkidle")

      // Find the "Maximum value unknown" checkbox on the first card
      const unknownCheckbox = page.locator('label:has-text("Maximum value unknown")').first()
      await expect(unknownCheckbox).toBeVisible({ timeout: 10000 })

      // Get the first amount input
      const amountInput = page.locator('input[type="number"]').first()

      // Check the checkbox
      await unknownCheckbox.click()

      // Amount input should be disabled
      await expect(amountInput).toBeDisabled()

      // Click Update to save with unknown value
      const updateBtn = page.locator('button:has-text("Update")').first()
      await updateBtn.click()

      // Should still show "Saved"
      await expect(
        page.locator('[role="status"]:has-text("Saved")').first()
      ).toBeVisible({ timeout: 15000 })
    } finally {
      await page.close()
    }
  })

  test("Saved state persists on page reload", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(filingYearUrl + "/review")
      await page.waitForLoadState("networkidle")

      // Both cards should show "Saved" state (green banner) from previous tests
      const savedBanners = page.locator('[role="status"]:has-text("Saved")')
      await expect(savedBanners).toHaveCount(2, { timeout: 10000 })

      // Reload the page
      await page.reload()
      await page.waitForLoadState("networkidle")

      // Saved state should persist (pre-populated from server)
      const savedBannersAfterReload = page.locator('[role="status"]:has-text("Saved")')
      await expect(savedBannersAfterReload).toHaveCount(2, { timeout: 10000 })

      // Buttons should say "Update" (not "Save") since reviews exist
      const updateButtons = page.locator('button:has-text("Update")')
      await expect(updateButtons).toHaveCount(2)
    } finally {
      await page.close()
    }
  })

  test("Submit for Review enabled after all accounts saved", async () => {
    const page = await sharedContext.newPage()
    try {
      // Navigate to the overview page
      await page.goto(filingYearUrl)
      await page.waitForLoadState("networkidle")

      // "Submit for Review" button should be enabled since all accounts are reviewed
      const submitBtn = page.locator('button:has-text("Submit for Review")')
      await expect(submitBtn).toBeVisible({ timeout: 10000 })
      await expect(submitBtn).toBeEnabled({ timeout: 5000 })

      // Click it — should succeed
      await submitBtn.click()

      // Should show success message
      await expect(
        page.locator("text=Successfully submitted for review")
      ).toBeVisible({ timeout: 15000 })

      // Status should update to "Reviewed"
      await expect(page.locator("text=Reviewed")).toBeVisible({ timeout: 10000 })
    } finally {
      await page.close()
    }
  })

  test("Review Accounts quick-link highlights when accounts exist without statements", async () => {
    // This tests a separate fresh client to verify the quick-link UX
    const page = await sharedContext.newPage()
    try {
      await loginAsAdmin(page)
      const newClientUrl = await createClient(page, "quicklink")
      await addAccount(page, "Test Bank for QuickLink", "XX11223344", "DE")
      const newFilingUrl = await createFilingYear(page, newClientUrl, 2024)

      // Navigate to the overview page
      await page.goto(newFilingUrl)
      await page.waitForLoadState("networkidle")

      // "Review Accounts" link should be highlighted (blue, not dimmed)
      const reviewLink = page.locator('a:has-text("Review Accounts")')
      await expect(reviewLink).toBeVisible({ timeout: 10000 })

      // Should NOT have opacity-60 (dimmed) class
      const classes = await reviewLink.getAttribute("class")
      expect(classes).not.toContain("opacity-60")
      expect(classes).toContain("border-blue-300")
    } finally {
      await page.close()
    }
  })
})
