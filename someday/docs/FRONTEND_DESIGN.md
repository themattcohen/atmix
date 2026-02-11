# Sara Sharp Knowledge Base - Frontend Design Document

**Version:** 1.0
**Date:** 2026-01-26
**Status:** Implementation Ready

---

## 1. Overview

A clean, professional web interface for querying the Sara Sharp Knowledge Base RAG system. The frontend provides semantic search capabilities with real-time results, source filtering, and responsive design.

---

## 2. Wireframes

### 2.1 Desktop Layout (1200px+)

```
+------------------------------------------------------------------+
|  [SS Logo]   Sara Sharp Knowledge Base          [Dark/Light Mode] |
+------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |  [Search icon] Ask anything about M&A, valuations, deals...  |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +------------------+  +------------------+  +-----------------+   |
|  | [x] All Sources  |  | [ ] YouTube      |  | [ ] Blog        |   |
|  +------------------+  +------------------+  +-----------------+   |
|                                                                    |
|  Results: 5 matches (42ms)                                         |
|  +--------------------------------------------------------------+  |
|  |  [YouTube Badge]  Score: 0.847                                |  |
|  |  How to Structure an Earnout in Acquisitions                  |  |
|  |  ------------------------------------------------------------ |  |
|  |  "When structuring an earnout, you want to make sure the      |  |
|  |  metrics are objective and measurable. I always recommend..." |  |
|  |  [View Original ->]                                           |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
|  +--------------------------------------------------------------+  |
|  |  [Blog Badge]     Score: 0.812                                |  |
|  |  Understanding Deal Structures                                |  |
|  |  ------------------------------------------------------------ |  |
|  |  "Earnouts can be a powerful tool for bridging valuation      |  |
|  |  gaps between buyers and sellers. Here's what you need..."    |  |
|  |  [View Original ->]                                           |  |
|  +--------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
|  Powered by Sara Sharp Knowledge Base | v1.0                      |
+------------------------------------------------------------------+
```

### 2.2 Mobile Layout (<768px)

```
+--------------------------------+
|  [SS]  Knowledge Base    [DM]  |
+--------------------------------+
|                                |
|  +----------------------------+ |
|  | [Search] Ask anything...   | |
|  +----------------------------+ |
|                                |
|  [All] [YouTube] [Blog]        |
|                                |
|  5 results (42ms)              |
|                                |
|  +----------------------------+ |
|  | [YouTube]     Score: 0.847 | |
|  | How to Structure an...     | |
|  | -------------------------- | |
|  | "When structuring an       | |
|  | earnout, you want to..."   | |
|  | [View Original ->]         | |
|  +----------------------------+ |
|                                |
|  +----------------------------+ |
|  | [Blog]        Score: 0.812 | |
|  | Understanding Deal...      | |
|  | ...                        | |
|  +----------------------------+ |
|                                |
+--------------------------------+
```

### 2.3 Loading State

```
+--------------------------------------------------------------+
|  [Search icon] earnout structure                    [Loading] |
+--------------------------------------------------------------+
|                                                                |
|  +----------------------------------------------------------+  |
|  |  [████████░░░░░░░░░░░░]  Searching knowledge base...     |  |
|  +----------------------------------------------------------+  |
|                                                                |
```

### 2.4 Empty State

```
+--------------------------------------------------------------+
|                                                                |
|               [Search Icon - Large]                            |
|                                                                |
|         Ask a question about M&A, valuations,                  |
|         deal structures, or business acquisitions              |
|                                                                |
|         Example queries:                                       |
|         - "How do I value an accounting practice?"             |
|         - "What should be in a letter of intent?"              |
|         - "How to retain employees after acquisition?"         |
|                                                                |
+--------------------------------------------------------------+
```

### 2.5 Error State

```
+--------------------------------------------------------------+
|                                                                |
|               [Warning Icon]                                   |
|                                                                |
|         Unable to connect to the knowledge base                |
|                                                                |
|         [Retry Button]                                         |
|                                                                |
+--------------------------------------------------------------+
```

---

## 3. Component Breakdown

### 3.1 Component Hierarchy

```
App
├── Header
│   ├── Logo
│   ├── Title
│   └── ThemeToggle
├── SearchSection
│   ├── SearchInput
│   └── FilterTabs
│       └── FilterButton (x3: All, YouTube, Blog)
├── ResultsSection
│   ├── ResultsHeader (count + timing)
│   ├── ResultsList
│   │   └── ResultCard (x n)
│   │       ├── SourceBadge
│   │       ├── ScoreIndicator
│   │       ├── Title
│   │       ├── ContentSnippet
│   │       └── OriginalLink
│   ├── LoadingState
│   ├── EmptyState
│   └── ErrorState
└── Footer
```

### 3.2 Component Specifications

#### SearchInput
- **Type:** Input with icon
- **Behavior:** Debounced search (300ms delay)
- **States:** Empty, Focused, Loading, Error
- **Accessibility:**
  - `role="searchbox"`
  - `aria-label="Search knowledge base"`
  - Clear button with keyboard support

#### FilterButton
- **Type:** Toggle button group
- **States:** Active, Inactive, Hover
- **Behavior:** Single selection (All, YouTube, Blog)
- **Accessibility:**
  - `role="tablist"` for container
  - `role="tab"` for each button
  - `aria-selected` state

#### ResultCard
- **Type:** Card container
- **Sections:**
  - Header: Badge + Score
  - Body: Title + Snippet
  - Footer: Link
- **Accessibility:**
  - `role="article"`
  - `aria-labelledby` linked to title

#### SourceBadge
- **Type:** Inline badge
- **Variants:**
  - YouTube: Red background (#FF0000)
  - Blog: Blue background (#3B82F6)
- **Content:** Icon + Text

#### ScoreIndicator
- **Type:** Visual indicator
- **Format:** "Score: 0.XXX"
- **Color coding:**
  - High (>0.8): Green
  - Medium (0.5-0.8): Yellow
  - Low (<0.5): Gray

---

## 4. Color Scheme

### 4.1 Light Mode

| Element | Color | Hex |
|---------|-------|-----|
| Background | White | #FFFFFF |
| Surface | Light Gray | #F9FAFB |
| Border | Medium Gray | #E5E7EB |
| Text Primary | Dark Gray | #111827 |
| Text Secondary | Medium Gray | #6B7280 |
| Accent Primary | Blue | #3B82F6 |
| Accent Hover | Dark Blue | #2563EB |
| Success | Green | #10B981 |
| Warning | Yellow | #F59E0B |
| Error | Red | #EF4444 |
| YouTube Badge | Red | #FF0000 |
| Blog Badge | Blue | #3B82F6 |

### 4.2 Dark Mode

| Element | Color | Hex |
|---------|-------|-----|
| Background | Dark Gray | #111827 |
| Surface | Darker Gray | #1F2937 |
| Border | Gray | #374151 |
| Text Primary | White | #F9FAFB |
| Text Secondary | Light Gray | #9CA3AF |
| Accent Primary | Light Blue | #60A5FA |
| Accent Hover | Blue | #3B82F6 |
| Success | Light Green | #34D399 |
| Warning | Light Yellow | #FBBF24 |
| Error | Light Red | #F87171 |
| YouTube Badge | Red | #FF0000 |
| Blog Badge | Light Blue | #60A5FA |

### 4.3 CSS Custom Properties

```css
:root {
  /* Light mode (default) */
  --color-bg: #FFFFFF;
  --color-surface: #F9FAFB;
  --color-border: #E5E7EB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;
  --color-accent: #3B82F6;
  --color-accent-hover: #2563EB;
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-error: #EF4444;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;

  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: 'SF Mono', Consolas, 'Liberation Mono', monospace;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
}

[data-theme="dark"] {
  --color-bg: #111827;
  --color-surface: #1F2937;
  --color-border: #374151;
  --color-text-primary: #F9FAFB;
  --color-text-secondary: #9CA3AF;
  --color-accent: #60A5FA;
  --color-accent-hover: #3B82F6;
  --color-success: #34D399;
  --color-warning: #FBBF24;
  --color-error: #F87171;
}
```

---

## 5. Typography

### 5.1 Scale

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| H1 (Title) | 1.5rem (24px) | 600 | 1.25 |
| H2 (Result Title) | 1.125rem (18px) | 600 | 1.4 |
| Body | 1rem (16px) | 400 | 1.5 |
| Small | 0.875rem (14px) | 400 | 1.5 |
| Caption | 0.75rem (12px) | 500 | 1.5 |

### 5.2 Font Stack

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;
```

---

## 6. API Integration Plan

### 6.1 Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Check server status |
| `/api/search` | POST | Execute search query |
| `/api/stats` | GET | Get knowledge base statistics |

### 6.2 Request/Response Formats

#### Search Request
```javascript
POST /api/search
Content-Type: application/json

{
  "query": "How to structure an earnout?",
  "top_k": 5,
  "source": "all" | "youtube" | "blog"
}
```

#### Search Response
```javascript
{
  "results": [
    {
      "chunk_id": "chunk_abc123_0003",
      "document_id": "youtube_abc123",
      "content": "When structuring an earnout...",
      "score": 0.847,
      "source_type": "youtube",
      "title": "Earnout Structures Explained",
      "url": "https://www.youtube.com/watch?v=abc123",
      "position": {
        "index": 3,
        "total_chunks": 8
      }
    }
  ],
  "query_time_ms": 42
}
```

#### Health Response
```javascript
{
  "status": "healthy",
  "version": "1.0.0",
  "total_chunks": 520,
  "model": "all-MiniLM-L6-v2"
}
```

#### Stats Response
```javascript
{
  "total_chunks": 520,
  "total_documents": 85,
  "sources": {
    "youtube": 500,
    "blog": 22
  }
}
```

### 6.3 Error Handling

```javascript
// API error response format
{
  "error": {
    "code": "SEARCH_ERROR",
    "message": "Failed to execute search query",
    "details": "Connection timeout"
  }
}
```

### 6.4 Frontend API Client

```javascript
class KnowledgeBaseAPI {
  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async search(query, options = {}) {
    const { topK = 5, source = 'all' } = options;

    const response = await fetch(`${this.baseUrl}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, top_k: topK, source })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Search failed');
    }

    return response.json();
  }

  async health() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    return response.json();
  }

  async stats() {
    const response = await fetch(`${this.baseUrl}/api/stats`);
    return response.json();
  }
}
```

---

## 7. Accessibility Requirements

### 7.1 WCAG 2.1 AA Compliance

- **Color Contrast:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators:** Visible focus states on all interactive elements
- **Keyboard Navigation:** All functionality accessible via keyboard
- **Screen Reader Support:** Proper ARIA labels and roles
- **Reduced Motion:** Respect `prefers-reduced-motion` preference

### 7.2 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search input |
| `Escape` | Clear search / Close dialogs |
| `Tab` | Navigate between elements |
| `Enter` | Activate focused element |

### 7.3 ARIA Implementation

```html
<!-- Search input -->
<input
  type="search"
  role="searchbox"
  aria-label="Search knowledge base"
  aria-describedby="search-help"
/>

<!-- Filter tabs -->
<div role="tablist" aria-label="Filter by source">
  <button role="tab" aria-selected="true">All</button>
  <button role="tab" aria-selected="false">YouTube</button>
  <button role="tab" aria-selected="false">Blog</button>
</div>

<!-- Results -->
<section aria-live="polite" aria-atomic="false">
  <article aria-labelledby="result-1-title">
    <h3 id="result-1-title">...</h3>
  </article>
</section>
```

---

## 8. Responsive Design

### 8.1 Breakpoints

| Name | Width | Layout |
|------|-------|--------|
| Mobile | < 640px | Single column, stacked |
| Tablet | 640px - 1024px | Single column, wider |
| Desktop | > 1024px | Full width, optimized |

### 8.2 Responsive Behaviors

- **Search Input:** Full width on all screens
- **Filter Buttons:** Horizontal scroll on mobile if needed
- **Result Cards:** Stack vertically, max-width on desktop
- **Typography:** Slightly reduced on mobile

---

## 9. Performance Considerations

### 9.1 Optimization Strategies

- **Debounced Search:** 300ms delay to reduce API calls
- **Lazy Loading:** Load results progressively if many
- **Minimal Dependencies:** Vanilla JS, no framework overhead
- **Efficient CSS:** CSS custom properties for theming
- **Caching:** Cache health/stats responses for 5 minutes

### 9.2 Performance Targets

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.0s |
| Cumulative Layout Shift | < 0.1 |

---

## 10. File Structure

```
frontend/
├── index.html          # Main HTML file
├── styles.css          # All styles (using CSS custom properties)
├── app.js              # Application logic
└── assets/
    └── favicon.ico     # Optional favicon
```

---

## 11. Browser Support

- Chrome 90+
- Firefox 90+
- Safari 14+
- Edge 90+

No IE11 support required.

---

**Document Status:** DESIGN COMPLETE - Ready for Implementation
