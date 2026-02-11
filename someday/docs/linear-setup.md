# Linear Workspace Setup - Someday Consultants

## Overview

This document describes the Linear workspace structure for Someday Consultants, an accounting firm M&A brokerage.

**Team**: Someday (SD)
**Workspace**: Atmix

---

## Structure

### Hierarchy
```
Initiatives (Categories - permanent)
└── Projects (Focused work - time-boxed, archivable)
    └── Issues (Tasks - with dependencies)
```

### Initiatives

| Initiative | Purpose |
|------------|---------|
| Content | All content extraction and repurposing work |
| CRM & Systems | Baserow, GHL, and infrastructure work |
| Marketing | Marketing automation and attribution |
| Operations | Processes, workflows, and team operations |

### Active Projects

| Project | Initiative | Issues |
|---------|------------|--------|
| YouTube Extraction | Content | SD-1, SD-2 |
| Knowledge Base Sources | Content | SD-3, SD-4, SD-5, SD-21 |
| RAG Chatbot v1 | Content | SD-6, SD-28 |
| Content Repurposing Pipeline | Content | SD-22 |
| Baserow v1 Setup | CRM & Systems | SD-7, SD-27, SD-16, SD-17 |
| GHL Integration | Marketing | SD-18, SD-19, SD-20 |

---

## Issues & Dependencies

### Baserow v1 Setup (Sequential Chain)
```
SD-7  Set up Baserow instance           [START]
  ↓
SD-27 Create all Baserow tables per schema
  ↓
SD-16 Set up Baserow views
  ↓
SD-17 Set up Baserow automations        [END - unblocks GHL Integration]
```

### GHL Integration (Blocked by Baserow)
```
SD-17 (Baserow automations) blocks:
  → SD-18 Set up GHL → Baserow contact sync
  → SD-19 Set up GHL → Baserow activity sync
  → SD-20 Implement UTM tracking in GHL forms
```

### YouTube Extraction (Sequential)
```
SD-1 Run YouTube transcript extraction   [START]
  ↓
SD-2 Transcribe videos without auto-captions using Whisper
```

### RAG Chatbot v1 (Blocked by Content)
```
SD-1 (YouTube extraction) blocks:
  → SD-6 Load knowledge base into Supabase pgvector
      ↓
    SD-28 Build Sara AI assistant (RAG chatbot)
```

### Content Repurposing Pipeline
```
SD-1 (YouTube extraction) blocks:
  → SD-22 Design content repurposing pipeline
```

### Knowledge Base Sources (Parallel - No Dependencies)
```
SD-3  Extract Sara's book content (PDF)
SD-4  Export and process LinkedIn posts
SD-5  Set up Deal Academy content extraction
SD-21 Blog content extracted              [DONE]
```

---

## Starting Points

These issues have no blockers and can begin immediately:

| Issue | Title | Project |
|-------|-------|---------|
| SD-7 | Set up Baserow instance | Baserow v1 Setup |
| SD-1 | Run YouTube transcript extraction | YouTube Extraction |
| SD-3 | Extract Sara's book content (PDF) | Knowledge Base Sources |
| SD-4 | Export and process LinkedIn posts | Knowledge Base Sources |
| SD-5 | Set up Deal Academy content extraction | Knowledge Base Sources |

---

## Linear API Access

### Authentication
```bash
# Store your API key in .env (gitignored)
LINEAR_API_KEY=lin_api_xxxxx
```

### Common Queries

**List all issues:**
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "{ issues(filter: { team: { name: { eq: \"Someday\" } } }) { nodes { identifier title state { name } project { name } } } }"}'
```

**Get initiatives and projects:**
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "{ initiatives { nodes { name projects { nodes { name } } } } }"}'
```

**Create an issue:**
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "mutation { issueCreate(input: { teamId: \"TEAM_ID\", title: \"Issue title\", projectId: \"PROJECT_ID\" }) { success issue { identifier } } }"}'
```

**Create a dependency (X blocks Y):**
```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "mutation { issueRelationCreate(input: { issueId: \"BLOCKED_ISSUE_ID\", relatedIssueId: \"BLOCKING_ISSUE_ID\", type: blocks }) { success } }"}'
```

---

## Linear Method Best Practices

Based on [linear.app/method](https://linear.app/method):

### Issues, Not User Stories
- Write clear, concrete tasks in plain language
- Titles should be scannable
- No "As a user, I want..." format

### Project Scoping
- Projects complete in 1-3 weeks with 1-3 people
- Each project has one lead (owner)
- Has a clear "done" state

### Structure
- **Initiatives**: Categories that live forever
- **Projects**: Focused work that gets archived when complete
- **Issues**: Atomic tasks with dependencies

### Shipping Rhythm
- Small, frequent releases over big-bang launches
- Complete and archive projects, then create new ones

---

## IDs Reference

### Team
- Someday: `8f246737-975f-4712-ba1f-d002b94e5360`

### Initiatives
- Content: `17834099-4614-4ff8-8e04-c54e0b4416de`
- CRM & Systems: `5ced37f6-a561-4c02-ab24-6f9f73182ecf`
- Marketing: `ad17f015-3e9a-4a7e-8922-764149f17f4d`
- Operations: `2e20b5d9-c9c3-40cb-b36d-f21fdd6fc62c`

### Projects
- YouTube Extraction: `c5d867d6-5c63-407f-82b6-83d9dc1b7cd5`
- Knowledge Base Sources: `d1edc897-e5ff-478d-98c0-e4f45d4b79ab`
- RAG Chatbot v1: `8f1c5111-05ac-4423-a197-42dffcb88ebd`
- Content Repurposing Pipeline: `65173aff-1053-4d93-a171-ace40b192a3d`
- Baserow v1 Setup: `eba1a4a9-ffcf-4aa6-bb2e-c41c4592ed93`
- GHL Integration: `53018965-91d3-454f-850c-9952961218dd`

---

## Next Steps

1. **Brain dump session with Sara** - Add new issues to relevant projects
2. **Assign owners** - Each project needs a lead (Matt or Sara)
3. **Set dates** - Add target dates to projects after prioritization
4. **Enable cycles** - Optional: use 1-week cycles for shipping rhythm
