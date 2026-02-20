/**
 * Sanitize a file name by removing dangerous characters.
 * Strips null bytes, path traversal sequences, path separators,
 * and Windows reserved characters. Preserves the file extension.
 * Enforces a 255-character maximum.
 */
export function sanitizeFileName(name: string): string {
  if (!name) return `upload_${Date.now()}`;

  // Remove null bytes, path traversal, path separators, Windows reserved chars
  let sanitized = name
    .replace(/\0/g, "")           // null bytes
    .replace(/\.\./g, "")         // path traversal
    .replace(/[/\\]/g, "")        // path separators
    .replace(/[<>:"|?*]/g, "")    // Windows reserved chars
    .trim();

  if (!sanitized) return `upload_${Date.now()}`;

  // Enforce 255-char max with extension preservation
  if (sanitized.length > 255) {
    const lastDot = sanitized.lastIndexOf(".");
    if (lastDot > 0) {
      const ext = sanitized.slice(lastDot); // e.g., ".pdf"
      const base = sanitized.slice(0, 255 - ext.length);
      sanitized = base + ext;
    } else {
      sanitized = sanitized.slice(0, 255);
    }
  }

  return sanitized;
}
