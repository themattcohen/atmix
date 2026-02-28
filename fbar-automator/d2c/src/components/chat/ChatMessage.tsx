"use client";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML entities first
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold: **text**
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Links: [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="underline text-gov-blue hover:text-gov-blue-dark">$1</a>'
  );

  // Process lines for bullet lists and line breaks
  const lines = html.split("\n");
  const output: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      if (!inList) {
        output.push('<ul class="list-disc list-inside my-1 space-y-0.5">');
        inList = true;
      }
      output.push(`<li>${trimmed.slice(2)}</li>`);
    } else {
      if (inList) {
        output.push("</ul>");
        inList = false;
      }
      if (trimmed === "") {
        output.push("<br/>");
      } else {
        output.push(trimmed + "<br/>");
      }
    }
  }

  if (inList) {
    output.push("</ul>");
  }

  // Remove trailing <br/>
  let result = output.join("");
  while (result.endsWith("<br/>")) {
    result = result.slice(0, -5);
  }

  return result;
}

export function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}
    >
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? "bg-gov-blue text-white"
            : "bg-gray-100 text-text-primary"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div
            className="chat-markdown"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        )}
      </div>
    </div>
  );
}
