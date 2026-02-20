import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "./src/lib/sentry";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    return scrubPii(event as unknown as Parameters<typeof scrubPii>[0]) as unknown as typeof event;
  },
});
