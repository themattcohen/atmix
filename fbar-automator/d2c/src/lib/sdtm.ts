import { Client as SFTPClient } from "ssh2";
import fs from "fs";
import { XMLParser } from "fast-xml-parser";

export interface SubmissionResult {
  success: boolean;
  batchId: string;
  remoteFilePath: string;
  error?: string;
}

export interface AcknowledgementResult {
  status: "pending" | "accepted" | "rejected";
  bsaId?: string;
  rejectionReason?: string;
  messages?: Array<{ level: string; code: string; description: string }>;
}

const isSandbox = () => process.env.SDTM_SANDBOX_MODE === "true";

export function validateSdtmConfig(): void {
  if (isSandbox()) return;

  if (!process.env.SDTM_HOST_KEY) {
    throw new Error("SDTM_HOST_KEY is required when SDTM_SANDBOX_MODE is not true");
  }
}

function getSFTPConnectConfig(): Record<string, unknown> {
  const config: Record<string, unknown> = {
    host: process.env.SDTM_HOST,
    port: parseInt(process.env.SDTM_PORT || "2222"),
    username: process.env.SDTM_USERNAME,
    readyTimeout: 10000,
  };

  // SSH key auth
  const keyPath = process.env.SDTM_PRIVATE_KEY_PATH;
  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      throw new Error(`SFTP private key not found at: ${keyPath}`);
    }
    config.privateKey = fs.readFileSync(keyPath);
  }

  // Password auth fallback (FinCEN uses "client ID and secret" = username/password)
  const password = process.env.SDTM_PASSWORD;
  if (password) {
    config.password = password;
  }

  if (!keyPath && !password) {
    console.warn("[SDTM] No SDTM_PRIVATE_KEY_PATH or SDTM_PASSWORD set — SFTP auth will fail");
  }

  const hostKey = process.env.SDTM_HOST_KEY;
  if (hostKey) {
    config.hostVerifier = (key: Buffer) => {
      const matches = key.toString("base64") === hostKey;
      if (!matches) {
        console.error("[SDTM] SFTP host key mismatch — possible MITM attack");
      }
      return matches;
    };
  } else {
    console.warn("[SDTM] SDTM_HOST_KEY not set — skipping host key verification (unsafe for production)");
  }

  return config;
}

export async function submitBatch(
  xmlContent: string,
  batchId: string
): Promise<SubmissionResult> {
  // FinCEN SDTM naming convention: FFBARST.yyyymmddhhmmss.<username>.xml
  const now = new Date();
  const ts =
    String(now.getUTCFullYear()) +
    String(now.getUTCMonth() + 1).padStart(2, "0") +
    String(now.getUTCDate()).padStart(2, "0") +
    String(now.getUTCHours()).padStart(2, "0") +
    String(now.getUTCMinutes()).padStart(2, "0") +
    String(now.getUTCSeconds()).padStart(2, "0");
  const sdtmUsername = process.env.SDTM_USERNAME || "unknown";
  const filename = `FFBARST.${ts}.${sdtmUsername}.xml`;
  const remoteDir = process.env.SDTM_REMOTE_DIR || "submissions";
  const remoteFilePath = `${remoteDir}/${filename}`;

  if (isSandbox()) {
    console.warn("[SDTM SANDBOX] Would upload to:", remoteFilePath);
    console.warn("[SDTM SANDBOX] XML length:", xmlContent.length, "bytes");
    return { success: true, batchId, remoteFilePath };
  }

  return new Promise((resolve) => {
    const conn = new SFTPClient();

    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          resolve({ success: false, batchId, remoteFilePath, error: err.message });
          return;
        }

        const writeStream = sftp.createWriteStream(remoteFilePath);

        writeStream.on("close", () => {
          conn.end();
          resolve({ success: true, batchId, remoteFilePath });
        });

        writeStream.on("error", (writeErr: Error) => {
          conn.end();
          resolve({ success: false, batchId, remoteFilePath, error: writeErr.message });
        });

        writeStream.end(Buffer.from(xmlContent, "utf-8"));
      });
    });

    conn.on("error", (connErr) => {
      resolve({ success: false, batchId, remoteFilePath, error: connErr.message });
    });

    conn.connect(getSFTPConnectConfig());
  });
}

/**
 * Extract search key for ack file matching.
 * Accepts a full remote path (submissions/FBAR_DIRECT_xxx.xml) or a bare batchId.
 */
function extractAckSearchKey(submissionId: string): string {
  if (submissionId.includes("/")) {
    const parts = submissionId.split("/");
    const filename = parts[parts.length - 1];
    return filename.replace(/\.xml$/i, "");
  }
  return submissionId;
}

/** FinCEN ack file extensions: .MESSAGES.XML and .ACK */
const ACK_EXTENSIONS = [".MESSAGES.XML", ".messages.xml", ".ACK", ".ack", ".xml", ".XML"];

function isAckFile(filename: string, searchKey: string): boolean {
  const hasMatchingExt = ACK_EXTENSIONS.some((ext) => filename.endsWith(ext));
  if (!hasMatchingExt) return false;
  return filename.includes(searchKey);
}

/**
 * Check for FinCEN acknowledgement of a submission.
 * @param submissionId - Full remote path (e.g. "submissions/FBAR_DIRECT_xxx.xml")
 *                       or bare batchId for backward compatibility.
 */
export async function checkAcknowledgement(
  submissionId: string
): Promise<AcknowledgementResult> {
  if (isSandbox()) {
    console.warn("[SDTM SANDBOX] Checking acknowledgement for:", submissionId);
    return { status: "pending" };
  }

  const searchKey = extractAckSearchKey(submissionId);

  return new Promise((resolve) => {
    const conn = new SFTPClient();

    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          resolve({ status: "pending" });
          return;
        }

        const ackDir = process.env.SDTM_ACK_DIR || "acks";

        sftp.readdir(ackDir, (readErr, list) => {
          if (readErr || !list) {
            conn.end();
            resolve({ status: "pending" });
            return;
          }

          const ackFile = list.find((f) => isAckFile(f.filename, searchKey));

          if (!ackFile) {
            conn.end();
            resolve({ status: "pending" });
            return;
          }

          const ackPath = `${ackDir}/${ackFile.filename}`;

          sftp.readFile(ackPath, (fileErr, data) => {
            conn.end();

            if (fileErr || !data) {
              resolve({ status: "pending" });
              return;
            }

            try {
              resolve(parseAcknowledgement(data.toString("utf-8")));
            } catch {
              resolve({ status: "pending" });
            }
          });
        });
      });
    });

    conn.on("error", () => {
      resolve({ status: "pending" });
    });

    conn.connect(getSFTPConnectConfig());
  });
}

/**
 * Parse FinCEN BatchMessages XML (EFL_BatchMessagesSchema.xsd).
 * Schema: BatchMessages > Batch[@status, @trackingID] > Message[@level, @code] > Description
 */
function parseAcknowledgement(xml: string): AcknowledgementResult {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
  const parsed = parser.parse(xml);

  // FinCEN schema: BatchMessages > Batch
  const batch = parsed?.BatchMessages?.Batch;
  if (!batch) {
    // Fallback: try legacy field names for backward compatibility
    const legacy = parsed?.EFilingBatchAcknowledgement || parsed?.acknowledgement;
    if (legacy) {
      return parseLegacyAck(legacy);
    }
    return { status: "pending" };
  }

  const status = batch.status as string | undefined;
  const trackingId = batch.trackingID as string | undefined;

  // Parse messages
  const rawMessages: Record<string, string>[] = Array.isArray(batch.Message)
    ? batch.Message
    : batch.Message
      ? [batch.Message]
      : [];
  const messages = rawMessages.map((m) => ({
    level: m.level || "",
    code: m.code || "",
    description: m.Description || "",
  }));

  if (status === "ACCEPTED" || status === "ACCEPTED-WITH-WARNINGS") {
    if (messages.length > 0) {
      console.warn("[SDTM] Ack messages:", JSON.stringify(messages));
    }
    return {
      status: "accepted",
      bsaId: trackingId ? String(trackingId) : undefined,
      messages: messages.length > 0 ? messages : undefined,
    };
  } else if (status === "REJECTED") {
    const reasons = messages
      .map((m) => m.description)
      .filter(Boolean)
      .join("; ");
    return {
      status: "rejected",
      rejectionReason: reasons || "Unknown rejection reason",
      messages: messages.length > 0 ? messages : undefined,
    };
  }

  return { status: "pending" };
}

/** Parse legacy ack format for backward compatibility */
function parseLegacyAck(ack: Record<string, unknown>): AcknowledgementResult {
  const status = ack.Status || ack.status;
  if (status === "A" || status === "Accepted") {
    const bsaId = ack.BSAId || ack.bsaId || ack.TrackingId;
    return { status: "accepted", bsaId: bsaId ? String(bsaId) : undefined };
  } else if (status === "R" || status === "Rejected") {
    const reason = (ack.ErrorMessage || ack.Reason || "Unknown rejection reason") as string;
    return { status: "rejected", rejectionReason: reason };
  }
  return { status: "pending" };
}
