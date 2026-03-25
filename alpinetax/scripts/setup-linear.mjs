#!/usr/bin/env node
/**
 * Alpine Tax — Linear Setup Script
 * Creates all projects, labels, issues, and dependencies in the Atmix team.
 */

const API_KEY = process.env.LINEAR_API_KEY || "";
const TEAM_ID = "6732838a-f0c8-4503-9ee2-c8f4f15d0723";
const API_URL = "https://api.linear.app/graphql";

// Workflow state IDs (Atmix team)
const STATES = {
  backlog: "d5738cd3-57e6-473f-a358-fffa8de65d08",
  todo: "b66afb1e-f444-40a7-8d6b-36b240f604d0",
  inProgress: "66f2242a-a231-46b1-93e2-d7a85462efed",
  inReview: "6668fc2f-7b56-4979-8319-c1993940908b",
  done: "ced58fcf-e2b2-4b7e-a34e-9df84ff74153",
  canceled: "01872a89-bf69-46b0-8e2b-d3361687c515",
};

// Priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low
const PRI = { urgent: 1, high: 2, medium: 3, low: 4 };

async function gql(query, variables = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    console.error("GQL Error:", JSON.stringify(json.errors, null, 2));
    throw new Error(json.errors[0].message);
  }
  return json.data;
}

// Rate limit helper — Linear allows ~400 req/min for basic, but let's be safe
let callCount = 0;
async function throttledGql(query, variables = {}) {
  callCount++;
  if (callCount % 20 === 0) {
    await new Promise((r) => setTimeout(r, 1500));
  }
  return gql(query, variables);
}

// ─────────────────────────────────────────────
// STEP 0: Cancel onboarding issues
// ─────────────────────────────────────────────
async function cancelOnboardingIssues() {
  console.log("\n=== Step 0: Canceling onboarding issues ===");
  const onboardingIds = [
    "f3f8c32e-39de-4709-b491-872665c0bcef", // ATM-3
    "f260def2-01e1-4836-b1d8-1448b512deea", // ATM-2
    "d2baa9b8-e5de-4ea7-bc1f-d971b2afb282", // ATM-4
    "31de9168-b5e3-4e2b-a5f8-2c43533e2d0f", // ATM-1
  ];
  for (const id of onboardingIds) {
    await throttledGql(
      `mutation($id: String!, $stateId: String!) {
        issueUpdate(id: $id, input: { stateId: $stateId }) { success }
      }`,
      { id, stateId: STATES.canceled }
    );
  }
  console.log("  Canceled 4 onboarding issues");
}

// ─────────────────────────────────────────────
// STEP 1: Create "Blocked" workflow state
// ─────────────────────────────────────────────
async function createBlockedState() {
  console.log("\n=== Step 1: Creating Blocked workflow state ===");
  try {
    const data = await throttledGql(
      `mutation($teamId: String!, $name: String!, $type: String!, $color: String!) {
        workflowStateCreate(input: { teamId: $teamId, name: $name, type: $type, color: $color, position: 1001 }) {
          success workflowState { id name }
        }
      }`,
      { teamId: TEAM_ID, name: "Blocked", type: "started", color: "#eb5757" }
    );
    const id = data.workflowStateCreate.workflowState.id;
    console.log(`  Created Blocked state: ${id}`);
    return id;
  } catch (e) {
    console.log("  Blocked state may already exist, continuing...");
    return null;
  }
}

// ─────────────────────────────────────────────
// STEP 2: Create labels
// ─────────────────────────────────────────────
async function createLabels() {
  console.log("\n=== Step 2: Creating labels ===");
  const labelDefs = [
    { name: "Website", color: "#4ea7fc" },
    { name: "SEO", color: "#26b5ce" },
    { name: "Content", color: "#7c3aed" },
    { name: "GBP", color: "#f59e0b" },
    { name: "Reviews", color: "#10b981" },
    { name: "Citations", color: "#6366f1" },
    { name: "EA-Transition", color: "#8b5cf6" },
    { name: "Infrastructure", color: "#6b7280" },
    { name: "Vinnie-Action", color: "#ef4444" },
    { name: "Claude-Drafts", color: "#3b82f6" },
    { name: "Matt-Setup", color: "#f97316" },
  ];

  const labels = {};
  for (const l of labelDefs) {
    try {
      const data = await throttledGql(
        `mutation($teamId: String!, $name: String!, $color: String!) {
          issueLabelCreate(input: { teamId: $teamId, name: $name, color: $color }) {
            success issueLabel { id name }
          }
        }`,
        { teamId: TEAM_ID, name: l.name, color: l.color }
      );
      labels[l.name] = data.issueLabelCreate.issueLabel.id;
      console.log(`  Created label: ${l.name} (${labels[l.name]})`);
    } catch (e) {
      console.log(`  Label ${l.name} may exist, checking...`);
      // Try to find existing
      const existing = await throttledGql(
        `{ issueLabels(filter: { team: { id: { eq: "${TEAM_ID}" } }, name: { eq: "${l.name}" } }) { nodes { id name } } }`
      );
      if (existing.issueLabels.nodes.length > 0) {
        labels[l.name] = existing.issueLabels.nodes[0].id;
        console.log(`  Found existing: ${l.name} (${labels[l.name]})`);
      }
    }
  }
  return labels;
}

// ─────────────────────────────────────────────
// STEP 3: Create projects
// ─────────────────────────────────────────────
async function createProjects() {
  console.log("\n=== Step 3: Creating projects ===");
  const projectDefs = [
    {
      name: "Website Rebuild",
      desc: "WordPress migration to GoDaddy Managed WP — all pages, copy, design, launch. Target: Month 1-2.",
    },
    {
      name: "Google Business Profile",
      desc: "GBP creation, optimization, photos, posting calendar. Target: Week 1-3.",
    },
    {
      name: "Local SEO & Citations",
      desc: "75+ directory citations, NAP consistency, AFSP enrollment, BrightLocal. Target: Month 1-6.",
    },
    {
      name: "Review Generation",
      desc: "TaxDome automation, personal asks, review response templates. Target: 120+ reviews over 12 months.",
    },
    {
      name: "Content Strategy",
      desc: "S-Corp pillar article, blog calendar, 24 posts/year target. Target: Month 1-12.",
    },
    {
      name: "Link Building",
      desc: "HARO, Chamber of Commerce, BBB, linkable assets for domain authority. Target: Month 2-12.",
    },
    {
      name: "EA Transition",
      desc: "Same-day credential update playbook for when Vinnie passes the SEE exam.",
    },
  ];

  const projects = {};
  for (const p of projectDefs) {
    const data = await throttledGql(
      `mutation($name: String!, $teamIds: [String!]!, $desc: String) {
        projectCreate(input: { name: $name, teamIds: $teamIds, description: $desc }) {
          success project { id name }
        }
      }`,
      { name: p.name, teamIds: [TEAM_ID], desc: p.desc }
    );
    projects[p.name] = data.projectCreate.project.id;
    console.log(`  Created project: ${p.name} (${projects[p.name]})`);
  }
  return projects;
}

// ─────────────────────────────────────────────
// STEP 4: Create all 51 issues
// ─────────────────────────────────────────────
async function createIssues(projects, labels) {
  console.log("\n=== Step 4: Creating 51 issues ===");

  // Helper to create issue and return its ID
  async function createIssue(opts) {
    const input = {
      teamId: TEAM_ID,
      title: opts.title,
      description: opts.description || "",
      priority: opts.priority || 0,
      stateId: opts.stateId || STATES.backlog,
      labelIds: opts.labelIds || [],
    };
    if (opts.projectId) input.projectId = opts.projectId;

    const data = await throttledGql(
      `mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success issue { id identifier title }
        }
      }`,
      { input }
    );
    const issue = data.issueCreate.issue;
    console.log(`  ${issue.identifier}: ${issue.title}`);
    return issue.id;
  }

  const P = projects;
  const L = labels;
  const ids = {};

  // ── Project 1: Website Rebuild ──

  // Phase: Pre-Migration
  ids["AT-1"] = await createIssue({
    title: "Screenshot & document current GoDaddy site",
    description: `Screenshot all 5 pages of the current alpinetax.co site. Save all text content, download images, document DNS records.\n\nCapture:\n- GA4 ID: G-BF2FDR6KMM\n- Facebook Pixel: 282429905966327\n- Current page URLs and structure\n- All copy text\n- All images\n\n**Owner**: Matt`,
    priority: PRI.urgent,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-2"] = await createIssue({
    title: "Purchase GoDaddy Managed WordPress hosting",
    description: `Purchase GoDaddy Managed WordPress Basic plan (~$9/mo).\n\n**IMPORTANT**: Do NOT cancel the existing site until migration is complete and verified.\n\n**Owner**: Matt`,
    priority: PRI.urgent,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-3"] = await createIssue({
    title: "Vinnie: confirm business phone number for NAP",
    description: `This phone number goes on EVERY citation, GBP listing, and website page. Must be the same everywhere.\n\nConfirm the exact number that should be used as the permanent business phone. This is a critical blocker for multiple downstream tasks.\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Vinnie-Action"], L["Citations"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-4"] = await createIssue({
    title: "Vinnie: confirm business hours",
    description: `Provide standard business hours + tax season extended hours (Jan-Apr).\n\nFormat needed:\n- Regular hours (May-Dec)\n- Tax season hours (Jan-Apr)\n- Any by-appointment-only notes\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Vinnie-Action"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-5"] = await createIssue({
    title: "Create NAP master document",
    description: `Finalize \`alpinetax/claudedocs/nap-master.md\` with confirmed phone, hours, and all business details.\n\nThis is the **single source of truth** for:\n- Business name (exact spelling)\n- Address (for citations that require it)\n- Phone number\n- Hours\n- Website URL\n- Email\n- All social profile URLs\n\nBlocked by: confirmed phone number.\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Citations"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-6"] = await createIssue({
    title: "Vinnie: provide bio details for About page",
    description: `Needed for the About page copy:\n\n- Year started in tax preparation\n- Approximate number of returns filed\n- Personal story / why tax preparation\n- Philosophy on client service\n- Any specializations to highlight (S-Corp, small business, etc.)\n- Education / relevant background\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Vinnie-Action"], L["Content"]],
    projectId: P["Website Rebuild"],
  });

  // Phase: Copy Drafting
  ids["AT-7"] = await createIssue({
    title: "Draft homepage copy",
    description: `800-1200 words. Include:\n- Hero headline with trust signals\n- 3-step process section\n- Service highlights (card-based)\n- Testimonial placeholders\n- Blog preview section\n- Strong CTA\n\nFollow credential rules — NO CPA language. See copy-bank.md for requirements.\n\nBlocked by: AT-1 (need current site screenshots for reference).\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-8"] = await createIssue({
    title: "Draft services overview + 5 service page copies",
    description: `Services overview (500-700 words) + individual pages (400-600 each):\n\n1. **Individual Tax Prep** — who it's for, what's included, process, 2-3 FAQ\n2. **Small Business Tax Prep** — same structure\n3. **S-Corp/Partnership** — same structure\n4. **Tax Planning** — same structure\n5. **IRS Representation** — stub until EA credential\n\nEach page needs: who it's for, what's included, process, 2-3 FAQ with schema, CTA.\n\nNO CPA language anywhere.\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-9"] = await createIssue({
    title: "Draft pricing page copy",
    description: `400-600 words. Published pricing:\n- $600 individual (1040)\n- $850 MFJ\n- $2,000 business\n\nInclude:\n- What's included at each tier\n- Complexity notes / add-on pricing\n- "No surprises" messaging\n- CTA to schedule consultation\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-10"] = await createIssue({
    title: "Draft FAQ page copy",
    description: `800-1200 words. 15-20 questions organized by category:\n- Filing questions\n- Pricing questions\n- Process questions\n- S-Corp questions\n- Virtual/remote service questions\n\nAll with FAQPage schema markup notes. Answers should be concise and linkable to relevant service pages.\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-11"] = await createIssue({
    title: "Draft About page copy",
    description: `600-900 words. Include:\n- Vinnie's story and experience\n- Credentials (carefully worded — NO CPA claims)\n- Philosophy on client service\n- Headshot placement area\n- Personal touches / Denver connection\n\nBlocked by: AT-6 (Vinnie's bio details).\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-12"] = await createIssue({
    title: "Draft 7 service-area page copies",
    description: `400-500 words EACH, UNIQUE content per city (NOT find-and-replace):\n\n1. Denver\n2. Aurora\n3. Lakewood\n4. Centennial\n5. Littleton\n6. Highlands Ranch\n7. Virtual / Remote\n\nEach needs:\n- Local flavor and relevant city stats\n- Why Alpine Tax serves this area\n- Link to services\n- Local SEO keywords naturally integrated\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"], L["SEO"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-13"] = await createIssue({
    title: "Draft contact, client-portal, reviews page copy",
    description: `Three pages:\n\n**Contact** (300-400 words): Form fields spec, map placeholder, business info, hours.\n\n**Client Portal** (150-200 words): TaxDome explainer + direct link to portal.\n\n**Reviews** (200-300 words): Testimonial placeholders + Google review CTA button.\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Website Rebuild"],
  });

  // Phase: WordPress Build
  ids["AT-14"] = await createIssue({
    title: "Install WordPress + Kadence + all plugins",
    description: `On GoDaddy Managed WordPress. Install:\n- Kadence theme + Kadence Blocks\n- Rank Math (free)\n- WPForms Lite\n- Site Kit by Google\n- Wordfence\n- UpdraftPlus\n\nConfigure Rank Math with business info from NAP master document.\nCheck GoDaddy server type for caching plugin compatibility (WP Rocket vs LiteSpeed).\n\nBlocked by: AT-2 (hosting), AT-5 (NAP master).\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-15"] = await createIssue({
    title: "Build all WordPress pages",
    description: `Build 22-25 pages using Kadence Blocks in Gutenberg. Use copy from AT-7 through AT-13.\n\nDesign direction:\n- Mountain blue (#1B4965)\n- Teal (#2A9D8F)\n- Terracotta (#E76F51) for CTAs\n- DM Sans headings, Inter body\n- Card-based service tiles\n- Alternating white/light-gray sections\n\nBlocked by: AT-7, AT-8, AT-9, AT-10, AT-11, AT-12, AT-13, AT-14, AT-16 (headshot).\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-16"] = await createIssue({
    title: "Vinnie: get professional headshot",
    description: `Business casual, well-lit, smiling. This is the #1 trust signal on the website and GBP.\n\nBudget: $150-300.\n\nNeeded for:\n- About page\n- GBP profile photo\n- Schema markup person image\n\n**Owner**: Vinnie`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Vinnie-Action"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-17"] = await createIssue({
    title: "Configure schema markup via Rank Math",
    description: `Set up structured data:\n- ProfessionalService (sitewide)\n- FAQPage (FAQ page + each service page)\n- Article (blog posts)\n- BreadcrumbList (all pages)\n\nAll via Rank Math free tier settings.\n\nBlocked by: AT-14 (WordPress installed).\n\n**Owner**: Matt`,
    priority: PRI.medium,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["SEO"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-18"] = await createIssue({
    title: "Embed Calendly on /schedule/ page",
    description: `Inline embed (not popup). Use Calendly's embed code in a Kadence HTML block.\n\nBlocked by: AT-14 (WordPress), AT-19 (Vinnie's Calendly account).\n\n**Owner**: Matt`,
    priority: PRI.medium,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-19"] = await createIssue({
    title: "Vinnie: set up Calendly + connect to Zoom",
    description: `Steps:\n1. Create Calendly account (free tier, 1 event type is enough)\n2. Create a "Tax Consultation" event type (30 min)\n3. Connect to Zoom for auto-generated meeting links\n4. Check if TaxDome has native Calendly integration (or if Zapier needed)\n\n**Owner**: Vinnie`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Vinnie-Action"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-20"] = await createIssue({
    title: "Reconnect GA4 + Facebook Pixel",
    description: `After WordPress migration:\n\n**GA4**: G-BF2FDR6KMM — install via Site Kit by Google plugin.\n**Facebook Pixel**: 282429905966327 — install via Rank Math code injection (header scripts).\n\nVerify both fire correctly in their respective dashboards (GA4 Realtime, FB Events Manager).\n\nBlocked by: AT-14 (WordPress installed).\n\n**Owner**: Matt`,
    priority: PRI.medium,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  // Phase: Review & Launch
  ids["AT-21"] = await createIssue({
    title: "Vinnie: review and approve all website copy",
    description: `Review EVERY page for:\n- Factual accuracy\n- Tone and voice\n- Credential compliance (NO CPA/accountant claims)\n- Pricing accuracy\n- Service descriptions\n\nFlag anything that sounds like CPA/accountant claims. Approve or request specific changes.\n\nBlocked by: AT-15 (all pages built).\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Vinnie-Action"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-22"] = await createIssue({
    title: "Configure 301 redirects",
    description: `Via Rank Math Redirections module:\n\n| Old URL | New URL |\n|---------|----------|\n| /services-%26-fees | /pricing/ |\n| /schedule-a-meeting | /schedule/ |\n| /contact | /contact/ |\n| /client-portal | /client-portal/ |\n\nBlocked by: AT-14 (WordPress + Rank Math installed).\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["SEO"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-23"] = await createIssue({
    title: "Go live: DNS cutover + SSL verification",
    description: `Steps:\n1. Point alpinetax.co DNS to new WordPress hosting IP\n2. Verify SSL certificate is active\n3. Submit sitemap.xml to Google Search Console\n4. Verify all pages load correctly\n\n**ONLY after Vinnie approves copy (AT-21) and redirects are configured (AT-22).**\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  ids["AT-24"] = await createIssue({
    title: "Post-launch verification checklist",
    description: `Verify all items:\n- [ ] Mobile rendering (Chrome DevTools device emulation)\n- [ ] Contact form sends email with all fields\n- [ ] Calendly booking flow works end-to-end\n- [ ] Client Portal link opens TaxDome\n- [ ] Schema validation passes (Rich Results Test)\n- [ ] Rank Math SEO audit shows green\n- [ ] GA4 pageviews visible in Realtime report\n- [ ] Facebook Pixel events visible in Events Manager\n- [ ] All 301 redirects verified (old URLs → new)\n- [ ] Monitor 404s for 1 week via Search Console\n\nBlocked by: AT-23 (site is live).\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Website"], L["Matt-Setup"]],
    projectId: P["Website Rebuild"],
  });

  // ── Project 2: Google Business Profile ──

  ids["AT-25"] = await createIssue({
    title: "Vinnie: provide home address for GBP verification",
    description: `Denver metro home address needed for Google Business Profile verification.\n\n**Will be used for verification ONLY** — hidden from public (Service Area Business model). Will NOT appear in search results.\n\nThis is a critical blocker for GBP registration.\n\n**Owner**: Vinnie`,
    priority: PRI.urgent,
    stateId: STATES.todo,
    labelIds: [L["GBP"], L["Vinnie-Action"]],
    projectId: P["Google Business Profile"],
  });

  ids["AT-26"] = await createIssue({
    title: "Draft GBP description — 750 chars",
    description: `Write a 750-character Google Business Profile description.\n\nRequirements:\n- Lead with "Denver" + core services + experience\n- Mention S-Corp/partnership specialization\n- Note virtual meetings via Zoom availability\n- NO CPA language\n- Must be exactly 750 chars or less (GBP limit)\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["GBP"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Google Business Profile"],
  });

  ids["AT-27"] = await createIssue({
    title: "Vinnie: collect 3-5 client testimonials with permission",
    description: `Reach out to satisfied clients for written testimonials.\n\nRequirements:\n- Written permission from each client\n- First name + last initial + service type\n- Will use on website Reviews page and possibly GBP\n- Target: 3-5 testimonials minimum\n\n**Owner**: Vinnie`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Reviews"], L["Vinnie-Action"]],
    projectId: P["Google Business Profile"],
  });

  ids["AT-28"] = await createIssue({
    title: "Research Calendly-TaxDome-Zoom integration steps",
    description: `Document exact steps for Vinnie to connect all three systems:\n\n1. Calendly ↔ Zoom integration steps\n2. Check if TaxDome has native Calendly integration\n3. If not, document Zapier workflow alternative\n4. Note any costs (Zapier tier needed, etc.)\n\nSave to alpinetax/claudedocs/.\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Claude-Drafts"]],
    projectId: P["Google Business Profile"],
  });

  ids["AT-29"] = await createIssue({
    title: "Vinnie: take 10-15 GBP photos",
    description: `Photos needed for GBP listing:\n- Professional headshot (reuse from AT-16)\n- Business logo\n- At-work photos (desk, dual monitors, working)\n- 3-4 Denver landmark/scenery photos\n\nMinimum 10 photos, 15 preferred. Good lighting, high resolution.\n\n**Owner**: Vinnie`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["GBP"], L["Vinnie-Action"]],
    projectId: P["Google Business Profile"],
  });

  ids["AT-30"] = await createIssue({
    title: "Register Google Business Profile",
    description: `Register at business.google.com as Service Area Business (SAB).\n\nSettings:\n- Use Vinnie's home address (AT-25) — hidden from public\n- Primary category: **Tax Preparation Service**\n- Secondary: Tax Consultant, Accountant, Financial Consultant\n- **DO NOT use "CPA" category**\n- Service areas: Denver, Aurora, Lakewood, Centennial, Littleton, Englewood, Greenwood Village, Highlands Ranch\n- Phone from NAP master (AT-5)\n- Description from AT-26\n\nBlocked by: AT-25, AT-5, AT-3, AT-26.\n\n**Owner**: Matt`,
    priority: PRI.urgent,
    stateId: STATES.backlog,
    labelIds: [L["GBP"], L["Matt-Setup"]],
    projectId: P["Google Business Profile"],
  });

  ids["AT-31"] = await createIssue({
    title: "Upload GBP photos + first week of posts",
    description: `After GBP is registered and verified:\n\n1. Upload all photos from AT-29 + headshot from AT-16\n2. Create first 3-4 GBP posts:\n   - Tax deadline reminder\n   - Availability / booking CTA\n   - S-Corp tip\n   - Denver-focused post\n\nBlocked by: AT-30, AT-29, AT-16.\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["GBP"], L["Matt-Setup"]],
    projectId: P["Google Business Profile"],
  });

  // ── Project 3: Local SEO & Citations ──

  ids["AT-32"] = await createIssue({
    title: "Vinnie: enroll in AFSP course",
    description: `Annual Filing Season Program (AFSP).\n\n- Cost: ~$100-200\n- Time: 18 hours CE, completable in 1-2 weeks\n- Gets listed in IRS Return Preparer Directory\n- Provides limited representation rights\n- Strong credibility signal before EA exam\n\nThis is a prerequisite for IRS Directory citation.\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Citations"], L["Vinnie-Action"], L["SEO"]],
    projectId: P["Local SEO & Citations"],
  });

  ids["AT-33"] = await createIssue({
    title: "Create citation tracker with all target directories",
    description: `Verify/create \`alpinetax/claudedocs/citation-tracker.md\` with all 30+ directories across 4 phases:\n\n**Phase 1** (Week 1-2): Google, Yelp, Facebook, Apple, Bing, YP.com\n**Phase 2** (Week 3-4): Data aggregators (Data Axle, Neustar, Foursquare, Factual)\n**Phase 3** (Month 2-3): Industry (IRS Directory, TaxDome Advisor, Thumbtack, BBB, Chamber)\n**Phase 4** (Month 3-6): General directories (Manta, Hotfrog, Cylex, etc.)\n\nAdd any missing directories. Target: 100+ total.\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Citations"], L["Claude-Drafts"]],
    projectId: P["Local SEO & Citations"],
  });

  ids["AT-34"] = await createIssue({
    title: "Set up BrightLocal or Whitespark",
    description: `Citation tracking + local rank tracking platform.\n\n- BrightLocal: ~$29-39/mo\n- Whitespark: alternative pricing\n\nConfigure for Alpine Tax NAP monitoring. Set up local rank tracking for target keywords.\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Citations"], L["SEO"], L["Matt-Setup"]],
    projectId: P["Local SEO & Citations"],
  });

  ids["AT-35"] = await createIssue({
    title: "Submit Phase 1 citations — Week 1-2",
    description: `Submit to core directories:\n- Google (covered by AT-30)\n- Yelp\n- Facebook Business Page\n- Apple Business Connect\n- Bing Places\n- YP.com\n\n**All must match NAP master exactly.** Any discrepancy hurts local SEO.\n\nBlocked by: AT-5 (NAP master), AT-30 (GBP).\n\n**Owner**: Matt`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Citations"], L["Matt-Setup"]],
    projectId: P["Local SEO & Citations"],
  });

  ids["AT-36"] = await createIssue({
    title: "Submit Phase 2-3 citations — Week 3 to Month 3",
    description: `**Phase 2 — Data Aggregators:**\n- Data Axle\n- Neustar / Localeze\n- Foursquare\n- Factual\n\n**Phase 3 — Industry Directories:**\n- IRS Return Preparer Directory (requires AFSP from AT-32)\n- TaxDome Advisor Directory\n- Thumbtack\n- Bark\n- Alignable\n- BBB\n- Denver Metro Chamber\n\nTarget: 75 total citations.\n\nBlocked by: AT-35 (Phase 1), AT-32 (AFSP).\n\n**Owner**: Matt`,
    priority: PRI.medium,
    stateId: STATES.backlog,
    labelIds: [L["Citations"], L["Matt-Setup"]],
    projectId: P["Local SEO & Citations"],
  });

  ids["AT-37"] = await createIssue({
    title: "Submit Phase 4 citations — Month 3-6",
    description: `General directories to reach 100+:\n- Manta\n- Hotfrog\n- Cylex\n- ShowMeLocal\n- EZLocal\n- CitySearch\n- And others from citation tracker\n\nBlocked by: AT-36 (Phase 2-3 complete).\n\n**Owner**: Matt`,
    priority: PRI.low,
    stateId: STATES.backlog,
    labelIds: [L["Citations"], L["Matt-Setup"]],
    projectId: P["Local SEO & Citations"],
  });

  // ── Project 4: Review Generation ──

  ids["AT-38"] = await createIssue({
    title: "Draft review request email template",
    description: `Short, personal email from Vincent requesting a Google review.\n\nRequirements:\n- Personal tone (from Vinnie, not generic)\n- Include DIRECT Google review link (placeholder until GBP live)\n- Must comply with IRC 7216 — NEVER confirm/deny client status\n- Include easy 1-click review link\n- Brief, scannable (under 150 words)\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Reviews"], L["Claude-Drafts"]],
    projectId: P["Review Generation"],
  });

  ids["AT-39"] = await createIssue({
    title: "Vinnie: configure TaxDome review automation",
    description: `In TaxDome pipeline settings:\n\n1. Add automation to "Return Filed/Delivered" pipeline stage\n2. Set 2-day delay after stage entry\n3. Auto-send review request email (template from AT-38)\n4. Add tag "review-requested-2026" to prevent duplicate sends\n\nBlocked by: AT-38 (email template), AT-30 (GBP live for review link).\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Reviews"], L["Vinnie-Action"]],
    projectId: P["Review Generation"],
  });

  ids["AT-40"] = await createIssue({
    title: "Vinnie: personally ask 10-15 best clients for reviews",
    description: `Direct personal ask (in-person, phone, or personal email) to top clients.\n\nShare the direct Google review link. Personal asks convert 5-10x better than automated emails.\n\nTarget: 20-30 reviews in month 1-2.\n\nBlocked by: AT-30 (GBP live).\n\n**Owner**: Vinnie`,
    priority: PRI.high,
    stateId: STATES.backlog,
    labelIds: [L["Reviews"], L["Vinnie-Action"]],
    projectId: P["Review Generation"],
  });

  ids["AT-41"] = await createIssue({
    title: "Draft IRC 7216 compliant review response templates",
    description: `Generic response templates for Google reviews:\n\n**Positive review response** — Thank them warmly WITHOUT confirming they are a client or mentioning specific services.\n\n**Negative review response** — Empathetic, invite to contact directly, WITHOUT confirming/denying client status or mentioning specific services.\n\n**Key rule**: IRC 7216 prohibits tax preparers from confirming or denying someone is a client. NEVER say "Thank you for being a client" or "I'm sorry about your tax return."\n\nExamples:\n- ✅ "Thank you for the kind words!"\n- ✅ "Please contact me directly to discuss your concerns."\n- ❌ "Thank you for trusting us with your taxes."\n- ❌ "I'm sorry about the issue with your filing."\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Reviews"], L["Claude-Drafts"]],
    projectId: P["Review Generation"],
  });

  // ── Project 5: Content Strategy ──

  ids["AT-42"] = await createIssue({
    title: "Draft S-Corp pillar article — 3000+ words",
    description: `"Complete Guide to S-Corp Taxation" — comprehensive pillar page.\n\nRequirements:\n- 3000+ words\n- Covers all aspects of S-Corp taxation\n- Internal linking hub for 10 cluster articles\n- Target keywords: "S-Corp taxes", "S-Corp tax guide"\n- SEO-optimized headings (H2/H3 structure)\n- Include FAQ section with schema\n- NO CPA language\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Content"], L["Claude-Drafts"], L["SEO"]],
    projectId: P["Content Strategy"],
  });

  ids["AT-43"] = await createIssue({
    title: "Draft first 3 cluster blog posts",
    description: `From content calendar:\n\n1. **"S-Corp vs LLC: Which Structure Saves You More?"** (800-1500 words)\n2. **"What Is S-Corp Reasonable Compensation?"** (800-1500 words)\n3. **"Denver Small Business Tax Deadlines"** (800-1500 words)\n\nEach must:\n- Link back to S-Corp pillar (AT-42)\n- Include 2-3 FAQ with schema\n- Target specific long-tail keywords\n- Be publishable without edits (professional quality)\n\n**Owner**: Claude`,
    priority: PRI.high,
    stateId: STATES.todo,
    labelIds: [L["Content"], L["Claude-Drafts"], L["SEO"]],
    projectId: P["Content Strategy"],
  });

  ids["AT-44"] = await createIssue({
    title: "Finalize 12-month content calendar",
    description: `Review and refine the content calendar at \`alpinetax/claudedocs/content-calendar.md\`.\n\n- Verify all 24 post topics for the year\n- Confirm keyword targets for each\n- Add keyword difficulty estimates where possible\n- Verify content mix percentages (S-Corp, local, seasonal, etc.)\n- Ensure seasonal alignment (tax deadlines, planning windows)\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Content"], L["Claude-Drafts"]],
    projectId: P["Content Strategy"],
  });

  ids["AT-45"] = await createIssue({
    title: "Research WordPress theme customization for tax practice",
    description: `Find Kadence starter templates or block patterns matching the design direction.\n\nDocument:\n- Recommended Kadence Blocks settings\n- Color palette configuration (Mountain blue #1B4965, Teal #2A9D8F, Terracotta #E76F51)\n- Typography setup (DM Sans headings, Inter body)\n- Useful block patterns for service pages\n- Any Kadence Pro features worth the upgrade\n\nSave to alpinetax/claudedocs/.\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["Website"], L["Claude-Drafts"]],
    projectId: P["Content Strategy"],
  });

  ids["AT-46"] = await createIssue({
    title: "Draft GBP posting templates — 12 post templates",
    description: `Monthly post templates for the GBP posting calendar:\n\n- 2-3 deadline reminder templates\n- 2-3 filing tips templates\n- 2-3 S-Corp education templates\n- 2 availability/booking announcement templates\n- 2 seasonal planning tips templates\n\nEach template should be 150-300 words with image suggestions.\n\n**Owner**: Claude`,
    priority: PRI.low,
    stateId: STATES.todo,
    labelIds: [L["GBP"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Content Strategy"],
  });

  // ── Project 6: Link Building ──

  ids["AT-47"] = await createIssue({
    title: "Research Denver Chamber of Commerce membership",
    description: `Research and document:\n- Pricing ($350-600/yr estimated)\n- Directory listing details and backlink quality (DA score)\n- Application process\n- Networking events schedule\n- Is it worth it for a solo tax practice?\n\nSave to alpinetax/claudedocs/.\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["SEO"], L["Claude-Drafts"]],
    projectId: P["Link Building"],
  });

  ids["AT-48"] = await createIssue({
    title: "Research BBB accreditation process",
    description: `Research and document:\n- Cost ($400-600/yr estimated)\n- Application timeline\n- Trust badge placement on website\n- Backlink quality (DA 70+?)\n- ROI analysis: worth the cost for a small tax practice?\n\nSave to alpinetax/claudedocs/.\n\n**Owner**: Claude`,
    priority: PRI.medium,
    stateId: STATES.todo,
    labelIds: [L["SEO"], L["Claude-Drafts"]],
    projectId: P["Link Building"],
  });

  ids["AT-49"] = await createIssue({
    title: "Create HARO/Featured.com pitch templates",
    description: `3-5 pitch templates for tax expert media queries:\n\n1. S-Corp tax savings expertise\n2. Small business tax tips\n3. Denver tax landscape / Colorado-specific\n4. Freelancer/gig worker tax advice\n5. Tax planning strategies\n\nTarget: 2-3 media placements per quarter for backlinks.\n\n**Owner**: Claude`,
    priority: PRI.low,
    stateId: STATES.todo,
    labelIds: [L["SEO"], L["Content"], L["Claude-Drafts"]],
    projectId: P["Link Building"],
  });

  // ── Project 7: EA Transition ──

  ids["AT-50"] = await createIssue({
    title: "Finalize EA transition checklist",
    description: `Review and finalize \`alpinetax/claudedocs/ea-transition-checklist.md\`.\n\nEnsure all P0/P1/P2 actions are clearly documented with specific steps:\n- Website copy updates (all credential references)\n- GBP category updates\n- Citation updates (IRS Directory, etc.)\n- Marketing material updates\n- Legal/compliance updates\n\nThis fires when Vinnie passes the SEE exam.\n\n**Owner**: Claude`,
    priority: PRI.low,
    stateId: STATES.todo,
    labelIds: [L["EA-Transition"], L["Claude-Drafts"]],
    projectId: P["EA Transition"],
  });

  ids["AT-51"] = await createIssue({
    title: "Vinnie: confirm alpinetax.com domain availability",
    description: `Check if alpinetax.com is available for purchase.\n\nIf available:\n- Consider purchasing as defensive registration (~$12/yr)\n- Could serve as redirect to alpinetax.co\n- Or future primary domain\n\n**Owner**: Vinnie`,
    priority: PRI.low,
    stateId: STATES.todo,
    labelIds: [L["Infrastructure"], L["Vinnie-Action"]],
    projectId: P["EA Transition"],
  });

  return ids;
}

// ─────────────────────────────────────────────
// STEP 5: Create dependencies (blocking relations)
// ─────────────────────────────────────────────
async function createDependencies(ids) {
  console.log("\n=== Step 5: Creating dependencies ===");

  // Helper: A blocks B (A must complete before B can start)
  async function blocks(blockerKey, blockedKey) {
    try {
      await throttledGql(
        `mutation($issueId: String!, $relatedIssueId: String!, $type: IssueRelationType!) {
          issueRelationCreate(input: { issueId: $issueId, relatedIssueId: $relatedIssueId, type: $type }) {
            success
          }
        }`,
        { issueId: blockedKey, relatedIssueId: blockerKey, type: "blocks" }
      );
      console.log(`  ${blockerKey} → blocks → ${blockedKey}`);
    } catch (e) {
      console.log(`  WARN: Failed ${blockerKey} → ${blockedKey}: ${e.message}`);
    }
  }

  // AT-1 blocks AT-7
  await blocks(ids["AT-1"], ids["AT-7"]);

  // AT-2 blocks AT-14
  await blocks(ids["AT-2"], ids["AT-14"]);

  // AT-3 blocks AT-5, AT-14, AT-30
  await blocks(ids["AT-3"], ids["AT-5"]);
  await blocks(ids["AT-3"], ids["AT-14"]);
  await blocks(ids["AT-3"], ids["AT-30"]);

  // AT-4 blocks AT-14
  await blocks(ids["AT-4"], ids["AT-14"]);

  // AT-5 blocks AT-14, AT-30, AT-35
  await blocks(ids["AT-5"], ids["AT-14"]);
  await blocks(ids["AT-5"], ids["AT-30"]);
  await blocks(ids["AT-5"], ids["AT-35"]);

  // AT-6 blocks AT-11
  await blocks(ids["AT-6"], ids["AT-11"]);

  // AT-7..AT-13 block AT-15
  for (let i = 7; i <= 13; i++) {
    await blocks(ids[`AT-${i}`], ids["AT-15"]);
  }

  // AT-14 blocks AT-15, AT-17, AT-18, AT-20, AT-22
  await blocks(ids["AT-14"], ids["AT-15"]);
  await blocks(ids["AT-14"], ids["AT-17"]);
  await blocks(ids["AT-14"], ids["AT-18"]);
  await blocks(ids["AT-14"], ids["AT-20"]);
  await blocks(ids["AT-14"], ids["AT-22"]);

  // AT-16 blocks AT-15, AT-31
  await blocks(ids["AT-16"], ids["AT-15"]);
  await blocks(ids["AT-16"], ids["AT-31"]);

  // AT-19 blocks AT-18
  await blocks(ids["AT-19"], ids["AT-18"]);

  // AT-15 blocks AT-21
  await blocks(ids["AT-15"], ids["AT-21"]);

  // AT-21 blocks AT-23
  await blocks(ids["AT-21"], ids["AT-23"]);

  // AT-22 blocks AT-23
  await blocks(ids["AT-22"], ids["AT-23"]);

  // AT-23 blocks AT-24
  await blocks(ids["AT-23"], ids["AT-24"]);

  // AT-25 blocks AT-30
  await blocks(ids["AT-25"], ids["AT-30"]);

  // AT-26 blocks AT-30
  await blocks(ids["AT-26"], ids["AT-30"]);

  // AT-27 blocks AT-15
  await blocks(ids["AT-27"], ids["AT-15"]);

  // AT-29 blocks AT-31
  await blocks(ids["AT-29"], ids["AT-31"]);

  // AT-30 blocks AT-31, AT-35, AT-39, AT-40
  await blocks(ids["AT-30"], ids["AT-31"]);
  await blocks(ids["AT-30"], ids["AT-35"]);
  await blocks(ids["AT-30"], ids["AT-39"]);
  await blocks(ids["AT-30"], ids["AT-40"]);

  // AT-32 blocks AT-36
  await blocks(ids["AT-32"], ids["AT-36"]);

  // AT-35 blocks AT-36
  await blocks(ids["AT-35"], ids["AT-36"]);

  // AT-36 blocks AT-37
  await blocks(ids["AT-36"], ids["AT-37"]);

  // AT-38 blocks AT-39
  await blocks(ids["AT-38"], ids["AT-39"]);

  console.log("\n  All dependencies created.");
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Alpine Tax — Linear Setup                   ║");
  console.log("║  Team: Atmix (ATM)                           ║");
  console.log("╚══════════════════════════════════════════════╝");

  await cancelOnboardingIssues();
  const blockedStateId = await createBlockedState();
  const labels = await createLabels();
  const projects = await createProjects();
  const ids = await createIssues(projects, labels);
  await createDependencies(ids);

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║  SETUP COMPLETE                              ║");
  console.log("╠══════════════════════════════════════════════╣");
  console.log(`║  Labels: ${Object.keys(labels).length}                                  ║`);
  console.log(`║  Projects: ${Object.keys(projects).length}                                 ║`);
  console.log(`║  Issues: ${Object.keys(ids).length}                                 ║`);
  console.log("╚══════════════════════════════════════════════╝");

  // Output IDs for reference
  console.log("\n=== Project IDs ===");
  for (const [name, id] of Object.entries(projects)) {
    console.log(`  ${name}: ${id}`);
  }

  console.log("\n=== Label IDs ===");
  for (const [name, id] of Object.entries(labels)) {
    console.log(`  ${name}: ${id}`);
  }

  console.log("\n=== Issue IDs (for dependency reference) ===");
  for (const [key, id] of Object.entries(ids)) {
    console.log(`  ${key}: ${id}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
