# Next Steps for Sara Sharp Knowledge Base

## Current State (January 2026)

### What's Working
- **511 content chunks** indexed and searchable
- **Semantic search** using sentence-transformers (all-MiniLM-L6-v2)
- **FastAPI server** at http://127.0.0.1:8000
- **Web frontend** with search, filtering, dark mode
- **Source filtering** (All / YouTube / Blog)

### What's NOT Working Yet
- **Claude API integration** - search returns raw chunks, not synthesized answers
- **Additional data sources** - only YouTube and blog content indexed

---

## Priority 1: Claude API Integration

### What It Does
Transforms the system from a search engine to a Q&A assistant:

| Without Claude | With Claude |
|----------------|-------------|
| Shows 10 raw text excerpts | Synthesizes one coherent answer |
| "Here's what I found" | "Here's the answer to your question" |
| User reads and interprets | Claude interprets and explains |

### What I Need From You
1. **Anthropic API Key** - Get from https://console.anthropic.com/
2. Add to `.env` file in project root:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

### What I'll Build
- New `/api/ask` endpoint
- Takes question + retrieves relevant chunks
- Sends to Claude with system prompt about Sara Sharp's style
- Returns synthesized answer with source citations

---

## Priority 2: Additional Data Sources

### Podcast
**What I need:** RSS feed URL
**How to find it:**
- If on Spotify: Spotify for Podcasters dashboard → Distribution → RSS feed
- If on Apple: Look in podcast settings or Buzzsprout/Anchor dashboard
- Generic: Search "[podcast name] RSS feed"

**What I'll do:** Extract episode descriptions and transcribe audio

### Book
**What I need:** PDF file of Sara's book
**How to provide:** Drop file in `data/raw/book/` folder

**What I'll do:** Extract text, chunk by chapter/section, embed

### LinkedIn
**What I need:** LinkedIn data export
**How to get it:**
1. Go to LinkedIn Settings
2. "Get a copy of your data"
3. Select posts, articles, comments
4. Download ZIP when ready

**What I'll do:** Parse posts/articles, normalize, embed

### Deal Academy (Teachable)
**What I need:** Either:
- Teachable API access, OR
- Manual export of course content

**What I'll do:** Structure by course → module → lesson, embed

### Newsletter
**What I need:** Either:
- GoHighLevel export/API access, OR
- Folder of saved newsletter HTML/text files

**What I'll do:** Parse, deduplicate, normalize, embed

---

## Priority 3: Production Deployment (Optional)

If you want to make this publicly accessible:

### Option A: Simple (Recommended for now)
- Run on your Mac when needed
- Access via localhost or local network

### Option B: Cloud Hosting
**What I need:**
- Hosting preference (Vercel, Railway, Render, etc.)
- Domain name (optional)
- Authentication decision (public vs password-protected)

**Considerations:**
- FAISS index is ~2MB, loads fast
- API is lightweight, minimal server needed
- Could run on free tier of most platforms

---

## Technical Debt / Future Improvements

### Performance
- [ ] Cache embeddings for repeated queries
- [ ] Batch embedding generation for new content
- [ ] Precompute popular query results

### Features
- [ ] Conversation history (multi-turn Q&A)
- [ ] "Related content" suggestions
- [ ] Search within specific videos/articles
- [ ] Timestamp links for YouTube videos
- [ ] Export search results

### Data Quality
- [ ] Review chunk boundaries for coherence
- [ ] Add more metadata (dates, categories, tags)
- [ ] Cross-reference related content
- [ ] Identify and mark "core teachings" vs tangential content

---

## Quick Reference: Running the System

```bash
# Start the server
cd /Users/matt/Documents/someday
python3 scripts/rag/server.py

# Open web UI
open http://127.0.0.1:8000

# Or use CLI
python3 scripts/rag/query_cli.py "your question here"

# Run tests
python3 -m pytest tests/test_rag.py -v
```

---

## Questions for You

1. **Claude API** - Do you have or want to get an Anthropic API key?
2. **Data sources** - Which additional sources are highest priority?
3. **Deployment** - Local only, or do you want it hosted online?
4. **Access control** - If hosted, public or password-protected?
