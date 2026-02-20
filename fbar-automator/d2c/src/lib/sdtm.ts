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
    port: parseInt(process.env.SDTM_PORT || "22"),
    username: process.env.SDTM_USERNAME,
    readyTimeout: 10000,
  };

  const keyPath = process.env.SDTM_PRIVATE_KEY_PATH;
  if (keyPath) {
    if (!fs.existsSync(keyPath)) {
      throw new Error(`SFTP private key not found at: ${keyPath}`);
    }
    config.privateKey = fs.readFileSync(keyPath);
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
    console.warn("[SDTM] SFTP_HOST_KEY not set — skipping host key verification (unsafe for production)");
  }

  return config;
}

export async function submitBatch(
  xmlContent: string,
  batchId: string
): Promise<SubmissionResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `FBAR_DIRECT_${batchId}_${timestamp}.xml`;
  const remoteDir = process.env.SDTM_REMOTE_DIR || "/upload";
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

export async function checkAcknowledgement(
  batchId: string
): Promise<AcknowledgementResult> {
  if (isSandbox()) {
    console.warn("[SDTM SANDBOX] Checking acknowledgement for batch:", batchId);
    return { status: "pending" };
  }

  return new Promise((resolve) => {
    const conn = new SFTPClient();

    conn.on("ready", () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          resolve({ status: "pending" });
          return;
        }

        const ackDir = process.env.SDTM_REMOTE_DIR
          ? process.env.SDTM_REMOTE_DIR.replace(/\/upload\/?$/, "/download")
          : "/download";

        sftp.readdir(ackDir, (readErr, list) => {
          if (readErr || !list) {
            conn.end();
            resolve({ status: "pending" });
            return;
          }

          const ackFile = list.find(
            (f) => f.filename.includes(batchId) && f.filename.endsWith(".xml")
          );

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
              const parser = new XMLParser();
              const parsed = parser.parse(data.toString("utf-8"));
              const ack = parsed?.EFilingBatchAcknowledgement || parsed?.acknowledgement;

              if (!ack) {
                resolve({ status: "pending" });
                return;
              }

              const status = ack.Status || ack.status;
              if (status === "A" || status === "Accepted") {
                const bsaId = ack.BSAId || ack.bsaId || ack.TrackingId;
              if (!bsaId) {
                resolve({ status: "accepted" });
                return;
              }
              resolve({ status: "accepted", bsaId: String(bsaId) });
              } else if (status === "R" || status === "Rejected") {
                const reason = ack.ErrorMessage || ack.Reason || "Unknown rejection reason";
                resolve({ status: "rejected", rejectionReason: reason });
              } else {
                resolve({ status: "pending" });
              }
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
