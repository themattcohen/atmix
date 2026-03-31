import { execFileSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import path from "path";
import crypto from "crypto";

export interface XsdError {
  line: number;
  message: string;
  element?: string;
}

export interface XsdValidationResult {
  isValid: boolean;
  errors: XsdError[];
}

// Cache xmllint availability check
let xmllintAvailable: boolean | null = null;

function isXmllintAvailable(): boolean {
  if (xmllintAvailable !== null) return xmllintAvailable;
  try {
    execFileSync("xmllint", ["--version"], { stdio: "pipe" });
    xmllintAvailable = true;
  } catch {
    xmllintAvailable = false;
  }
  return xmllintAvailable;
}

/**
 * Validate XML string against the FinCEN FBAR XSD schema using xmllint.
 *
 * In production: throws if xmllint is not available (mandatory).
 * In dev/test: warns and returns valid if xmllint is missing (graceful degradation).
 */
export function validateXmlAgainstXsd(xml: string): XsdValidationResult {
  if (!isXmllintAvailable()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "xmllint is required in production but not found. Install libxml2-utils."
      );
    }
    console.warn("[XSD] xmllint not available — skipping XSD validation");
    return { isValid: true, errors: [] };
  }

  const schemaPath = path.resolve(
    process.cwd(),
    "schemas/fincen/EFL_FBARXBatchSchema.xsd"
  );
  const tmpFile = path.join("/tmp", `fbar-xsd-${crypto.randomUUID()}.xml`);

  try {
    writeFileSync(tmpFile, xml, "utf-8");
    execFileSync("xmllint", ["--noout", "--schema", schemaPath, tmpFile], {
      stdio: "pipe",
      timeout: 10000,
    });
    return { isValid: true, errors: [] };
  } catch (err: unknown) {
    // xmllint writes validation errors to stderr and returns non-zero exit
    const stderr =
      (err as { stderr?: Buffer })?.stderr?.toString() || "";
    const errors = parseXmllintErrors(stderr);

    // If we got no parsed errors but xmllint failed, include the raw stderr
    if (errors.length === 0 && stderr.trim()) {
      errors.push({ line: 0, message: stderr.trim() });
    }

    return { isValid: false, errors };
  } finally {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore cleanup errors */
    }
  }
}

/**
 * Parse xmllint stderr output into structured errors.
 * Format: "/tmp/fbar-xyz.xml:15: element PartyCount: Schemas validity error : ..."
 */
function parseXmllintErrors(stderr: string): XsdError[] {
  const errors: XsdError[] = [];
  const lines = stderr.split("\n");

  for (const line of lines) {
    // Match: filename:line: element ElementName: message
    const match = line.match(
      /^[^:]+:(\d+):\s*(?:element\s+(\S+)\s*:\s*)?(.+)/
    );
    if (match) {
      const message = match[3]
        .replace(/^Schemas validity error\s*:\s*/, "")
        .trim();
      if (
        message &&
        !message.startsWith("validates") &&
        !message.startsWith("fails to validate")
      ) {
        errors.push({
          line: parseInt(match[1], 10),
          element: match[2] || undefined,
          message,
        });
      }
    }
  }

  return errors;
}
