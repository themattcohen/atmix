import { anthropic } from "@ai-sdk/anthropic";
import * as Sentry from "@sentry/nextjs";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { FBAR_SYSTEM_PROMPT } from "@/lib/knowledge-base";
import { z } from "zod";

export const maxDuration = 30;

/* ---------- Validation ---------- */

const messagePartSchema = z.object({
  type: z.string(),
  text: z.string().max(2000).optional(),
}).passthrough();

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(messagePartSchema).optional(),
  content: z.string().max(2000).optional(),
}).passthrough();

const chatRequestSchema = z.object({
  messages: z.array(uiMessageSchema).max(20, "Too many messages"),
  turnstileToken: z.string().min(1, "Security verification is required"),
});

/* ---------- Turnstile verification ---------- */

async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Skip verification in dev when secret is not configured
  if (!secret) {
    console.warn("[chat] TURNSTILE_SECRET_KEY not set — skipping verification");
    return true;
  }

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    }
  );

  const result = await res.json();
  return result.success === true;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || "Invalid input";
      return new Response(JSON.stringify({ error: firstError }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages, turnstileToken } = parsed.data;

    // Verify Turnstile
    const turnstileOk = await verifyTurnstile(turnstileToken);
    if (!turnstileOk) {
      return new Response(
        JSON.stringify({ error: "Security verification failed. Please try again." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const result = streamText({
      model: anthropic("claude-haiku-4-5-20251001"),
      system: FBAR_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages as UIMessage[]),
      maxOutputTokens: 500,
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    Sentry.captureException(error);
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
