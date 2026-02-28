"use client";

import { useState, useRef, FormEvent } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const SUBJECT_OPTIONS = [
  "General Question",
  "Filing Help",
  "Billing",
  "Technical Issue",
  "Other",
] as const;

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState<string>(SUBJECT_OPTIONS[0]);
  const [message, setMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

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
        body: JSON.stringify({ name, email, subject, message, turnstileToken }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
      setName("");
      setEmail("");
      setSubject(SUBJECT_OPTIONS[0]);
      setMessage("");
      setTurnstileToken(null);
      turnstileRef.current?.reset();
    } catch {
      setError("Unable to send your message. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClasses =
    "w-full border border-border-gray px-3 py-2 text-sm text-text-primary bg-white focus:outline-none focus:ring-2 focus:ring-gov-blue focus:border-gov-blue transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Success message */}
      {success && (
        <div
          role="status"
          className="bg-green-50 border border-green-300 text-green-800 px-4 py-3 text-sm rounded"
        >
          Your message has been sent. We&apos;ll respond within 1 business day.
        </div>
      )}

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 text-sm rounded"
        >
          {error}
        </div>
      )}

      {/* Name */}
      <div>
        <label htmlFor="contact-name" className="block text-sm font-semibold text-text-primary mb-1">
          Name <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-name"
          type="text"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClasses}
          autoComplete="name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="contact-email" className="block text-sm font-semibold text-text-primary mb-1">
          Email <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <input
          id="contact-email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClasses}
          autoComplete="email"
        />
      </div>

      {/* Subject */}
      <div>
        <label htmlFor="contact-subject" className="block text-sm font-semibold text-text-primary mb-1">
          Subject
        </label>
        <select
          id="contact-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className={inputClasses}
        >
          {SUBJECT_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="contact-message" className="block text-sm font-semibold text-text-primary mb-1">
          Message <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <textarea
          id="contact-message"
          required
          minLength={10}
          maxLength={5000}
          rows={6}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={inputClasses}
          placeholder="How can we help?"
        />
        <p className="text-xs text-text-secondary mt-1">Minimum 10 characters</p>
      </div>

      {/* Turnstile */}
      {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken(null)}
          onExpire={() => setTurnstileToken(null)}
        />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gov-blue hover:bg-gov-blue-dark text-white font-semibold text-sm px-6 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
