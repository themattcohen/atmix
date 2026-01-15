# PRD: Case Studies Feature

## Overview
Add detailed case study pages linked from each project in "stuff i've done" section. Each case study follows a standardized framework to demonstrate expertise and results.

## Goals
- Showcase depth of work beyond one-liner descriptions
- Build credibility through detailed implementation stories
- Provide clear ROI/outcomes for potential clients
- Create reusable content for marketing/sales

## Framework Structure
Based on marketing best practices, each case study should follow the **Situation-Solution-Results (SSR)** framework:

### 1. Situation (The Challenge)
- Client/business context
- Problem/pain point they were facing
- Why it mattered (business impact, cost, inefficiency, etc.)
- What they'd tried before (if applicable)

### 2. Solution (The Implementation)
- Your approach/methodology
- Technologies/tools used
- Key features built
- Timeline/process overview
- Challenges overcome during implementation

### 3. Results (The Outcome)
- Quantifiable metrics (time saved, cost reduced, revenue increased, etc.)
- Qualitative improvements (user satisfaction, process clarity, etc.)
- Long-term impact/sustainability
- Client testimonial (optional but valuable)

## Technical Implementation

### Content Structure
```
/content/case-studies/
  ├── accounting-practice.json
  ├── finance-operations.json
  ├── benchproof.json
  └── broker-automation.json
```

### Schema
```json
{
  "id": "unique-slug",
  "title": "Project Name",
  "tagline": "One-liner from main page",
  "situation": {
    "heading": "The Challenge",
    "context": "...",
    "problem": "...",
    "impact": "..."
  },
  "solution": {
    "heading": "The Solution",
    "approach": "...",
    "technologies": ["tag1", "tag2"],
    "features": ["...", "..."],
    "timeline": "X months",
    "challenges": "..."
  },
  "results": {
    "heading": "The Results",
    "metrics": [
      {"label": "Time Saved", "value": "45 mins/day"},
      {"label": "ROI", "value": "$XXk annually"}
    ],
    "qualitative": "...",
    "testimonial": {
      "quote": "...",
      "author": "Name, Title"
    }
  }
}
```

### UI Components
- **CaseStudyCard.tsx** - Renders case study detail page
- **ProjectCard enhancement** - Add "Read More →" link to each project
- **Route setup** - `/case-studies/[slug]`

### Design Considerations
- Must work in both Brutalist and Warm themes
- Maintain existing design language
- Mobile-friendly layout
- Print-friendly for PDF generation
- Consider adding "Back to Projects" navigation

## Future Enhancements
- PDF export functionality
- Social share cards (OG images)
- Related projects section
- Timeline/process visualization
- Before/after comparisons
- Video testimonials

## Success Metrics
- Increased time-on-site
- Lower bounce rate on project section
- Conversion tracking (if leads form added)
- Social shares of case studies

## Open Questions
- Which projects get case studies first? Priority order?
- Client confidentiality - how much detail can be shared?
- Need client permission/approval for testimonials?
- Should case studies be gated (email capture) or open?

## Notes
- Keep case studies concise (800-1200 words ideal)
- Use specific numbers/metrics wherever possible
- Include visuals (screenshots, diagrams, before/after)
- Update as projects evolve or new results emerge
