import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "./src/lib/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // scrubPii operates on the same shape; cast through unknown for SDK type compat
    return scrubPii(event as unknown as Parameters<typeof scrubPii>[0]) as unknown as typeof event;
  },
});
