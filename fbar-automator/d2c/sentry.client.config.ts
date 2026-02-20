import * as Sentry from "@sentry/nextjs";
import { scrubPii } from "./src/lib/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend(event) {
    return scrubPii(event as unknown as Parameters<typeof scrubPii>[0]) as unknown as typeof event;
  },
});
