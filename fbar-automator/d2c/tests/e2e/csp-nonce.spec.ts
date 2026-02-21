import { test, expect } from "@playwright/test";

test.describe("CSP Nonce Headers", () => {
  test("response has Content-Security-Policy header with nonce", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();

    const csp = response!.headers()["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("nonce-");
    expect(csp).toContain("script-src");
    // In production mode, should have strict-dynamic; in dev, unsafe-eval
    // Just verify nonce is present
    const nonceMatch = csp.match(/nonce-([A-Za-z0-9+/=]+)/);
    expect(nonceMatch).not.toBeNull();
  });

  test("nonce is unique per request", async ({ page }) => {
    const response1 = await page.goto("/");
    const csp1 = response1!.headers()["content-security-policy"];
    const nonce1 = csp1.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];

    const response2 = await page.goto("/");
    const csp2 = response2!.headers()["content-security-policy"];
    const nonce2 = csp2.match(/nonce-([A-Za-z0-9+/=]+)/)?.[1];

    expect(nonce1).toBeDefined();
    expect(nonce2).toBeDefined();
    expect(nonce1).not.toBe(nonce2);
  });

  test("x-nonce header is set", async ({ page }) => {
    const response = await page.goto("/");
    const xNonce = response!.headers()["x-nonce"];
    expect(xNonce).toBeDefined();
    expect(xNonce.length).toBeGreaterThan(0);
  });

  test("no duplicate CSP headers", async ({ page }) => {
    const response = await page.goto("/");
    const headers = await response!.headersArray();
    const cspHeaders = headers.filter(
      (h: { name: string; value: string }) => h.name.toLowerCase() === "content-security-policy"
    );
    // Should have exactly 1 CSP header (from middleware, not duplicated by next.config.js or nginx)
    expect(cspHeaders.length).toBe(1);
  });
});
