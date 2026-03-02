import { test, expect } from "@playwright/test";

// IMPLEMENTATION NEEDED: P7-3 will create blog pages at:
//   - /blog (index page listing all posts)
//   - /blog/[slug] (individual blog post pages)
// These are marketing/content pages — no authentication required.
// Blog content may be static MDX, CMS-driven, or generated at build time.

test.describe("P7-3: Blog Pages", () => {
  test.describe("Blog Index Page", () => {
    test("P7-3: blog index page loads at /blog", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Page should load without error (not 404, not redirect)
      expect(page.url()).toContain("/blog");

      // Should have a visible heading
      const h1 = page.locator("h1");
      await expect(h1).toBeVisible();
    });

    test("P7-3: blog index displays a list of posts", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Blog index should contain at least one post link/card
      // Posts are typically rendered as links, cards, or article elements
      const postLinks = page.locator("article, [data-testid='blog-post'], a[href*='/blog/']");
      const count = await postLinks.count();

      expect(count).toBeGreaterThanOrEqual(1);
    });

    test("P7-3: blog index has proper SEO metadata", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Page should have a <title> tag
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      // Title should reference blog or FBAR
      expect(title.toLowerCase()).toMatch(/blog|fbar|filing/);

      // Should have a meta description
      const metaDescription = await page.getAttribute(
        'meta[name="description"]',
        "content"
      );
      expect(metaDescription).not.toBeNull();
      expect(metaDescription!.length).toBeGreaterThan(20);
    });

    test("P7-3: blog index has proper heading structure", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Should have exactly one h1
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBe(1);
    });
  });

  test.describe("Individual Blog Post Page", () => {
    test("P7-3: individual blog post page loads with content", async ({ page }) => {
      // First, navigate to the blog index to find a post slug
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Find the first blog post link
      const firstPostLink = page.locator("a[href*='/blog/']").first();
      const href = await firstPostLink.getAttribute("href");
      expect(href).not.toBeNull();

      // Navigate to the individual post (Next.js Link does soft navigation)
      await firstPostLink.click();
      await page.waitForURL(/\/blog\/.+/);

      // URL should be /blog/[slug]
      expect(page.url()).toMatch(/\/blog\/.+/);

      // Post should have a title (h1)
      const h1 = page.locator("h1").first();
      await expect(h1).toBeVisible();
      const titleText = await h1.textContent();
      expect(titleText!.length).toBeGreaterThan(0);
    });

    test("P7-3: blog post contains title, date, and body content", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Navigate to first post
      const firstPostLink = page.locator("a[href*='/blog/']").first();
      await firstPostLink.click();
      await page.waitForLoadState("load");

      // Title
      const title = page.locator("h1").first();
      await expect(title).toBeVisible();

      // Date — look for a time element or text matching date patterns
      const dateElement = page.locator("time, [data-testid='post-date'], [datetime]");
      await expect(dateElement.first()).toBeVisible();

      // Body content — there should be paragraph text
      const paragraphs = page.locator("article p, main p, .prose p");
      const pCount = await paragraphs.count();
      expect(pCount).toBeGreaterThanOrEqual(1);
    });

    test("P7-3: blog post has proper heading structure", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      const firstPostLink = page.locator("a[href*='/blog/']").first();
      await firstPostLink.click();
      await page.waitForLoadState("load");

      // Should have at least one visible h1 (layout may add a hidden one)
      const h1Count = await page.locator("h1").count();
      expect(h1Count).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe("Blog Navigation", () => {
    test("P7-3: clicking a post on index navigates to the post page", async ({ page }) => {
      await page.goto("/blog");
      await page.waitForLoadState("load");

      // Get the first post's title text for verification
      const firstPostLink = page.locator("a[href*='/blog/']").first();
      const linkHref = await firstPostLink.getAttribute("href");
      expect(linkHref).not.toBeNull();

      // Click the post (Next.js Link does soft navigation)
      await firstPostLink.click();
      await page.waitForURL(`**${linkHref!}`);

      // Should have navigated to the post URL
      expect(page.url()).toContain(linkHref!);

      // Post page should have a heading
      await expect(page.locator("h1").first()).toBeVisible();
    });

    test("P7-3: 404 for non-existent blog post", async ({ page }) => {
      const response = await page.goto("/blog/this-post-does-not-exist-12345");

      // Should return 404 status or show a "not found" message
      if (response) {
        // Either 404 status or a soft 404 page
        const status = response.status();
        if (status === 404) {
          expect(status).toBe(404);
        } else {
          // Soft 404 — page renders but shows "not found" message
          const body = await page.textContent("body");
          expect(body!.toLowerCase()).toMatch(/not found|404|doesn't exist|does not exist/);
        }
      }
    });
  });
});
