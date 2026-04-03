# CDP Interaction Patterns — Proven Reference

All patterns below are tested and working as of 2026-04-03.

---

## Connecting to Chrome

### Browser-level (for creating tabs)
```python
ver = json.loads(urllib.request.urlopen('http://127.0.0.1:9300/json/version').read())
ws = await websockets.connect(ver['webSocketDebuggerUrl'])
```

### Page-level (for interacting with a tab)
```python
pages = json.loads(urllib.request.urlopen('http://127.0.0.1:9300/json').read())
tab = next(p for p in pages if p['id'] == tab_id)  # or p['type'] == 'page'
ws = await websockets.connect(tab['webSocketDebuggerUrl'])
```

### CDP helper pattern
```python
msg_id = 1
async def cdp(method, params=None):
    nonlocal msg_id
    await ws.send(json.dumps({'id': msg_id, 'method': method, 'params': params or {}}))
    msg_id += 1
    while True:
        r = json.loads(await ws.recv())
        if r.get('id') == msg_id - 1:
            return r.get('result', {})
```

---

## Text Input (React-compatible)

```python
await cdp('Runtime.evaluate', {'expression': 'document.querySelector("#field-id").focus()'})
await asyncio.sleep(0.3)
await cdp('Input.insertText', {'text': 'value'})
```

**Why this works**: `Input.insertText` fires through Chrome's input pipeline, triggering React's synthetic event system. Direct `element.value = x` does NOT update React state.

---

## Mouse Click (MANDATORY — never use JS .click())

```python
# Step 1: Find element by text match, get live coords
r = await cdp('Runtime.evaluate', {'expression': '''
    (() => {
        const el = Array.from(document.querySelectorAll('button, a'))
            .find(e => e.textContent.trim().startsWith('Target Text') && e.offsetParent !== null);
        if (!el) return '0,0';
        const r = el.getBoundingClientRect();
        return Math.round(r.x + r.width/2) + ',' + Math.round(r.y + r.height/2);
    })()
'''})
coords = r.get('result', {}).get('value', '0,0').split(',')
x, y = int(coords[0]), int(coords[1])

# Step 2: Dispatch mouse events
await cdp('Input.dispatchMouseEvent', {'type': 'mouseMoved', 'x': x, 'y': y})
await asyncio.sleep(0.05)
await cdp('Input.dispatchMouseEvent', {
    'type': 'mousePressed', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1
})
await asyncio.sleep(0.03)
await cdp('Input.dispatchMouseEvent', {
    'type': 'mouseReleased', 'x': x, 'y': y, 'button': 'left', 'clickCount': 1
})
```

**Why not JS .click()**: reCAPTCHA Enterprise intercepts JavaScript click events. CDP mouse events simulate OS-level clicks that reCAPTCHA treats as real user input.

---

## Element Selection Rules

1. **NEVER use querySelector alone** when multiple elements share the same class
2. **ALWAYS match by text content**: `.find(e => e.textContent.trim() === 'Exact Text')`
3. **Check visibility**: `e.offsetParent !== null`
4. **Get fresh coords every time** — don't cache from a previous page state

---

## Screenshot for Verification

```python
import base64
shot = await cdp('Page.captureScreenshot', {'format': 'png'})
Path('profiles/debug_stepN.png').write_bytes(base64.b64decode(shot['data']))
```

**ALWAYS screenshot after clicks** — never trust return values as proof the UI changed.

---

## Digit-by-Digit Typing (2FA code fields)

For forms with separate input fields per digit (e.g., Dialpad 6-field 2FA):

```python
# Click first field
await mouse_click('document.querySelectorAll("input[type=text]")[0]')
await asyncio.sleep(0.2)

for digit in '123456':
    await cdp('Input.dispatchKeyEvent', {'type': 'keyDown', 'key': digit, 'text': digit})
    await cdp('Input.dispatchKeyEvent', {'type': 'keyUp', 'key': digit})
    await asyncio.sleep(0.1)
```

Fields auto-advance after each digit. For single-field codes (like Chase 8-digit), use `Input.insertText` instead.

---

## New Tab

```python
ver = json.loads(urllib.request.urlopen('http://127.0.0.1:9300/json/version').read())
async with websockets.connect(ver['webSocketDebuggerUrl']) as ws:
    result = await cdp('Target.createTarget', {'url': 'about:blank'})
    tab_id = result['targetId']
```

Then reconnect to the new tab's websocket for page interaction.

---

## Navigation

```python
await cdp('Page.enable')
await cdp('Page.navigate', {'url': 'https://example.com'})
await asyncio.sleep(8)  # wait for load
```

---

## Chrome Launch (subprocess — survives Python exit)

```python
import subprocess
args = [
    'chrome.exe',
    f'--remote-debugging-port={port}',
    f'--user-data-dir={abs_profile_path}',
    '--disable-features=IsolateOrigins,site-per-process',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-infobars',
]
# Add for banks only (breaks Dialpad WebSocket):
# args.append('--disable-blink-features=AutomationControlled')

proc = subprocess.Popen(args, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
```

Clean stale lock files before launch:
```python
for lock in ('SingletonLock', 'SingletonSocket', 'SingletonCookie'):
    p = profile_dir / lock
    if p.exists() or p.is_symlink():
        p.unlink()
```
