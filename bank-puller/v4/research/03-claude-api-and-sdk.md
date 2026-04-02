# Claude API, Agent SDK, and Vision — Research Summary
**Date**: 2026-04-02

## Claude Agent SDK

Official Python library wrapping Claude Code as a library. Bundles Claude Code CLI internally.

```python
from claude_agent_sdk import query, ClaudeAgentOptions

async for message in query(
    prompt="Download Chase statement",
    options=ClaudeAgentOptions(
        allowed_tools=["Read", "Bash"],
        permission_mode="bypassPermissions",
        system_prompt="You are a bank automation agent.",
        mcp_servers={"browser": browser_tools},
    ),
):
    handle(message)
```

**For bank automation**: Overkill. We don't need Claude Code's filesystem tools. Raw Anthropic API gives more control.

## Claude API tool_use

Claude decides which tool to call based on tool descriptions. Returns `stop_reason: "tool_use"` with structured parameters. You execute the tool and send back results.

```python
tools = [
    {"name": "click_element", "description": "Click element by text/selector",
     "input_schema": {"type": "object", "properties": {"text": {"type": "string"}}}},
    {"name": "take_screenshot", "description": "Screenshot current page",
     "input_schema": {"type": "object", "properties": {}}},
]

# The agent loop
while response.stop_reason == "tool_use":
    tool_results = []
    for block in response.content:
        if block.type == "tool_use":
            result = execute_tool(block.name, block.input)
            tool_results.append({"type": "tool_result", "tool_use_id": block.id, "content": result})
    messages.append({"role": "assistant", "content": response.content})
    messages.append({"role": "user", "content": tool_results})
    response = client.messages.create(model="claude-haiku-4-5", tools=tools, messages=messages)
```

**Note**: BrowserUse already handles this loop internally. If using BrowserUse, you don't write this yourself.

## Claude Vision for Screenshots

### Sending a screenshot
```python
png_bytes = await page.screenshot()
b64 = base64.standard_b64encode(png_bytes).decode()
# Include as image content block in messages
{"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64}}
```

### Token cost formula
```
tokens = (width_px * height_px) / 750
```

| Resolution | Tokens | Cost (Haiku) | Cost (Sonnet) |
|---|---|---|---|
| 1280x800 | 1,366 | $0.0014 | $0.0041 |
| 1920x1080 | Scaled down | — | — |

- Max: 8000x8000 px
- Auto-scaled if > 1568px long edge
- Optimal: <= 1.15 megapixels (e.g., 1280x800)
- Min recommended: 200px on any edge

### Spatial reasoning limitation
Claude reads text and identifies elements by labels well. Struggles with precise pixel coordinates. **Ask for element text/labels, use Playwright's get_by_text() to find them.**

## Cost Estimation

### Per-account (~30 LLM calls)
| Model | Input Cost | Output Cost | Total |
|---|---|---|---|
| Haiku 4.5 | $0.097 | $0.053 | ~$0.15 |
| Sonnet 4.6 | $0.29 | $0.16 | ~$0.45 |
| Haiku + caching | ~$0.07 | $0.053 | ~$0.10 |

### Full run (15 accounts)
| Model | Total |
|---|---|
| Haiku 4.5 | ~$2.25 |
| Haiku + caching | ~$1.50 |
| Sonnet 4.6 | ~$6.75 |

### Model recommendation
- **Haiku 4.5**: Default for all navigation (fast, cheap)
- **Sonnet 4.6**: Error recovery only (complex reasoning)
- **Prompt caching**: System prompt + tool schemas cached across calls — 90% discount on cached tokens

## BrowserUse vs Raw API for Bank Automation

| Factor | BrowserUse | Raw API |
|---|---|---|
| Setup time | 30 min | 2-4 hours |
| Agent loop | Built-in | You build it |
| DOM extraction | Built-in (numbered elements) | You build it |
| Control | Configurable via structured mode | Full control |
| Debugging | Moderate (has history/logging) | Full observability |
| Stealth | Via CDP bridge to Patchright | Direct Patchright |
| 2FA | Via @controller.action | You build it |
| Cost visibility | Via calculate_cost flag | Full |
| Dependencies | browser-use + langchain-anthropic | anthropic + patchright |

**Verdict**: BrowserUse saves significant development effort. The structured mode features (override_system_message, max_steps, restricted tools) provide sufficient control for bank automation. The agent loop, DOM extraction, and action execution are non-trivial to rebuild.
