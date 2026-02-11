# Sara Sharp Knowledge Base Extractor

A comprehensive toolkit for extracting Sara Sharp's content from multiple sources and building a RAG-ready knowledge base.

## Quick Start

```bash
# Install dependencies
pip install yt-dlp feedparser beautifulsoup4 requests pymupdf

# Extract everything available
python sara_content_extractor.py --all

# Or extract specific sources
python sara_content_extractor.py --youtube --blog
```

## Content Sources

| Source | Status | Credentials Needed | Est. Content |
|--------|--------|-------------------|--------------|
| YouTube (@dealmakerseta) | Ready | None | 100+ videos |
| SK&S Law Blog | Ready | None | 20+ articles |
| Book (PDF) | Ready | File access | 1 book |
| Dealmakers Podcast | Ready | None (RSS) | 20+ episodes |
| Deal Academy (Teachable) | Needs setup | Login credentials | Courses |
| LinkedIn Posts | Needs export | Data export or API | 100+ posts |
| Media Features | Manual | None | Various |

## Detailed Setup

### 1. YouTube Transcripts (Primary Source)

Extracts auto-generated captions from all videos on the channel.

```bash
python sara_content_extractor.py --youtube
```

**What it does:**
- Fetches list of all videos from @dealmakerseta
- Downloads auto-captions (VTT/SRT format)
- Cleans and deduplicates caption text
- Outputs structured JSON with metadata

**Troubleshooting:**
- If you get SSL errors, the script includes `--no-check-certificate`
- If you get 403 errors, try running from a different network
- YouTube may rate-limit; the script handles timeouts gracefully

### 2. Blog Articles

Scrapes all articles from SK&S Law Group blog.

```bash
python sara_content_extractor.py --blog
```

**What it extracts:**
- Article title, URL, full text content
- Word count for each article
- Automatic deduplication

### 3. Book (PDF)

Extracts and chunks a PDF book for RAG.

```bash
python sara_content_extractor.py --book /path/to/sara_book.pdf
```

**What it does:**
- Extracts text from all pages
- Detects chapter headings and creates chunks
- Preserves page numbers for reference
- Creates both chapter-level and full-text outputs

### 4. Podcast Audio Transcription

For podcast episodes that need audio transcription (no captions available).

```bash
# Using OpenAI Whisper API (fast, costs ~$0.006/minute)
export OPENAI_API_KEY=your_key_here
python transcribe_audio.py --api /path/to/episode.mp3

# Using local Whisper (free but slower)
pip install openai-whisper
python transcribe_audio.py --local /path/to/episode.mp3 --model base

# Download and transcribe from URL
python transcribe_audio.py --download "https://podcast-url.com/episode.mp3" --api
```

**Model options for local Whisper:**
- `tiny`: Fastest, least accurate
- `base`: Good balance (recommended)
- `small`: Better accuracy
- `medium`: High accuracy
- `large`: Best accuracy, needs GPU

### 5. Deal Academy Courses

Requires Teachable login credentials.

```bash
python sara_content_extractor.py --deal-academy --email your@email.com --password yourpass
```

Or set environment variables:
```bash
export TEACHABLE_EMAIL=your@email.com
export TEACHABLE_PASSWORD=yourpassword
python sara_content_extractor.py --deal-academy
```

### 6. LinkedIn Posts

LinkedIn requires data export or API access.

**Option A: Manual Export (Easiest)**
1. Go to LinkedIn Settings > Data Privacy > Get a copy of your data
2. Request "Posts" data
3. Download the ZIP file
4. Extract and provide the file path:

```bash
python sara_content_extractor.py --linkedin /path/to/linkedin_posts.csv
```

**Option B: PhantomBuster**
1. Sign up at phantombuster.com
2. Use "LinkedIn Activity Extractor" phantom
3. Export results as JSON
4. Provide file path to script

## Output Files

After extraction, you'll find these files in `./sara_knowledge_base/`:

```
sara_knowledge_base/
├── sara_knowledge_base.json    # Full structured data
├── sara_knowledge_base.md      # Human-readable summary
└── sara_rag_chunks.json        # Chunked for RAG (1000 words max)
```

### JSON Structure

```json
{
  "metadata": {
    "subject": "Sara Sharp",
    "created_at": "2026-01-26T...",
    "total_items": 150,
    "total_words": 250000,
    "sources": [
      {"type": "youtube", "count": 100, "total_words": 200000},
      {"type": "blog", "count": 20, "total_words": 10000}
    ]
  },
  "content": [
    {
      "id": "abc123",
      "source": "youtube",
      "source_type": "video_transcript",
      "title": "How to Buy an Accounting Firm",
      "url": "https://youtube.com/watch?v=...",
      "content": "Full transcript text...",
      "word_count": 2500,
      "extracted_at": "2026-01-26T..."
    }
  ]
}
```

### RAG Chunks Structure

Chunks are optimized for vector database ingestion:
- Target size: 1000 words
- Overlap: 200 words between chunks
- Preserves source metadata

```json
{
  "chunks": [
    {
      "id": "abc123-0",
      "chunk_index": 0,
      "source": "youtube",
      "source_type": "video_transcript",
      "title": "How to Buy an Accounting Firm",
      "url": "https://youtube.com/watch?v=...",
      "content": "Chunk text...",
      "word_count": 1000
    }
  ]
}
```

## Loading into RAG Systems

### CustomGPT.ai / Chatbase (Simplest)

1. Run extraction
2. Upload `sara_knowledge_base.json` or individual source files
3. Configure chatbot settings

### Supabase pgvector

```sql
-- Create table
CREATE TABLE sara_knowledge (
  id TEXT PRIMARY KEY,
  source TEXT,
  source_type TEXT,
  title TEXT,
  url TEXT,
  content TEXT,
  word_count INT,
  embedding VECTOR(1536)
);

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;
```

```python
# Load chunks
import json
from openai import OpenAI
from supabase import create_client

client = OpenAI()
supabase = create_client(url, key)

with open('sara_rag_chunks.json') as f:
    chunks = json.load(f)['chunks']

for chunk in chunks:
    # Generate embedding
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=chunk['content']
    )
    embedding = response.data[0].embedding
    
    # Insert
    supabase.table('sara_knowledge').insert({
        **chunk,
        'embedding': embedding
    }).execute()
```

### Pinecone

```python
import pinecone
from openai import OpenAI

pinecone.init(api_key="your-key", environment="your-env")
index = pinecone.Index("sara-knowledge")

client = OpenAI()

with open('sara_rag_chunks.json') as f:
    chunks = json.load(f)['chunks']

vectors = []
for chunk in chunks:
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=chunk['content']
    )
    vectors.append({
        'id': chunk['id'],
        'values': response.data[0].embedding,
        'metadata': {
            'source': chunk['source'],
            'title': chunk['title'],
            'url': chunk.get('url', ''),
            'content': chunk['content'][:1000]  # Pinecone metadata limit
        }
    })

# Batch upsert
index.upsert(vectors=vectors, batch_size=100)
```

## Recommended Extraction Order

1. **YouTube** - Largest content source, run first
2. **Blog** - Quick extraction, valuable written content
3. **Book** - Add if PDF available
4. **Podcast** - Run after YouTube (may have overlap)
5. **LinkedIn** - Requires manual export
6. **Deal Academy** - Add courses with credentials

## Maintenance

### Updating the Knowledge Base

Run extraction periodically to capture new content:

```bash
# Re-run all sources
python sara_content_extractor.py --all

# Or specific sources
python sara_content_extractor.py --youtube  # New videos
python sara_content_extractor.py --blog     # New articles
```

The script generates unique IDs based on content, so duplicates are avoided.

### Content Quality Check

After extraction, review:
1. `sara_knowledge_base.md` for quick overview
2. Check word counts - very short items may be navigation/error pages
3. Sample content in JSON to verify quality

## Troubleshooting

### "No subtitles available" for YouTube

Some videos may not have auto-generated captions. Options:
1. Use Whisper to transcribe downloaded audio
2. Check if manual captions exist in other languages

### SSL Certificate Errors

The script includes `--no-check-certificate` flag. If issues persist:
```bash
pip install --upgrade certifi
export SSL_CERT_FILE=$(python -c "import certifi; print(certifi.where())")
```

### Rate Limiting

YouTube and other services may rate-limit requests. The script:
- Uses reasonable timeouts
- Handles errors gracefully
- Can be re-run to continue where it left off

### Missing Dependencies

```bash
# Full installation
pip install yt-dlp feedparser beautifulsoup4 requests pymupdf

# For Whisper transcription
pip install openai  # API
pip install openai-whisper  # Local
```

## File Manifest

```
/home/claude/
├── sara_content_extractor.py   # Main extraction script
├── transcribe_audio.py         # Whisper transcription helper
├── README.md                   # This file
├── sara_knowledge_base/        # Output directory
│   ├── sara_knowledge_base.json
│   ├── sara_knowledge_base.md
│   └── sara_rag_chunks.json
└── transcripts/                # Raw transcript files
```
