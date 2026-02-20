export async function register() {
  // Required for core functionality — fail fast if missing
  const required = ["DATABASE_URL", "NEXTAUTH_SECRET", "NEXTAUTH_URL"];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(
      `[STARTUP] FATAL: Missing required env vars: ${missing.join(", ")}`
    );
    process.exit(1);
  }

  // Required for features — warn if missing
  const featureVars: Record<string, string> = {
    ANTHROPIC_API_KEY: "Document extraction",
    STRIPE_SECRET_KEY: "Payment processing",
    STRIPE_WEBHOOK_SECRET: "Payment webhooks",
    RESEND_API_KEY: "Email sending",
    ENCRYPTION_KEY: "Data encryption",
  };
  for (const [key, feature] of Object.entries(featureVars)) {
    if (!process.env[key]) {
      console.warn(
        `[STARTUP] WARNING: ${key} not set — ${feature} will be disabled`
      );
    }
  }

  // Optional — informational
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn(
      "[STARTUP] INFO: Sentry DSN not configured — error tracking disabled"
    );
  }

  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY) {
    console.warn(
      "[STARTUP] WARNING: S3/MinIO not configured — file uploads will fail"
    );
  }

  console.log("[STARTUP] Configuration validated successfully");
}
