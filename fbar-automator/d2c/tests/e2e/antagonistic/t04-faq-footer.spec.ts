import { test, expect } from "@playwright/test";

test.use({ baseURL: "http://localhost:3001" });

// Increase timeout — landing page can be slow with Next.js dev server.
// Hydration + client-side navigation on the dev server can take 30-50s.
test.setTimeout(90_000);

const FAQ_ITEMS = [
  {
    question: "What is an FBAR?",
    // Use a snippet unique to the FAQ answer, NOT the Hero h1
    answerSnippet: "must be filed by United States persons",
  },
  {
    question: "When is the FBAR deadline?",
    answerSnippet: "April 15 of each year",
  },
  {
    question: "Is FBAR Direct a government agency?",
    answerSnippet: "FBAR Direct is a private tax technology company",
  },
  {
    question: "How is my data protected?",
    answerSnippet: "bank-grade 256-bit SSL encryption",
  },
  {
    question: "Can I file for previous years?",
    answerSnippet: "select the specific calendar year",
  },
  {
    question: "What happens if my filing is rejected?",
    answerSnippet: "notify you immediately with the specific error code",
  },
];

/**
 * Wait for Next.js client-side hydration to complete on the FAQ section.
 * The FAQ buttons render via SSR with aria-expanded="false", but the
 * React onClick handlers aren't attached until hydration finishes.
 *
 * Strategy: use Playwright's click() on the last FAQ button (which
 * dispatches through React's event delegation), then check if the
 * aria-expanded attribute toggled. If it did, click again to reset.
 * If not, wait and retry.
 */
async function waitForFaqHydration(page: import("@playwright/test").Page) {
  const probeBtn = page.getByRole("button", {
    name: FAQ_ITEMS[FAQ_ITEMS.length - 1].question,
  });

  // Poll until hydration is complete (button click actually toggles state)
  let hydrated = false;
  for (let attempt = 0; attempt < 40 && !hydrated; attempt++) {
    try {
      const before = await probeBtn.getAttribute("aria-expanded");
      await probeBtn.click({ timeout: 3_000 });
      // Short wait for React state update
      await page.waitForTimeout(100);
      const after = await probeBtn.getAttribute("aria-expanded");
      if (before !== after) {
        hydrated = true;
        // Reset to collapsed if we toggled it open
        if (after === "true") {
          await probeBtn.click({ timeout: 3_000 }).catch(() => {});
          await page.waitForTimeout(100);
        }
      } else {
        // Not hydrated yet — wait before retrying
        await page.waitForTimeout(500);
      }
    } catch {
      // Click timed out (e.g., overlay blocking) — wait and retry
      await page.waitForTimeout(500);
    }
  }

  if (!hydrated) {
    throw new Error("FAQ section did not hydrate within timeout");
  }
}

test.describe("FAQ Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Dismiss the sticky DeadlineBanner (sticky top-0 z-50) so it doesn't
    // intercept clicks on FAQ buttons underneath it
    const dismissBtn = page.getByRole("button", {
      name: "Dismiss notification",
    });
    if (await dismissBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await dismissBtn.click();
    }
    // Scope all FAQ checks to the FAQ section to avoid collisions with Hero text
    const section = page.locator("section#faq");
    await section.scrollIntoViewIfNeeded();
    await expect(section).toBeVisible();
    // Wait for React hydration before interacting with FAQ buttons
    await waitForFaqHydration(page);
  });

  test("displays FAQ heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Frequently asked questions" })
    ).toBeVisible();
  });

  test("all FAQ questions are visible and collapsed by default", async ({
    page,
  }) => {
    const section = page.locator("section#faq");
    for (const item of FAQ_ITEMS) {
      const button = page.getByRole("button", { name: item.question });
      await expect(button).toBeVisible();
      await expect(button).toHaveAttribute("aria-expanded", "false");
      // Answer text should NOT be visible when collapsed — scoped to FAQ section
      await expect(section.getByText(item.answerSnippet)).not.toBeVisible();
    }
  });

  test("clicking a question expands its answer", async ({ page }) => {
    const section = page.locator("section#faq");
    for (const item of FAQ_ITEMS) {
      const button = page.getByRole("button", { name: item.question });
      // Scroll button into viewport to avoid sticky banner overlay
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "true");
      await expect(section.getByText(item.answerSnippet)).toBeVisible();
      // Click again to collapse for the next iteration
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(button).toHaveAttribute("aria-expanded", "false");
      await expect(section.getByText(item.answerSnippet)).not.toBeVisible();
    }
  });

  test("multiple FAQ items can be open simultaneously (no accordion collapse)", async ({
    page,
  }) => {
    const section = page.locator("section#faq");
    // The FAQ uses independent state per item, NOT accordion behavior.
    // Opening one item should NOT close another.
    const firstButton = page.getByRole("button", {
      name: FAQ_ITEMS[0].question,
    });
    const secondButton = page.getByRole("button", {
      name: FAQ_ITEMS[1].question,
    });

    // Open first item
    await firstButton.scrollIntoViewIfNeeded();
    await firstButton.click();
    await expect(firstButton).toHaveAttribute("aria-expanded", "true");
    await expect(
      section.getByText(FAQ_ITEMS[0].answerSnippet)
    ).toBeVisible();

    // Open second item
    await secondButton.scrollIntoViewIfNeeded();
    await secondButton.click();
    await expect(secondButton).toHaveAttribute("aria-expanded", "true");
    await expect(
      section.getByText(FAQ_ITEMS[1].answerSnippet)
    ).toBeVisible();

    // First item should STILL be open (independent state)
    await expect(firstButton).toHaveAttribute("aria-expanded", "true");
    await expect(
      section.getByText(FAQ_ITEMS[0].answerSnippet)
    ).toBeVisible();
  });
});

test.describe("Footer Content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const footer = page.locator("footer");
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
  });

  test("footer displays brand name and tagline", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(
      footer.getByRole("heading", { name: "FBAR Direct" })
    ).toBeVisible();
    await expect(
      footer.getByText("Secure, simplified electronic filing")
    ).toBeVisible();
    await expect(
      footer.getByText("FinCEN-Registered BSA E-Filing Institution")
    ).toBeVisible();
  });

  test("footer contains all expected site links", async ({ page }) => {
    const footer = page.locator("footer");
    const expectedLinks = [
      "Who Must File",
      "How to File",
      "Pricing",
      "FAQ",
      "Log In",
      "Privacy Policy",
      "Terms of Service",
    ];
    for (const linkText of expectedLinks) {
      await expect(
        footer.getByRole("link", { name: linkText })
      ).toBeVisible();
    }
  });

  test("footer contains external resource links", async ({ page }) => {
    const footer = page.locator("footer");
    const externalLinks = [
      { name: "FinCEN.gov", href: "https://www.fincen.gov" },
      { name: "IRS FBAR Reference Guide", href: /irs\.gov/ },
      { name: "BSA E-Filing System", href: /bsaefiling\.fincen/ },
    ];
    for (const link of externalLinks) {
      const el = footer.getByRole("link", { name: link.name });
      await expect(el).toBeVisible();
      await expect(el).toHaveAttribute("target", "_blank");
      await expect(el).toHaveAttribute("rel", /noopener/);
    }
  });

  test("footer displays disclaimer and copyright", async ({ page }) => {
    const footer = page.locator("footer");
    await expect(
      footer.getByText("FBAR Direct is not a government agency")
    ).toBeVisible();
    const currentYear = new Date().getFullYear().toString();
    await expect(
      footer.getByText(new RegExp(`${currentYear}`))
    ).toBeVisible();
  });
});

test.describe("Footer Navigation", () => {
  /**
   * Helper: scroll to footer link and click it, retrying if the click
   * doesn't trigger navigation (layout may not be hydrated yet).
   */
  async function clickFooterLink(
    page: import("@playwright/test").Page,
    linkName: string,
    urlPattern: RegExp
  ) {
    const footer = page.locator("footer");
    const link = footer.getByRole("link", { name: linkName });

    // Retry click until navigation happens (hydration may be delayed)
    await expect(async () => {
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await expect(page).toHaveURL(urlPattern, { timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
  }

  test("Privacy Policy link navigates to /privacy with content", async ({
    page,
  }) => {
    test.setTimeout(120_000); // Navigation + hydration on dev server is slow
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clickFooterLink(page, "Privacy Policy", /\/privacy/);
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible();
    await expect(page.getByText("We never sell your data")).toBeVisible();
  });

  test("Terms of Service link navigates to /terms with content", async ({
    page,
  }) => {
    test.setTimeout(120_000); // Navigation + hydration on dev server is slow
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await clickFooterLink(page, "Terms of Service", /\/terms/);
    await expect(
      page.getByRole("heading", { name: "Terms of Service" })
    ).toBeVisible();
    await expect(
      page.getByText("Not affiliated with IRS or FinCEN")
    ).toBeVisible();
  });
});
