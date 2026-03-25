#!/usr/bin/env node
/**
 * Alpine Tax — Update Linear issues: WordPress → Static Site
 */

const API_KEY = process.env.LINEAR_API_KEY || "";
const API_URL = "https://api.linear.app/graphql";

const STATES = {
  backlog: "d5738cd3-57e6-473f-a358-fffa8de65d08",
  todo: "b66afb1e-f444-40a7-8d6b-36b240f604d0",
  canceled: "01872a89-bf69-46b0-8e2b-d3361687c515",
};

// Issue IDs from setup script (AT-key → Linear UUID)
const IDS = {
  "ATM-6":  "f515515f-8e0c-4b9d-a4f7-6b7495273483", // AT-2: was "Purchase GoDaddy WP hosting"
  "ATM-18": "67ca29c6-3a4b-4aae-bf8b-0e5e9e1a7f01", // AT-14: was "Install WordPress + plugins"
  "ATM-19": "ecd8798d-bbe7-4a65-ae69-0995a52ac1eb", // AT-15: was "Build all WordPress pages"
  "ATM-21": "dd85b8d8-828a-48df-a387-6dc02f141017", // AT-17: was "Configure schema via Rank Math"
  "ATM-22": "6e757673-56dd-4693-82e2-5303d39d1eaf", // AT-18: was "Embed Calendly on /schedule/"
  "ATM-24": "009467a0-6dcf-407f-872b-e27d2b13acf1", // AT-20: was "Reconnect GA4 + Facebook Pixel"
  "ATM-26": "20e22996-425a-4b76-8936-e2682b7144de", // AT-22: was "Configure 301 redirects"
  "ATM-27": "186f42ac-5308-4289-8235-31a734279a44", // AT-23: was "Go live: DNS cutover"
  "ATM-28": "1e710c08-2c41-4c3e-94af-9febd4657f01", // AT-24: was "Post-launch verification"
  "ATM-49": "a39927c8-e663-456a-ba1b-554bcdb842a5", // AT-45: was "Research WordPress theme customization"
};

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: API_KEY },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("GQL Error:", JSON.stringify(json.errors, null, 2));
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

async function updateIssue(id, input) {
  return gql(
    `mutation($id: String!, $input: IssueUpdateInput!) {
      issueUpdate(id: $id, input: $input) { success issue { identifier title } }
    }`,
    { id, input }
  );
}

async function main() {
  console.log("=== Updating Linear: WordPress → Static Site ===\n");

  // ── CANCEL: ATM-6 (GoDaddy WP hosting) ──
  console.log("CANCEL: ATM-6 — Purchase GoDaddy Managed WordPress hosting");
  await updateIssue(IDS["ATM-6"], {
    stateId: STATES.canceled,
    title: "[CANCELED] Purchase GoDaddy Managed WordPress hosting",
    description: "**Canceled** — switched to static site approach (Next.js/Astro). No hosting cost needed; deploying to Vercel/Cloudflare Pages for free.",
  });

  // ── CANCEL: ATM-49 (WP theme research) ──
  console.log("CANCEL: ATM-49 — Research WordPress theme customization");
  await updateIssue(IDS["ATM-49"], {
    stateId: STATES.canceled,
    title: "[CANCELED] Research WordPress theme customization for tax practice",
    description: "**Canceled** — no longer using WordPress. Design system is code-based (Tailwind + component library).",
  });

  // ── REWRITE: ATM-18 (was WP install → Scaffold static site) ──
  console.log("REWRITE: ATM-18 — Scaffold static site in monorepo");
  await updateIssue(IDS["ATM-18"], {
    title: "Scaffold static site in monorepo",
    stateId: STATES.todo, // Unblocked — can start immediately
    description: `Set up the Alpine Tax website as a static site in \`alpinetax/\` within the atmix monorepo.

**Stack decision** (pick one):
- **Next.js 14** — already proven in fbar-automator/d2c, SSG export, familiar
- **Astro** — built for content sites, faster builds, simpler mental model

**Setup checklist:**
- [ ] Initialize project (\`package.json\`, framework config)
- [ ] Tailwind CSS + design tokens (Mountain blue #1B4965, Teal #2A9D8F, Terracotta #E76F51 CTAs, DM Sans headings, Inter body)
- [ ] Layout component (header, footer, nav)
- [ ] MDX support for blog posts
- [ ] SEO component (meta tags, OG, canonical)
- [ ] Structured data components (ProfessionalService, FAQPage, Article, BreadcrumbList)
- [ ] Contact form (static form service or API route)
- [ ] Deploy pipeline to Vercel or Cloudflare Pages
- [ ] Environment variables for GA4, Facebook Pixel

**No longer blocked by hosting purchase.** Can start immediately.

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-19 (was Build WP pages → Build all site pages) ──
  console.log("REWRITE: ATM-19 — Build all site pages as components");
  await updateIssue(IDS["ATM-19"], {
    title: "Build all site pages as components",
    description: `Build 22-25 pages using the static site framework from ATM-18. Use copy from ATM-11 through ATM-17.

**Design system:**
- Mountain blue (#1B4965), Teal (#2A9D8F), Terracotta (#E76F51) CTAs
- DM Sans headings, Inter body
- Card-based service tiles
- Alternating white/light-gray sections
- Mobile-first responsive

**Pages:**
- Homepage, About, Services overview + 5 individual, Pricing
- FAQ, Contact, Client Portal, Reviews
- 7 service-area pages (Denver, Aurora, Lakewood, Centennial, Littleton, Highlands Ranch, Virtual)
- Blog index + individual post template
- Schedule (Calendly embed)

Blocked by: ATM-11 through ATM-17 (copy), ATM-18 (scaffold), ATM-20 (headshot).

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-21 (was Rank Math schema → Implement structured data in code) ──
  console.log("REWRITE: ATM-21 — Implement structured data in code");
  await updateIssue(IDS["ATM-21"], {
    title: "Implement structured data in code",
    description: `Build reusable structured data components (JSON-LD) baked into the site code. No plugins needed.

**Schema types:**
- \`ProfessionalService\` — sitewide (every page via layout)
- \`FAQPage\` — FAQ page + each service page with Q&A
- \`Article\` — blog posts (auto-generated from frontmatter)
- \`BreadcrumbList\` — all pages (auto-generated from route structure)
- \`LocalBusiness\` — homepage

**Approach:** Create a \`<StructuredData />\` component that accepts schema type + data props. Each page template passes the right schema.

Validate with Google Rich Results Test after build.

Blocked by: ATM-18 (scaffold).

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-22 (was Calendly embed via WP → Calendly component) ──
  console.log("REWRITE: ATM-22 — Add Calendly embed component");
  await updateIssue(IDS["ATM-22"], {
    title: "Add Calendly embed component",
    description: `Create a \`<CalendlyEmbed />\` component for the /schedule page.

Use Calendly's inline embed script or their React component (\`react-calendly\` package).

Blocked by: ATM-18 (scaffold), ATM-23 (Vinnie's Calendly account).

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-24 (was GA4/Pixel via plugins → Analytics via env vars) ──
  console.log("REWRITE: ATM-24 — Configure analytics via env vars");
  await updateIssue(IDS["ATM-24"], {
    title: "Configure GA4 + Facebook Pixel via env vars",
    description: `Add analytics tracking baked into the site code, controlled by environment variables.

**GA4**: \`G-BF2FDR6KMM\`
- Add \`<Script>\` tag for gtag.js in layout
- Env var: \`NEXT_PUBLIC_GA4_ID\` (or equivalent)

**Facebook Pixel**: \`282429905966327\`
- Add pixel base code in layout
- Env var: \`NEXT_PUBLIC_FB_PIXEL_ID\`

**Cookie consent**: Add a simple consent banner (same pattern as fbar-automator/d2c — Google Consent Mode v2).

Verify both fire in their respective dashboards after deploy.

Blocked by: ATM-18 (scaffold).

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-26 (was 301 redirects via Rank Math → redirects in config) ──
  console.log("REWRITE: ATM-26 — Configure redirects in site config");
  await updateIssue(IDS["ATM-26"], {
    title: "Configure 301 redirects in site config",
    description: `Add redirects from old GoDaddy URL patterns to new paths.

**Next.js** — \`next.config.js\` redirects array:
**Astro** — \`_redirects\` file or adapter config

| Old URL | New URL |
|---------|---------|
| /services-%26-fees | /pricing/ |
| /schedule-a-meeting | /schedule/ |
| /contact | /contact/ |
| /client-portal | /client-portal/ |

Blocked by: ATM-18 (scaffold).

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-27 (was DNS cutover to GoDaddy WP → DNS to Vercel/CF) ──
  console.log("REWRITE: ATM-27 — Go live: DNS to Vercel/Cloudflare Pages");
  await updateIssue(IDS["ATM-27"], {
    title: "Go live: DNS cutover to Vercel/Cloudflare Pages",
    description: `Point alpinetax.co DNS to the static site host.

**Steps:**
1. Add custom domain in Vercel/Cloudflare Pages dashboard
2. Update DNS records at registrar (CNAME or A records)
3. SSL is automatic (Vercel/Cloudflare handle this)
4. Submit sitemap.xml to Google Search Console
5. Verify all pages load correctly on production domain

**Only after Vinnie approves copy (ATM-25) and redirects are configured (ATM-26).**

**Owner**: Matt`,
  });

  // ── REWRITE: ATM-28 (post-launch verification — remove WP-specific items) ──
  console.log("REWRITE: ATM-28 — Post-launch verification checklist");
  await updateIssue(IDS["ATM-28"], {
    title: "Post-launch verification checklist",
    description: `Verify all items after go-live:

- [ ] Mobile rendering (Chrome DevTools device emulation)
- [ ] Lighthouse scores (target: 95+ across all categories)
- [ ] Contact form sends email with all fields
- [ ] Calendly booking flow works end-to-end
- [ ] Client Portal link opens TaxDome
- [ ] Schema validation passes (Google Rich Results Test)
- [ ] GA4 pageviews visible in Realtime report
- [ ] Facebook Pixel events visible in Events Manager
- [ ] All 301 redirects verified (old URLs → new)
- [ ] Sitemap submitted to Google Search Console
- [ ] Monitor 404s for 1 week via Search Console
- [ ] RSS feed works for blog (if applicable)
- [ ] OG/social meta tags render correctly (use ogimage.dev or similar)

Blocked by: ATM-27 (site is live).

**Owner**: Matt`,
  });

  console.log("\n=== All updates complete ===");
  console.log("Canceled: ATM-6, ATM-49");
  console.log("Rewritten: ATM-18, ATM-19, ATM-21, ATM-22, ATM-24, ATM-26, ATM-27, ATM-28");
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
