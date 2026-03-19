# Bank-Puller: Run Instructions

## Pre-Flight Checklist

1. **API key set**: `.env` has `ANTHROPIC_API_KEY=sk-ant-...`
2. **Excel ready**: `clients.xlsx` has accounts with status "active"
3. **Dialpad profile fresh** (if using SMS 2FA): run `--setup-dialpad` if expired
4. **Browser profiles exist**: `browser-profiles/` has `dialpad/` (for SMS) and `bank-*` dirs

## Common Commands

```bash
# See what would run (no browsers launched)
python run.py --dry-run

# Single account, debug mode, operator review
python run.py --account "Acme Corp" --bank "Chase" --debug --watch

# Full batch (all active accounts)
python run.py

# Retry only previously-failed downloads
python run.py --retry-only

# Re-learn a bank's login playbook
python run.py --bank "Chase" --relearn
```

## Dialpad Setup (SMS 2FA)

Dialpad receives bank SMS codes at **(720) 508-1992** under the **Compound Accounting** department.

### First-Time Setup

1. Run `python run.py --setup-dialpad`
2. A Chromium window opens and navigates to `dialpad.com/app`
3. **Dialpad sends its own email verification code** to `operations@allsolutionsconsult.com`
4. Check that email, copy the 6-digit code, and enter it in the browser
5. After login, the app auto-navigates to **Compound Accounting > New** tab
6. Press **Enter** in the terminal to save the browser profile
7. Profile is saved to `browser-profiles/dialpad/`

### Ongoing

- On each run, the app auto-navigates Dialpad to **Compound Accounting > New** messages
- If the selector fails, AI vision takes a screenshot and clicks the right element
- The browser profile **expires periodically** — re-run `--setup-dialpad` when the health check warns "shows login page"
- **Sender ID auto-learning**: after the first successful SMS poll, the sender short-code (e.g. "72166") is saved to the `2fa_sender` column in Excel. Future polls filter by this sender for faster/more accurate matching.

## 2FA Methods

### SMS via Dialpad (fully automated)

- **Excel columns**: `2fa=y`, `2fa_target=asc`, `2fa_method=sms`, `2fa_detail=dialpad`
- **How it works**: App opens a persistent Dialpad browser window, polls screenshots every 5s, AI (Haiku) extracts the 6-8 digit code
- **2FA preference**: If the bank offers multiple phone numbers, set `2fa_preference_order` to comma-separated last-4 digits (e.g. `1992,2212`) — the app selects the matching option
- **Sender hint**: `2fa_sender` is auto-populated after first success. You can also set it manually if known.
- **Serialized**: Only one bank window reads Dialpad at a time (semaphore prevents code collisions)

### TOTP (fully automated)

- **Excel columns**: `2fa=y`, `2fa_target=asc`, `2fa_method=totp`, `2fa_detail=<BASE32_SECRET>`
- **How it works**: Generates the current 6-digit code instantly using `pyotp`. No external service needed.
- **Where to get the secret**: When setting up TOTP in the bank's security settings, choose "can't scan QR" or similar — copy the base32 string (e.g. `JBSWY3DPEHPK3PXP`)

### Push Notification (semi-automated)

- **Excel columns**: `2fa=y`, `2fa_target=asc`, `2fa_method=push`, `2fa_detail=` (blank)
- **How it works**: After triggering 2FA, the app waits up to 3 minutes for the page to change (indicating mobile app approval)
- **Operator action**: Approve the push notification on your mobile device within 3 minutes
- **Detection**: Screenshots are compared every 5 seconds; any significant change = approval detected

### Email (not yet automated)

- **Excel columns**: `2fa=y`, `2fa_target=asc`, `2fa_method=email`, `2fa_detail=<email_address>`
- **Current state**: Gmail OAuth integration is stubbed. Use `--watch` mode — the app will prompt you to enter the code from your email manually.
- **Future**: Full Gmail API polling will be implemented.

### Security Questions

- **Excel columns**: `sq1_keyword` + `sq1_answer` through `sq5_keyword` + `sq5_answer`
- **How it works**: AI reads the security question from the screenshot, fuzzy-matches against your keyword list, and enters the matching answer
- **Keyword tips**: Use a unique word from the question (e.g. `pet`, `school`, `street`) — exact match not required, AI does fuzzy matching

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Dialpad browser shows login page" | Run `--setup-dialpad` to re-authenticate |
| SMS code not received | Check Dialpad manually — code may have arrived before polling started. Verify `2fa_preference_order` matches the right phone number. |
| TOTP code rejected | Verify system clock is accurate (TOTP is time-sensitive). Check that `2fa_detail` has the correct base32 secret. |
| Push timeout | Approve faster, or increase `push_2fa_wait` in config.py (default: 180s) |
| Playbook keeps failing | Run `--relearn` for that bank to rebuild the login flow |
| "Session timeout" | Bank may be slow or flow changed. Try `--debug --watch` to step through manually. |
| Download succeeded but wrong PDF | Check `account_last4` — the AI selects statements by matching last-4 digits |
