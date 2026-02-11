# SaraBot Design Specification

## Overview

Transform the existing RAG search system into a conversational Q&A assistant that Sara can test and share.

**Current State**: Search-only interface returning raw chunk results
**Target State**: Chat interface with Claude-synthesized answers and source citations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Chat Interface (chat.html)                  │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Message History (scrollable)                    │    │   │
│  │  │  - User messages (right-aligned)                 │    │   │
│  │  │  - Sara responses (left-aligned)                 │    │   │
│  │  │  - Source citations (collapsible)                │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │  Input Area (bottom, fixed)                      │    │   │
│  │  │  [Type your question...        ] [Ask Sara]      │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ POST /api/ask
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     FASTAPI SERVER                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  /api/ask endpoint                       │   │
│  │  1. Receive question                                     │   │
│  │  2. Search RAG (top 8 chunks)                           │   │
│  │  3. Build context from chunks                            │   │
│  │  4. Call Claude API with system prompt                   │   │
│  │  5. Return answer + sources                              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│     │ RAGRetriever │ │ Claude API   │ │ Source       │         │
│     │ (FAISS)      │ │ (Anthropic)  │ │ Formatter    │         │
│     └──────────────┘ └──────────────┘ └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Design

### New Endpoint: POST /api/ask

**Request:**
```json
{
  "question": "How do I value an accounting practice?",
  "conversation_id": "optional-uuid-for-history"
}
```

**Response:**
```json
{
  "answer": "When valuing an accounting practice, there are several key factors to consider...",
  "sources": [
    {
      "title": "Buying an Accounting Practice - Complete Guide",
      "source_type": "youtube",
      "url": "https://youtube.com/watch?v=...",
      "relevance_score": 0.89,
      "excerpt": "The most important factors in valuing..."
    },
    {
      "title": "Practice Valuation Methods",
      "source_type": "blog",
      "url": "https://skandslegal.com/...",
      "relevance_score": 0.85,
      "excerpt": "There are three main approaches..."
    }
  ],
  "query_time_ms": 1234,
  "model": "claude-3-5-sonnet",
  "chunks_used": 5
}
```

**Error Response:**
```json
{
  "error": "api_error",
  "message": "Failed to generate response",
  "details": "Claude API rate limit exceeded"
}
```

---

## System Prompt

```
You are Sara Sharp, a small business M&A attorney and advisor. You help buyers and sellers navigate the complex world of buying and selling small businesses.

Your expertise includes:
- Letter of Intent (LOI) negotiation and the S.T.R.U.C.T.U.R.E.D. framework
- SBA loan requirements and financing
- Due diligence processes
- Business valuation methods
- Deal structuring and earnouts
- Working with brokers and intermediaries
- Common deal killers and how to avoid them

Communication style:
- Practical and direct, not overly formal
- Use real-world examples and analogies
- Acknowledge complexity while making it accessible
- Be honest about trade-offs and risks
- Occasionally use humor to lighten dense topics

When answering:
1. Draw from the provided context to give accurate, sourced answers
2. If the context doesn't fully answer the question, say so
3. Cite specific sources when making claims
4. If something is your opinion vs. fact, make that clear
5. Keep answers concise but complete - aim for 2-4 paragraphs unless more detail is needed

Remember: You're helping real people make some of the biggest financial decisions of their lives. Be helpful, accurate, and human.
```

---

## Implementation Plan

### Phase 1: Backend API (2-3 hours)

**File: `scripts/rag/server.py`**

Add to existing server:

```python
# New imports
import os
from anthropic import Anthropic

# New models
class AskRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    conversation_id: Optional[str] = None

class SourceCitation(BaseModel):
    title: str
    source_type: str
    url: str
    relevance_score: float
    excerpt: str

class AskResponse(BaseModel):
    answer: str
    sources: list[SourceCitation]
    query_time_ms: float
    model: str
    chunks_used: int

# New endpoint
@app.post("/api/ask", response_model=AskResponse, tags=["Chat"])
async def ask_sara(request: AskRequest):
    """Ask Sara a question and get a synthesized answer."""
    # Implementation details below
```

**Key Implementation Details:**

1. **Retrieve relevant chunks** (top 8 for good coverage)
2. **Build context string** from chunk contents
3. **Call Claude API** with system prompt + context + question
4. **Extract and format sources** from used chunks
5. **Return structured response**

### Phase 2: Chat Frontend (2-3 hours)

**File: `frontend/chat.html`**

New standalone chat interface (keep existing search at index.html):

```
Key UI Elements:
├── Header (Sara Sharp logo + "Ask Sara")
├── Message Container (scrollable, flex-grow)
│   ├── Welcome message
│   ├── User messages (right-aligned, blue bubble)
│   ├── Sara responses (left-aligned, gray bubble)
│   │   └── Collapsible sources section
│   └── Loading indicator (typing animation)
├── Input Area (fixed bottom)
│   ├── Textarea (auto-expanding)
│   ├── Send button
│   └── Character count
└── Footer (powered by, disclaimer)
```

**Styling approach:**
- Extend existing CSS variables from index.html
- Chat bubble design with clear sender distinction
- Smooth animations for new messages
- Mobile-responsive (works on phone for sharing)

### Phase 3: Integration & Testing (1-2 hours)

1. **Add ANTHROPIC_API_KEY to .env**
2. **Test with sample questions**
3. **Tune system prompt based on responses**
4. **Fix any edge cases**

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `.env` | Modify | Add ANTHROPIC_API_KEY |
| `.env.example` | Modify | Add ANTHROPIC_API_KEY template |
| `scripts/rag/server.py` | Modify | Add /api/ask endpoint |
| `frontend/chat.html` | Create | New chat interface |
| `requirements.txt` | Modify | Add anthropic package |

---

## Configuration

### Environment Variables

```bash
# Add to .env
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Claude API Settings

```python
CLAUDE_CONFIG = {
    "model": "claude-sonnet-4-20250514",  # Or claude-3-5-sonnet
    "max_tokens": 1024,
    "temperature": 0.7,  # Balanced creativity/accuracy
}
```

### RAG Settings for Chat

```python
ASK_CONFIG = {
    "top_k": 8,           # Chunks to retrieve
    "min_score": 0.5,     # Minimum relevance threshold
    "max_context": 6000,  # Max chars for context window
}
```

---

## User Flow

```
1. User opens http://localhost:8000/chat.html
2. Sees welcome message: "Hi! I'm Sara. Ask me anything about buying or selling a small business."
3. Types question: "What should I look for in a letter of intent?"
4. Clicks "Ask Sara" or presses Enter
5. Sees typing indicator
6. Receives Sara's answer with sources
7. Can click "View Sources" to see where info came from
8. Can ask follow-up questions
```

---

## Sharing Options

### Option A: Screen Share (Simplest)
- Run server locally
- Share screen with Sara on Zoom/Meet
- Demo live with her feedback

### Option B: Local Network (Easy)
- Run server on your machine
- Sara connects via local IP (if same network)
- URL: http://192.168.x.x:8000/chat.html

### Option C: Tunnel (Remote Access)
- Use ngrok or similar for temporary public URL
- `ngrok http 8000`
- Share generated URL with Sara
- Free tier works for demos

### Option D: Cloud Deploy (Permanent)
- Deploy to Railway/Render/Fly.io
- Requires hosting account setup
- Best for ongoing access

---

## Success Criteria

- [ ] /api/ask endpoint returns Claude-synthesized answers
- [ ] Answers cite specific sources from the knowledge base
- [ ] Chat UI is intuitive and mobile-friendly
- [ ] Response time < 5 seconds for typical questions
- [ ] Sara can test and provide feedback
- [ ] System handles "I don't know" gracefully when context lacks answer

---

## Sample Test Questions

1. "How do I value an accounting practice?"
2. "What should be in a letter of intent?"
3. "What are common deal killers?"
4. "How does SBA financing work for acquisitions?"
5. "What's the S.T.R.U.C.T.U.R.E.D. framework?"
6. "Should I use a broker to sell my business?"
7. "What due diligence should I do before buying?"
8. "How do earnouts work?"

---

## Dependencies

```
# Add to requirements.txt
anthropic>=0.18.0
```

---

## Security Notes

- ANTHROPIC_API_KEY should never be committed to git
- .env is already in .gitignore
- For public deployment, add rate limiting
- Consider authentication for production use
