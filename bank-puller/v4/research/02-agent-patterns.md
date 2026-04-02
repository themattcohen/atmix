# AI Agent Patterns for Browser Automation — Research Summary
**Date**: 2026-04-02

## The Mental Model

An AI browser agent cycles through 4 steps:
1. **Observe**: Screenshot + DOM extraction with numbered elements
2. **Decide**: Send state to LLM, get structured action back
3. **Act**: Execute action via browser (click, type, navigate)
4. **Verify**: Check result, feed into next step's history

The LLM returns a structured object, not free text:
```python
AgentOutput(
    thinking="I see the login form. Username field is element #3.",
    next_goal="Fill username field",
    action=ClickAction(element_index=3)
)
```

## Structured vs Unstructured Agents (Critical Decision)

### Unstructured (give it a goal, let it freestyle)
```python
agent = Agent(task="Download all Chase statements for last 6 months")
await agent.run()  # LLM plans AND executes every step
```
**Fails at bank automation because:**
- Hallucinated completion: LLM says "done" when it isn't
- Goal drift: optimizes for adjacent goals
- No phase-level retry
- Security risk: might click unintended things
- Unpredictable cost

### Structured (Python as rails, LLM as eyes)
```python
# Python controls the workflow. LLM handles individual interactions.
async def phase_login(self):
    await self.page.goto(self.bank.login_url)
    await agent_step("Find the username field and type: {username}")
    await agent_step("Find the password field and type: {password}")
    await agent_step("Find the login button and click it")
    await self.page.wait_for_url("**/dashboard**")  # Python verifies
```
**The LLM never decides what to do next. Only HOW to do what Python decided.**

### Evidence: Deepsense.ai Experiment
- Unstructured: "overlooked selecting options," "got lost scrolling," "prematurely declared completion"
- Structured: 100% success rate

## Implementing Structured Mode with BrowserUse

BrowserUse defaults to unstructured but provides levers for structure:

1. **New Agent per phase**: Fresh agent with phase-specific task
2. **`override_system_message`**: Lock down LLM role to element finding only
3. **`max_steps=5`**: Hard cap — login shouldn't take >5 actions
4. **`tools=restricted_tools`**: Only click/type in login phase, not navigate/download
5. **`allowed_domains`**: LLM literally cannot navigate away

```python
# Phase: Login — restricted agent
login_agent = Agent(
    task="Fill username with 'myuser', password with 'mypass', click Sign In",
    llm=llm,
    browser=browser,
    max_steps=6,
    override_system_message="You are an element locator. Fill the described fields and click the button. Nothing else.",
)
await login_agent.run()
# Python verifies: did URL change to dashboard?
```

## The LLMPageInterpreter Pattern

Three methods — the entire LLM interface:
```python
class LLMPageInterpreter:
    async def find_and_click(self, description: str) -> bool
    async def find_and_type(self, field_desc: str, value: str) -> bool
    async def check_page_state(self, question: str) -> str
```
Each calls BrowserUse Agent with max_steps=3 and a narrow system prompt.

## Limiting LLM Autonomy — 6 Mechanisms

1. **Structured output only** (Pydantic models — LLM can't return free text)
2. **System prompt constraints** ("You are an element locator. ONLY identify elements.")
3. **Domain restrictions** (`allowed_domains=['*.chase.com']`)
4. **Minimal tool sets per phase** (login: only click/type, not navigate/download)
5. **Low max_steps per phase** (3-6 per phase)
6. **Code-level safety checks** (block certain actions in certain phases)

## Error Recovery

### Three failure categories:
1. **Transient**: Network timeout, element not ready → retry with backoff
2. **State surprise**: Unexpected modal/popup → ask LLM to dismiss it
3. **Fundamental**: Bank UI completely changed → escalate to human

### BrowserUse built-in: ActionLoopDetector
Watches for repetition (5+ identical steps, 8+ attempts on same element). Injects "nudge" to break loops.

### Never retry identically — always try a different approach.

## State Management / Checkpointing

```python
@dataclass
class BankRunCheckpoint:
    bank_id: str
    phase: str  # "login" | "2fa" | "navigate" | "download" | "done"
    statements_downloaded: list[str]
    statements_failed: list[str]
    error_count: int
```
Save after EACH phase and after EACH individual download. Resume from last checkpoint on crash.

## Verification — How to Know a Step Succeeded

| Method | Use For | Reliability |
|---|---|---|
| URL assertion (`wait_for_url`) | Navigation | Highest |
| Element presence (`wait_for_selector`) | Page state changes | High |
| File system check | Downloads | High |
| Ask LLM | Ambiguous states only | Lowest — fallback only |

**Rule: Python asserts success. The LLM never says "I think that worked."**

## Workflow-Use: Record → Replay → Self-Heal

BrowserUse extension that records an LLM-driven run into a deterministic script:
1. Run once with full LLM (figures out every click)
2. Records execution as workflow JSON
3. Future runs replay deterministically — zero LLM calls
4. If a step fails (UI changed), falls back to LLM for that step only

The end-state optimization: LLM teaches itself once, runs for free monthly.

## Framework Comparison

| Framework | Control Model | Bank Reliability | Best For |
|---|---|---|---|
| Raw Playwright | Fully deterministic | ~98% (stable UIs) | Known, stable steps |
| BrowserUse | Configurable (structured ↔ free) | ~78% unstructured | AI-driven with structure |
| Stagehand | You call act()/extract() | ~75% | TypeScript projects |
| Nova Act (AWS) | Python-orchestrated acts | ~90%+ | Enterprise/AWS |
| Skyvern | Multi-agent swarm | Moderate | Invoice retrieval |

**Hybrid approach**: "Playwright for 80% predictable steps, BrowserUse for 20% requiring AI understanding."
