"use client";

import { useState, useRef, type FormEvent } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatEscalationFormProps {
  messages: ChatMessage[];
  onBack: () => void;
}

function buildTranscript(messages: ChatMessage[]): string {
  const lines = messages
    .filter((m) => m.content.trim())
    // Skip the initial greeting message
    .slice(1)
    .map((m) => {
      const label = m.role === "user" ? "[You]" : "[Assistant]";
      return `${label}: ${m.content}`;
    });

  const full = lines.join("\n\n");
  if (full.length <= 10000) return full;

  // Truncate from the beginning (drop oldest) to fit limit
  let truncated = full;
  while (truncated.length > 10000) {
    const idx = truncated.indexOf("\n\n");
    if (idx === -1) break;
    truncated = truncated.slice(idx + 2);
  }
  return "[...earlier messages truncated...]\n\n" + truncated;
}

export function ChatEscalationForm({ messages, onBack }: ChatEscalationFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!turnstileToken) {
      setError("Please complete the security check.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          name,
          email,
          subject: "Chat Escalation",
          message,
          turnstileToken,
          chatTranscript: buildTranscript(messages),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Unable to send your message. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClasses =
    "w-full border border-border-gray px-3 py-2 text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue transition-colors";

  if (success) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="rounded bg-green-50 border border-green-300 text-green-800 px-4 py-3 text-sm">
          Your message has been sent. We&apos;ll respond within 1 business day.
        </div>
        <button
          onClick={onBack}
          className="text-sm font-semibold text-gov-blue hover:text-gov-blue-dark transition-colors"
        >
          Back to Chat
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" noValidate>
      {error && (
        <div role="alert" className="rounded bg-red-50 border border-red-300 text-red-800 px-3 py-2 text-xs">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="esc-name" className="block text-xs font-semibold text-text-primary mb-1">
          Name <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <input
          id="esc-name"
          type="text"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClasses}
          autoComplete="name"
        />
      </div>

      <div>
        <label htmlFor="esc-email" className="block text-xs font-semibold text-text-primary mb-1">
          Email <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <input
          id="esc-email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="esc-message" className="block text-xs font-semibold text-text-primary mb-1">
          Message <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <textarea
          id="esc-message"
          required
          minLength={10}
          maxLength={5000}
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClasses}
          placeholder="How can we help?"
        />
      </div>

      <p className="text-xs text-text-secondary -mt-2">
        Your chat conversation will be included for context.
      </p>

      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          options={{ size: "compact" }}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-4 py-2.5 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending..." : "Send to Support"}
      </button>
    </form>
  );
}
