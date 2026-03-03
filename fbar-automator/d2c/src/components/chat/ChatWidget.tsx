"use client";

import { useChat } from "@ai-sdk/react";
import { MessageCircle, X, Send, Mail, ArrowLeft } from "lucide-react";
import { ChatEscalationForm } from "./ChatEscalationForm";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { ChatMessage } from "./ChatMessage";

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<"chat" | "escalation">("chat");
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status } = useChat({
    messages: [
      {
        id: "greeting",
        role: "assistant" as const,
        parts: [
          {
            type: "text" as const,
            text: "Hello! I'm the FBAR Direct support assistant. I can help you with questions about FBAR filing requirements, how our service works, pricing, and more. How can I help you?",
          },
        ],
      },
    ],
  });

  const isLoading = status === "streaming" || status === "submitted";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Auto-scroll when messages change or loading state changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Focus textarea when chat opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`;
    }
  }, [input]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input });
    setInput("");
  }, [input, isLoading, sendMessage]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = input.trim().length > 0 && !isLoading;

  // Extract text content from message parts
  function getMessageContent(message: (typeof messages)[number]): string {
    if ("parts" in message && Array.isArray(message.parts)) {
      return message.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");
    }
    return "";
  }

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gov-blue text-white shadow-lg transition-transform hover:scale-105 hover:bg-gov-blue-dark focus:outline-none focus:ring-2 focus:ring-gov-blue focus:ring-offset-2"
          aria-label="Open chat assistant"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-5 right-5 z-50 flex flex-col overflow-hidden rounded-xl border border-border-gray bg-white shadow-2xl"
          style={{
            width: "min(400px, calc(100vw - 40px))",
            height: "min(520px, calc(100vh - 40px))",
          }}
          role="dialog"
          aria-label="Chat assistant"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-gov-blue px-4 py-3">
            <div className="flex items-center gap-2">
              {view === "escalation" && (
                <button
                  onClick={() => setView("chat")}
                  className="rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Back to chat"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <h2 className="font-heading text-sm font-bold text-white">
                {view === "chat" ? "FBAR Direct Assistant" : "Email Support"}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {view === "chat" && (
                <button
                  onClick={() => setView("escalation")}
                  className="rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                  aria-label="Email support"
                  title="Email support"
                >
                  <Mail className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => { setIsOpen(false); setView("chat"); }}
                className="rounded p-1 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Close chat assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {view === "chat" ? (
            <>
              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role as "user" | "assistant"}
                    content={getMessageContent(message)}
                  />
                ))}

                {/* Loading indicator */}
                {isLoading &&
                  messages.length > 0 &&
                  (messages[messages.length - 1].role as string) === "user" && (
                    <div className="mb-3 flex justify-start">
                      <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-text-secondary">
                        <span className="inline-flex items-center gap-1">
                          <span
                            className="animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          >
                            .
                          </span>
                          <span
                            className="animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          >
                            .
                          </span>
                        </span>
                      </div>
                    </div>
                  )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="flex items-end gap-2 border-t border-border-gray px-3 py-2"
              >
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Type your question..."
                  rows={1}
                  className="max-h-24 flex-1 resize-none rounded-lg border border-border-gray bg-gray-50 px-3 py-2 font-body text-sm text-text-primary placeholder:text-text-secondary focus:border-gov-blue focus:outline-none focus:ring-1 focus:ring-gov-blue"
                  aria-label="Chat message input"
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gov-blue text-white transition-colors hover:bg-gov-blue-dark focus:outline-none focus:ring-2 focus:ring-gov-blue focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <ChatEscalationForm
              messages={messages.map((m) => ({
                role: m.role,
                content: getMessageContent(m),
              }))}
              onBack={() => setView("chat")}
            />
          )}
        </div>
      )}
    </>
  );
}
