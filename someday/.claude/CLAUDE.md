# Someday Consultants - Project Rules

## Linear-First Workflow (STRICT)

**Every task MUST have a Linear issue.** No exceptions.

### Session Start Ritual
1. Check Linear for open/in-progress issues in Someday (SD) team
2. Show current status to user
3. Ask what to work on

### Before Starting ANY Work
1. Check Linear for matching issue
2. If no issue exists → ASK: "I don't see an issue for this. Want me to create one?"
3. Wait for user approval before proceeding
4. Update issue status to **In Progress** when starting

### Task Completion Flow
```
Work → Commit → Push → WAIT for user verification → Mark Done
```

**CRITICAL**: Do NOT mark any issue as Done until:
- Code is committed
- Code is pushed to remote
- User explicitly verifies ("good", "done", "verified", etc.)

User tests in production. Always commit and push completed work.

## Guardrails - NEVER Without Asking

- ❌ Modify Baserow schema (add/remove/change fields or tables)
- ❌ Create new Linear projects or initiatives
- ❌ Create new top-level folders in project

## Code Organization

Before creating or modifying files:
1. Run `/sc:analyze` to understand existing patterns
2. Follow established project structure:
   ```
   scripts/     → Python scripts (sync, extract, utils)
   config/      → YAML configurations
   docs/        → Documentation (use /sc:document)
   tests/       → Test files
   data/        → Data files
   reports/     → Generated reports
   ```
3. Match existing code style and patterns
4. Never create files in wrong locations

## Platform Access

All credentials in `.env`:

| Platform | API Variable | Purpose |
|----------|--------------|---------|
| Linear | `LINEAR_API_KEY` | Issue tracking, workflow |
| Baserow | `BASEROW_API_TOKEN` | CRM data, contacts, deals |
| GHL | `GHL_API_TOKEN` + `GHL_LOCATION_ID` | Marketing, contacts source |
| n8n | `N8N_URL` + `N8N_API_KEY` | Automation workflows |

### Platform Usage (TBD)
- Contact data: Baserow is source of truth (synced from GHL)
- Automations: n8n workflows
- Work tracking: Linear

## Git Workflow

- Commit after completing each logical unit of work
- Always push (user tests in prod)
- Use descriptive commit messages
- Feature branches for large changes

## Linear Reference

- **Team**: Someday (SD) - `8f246737-975f-4712-ba1f-d002b94e5360`
- **Workflow**: Backlog → Todo → In Progress → In Review → Done

### Key Projects
| Project | ID |
|---------|-----|
| Inbox / Triage | `aa45a1bc-09a2-41ab-8aa6-d4298a37d259` |
| GHL Integration | `53018965-91d3-454f-850c-9952961218dd` |
| Baserow v1 Setup | `eba1a4a9-ffcf-4aa6-bb2e-c41c4592ed93` |
| RAG Chatbot v1 | `8f1c5111-05ac-4423-a197-42dffcb88ebd` |
