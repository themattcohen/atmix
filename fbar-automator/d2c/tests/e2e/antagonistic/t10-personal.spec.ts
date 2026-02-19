import { test, expect, Page, BrowserContext } from "@playwright/test";
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as http from "http";

test.use({ baseURL: "http://localhost:3001" });

// Dev server is slow (Next.js compiles routes on demand). Allow extra time.
test.setTimeout(60_000);

// Pre-computed bcrypt hash of "TestPassword123!" with cost 4 (fast for testing).
const FAST_HASH =
  "$2a$04$1zPi1soPtQC0..oX8cNVLe67HPVVPoenvG8ZUsgEQ2DuUtVWEGNXS";
const TEST_PASSWORD = "TestPassword123!";

/** Simple HTTP request helper (no external deps). */
function httpReq(
  options: http.RequestOptions,
  body?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () =>
        resolve({
          status: res.statusCode!,
          headers: res.headers,
          body: data,
        })
      );
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Create a user directly in the DB with a fast bcrypt hash,
 * then obtain a session token via the NextAuth callback API.
 * Returns { email, sessionToken, cookies } for injecting into browser.
 */
async function createUserAndGetSession(): Promise<{
  email: string;
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }>;
}> {
  const email = `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const d2cDir = path.resolve(__dirname, "../../..");
  const scriptPath = path.join(d2cDir, ".tmp-create-user.js");

  // Create user in DB with fast hash
  fs.writeFileSync(
    scriptPath,
    [
      "const { PrismaClient } = require('@prisma/client');",
      "const p = new PrismaClient();",
      `p.user.create({ data: { email: '${email}', passwordHash: '${FAST_HASH}', firstName: 'Test', lastName: 'User' } })`,
      ".then(u => { console.log(u.id); return p.$disconnect(); })",
      ".catch(e => { console.error(e.message); process.exit(1); });",
    ].join("\n")
  );

  try {
    execSync(
      `export PATH="/private/tmp/node-v22.13.1-darwin-x64/bin:$PATH" && cd "${d2cDir}" && node "${scriptPath}"`,
      { encoding: "utf-8", timeout: 10_000 }
    );
  } finally {
    try {
      fs.unlinkSync(scriptPath);
    } catch {
      /* ignore */
    }
  }

  // Get CSRF token from NextAuth
  const csrfResp = await httpReq({
    hostname: "localhost",
    port: 3001,
    path: "/api/auth/csrf",
    method: "GET",
  });
  const csrfData = JSON.parse(csrfResp.body);
  const csrfToken = csrfData.csrfToken;

  // Deduplicate cookies (keep last value per name)
  const jar: Record<string, string> = {};
  (csrfResp.headers["set-cookie"] || []).forEach((c) => {
    const [kv] = c.split(";");
    const eqIdx = kv.indexOf("=");
    jar[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
  });
  const cookieStr = Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

  // Call credentials callback to get session token
  const formData = new URLSearchParams({
    email,
    password: TEST_PASSWORD,
    csrfToken,
    callbackUrl: "http://localhost:3001/threshold",
    json: "true",
  }).toString();

  const cbResp = await httpReq(
    {
      hostname: "localhost",
      port: 3001,
      path: "/api/auth/callback/credentials",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieStr,
        "Content-Length": Buffer.byteLength(formData).toString(),
      },
    },
    formData
  );

  if (cbResp.status !== 302 || !cbResp.headers.location?.includes("threshold")) {
    throw new Error(
      `Login failed: status=${cbResp.status} location=${cbResp.headers.location}`
    );
  }

  // Parse all cookies from both responses
  const allCookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }> = [];

  const parseCookies = (setCookieHeaders: string[] | undefined) => {
    (setCookieHeaders || []).forEach((c) => {
      const [kv] = c.split(";");
      const eqIdx = kv.indexOf("=");
      const name = kv.slice(0, eqIdx);
      const value = kv.slice(eqIdx + 1);
      // Remove existing cookie with same name, then add new one
      const existingIdx = allCookies.findIndex((x) => x.name === name);
      if (existingIdx >= 0) allCookies.splice(existingIdx, 1);
      allCookies.push({
        name,
        value: decodeURIComponent(value),
        domain: "localhost",
        path: "/",
      });
    });
  };

  parseCookies(csrfResp.headers["set-cookie"]);
  parseCookies(cbResp.headers["set-cookie"]);

  return { email, cookies: allCookies };
}

/**
 * Set up a fresh user, inject session cookies, navigate through threshold to /personal.
 */
async function getToPersonalPage(page: Page): Promise<void> {
  // Retry createUserAndGetSession up to 3 times (MissingCSRF is transient)
  let result: Awaited<ReturnType<typeof createUserAndGetSession>> | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      result = await createUserAndGetSession();
      break;
    } catch {
      if (attempt === 2) throw new Error("createUserAndGetSession failed after 3 attempts");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Inject cookies into browser context
  await page.context().addCookies(result!.cookies);

  // Navigate to threshold (authenticated via cookie)
  await page.goto("/threshold", { timeout: 30_000, waitUntil: "networkidle" });

  // Fallback: if cookie injection failed and we landed on login, do browser login
  if (page.url().includes("/login")) {
    await page.fill("#email", result!.email);
    await page.fill("#password", TEST_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(threshold|dashboard)/, { timeout: 30_000 });
    if (!page.url().includes("/threshold")) {
      await page.goto("/threshold", { timeout: 30_000, waitUntil: "networkidle" });
    }
  }

  // Complete threshold — wait for React hydration first
  const firstYes = page.locator("button:has-text('Yes')").first();
  await expect(firstYes).toBeVisible({ timeout: 30_000 });
  // Wait for hydration by ensuring the button is clickable (has React event handler)
  await page.waitForTimeout(2000);
  await firstYes.click();

  // After clicking Yes on Q1, Q2 should appear. Retry click if needed.
  const secondYes = page.locator("button:has-text('Yes')").nth(1);
  try {
    await expect(secondYes).toBeVisible({ timeout: 10_000 });
  } catch {
    // Q2 didn't appear — the click on Q1 didn't register. Retry.
    await firstYes.click();
    await expect(secondYes).toBeVisible({ timeout: 10_000 });
  }
  await secondYes.click();

  const continueBtn = page.locator("text=Continue to Personal Information");
  await expect(continueBtn).toBeVisible({ timeout: 15_000 });
  await continueBtn.click();
  await page.waitForURL("**/personal", { timeout: 30_000, waitUntil: "domcontentloaded" });

  // Wait for form to render
  await expect(page.locator("h1")).toContainText("Personal Information", {
    timeout: 10_000,
  });

  // Wait for API data to load — firstName gets pre-filled from user record.
  // Must wait for this before filling any fields to avoid useEffect race condition
  // where /api/user response overwrites form values after test fills them.
  await expect(page.locator("#firstName")).toHaveValue(/\w+/, { timeout: 30_000 });
  await page.waitForTimeout(1500); // Extra settle time for React re-renders
}

test.describe("Personal Information Wizard Step — Antagonistic Tests", () => {
  test.describe.configure({ retries: 1 }); // API-based auth has transient MissingCSRF failures
  test("all expected form fields render on /personal", async ({ page }) => {
    await getToPersonalPage(page);

    // Heading
    await expect(page.locator("h1")).toContainText("Personal Information");

    // Name fields (pre-filled from user record)
    await expect(page.locator("#firstName")).toBeVisible();
    await expect(page.locator("#firstName")).toHaveValue("Test");
    await expect(page.locator("#lastName")).toBeVisible();
    await expect(page.locator("#lastName")).toHaveValue("User");

    // Middle name and suffix (optional)
    await expect(page.locator("#middleName")).toBeVisible();
    await expect(page.locator("#suffix")).toBeVisible();

    // TIN type selector (SSN/ITIN dropdown)
    const tinType = page.locator("#tinType");
    await expect(tinType).toBeVisible();
    await expect(tinType.locator("option")).toHaveCount(2);
    await expect(tinType.locator("option").nth(0)).toHaveText("SSN");
    await expect(tinType.locator("option").nth(1)).toHaveText("ITIN");

    // SSN/ITIN input
    await expect(page.locator("#tin")).toBeVisible();
    await expect(page.locator("#tin")).toHaveAttribute("maxLength", "11");

    // Date of birth
    await expect(page.locator("#dateOfBirth")).toBeVisible();
    await expect(page.locator("#dateOfBirth")).toHaveAttribute("type", "date");

    // Address fields
    await expect(page.locator("#street")).toBeVisible();
    await expect(page.locator("#street2")).toBeVisible();
    await expect(page.locator("#city")).toBeVisible();
    await expect(page.locator("#state")).toBeVisible();
    await expect(page.locator("#zip")).toBeVisible();
    await expect(page.locator("#zip")).toHaveAttribute("maxLength", "10");

    // Phone (optional)
    await expect(page.locator("#phone")).toBeVisible();

    // Submit button
    await expect(
      page.getByRole("button", { name: "Save & Continue to Accounts" })
    ).toBeVisible();
  });

  test("state dropdown has 50+ options (all US states + territories)", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    const stateSelect = page.locator("#state");
    // Wait for select to be visible and have options (React hydration + data load)
    await expect(stateSelect).toBeVisible({ timeout: 15_000 });
    // Wait for options to populate (useEffect loads data async)
    await page.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15_000 }
    );

    const options = stateSelect.locator("option");
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(51);

    await expect(options.first()).toHaveText("Select state");
    // Verify placeholder option has empty value via attribute (toHaveValue only works on inputs)
    await expect(options.first()).toHaveAttribute("value", "");

    const values = await stateSelect.locator("option").allTextContents();
    expect(values).toContain("CA");
    expect(values).toContain("NY");
    expect(values).toContain("TX");
  });

  test("submit empty form triggers browser validation (required fields)", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    // Clear the pre-filled name fields (must use triple-click + delete to clear React controlled inputs)
    await page.locator("#firstName").click({ clickCount: 3 });
    await page.keyboard.press("Backspace");
    await page.locator("#lastName").click({ clickCount: 3 });
    await page.keyboard.press("Backspace");

    // Clear the TIN if pre-filled
    await page.locator("#tin").focus();
    await page.locator("#tin").click({ clickCount: 3 });
    await page.keyboard.press("Backspace");

    await page
      .getByRole("button", { name: "Save & Continue to Accounts" })
      .click();

    // Should still be on /personal (validation prevented navigation)
    await expect(page).toHaveURL(/\/personal/);
  });

  test("submit with names but missing TIN triggers browser validation on TIN", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    await page
      .getByRole("button", { name: "Save & Continue to Accounts" })
      .click();

    await expect(page).toHaveURL(/\/personal/);

    const msg = await page
      .locator("#tin")
      .evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(msg.length).toBeGreaterThan(0);
  });

  test("SSN input auto-formats digits with dashes", async ({ page }) => {
    await getToPersonalPage(page);

    const tinInput = page.locator("#tin");
    await tinInput.focus();
    await tinInput.fill("123456789");

    await expect(tinInput).toHaveValue("123-45-6789");
  });

  test("SSN masks on blur after entry", async ({ page }) => {
    await getToPersonalPage(page);

    const tinInput = page.locator("#tin");
    await tinInput.focus();
    await tinInput.fill("123456789");
    await expect(tinInput).toHaveValue("123-45-6789");

    await tinInput.blur();
    await expect(tinInput).toHaveValue("***-**-6789");
  });

  test("TIN type can be toggled between SSN and ITIN", async ({ page }) => {
    await getToPersonalPage(page);

    const tinType = page.locator("#tinType");
    await expect(tinType).toHaveValue("SSN");

    await tinType.selectOption("ITIN");
    await expect(tinType).toHaveValue("ITIN");

    await tinType.selectOption("SSN");
    await expect(tinType).toHaveValue("SSN");
  });

  test("fill valid data and submit redirects to /accounts", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await getToPersonalPage(page);

    // Wait for state dropdown to have options (useEffect data load)
    await page.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15_000 }
    );

    // Fill address fields
    await page.locator("#street").fill("123 Test St");
    await page.locator("#city").fill("Testville");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zip").fill("90210");

    // Set date of birth via evaluate (Playwright fill on type=date can be unreliable)
    await page.locator("#dateOfBirth").evaluate(
      (el: HTMLInputElement) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )!.set!;
        nativeInputValueSetter.call(el, '1990-01-15');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    );

    // Fill TIN last — focus first, type digits, then submit via keyboard (Enter)
    // to avoid the blur event that masks the TIN value before form submission
    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123-45-6789");

    // Submit via Enter key while TIN is still focused — this avoids blur masking
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL(/\/accounts/, { timeout: 30_000 });
  });

  test("invalid ZIP code format triggers server-side validation error", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    await page.locator("#tin").focus();
    await page.locator("#tin").fill("123456789");
    await page.locator("#dateOfBirth").fill("1990-01-15");
    await page.locator("#street").fill("123 Test St");
    await page.locator("#city").fill("Testville");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zip").fill("ABCDE");

    await page
      .getByRole("button", { name: "Save & Continue to Accounts" })
      .click();

    await expect(page).toHaveURL(/\/personal/);
    await expect(page.locator('[role="alert"]').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("submit button shows 'Saving...' while request is in flight", async ({
    page,
  }) => {
    await getToPersonalPage(page);

    // Wait for state dropdown to populate
    await page.waitForFunction(
      () => (document.querySelector("#state")?.querySelectorAll("option").length ?? 0) > 5,
      { timeout: 15_000 }
    );

    await page.locator("#tin").focus();
    await page.locator("#tin").pressSequentially("123456789", { delay: 20 });
    await page.locator("#dateOfBirth").fill("1990-01-15");
    await page.locator("#street").fill("123 Test St");
    await page.locator("#city").fill("Testville");
    await page.locator("#state").selectOption("CA");
    await page.locator("#zip").fill("90210");

    // Intercept API to add delay so we can observe loading state
    await page.route("**/api/user", async (route) => {
      if (route.request().method() === "PUT") {
        await new Promise((r) => setTimeout(r, 3000));
      }
      await route.continue();
    });

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // After click, button should show "Saving..." and be disabled
    await expect(submitBtn).toContainText("Saving", { timeout: 5000 });
    await expect(submitBtn).toBeDisabled();
  });
});
