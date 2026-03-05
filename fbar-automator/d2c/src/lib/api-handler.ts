import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { log } from "./logger";

type RouteHandler = (req: NextRequest) => Promise<NextResponse> | NextResponse;

export function apiHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
    const start = Date.now();
    const path = req.nextUrl.pathname;

    try {
      const response = await handler(req);
      log("info", `${req.method} ${path}`, {
        status: response.status,
        duration: Date.now() - start,
        requestId,
      });
      return response;
    } catch (error) {
      const duration = Date.now() - start;
      Sentry.captureException(error, {
        extra: { requestId, path, method: req.method, duration },
      });
      log("error", `${req.method} ${path}`, {
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
        requestId,
      });
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 }
      );
    }
  };
}
