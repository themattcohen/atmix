# Chase Postmortem — Lessons from 34 Accounts

**Date**: 2026-04-06

---

## What Was Tested
34 Chase Business accounts across 2 days. 21 successful, 9 correctly skipped/failed, 4 required bug fixes mid-run.

---

## Lesson 1: Two Different 2FA Flows Exist

**Standard flow** (URL: `recognizeUser/simplerAuthOptions`):
- Custom dropdown with TEXT ME / CALL ME headers and `<li>` phone options
- Dropdown trigger: `#header-simplerAuth-dropdownoptions-styledselect`
- Listbox: `#ul-list-container-simplerAuth-dropdownoptions-styledselect`
- Code entry: `#otpcode_input-input-field` + password re-entry `#password_input-input-field`

**CAAS flow** (URL: `caas/challenge`):
- Everything in shadow DOM
- "Get a text" / "Get a call" buttons (MDS-LIST-ITEM)
- Phone selection via dropdown or radio buttons (varies by account)
- Code entry: `#otpInput-input` (shadow DOM, no password re-entry)
- Next button is a `<SPAN>` not `<BUTTON>` — shadow DOM walker must search by text, not tag

**Detection**: Branch on URL after clicking Sign In. `recognizeUser` = standard. `caas` = CAAS.

---

## Lesson 2: Trusted Device Skips 2FA

If the browser profile has been authenticated before, Chase may skip 2FA entirely and go straight to the dashboard. The URL contains `dashboard` instead of `recognizeUser` or `caas`.

**Fix**: Check URL after Sign In. If `dashboard`, skip 2FA commands and go directly to `statements`.

**Bug this caused**: Before the fix, the script tried to open the 2FA dropdown on the dashboard page, found nothing, and reported "no TEXT ME numbers" — wrong diagnosis.

---

## Lesson 3: Shadow DOM Requires Recursive Walking

Chase uses web components (`mds-navigation-bar-item`, `MDS-LIST-ITEM`, `MDS-BUTTON`, etc.) with shadow roots. Standard DOM queries (`querySelector`, XPath, text search) can't find elements inside shadow roots.

**Pattern**: Recursive walker that enters each shadow root:
```javascript
function walkShadow(root, depth) {
    if (depth > 5) return null;
    for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) { const r = walkShadow(el.shadowRoot, depth+1); if (r) return r; }
        // ... match logic here ...
    }
    return null;
}
return walkShadow(document, 0);
```

**Where it's needed**: Statements nav tab, CAAS 2FA buttons, CAAS phone selection, CAAS Next button.

---

## Lesson 4: Statements Tab Needs Wait After 2FA

After 2FA completes, the dashboard SPA is still loading. The shadow DOM nav tabs (`mds-navigation-bar-item`) take seconds to render. Clicking immediately after 2FA hits a non-existent element.

**Fix**: Poll for `[data-testid="statementsAndDocuments-navigation-bar-item"]` every 2s up to 30s. Also retry click once if URL doesn't change.

**Bug this caused**: 100% failure on all 2FA accounts. 0% failure on trusted-device accounts (dashboard already loaded).

---

## Lesson 5: Two Download Mechanisms

**Flyout (checking/savings accounts):**
- Icon ID: `icon-accountsTable-{N}-row0-cell3-downloadDocumentDropdown-icon`
- Click icon → flyout opens → click "Save as PDF" inside `.dropdown.show`
- "Save as PDF" IDs are NOT unique across accounts — must find inside the open flyout

**Direct link (credit cards):**
- Link ID: `accountsTable-{N}-row0-cell3-requestThisDocumentAnchor-download`
- Click link → PDF downloads directly (no flyout)

**Detection**: Try flyout icon first. If not found, try direct link. If neither, skip (no statements).

---

## Lesson 6: scrollIntoView Before Every Click

Off-screen elements return (0,0) from `getBoundingClientRect`. Must call `scrollIntoView({block: "center"})` before getting coords.

**Bug this caused**: Last account in a long list (BUSINESS CARD) was below the viewport after expanding 7 other accounts. Click silently missed.

---

## Lesson 7: Flyout "Save as PDF" Needs Human-Like Timing

After clicking the download icon, the flyout menu needs time to render. Clicking "Save as PDF" too fast results in no download. Move mouse to element, wait 1s, then press-release with 0.1s delay.

---

## Lesson 8: Never Auto-Select a Different Phone Number

Some accounts only have 1993 (not 1992). Some have 5499+1296. The script must STOP and report which numbers are available — never guess or fall back to a different number.

---

## Lesson 9: Phone Verification Escalation

Some Chase accounts accept the SMS code but then escalate to "Call us for a code" (URL contains `callUs`). This is a Chase security policy — the account needs manual handling. Log it and move on.

---

## Lesson 10: Duplicate Phone Numbers Under TEXT ME

Some accounts have two `xxx-xxx-1992` entries under TEXT ME (two different numbers with the same last 4). The first may not receive SMS. If no code arrives after 4 minutes, the `retry` command selects the second match.

Count only numbers between TEXT ME and CALL ME headers — one TEXT + one CALL with same last4 is normal (not a retry case).

---

## Lesson 11: Tabs Accumulate

If signout doesn't close the tab, Chase tabs accumulate across multiple account runs. Always close the tab via `Target.closeTarget` after signout.
