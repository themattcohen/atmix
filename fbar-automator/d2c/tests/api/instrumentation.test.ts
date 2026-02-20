import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Startup validation (instrumentation)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module registry so each test gets a fresh import of instrumentation.ts
    vi.resetModules();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("exits if DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    process.env.NEXTAUTH_SECRET = "test";
    process.env.NEXTAUTH_URL = "http://localhost";

    const { register } = await import("@/instrumentation");
    await expect(register()).rejects.toThrow("process.exit called");
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("DATABASE_URL")
    );
  });

  it("warns if ANTHROPIC_API_KEY is missing", async () => {
    process.env.DATABASE_URL = "postgres://test";
    process.env.NEXTAUTH_SECRET = "test";
    process.env.NEXTAUTH_URL = "http://localhost";
    delete process.env.ANTHROPIC_API_KEY;

    const { register } = await import("@/instrumentation");
    await register();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("ANTHROPIC_API_KEY")
    );
  });

  it("succeeds when all required vars are set", async () => {
    process.env.DATABASE_URL = "postgres://test";
    process.env.NEXTAUTH_SECRET = "test";
    process.env.NEXTAUTH_URL = "http://localhost";

    const { register } = await import("@/instrumentation");
    await register();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("validated successfully")
    );
  });
});
