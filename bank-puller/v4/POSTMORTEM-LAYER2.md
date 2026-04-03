# Layer 2.1 — Postmortem & Path Forward

## What We Tried

| Test | Model | Result |
|---|---|---|
| example.com (simple page, ~10 elements) | Haiku | Worked (1 step) |
| Dialpad login (complex page, 250+ elements) | Haiku | Worked (5 retries for format errors, then succeeded) |
| Dialpad login | Sonnet | **FAILED** — "compiled grammar is too large" |
| Dialpad login | Opus | **FAILED** — "compiled grammar is too large" |
| Dialpad login + strict=False monkey-patch | Sonnet | **FAILED** — same error (it's in tool schemas, not response_format) |
| Dialpad login + max_actions_per_step=1 | Sonnet | **FAILED** — same error |

## Root Cause

BrowserUse v0.12 uses the Anthropic API's **constrained decoding** (strict JSON schema) for tool calls. When a page has many interactive DOM elements (Dialpad's login page has 250+), the compiled grammar exceeds Anthropic's size limit for Sonnet and Opus models. Haiku uses a different (less strict) parsing path that bypasses this limit.

This is a **hard API limitation** — not configurable, not patchable. The error comes from Anthropic's servers before the model even runs.

## What Actually Works

- Chrome launch via CDP: works
- BrowserUse connecting to CDP: works
- BrowserUse Agent + Haiku on simple pages: works perfectly
- BrowserUse Agent + Haiku on complex pages: works with retries
- BrowserUse Agent + Sonnet/Opus on ANY real page: broken

## Options Going Forward

### Option A: Use Haiku for BrowserUse (simplest)
- Haiku works. It retries a few times on format errors but succeeds.
- Cost is lowest. Speed is fastest.
- Quality concern: Haiku might make worse decisions on complex bank pages.
- **User preference conflicts**: User explicitly said "Sonnet for ALL development tasks. No Haiku."

### Option B: Drop BrowserUse, use raw Anthropic API (most control)
- Build our own agent loop: screenshot → Claude API tool_use → execute action
- We control tool schema complexity (keep it under 5 simple tools)
- Works with ANY Claude model (Sonnet, Opus, Haiku)
- More code to write but we already have the design from research
- This was the "raw API" approach we considered earlier before choosing BrowserUse

### Option C: Use BrowserUse cloud API
- BrowserUse cloud may handle the grammar compilation server-side
- We already have a BROWSER_USE_API_KEY in .env
- Unknown if this actually fixes the issue
- Adds cloud dependency and cost ($0.05-1.00/session)

### Option D: Use OpenAI GPT-4o instead of Claude for BrowserUse
- GPT-4o doesn't have the grammar limit
- BrowserUse supports it natively
- Mixes AI providers (Claude for everything else, GPT for browser)
- User may not want this

## Decision

**Option A: Use Haiku with BrowserUse.** User chose this — pragmatic, it works.

Why:
1. User wants Sonnet — this is the only option that delivers Sonnet
2. We control the tool schemas (5 simple tools: screenshot, click, type, scroll, done)
3. The research already designed this approach (see v4/research/03-claude-api-and-sdk.md)
4. More code but no dependency on BrowserUse's broken grammar handling
5. Works with any model — Sonnet now, Opus later if API limits change

The agent loop is ~100 lines of Python:
```
while not done:
    screenshot = page.screenshot()
    response = client.messages.create(
        model="claude-sonnet-4-6",
        tools=BROWSER_TOOLS,  # 5 simple tools, small schema
        messages=[..., image(screenshot), ...]
    )
    execute(response.tool_calls)
```

### What Changes
- Replace `browser_use.Agent` with our own agent loop in `src/agent.py`
- Replace `browser_use.Controller` / `@controller.action` with direct tool_use definitions
- Keep everything else: BrowserProcess, CDP launcher, bank workflows, skills, orchestrator
- Skills become regular Python functions called by the agent loop, not BrowserUse actions

### What Stays the Same
- Chrome/Nodriver launch via CDP
- Persistent profiles
- Per-bank workflow phase structure
- Checkpoint system
- Excel reader
- All the research, plans, and testing layers
