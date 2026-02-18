import { test, expect, type Page, type BrowserContext } from "@playwright/test"

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

test.setTimeout(120000)

/** Ensure the accounts section is expanded. Checks aria-expanded first to avoid toggling closed. */
async function ensureAccountsExpanded(page: import("@playwright/test").Page) {
  const toggle = page.locator('[data-testid="accounts-toggle"]')
  await expect(toggle).toBeVisible({ timeout: 10000 })
  const expanded = await toggle.getAttribute("aria-expanded")
  if (expanded !== "true") {
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-expanded", "true")
  }
}

test.describe.serial("Account CRUD", () => {
  let sharedContext: BrowserContext
  let clientPageUrl: string

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000)
    sharedContext = await browser.newContext()
    const page = await sharedContext.newPage()
    await loginAsAdmin(page)

    // Create a new client for these tests
    const ts = Date.now()
    await page.goto("/clients/new")
    await page.waitForLoadState("networkidle")
    await page.getByPlaceholder("Last name or entity name").fill(`AccountCRUD-${ts}`)
    await page.getByPlaceholder("First name").fill("Test")
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/clients\/[a-f0-9-]+$/, { timeout: 20000 })
    clientPageUrl = page.url()
    await page.close()
  })

  test.afterAll(async () => {
    if (sharedContext) await sharedContext.close()
  })

  test("Add new account", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(clientPageUrl)
      await page.waitForLoadState("networkidle")

      // Accounts section should show "(0)" and be collapsed initially
      const accountsToggle = page.locator('[data-testid="accounts-toggle"]')
      await expect(accountsToggle).toBeVisible({ timeout: 10000 })
      await expect(accountsToggle).toContainText("(0)")
      await ensureAccountsExpanded(page)

      // Verify empty state
      await expect(page.locator("text=No foreign accounts yet")).toBeVisible()

      // Open add form
      await page.click('button:has-text("Add Account")')

      // Fill account details
      await page.fill('input[placeholder="Bank name"]', "Test Bank AG")
      await page.fill(
        'input[placeholder="Account number"]',
        "CH93-0076-2011-6238-5295-7"
      )
      await page.selectOption('select[aria-label="Country"]', "CH")

      // Submit
      await page.click('button[type="submit"]:has-text("Add")')

      // Wait for form to close (Add Account button reappears)
      await expect(page.locator('button:has-text("Add Account")')).toBeVisible(
        { timeout: 10000 }
      )

      // Verify account appears in table
      await expect(page.locator("text=Test Bank AG")).toBeVisible()

      // Verify toggle count updated
      await expect(accountsToggle).toContainText("(1)")
    } finally {
      await page.close()
    }
  })

  test("Cancel add account", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(clientPageUrl)
      await page.waitForLoadState("networkidle")

      // Ensure accounts section is expanded
      await ensureAccountsExpanded(page)

      // Open add form
      await page.click('button:has-text("Add Account")')

      // Fill partial data
      await page.fill('input[placeholder="Bank name"]', "Cancel Bank")

      // Cancel
      await page.click('button:has-text("Cancel")')

      // Verify form closed
      await expect(page.locator('button:has-text("Add Account")')).toBeVisible(
        { timeout: 10000 }
      )

      // Verify "Cancel Bank" does NOT appear
      await expect(page.locator("text=Cancel Bank")).not.toBeVisible()
    } finally {
      await page.close()
    }
  })

  test("Edit account inline", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(clientPageUrl)
      await page.waitForLoadState("networkidle")

      // Ensure accounts section is expanded
      await ensureAccountsExpanded(page)

      // Click edit on Test Bank AG
      await page.click('button[aria-label="Edit account at Test Bank AG"]')

      // Find the edit form container and its institution name input
      const editForm = page
        .locator("div.rounded-md.bg-gray-50")
        .filter({ hasText: "Edit Account" })
      const institutionInput = editForm.locator("input").first()

      // Clear and type new name
      await institutionInput.clear()
      await institutionInput.fill("Updated Bank AG")

      // Save
      await editForm.locator('button:has-text("Save")').click()

      // Wait for edit form to close (indicates save completed)
      await expect(editForm).not.toBeVisible({ timeout: 15000 })

      // Reload and verify persistence
      await page.reload()
      await page.waitForLoadState("networkidle")
      await ensureAccountsExpanded(page)
      await expect(page.locator("text=Updated Bank AG")).toBeVisible()
    } finally {
      await page.close()
    }
  })

  test("Cancel account edit", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(clientPageUrl)
      await page.waitForLoadState("networkidle")

      // Ensure accounts section is expanded
      await ensureAccountsExpanded(page)

      // Click edit on Updated Bank AG
      await page.click('button[aria-label="Edit account at Updated Bank AG"]')

      // Find the edit form and change institution name
      const editForm = page
        .locator("div.rounded-md.bg-gray-50")
        .filter({ hasText: "Edit Account" })
      const institutionInput = editForm.locator("input").first()
      await institutionInput.clear()
      await institutionInput.fill("Should Not Save")

      // Cancel
      await editForm.locator('button:has-text("Cancel")').click()

      // Verify original name persists, changed name does not
      await expect(page.locator("text=Updated Bank AG")).toBeVisible()
      await expect(page.locator("text=Should Not Save")).not.toBeVisible()
    } finally {
      await page.close()
    }
  })

  test("Delete account with confirmation", async () => {
    const page = await sharedContext.newPage()
    try {
      await page.goto(clientPageUrl)
      await page.waitForLoadState("networkidle")

      // Ensure accounts section is expanded
      await ensureAccountsExpanded(page)

      // Click delete on Updated Bank AG
      await page.click(
        'button[aria-label="Delete account at Updated Bank AG"]'
      )

      // Verify confirmation text
      await expect(
        page.locator("text=Delete account at Updated Bank AG?")
      ).toBeVisible()

      // Cancel deletion — account should still be there
      await page.click('button:has-text("Cancel")')
      await expect(page.locator("text=Updated Bank AG")).toBeVisible()

      // Click delete again and confirm this time
      await page.click(
        'button[aria-label="Delete account at Updated Bank AG"]'
      )
      await page.click('button:has-text("Delete")')

      // Verify success alert (exclude Next.js route announcer)
      const alert = page.locator('div[role="alert"]:not(#__next-route-announcer__)')
      await expect(alert).toContainText("Account deleted successfully", {
        timeout: 10000,
      })

      // Verify toggle shows "(0)" again
      const accountsToggle = page.locator('[data-testid="accounts-toggle"]')
      await expect(accountsToggle).toContainText("(0)")
    } finally {
      await page.close()
    }
  })
})
