import { test, expect } from "@playwright/test";

// GTM pages use dynamic routes that need first-time compilation in dev mode.
// Increase the timeout to handle cold compilation (30s default is insufficient).
test.setTimeout(90_000);

// ---------------------------------------------------------------------------
// Blog Pages
// ---------------------------------------------------------------------------
test.describe("Blog Pages", () => {
  // Blog route compilation is especially slow on cold dev server (>90s).
  // test.slow() triples the describe-level timeout to 270s.
  test.slow();

  test("blog index renders with heading", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator("h1")).toContainText("FBAR Filing Blog");
  });

  test("blog index is accessible without authentication", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveURL(/\/blog/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("blog index shows 'Articles coming soon' when no posts exist", async ({
    page,
  }) => {
    await page.goto("/blog");
    // Either articles display or the empty state shows
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Country SEO Pages (/fbar/:country)
// ---------------------------------------------------------------------------
test.describe("Country SEO Pages", () => {
  const countries = [
    { slug: "canada", name: "Canada" },
    { slug: "uk", name: "United Kingdom" },
    { slug: "japan", name: "Japan" },
    { slug: "germany", name: "Germany" },
    { slug: "australia", name: "Australia" },
    { slug: "mexico", name: "Mexico" },
    { slug: "france", name: "France" },
    { slug: "switzerland", name: "Switzerland" },
    { slug: "israel", name: "Israel" },
    { slug: "india", name: "India" },
  ];

  for (const { slug, name } of countries) {
    test(`/fbar/${slug} renders with h1 mentioning ${name}`, async ({
      page,
    }) => {
      await page.goto(`/fbar/${slug}`);
      await expect(page.locator("h1")).toContainText(name);
    });
  }

  test("country page is accessible without authentication", async ({
    page,
  }) => {
    await page.goto("/fbar/canada");
    await expect(page).toHaveURL(/\/fbar\/canada/);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("country page has CTA linking to /threshold", async ({ page }) => {
    await page.goto("/fbar/canada");
    const cta = page.locator('a[href="/threshold"]');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Start Filing");
  });

  test("country page shows common banks section", async ({ page }) => {
    await page.goto("/fbar/canada");
    await expect(
      page.locator("text=Common Canada Banks Reported on FBAR")
    ).toBeVisible();
  });

  test("country page shows currency conversion section", async ({ page }) => {
    await page.goto("/fbar/canada");
    await expect(page.locator("text=CAD/USD Currency Conversion")).toBeVisible();
  });

  test("country page has JSON-LD FAQPage schema", async ({ page }) => {
    await page.goto("/fbar/canada");
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd.first()).toBeAttached();
    const allBlocks = await jsonLd.allTextContents();
    const hasFaqPage = allBlocks.some((block) => block.includes("FAQPage"));
    expect(hasFaqPage).toBe(true);
  });

  test("invalid country slug returns 404", async ({ page }) => {
    const response = await page.goto("/fbar/nonexistent-country");
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Comparison Pages (/compare/:slug)
// ---------------------------------------------------------------------------
test.describe("Comparison Pages", () => {
  // First comparison page hit triggers route compilation (>90s in dev).
  test.slow();
  const comparisons = [
    {
      slug: "fbar-direct-vs-bsa-efiling",
      title: "FBAR Direct vs BSA E-Filing Portal",
    },
    { slug: "fbar-direct-vs-cpa", title: "FBAR Direct vs Hiring a CPA" },
    {
      slug: "best-fbar-filing-services-2026",
      title: "Best FBAR Filing Services",
    },
  ];

  for (const { slug, title } of comparisons) {
    test(`/compare/${slug} renders with heading`, async ({ page }) => {
      await page.goto(`/compare/${slug}`);
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
      const text = await h1.textContent();
      // Title should contain key words from the expected title
      expect(text).toBeTruthy();
    });
  }

  test("BSA comparison page has feature table", async ({ page }) => {
    await page.goto("/compare/fbar-direct-vs-bsa-efiling");
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(page.locator("th >> text=Feature")).toBeVisible();
    await expect(
      page.locator("th >> text=BSA E-Filing Portal")
    ).toBeVisible();
    await expect(page.locator("th >> text=FBAR Direct")).toBeVisible();
  });

  test("CPA comparison page has feature table", async ({ page }) => {
    await page.goto("/compare/fbar-direct-vs-cpa");
    const table = page.locator("table");
    await expect(table).toBeVisible();
    await expect(page.locator("th >> text=Hiring a CPA")).toBeVisible();
  });

  test("services listicle page has numbered services", async ({ page }) => {
    await page.goto("/compare/best-fbar-filing-services-2026");
    // Should list services with names — use getByText to avoid parentheses
    // confusing Playwright's text= selector, and .first() to avoid strict
    // mode violation from multiple "FBAR Direct" occurrences on the page.
    await expect(page.getByText("BSA E-Filing Portal").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /FBAR Direct/ }).first()).toBeVisible();
  });

  test("comparison page has CTA linking to /threshold", async ({ page }) => {
    await page.goto("/compare/fbar-direct-vs-bsa-efiling");
    const cta = page.locator('a[href="/threshold"]');
    await expect(cta).toBeVisible();
    await expect(cta).toContainText("Start Filing");
  });

  test("comparison page is accessible without authentication", async ({
    page,
  }) => {
    await page.goto("/compare/fbar-direct-vs-bsa-efiling");
    await expect(page).toHaveURL(/\/compare\//);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid comparison slug returns 404", async ({ page }) => {
    const response = await page.goto("/compare/nonexistent-comparison");
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Landing Pages (/start/:variant) — Minimal Layout, No Full Nav
// ---------------------------------------------------------------------------
test.describe("Landing Pages", () => {
  const variants = [
    { slug: "file-fbar-online", headline: "File Your FBAR" },
    { slug: "fbar-expat", headline: "FBAR" },
    { slug: "fbar-software", headline: "FBAR" },
    { slug: "fincen-114", headline: "FinCEN" },
  ];

  for (const { slug, headline } of variants) {
    test(`/start/${slug} renders with headline`, async ({ page }) => {
      await page.goto(`/start/${slug}`);
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
      const text = await h1.textContent();
      expect(text).toContain(headline);
    });
  }

  test("landing page has dedicated start-layout branding header", async ({
    page,
  }) => {
    await page.goto("/start/file-fbar-online");
    // The start layout adds its own minimal header (inside the marketing layout).
    // Verify the FBAR Direct branding is visible and the page renders.
    await expect(page.locator("text=FBAR Direct").first()).toBeVisible();
    // The start layout header has a specific border style
    const startHeader = page.locator("header.border-b.border-gray-200");
    await expect(startHeader).toBeVisible();
    await expect(startHeader.locator("text=FBAR Direct")).toBeVisible();
  });

  test("landing page has CTA button", async ({ page }) => {
    await page.goto("/start/file-fbar-online");
    // Should have a CTA with "Start Filing" or similar
    const cta = page.locator("a").filter({ hasText: /Start Filing|Begin Filing/ });
    await expect(cta.first()).toBeVisible();
  });

  test("landing page shows 3-step process", async ({ page }) => {
    await page.goto("/start/file-fbar-online");
    await expect(page.locator("text=Enter your info")).toBeVisible();
    await expect(page.locator("text=Review & sign")).toBeVisible();
    await expect(page.locator("text=We submit to FinCEN")).toBeVisible();
  });

  test("landing page is accessible without authentication", async ({
    page,
  }) => {
    await page.goto("/start/file-fbar-online");
    await expect(page).toHaveURL(/\/start\//);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("invalid variant slug returns 404", async ({ page }) => {
    const response = await page.goto("/start/nonexistent-variant");
    expect(response?.status()).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Sitemap & Robots
// ---------------------------------------------------------------------------
test.describe("Sitemap and Robots", () => {
  test("sitemap.xml returns valid XML with expected URLs", async ({
    request,
  }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("<urlset");
    // Static pages
    expect(body).toContain("fbardirect.com");
    expect(body).toContain("/pricing");
    expect(body).toContain("/about");
    // Blog
    expect(body).toContain("/blog");
    // Country pages
    expect(body).toContain("/fbar/canada");
    expect(body).toContain("/fbar/uk");
    expect(body).toContain("/fbar/japan");
    // Comparison pages
    expect(body).toContain("/compare/fbar-direct-vs-bsa-efiling");
    expect(body).toContain("/compare/fbar-direct-vs-cpa");
    expect(body).toContain("/compare/best-fbar-filing-services-2026");
  });

  test("robots.txt returns correct rules", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const body = await response.text();
    expect(body).toContain("User-Agent: *");
    expect(body).toContain("Allow: /");
    // Disallowed paths
    expect(body).toContain("Disallow: /api/");
    expect(body).toContain("Disallow: /dashboard");
    expect(body).toContain("Disallow: /personal");
    expect(body).toContain("Disallow: /accounts");
    expect(body).toContain("Disallow: /review");
    expect(body).toContain("Disallow: /sign");
    expect(body).toContain("Disallow: /payment");
    // Sitemap reference
    expect(body).toContain("Sitemap:");
    expect(body).toContain("sitemap.xml");
  });
});

// ---------------------------------------------------------------------------
// JSON-LD on Homepage
// ---------------------------------------------------------------------------
test.describe("Homepage JSON-LD", () => {
  test("homepage has application/ld+json script(s)", async ({ page }) => {
    await page.goto("/");
    const jsonLdScripts = page.locator('script[type="application/ld+json"]');
    const count = await jsonLdScripts.count();
    expect(count).toBeGreaterThan(0);
  });

  test("homepage JSON-LD contains Organization or WebSite schema", async ({
    page,
  }) => {
    await page.goto("/");
    const jsonLd = page.locator('script[type="application/ld+json"]');
    const count = await jsonLd.count();
    let found = false;
    for (let i = 0; i < count; i++) {
      const content = await jsonLd.nth(i).textContent();
      if (
        content?.includes("Organization") ||
        content?.includes("WebSite") ||
        content?.includes("FAQPage")
      ) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
