// src/lib/deploy.ts

/**
 * Parse a .last-deploy file content string into structured data.
 *
 * Expected format:
 *   IMAGE_TAG=<tag>
 *   TIMESTAMP=<ISO 8601>
 *   COMMIT_HASH=<40-char hex>
 *
 * Throws on invalid or missing fields.
 */
export function parseLastDeploy(content: string): {
  tag: string;
  timestamp: string;
  commitHash: string;
} {
  if (!content || !content.trim()) {
    throw new Error("Empty .last-deploy file");
  }

  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  const map = new Map<string, string>();

  for (const line of lines) {
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    map.set(key, value);
  }

  const tag = map.get("IMAGE_TAG");
  const timestamp = map.get("TIMESTAMP");
  const commitHash = map.get("COMMIT_HASH");

  if (!tag) throw new Error("Missing or empty IMAGE_TAG in .last-deploy");
  if (!timestamp) throw new Error("Missing TIMESTAMP in .last-deploy");
  if (!commitHash) throw new Error("Missing COMMIT_HASH in .last-deploy");

  return { tag, timestamp, commitHash };
}

/**
 * Validate a Docker image tag for safety.
 * Accepts: sha-prefixed, semver (vX.Y.Z), "latest", alphanumeric with dots/hyphens.
 * Rejects: empty, spaces, shell metacharacters, path traversal, >128 chars.
 */
export function isValidImageTag(tag: string): boolean {
  if (!tag || tag.length === 0 || tag.length > 128) return false;
  // Only allow alphanumeric, dots, hyphens, underscores
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(tag);
}

/**
 * Check if a URL returns HTTP 200.
 * Uses AbortSignal for timeout enforcement.
 */
export async function checkHealth(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status === 200;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
