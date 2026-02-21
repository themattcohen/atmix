import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Mock the AWS SDK modules BEFORE importing the module under test ─────────
//
// We mock the S3Client so that .send() captures the command object for
// inspection, and we mock getSignedUrl to return a predictable URL.

let capturedCommand: unknown = null;

vi.mock("@aws-sdk/client-s3", () => {
  // Minimal mock PutObjectCommand that stores its input for assertions
  class MockPutObjectCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class MockGetObjectCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class MockDeleteObjectCommand {
    input: Record<string, unknown>;
    constructor(input: Record<string, unknown>) {
      this.input = input;
    }
  }

  class MockS3Client {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
    }
    async send(command: unknown) {
      capturedCommand = command;
      return {};
    }
  }

  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
    DeleteObjectCommand: MockDeleteObjectCommand,
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(),
}));

// Now import the module under test and the mocked presigner
import { uploadFile, getPresignedUrl } from "@/lib/s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  capturedCommand = null;
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("P3-3: S3 presigned URL generation", () => {
  it("P3-3: getPresignedUrl returns a URL containing the requested key", async () => {
    const testKey = "statements/user123/2024/statement.pdf";

    (getSignedUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
      `https://s3.example.com/fbar-direct/${testKey}?X-Amz-Signature=abc123&X-Amz-Expires=300`
    );

    const url = await getPresignedUrl(testKey);

    expect(typeof url).toBe("string");
    expect(url).toContain(testKey);
  });

  it("P3-3: getPresignedUrl uses default expiry of 300 seconds", async () => {
    const testKey = "statements/user456/2024/bank.pdf";

    (getSignedUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
      `https://s3.example.com/fbar-direct/${testKey}?X-Amz-Expires=300`
    );

    await getPresignedUrl(testKey);

    // getSignedUrl should have been called with { expiresIn: 300 } as default
    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const callArgs = (getSignedUrl as ReturnType<typeof vi.fn>).mock.calls[0];
    // Third argument is the options object { expiresIn }
    expect(callArgs[2]).toEqual({ expiresIn: 300 });
  });

  it("P3-3: getPresignedUrl passes custom expiry (900s) to getSignedUrl", async () => {
    const testKey = "statements/user789/2024/brokerage.pdf";

    (getSignedUrl as ReturnType<typeof vi.fn>).mockResolvedValue(
      `https://s3.example.com/fbar-direct/${testKey}?X-Amz-Expires=900`
    );

    await getPresignedUrl(testKey, 900);

    expect(getSignedUrl).toHaveBeenCalledTimes(1);
    const callArgs = (getSignedUrl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[2]).toEqual({ expiresIn: 900 });
  });
});

describe("P3-3: S3 server-side encryption on upload", () => {
  it("P3-3: uploadFile includes ServerSideEncryption when S3_SERVER_SIDE_ENCRYPTION is set", async () => {
    process.env.S3_SERVER_SIDE_ENCRYPTION = "AES256";

    const testKey = "statements/user123/2024/statement.pdf";
    const testBuffer = Buffer.from("fake-pdf-content");
    const testContentType = "application/pdf";

    await uploadFile(testKey, testBuffer, testContentType);

    expect(capturedCommand).not.toBeNull();
    const cmd = capturedCommand as { input: Record<string, unknown> };
    expect(cmd.input).toHaveProperty("Key", testKey);
    expect(cmd.input).toHaveProperty("ContentType", testContentType);
    expect(cmd.input).toHaveProperty("ServerSideEncryption", "AES256");

    delete process.env.S3_SERVER_SIDE_ENCRYPTION;
  });

  it("P3-3: uploadFile omits ServerSideEncryption when env var is not set", async () => {
    delete process.env.S3_SERVER_SIDE_ENCRYPTION;

    const testKey = "statements/user123/2024/nosse.pdf";
    const testBuffer = Buffer.from("fake-pdf-content");

    await uploadFile(testKey, testBuffer, "application/pdf");

    const cmd = capturedCommand as { input: Record<string, unknown> };
    expect(cmd.input).not.toHaveProperty("ServerSideEncryption");
  });

  it("P3-3: uploadFile returns the key on success", async () => {
    const testKey = "statements/user999/2024/bank-statement.pdf";
    const testBuffer = Buffer.from("pdf-bytes");

    const result = await uploadFile(testKey, testBuffer, "application/pdf");

    expect(result).toBe(testKey);
  });

  it("P3-3: uploadFile sends correct Bucket and Body", async () => {
    const testKey = "statements/user555/2024/doc.png";
    const testBuffer = Buffer.from("png-bytes");
    const testContentType = "image/png";

    await uploadFile(testKey, testBuffer, testContentType);

    const cmd = capturedCommand as { input: Record<string, unknown> };
    expect(cmd.input).toHaveProperty("Bucket");
    expect(cmd.input.Body).toEqual(testBuffer);
  });
});
