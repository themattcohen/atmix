"""Chase 2FA troubleshooter — uses the real session_runner Chase 2FA handler.

Max 2 SMS sends, max 2 code entries. Full debug screenshots.
"""
import asyncio
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from config import DEBUG_SCREENSHOTS_DIR
from orchestrator.excel_reader import ExcelManager
from orchestrator.session_runner import _try_chase_2fa_selection, _wait_and_enter_2fa_code
from orchestrator.tfa_interceptor import poll_dialpad_sms
from ai_skills.navigation import skill_classify_page
from utils.browser_setup import launch_hardened_browser, wait_and_screenshot, human_type, human_delay
from utils.logger import setup_logger, log

USERNAME = "ljmofcpa1"
DEBUG_DIR = DEBUG_SCREENSHOTS_DIR / "chase_2fa_debug"
DEBUG_DIR.mkdir(parents=True, exist_ok=True)

step_counter = 0


async def save_ss(page, label: str) -> bytes:
    global step_counter
    step_counter += 1
    ss = await page.screenshot(type="png", full_page=False)
    path = DEBUG_DIR / f"{step_counter:03d}_{label}.png"
    path.write_bytes(ss)
    log.info(f"[SS {step_counter}] {label}")
    return ss


async def main():
    setup_logger(debug=True)

    # Load account from Excel
    job = None
    with ExcelManager() as mgr:
        for a in mgr.read_accounts():
            if a.username.lower() == USERNAME.lower() and "chase" in a.bank_name.lower():
                job = a
                log.info(f"Account: {a.client_name}/{a.bank_name} #{a.account_last4} user={a.username}")
                break
    if not job:
        log.error(f"Account not found for username={USERNAME}")
        return

    # --- Launch Dialpad ---
    log.info("=== LAUNCH DIALPAD ===")
    dialpad_ctx = await launch_hardened_browser("dialpad")
    dialpad_page = dialpad_ctx.pages[0] if dialpad_ctx.pages else await dialpad_ctx.new_page()
    await dialpad_page.goto("https://dialpad.com/app", wait_until="domcontentloaded")
    await asyncio.sleep(3)
    try:
        await dialpad_page.get_by_text("Compound Accounting").first.click(timeout=5000)
        await asyncio.sleep(1)
        await dialpad_page.get_by_role("tab", name="New").click(timeout=5000)
        log.info("Dialpad: navigated to Compound Accounting > New")
    except Exception as e:
        log.warning(f"Dialpad nav: {e}")
    await save_ss(dialpad_page, "dialpad_ready")

    # --- Launch Chase ---
    log.info("=== LAUNCH CHASE ===")
    chase_ctx = await launch_hardened_browser("bank-1", download_dir=str(PROJECT_ROOT / "downloads" / "debug"))
    chase_page = chase_ctx.pages[0] if chase_ctx.pages else await chase_ctx.new_page()

    # Clear cookies
    cookies = await chase_ctx.cookies()
    chase_cookies = [c for c in cookies if "chase.com" in c.get("domain", "")]
    if chase_cookies:
        await chase_ctx.clear_cookies()
        log.info(f"Cleared {len(chase_cookies)} cookies")

    # Navigate
    await chase_page.goto("https://secure.chase.com/web/auth/dashboard", wait_until="domcontentloaded")
    await asyncio.sleep(5)
    await save_ss(chase_page, "chase_loaded")

    # Wait for login page
    for i in range(8):
        await asyncio.sleep(2)
        ss = await save_ss(chase_page, f"readiness_{i}")
        result = skill_classify_page(ss)
        log.info(f"State: {result.page_state} (conf={result.confidence:.2f})")
        if result.page_state in ("login", "login_page"):
            break

    # --- Enter credentials using playbook selectors ---
    log.info("=== ENTER CREDENTIALS ===")

    # Find auth iframe with login fields
    auth_frame = chase_page
    for f in chase_page.frames:
        try:
            if await f.locator("#userId-input-field-input").count() > 0:
                auth_frame = f
                log.info(f"Login iframe: {f.url[:80]}")
                break
        except Exception:
            pass

    # Username
    try:
        await auth_frame.locator("#userId-input-field-input").fill("")
        await auth_frame.locator("#userId-input-field-input").type(job.username, delay=80)
        log.info(f"Typed username: {job.username}")
    except Exception as e:
        log.error(f"Username failed: {e}")
        await save_ss(chase_page, "username_error")
        return

    # Password
    try:
        await auth_frame.locator("#password-input-field-input").fill("")
        await auth_frame.locator("#password-input-field-input").type(job.password, delay=80)
        log.info("Typed password")
    except Exception as e:
        log.error(f"Password failed: {e}")
        return

    await save_ss(chase_page, "credentials_entered")

    # Sign In
    try:
        await auth_frame.get_by_role("button", name="Sign In").click()
        log.info("Clicked Sign In")
    except Exception:
        try:
            await auth_frame.get_by_role("button", name="Sign in").click()
            log.info("Clicked 'Sign in'")
        except Exception as e:
            log.error(f"Sign In failed: {e}")
            return

    await asyncio.sleep(5)
    await save_ss(chase_page, "after_signin")

    # --- Handle 2FA using the REAL session_runner functions ---
    log.info("=== 2FA HANDLING (using session_runner) ===")

    for attempt in range(4):
        ss = await save_ss(chase_page, f"state_check_{attempt}")
        result = skill_classify_page(ss)
        state = result.page_state
        log.info(f"[Attempt {attempt}] State: {state} (conf={result.confidence:.2f})")

        if state in ("dashboard", "account_summary", "home", "statements"):
            log.info("SUCCESS — logged in!")
            await save_ss(chase_page, "success_dashboard")
            break

        if state in ("2fa_method_selection",):
            log.info("Calling _try_chase_2fa_selection (real handler)...")
            handled = await _try_chase_2fa_selection(chase_page, job, wid=1)
            if handled:
                log.info("Chase 2FA selection handled — now entering code")
                await save_ss(chase_page, f"after_2fa_select_{attempt}")

                # Poll Dialpad
                log.info("Polling Dialpad for SMS code (60s timeout)...")
                sms_result = await poll_dialpad_sms(dialpad_page, sender_hint=job.tfa_sender, timeout_s=60)
                if sms_result:
                    code, sender = sms_result
                    log.info(f"Got code: {code} from {sender}")

                    # Find code entry frame
                    code_frame = chase_page
                    for f in chase_page.frames:
                        try:
                            if await f.locator("[name='identificationCode']").count() > 0:
                                code_frame = f
                                log.info(f"Code entry iframe: {f.url[:60]}")
                                break
                        except Exception:
                            pass

                    # Enter code
                    try:
                        await code_frame.locator("[name='identificationCode']").fill(code)
                        log.info(f"Entered code: {code}")
                    except Exception as e:
                        log.error(f"Code entry failed: {e}")
                        await save_ss(chase_page, "code_entry_error")
                        continue

                    # Re-enter password if field present
                    try:
                        pw = code_frame.locator("#password-input-field-input")
                        if await pw.count():
                            await pw.fill(job.password)
                            log.info("Re-entered password")
                    except Exception:
                        pass

                    await save_ss(chase_page, f"code_filled_{attempt}")

                    # Click Next
                    try:
                        await code_frame.get_by_role("button", name="Next").click()
                        log.info("Clicked Next")
                    except Exception as e:
                        log.warning(f"Next failed: {e}")

                    await asyncio.sleep(8)
                    await save_ss(chase_page, f"after_code_submit_{attempt}")

                    # Check result
                    ss2 = await save_ss(chase_page, f"post_code_{attempt}")
                    r2 = skill_classify_page(ss2)
                    log.info(f"Post-code state: {r2.page_state} (conf={r2.confidence:.2f})")

                    if r2.page_state in ("dashboard", "account_summary", "home", "statements"):
                        log.info("SUCCESS after code entry!")
                        break

                    # Check for "remember device" interstitial
                    try:
                        body_text = ""
                        for f in chase_page.frames:
                            try:
                                t = await f.locator("body").text_content()
                                if t and len(t) > len(body_text):
                                    body_text = t
                            except Exception:
                                pass
                        if any(kw in body_text.lower() for kw in ["remember", "trust this", "recognize this"]):
                            log.info("'Remember device' page detected!")
                            for f in chase_page.frames:
                                for btn_name in ["Yes", "Not now", "Next", "Don't ask again"]:
                                    try:
                                        btn = f.get_by_role("button", name=btn_name)
                                        if await btn.count():
                                            await btn.first.click()
                                            log.info(f"Clicked '{btn_name}'")
                                            await asyncio.sleep(5)
                                            break
                                    except Exception:
                                        pass
                            await save_ss(chase_page, "after_remember_device")
                    except Exception as e:
                        log.warning(f"Remember-device check error: {e}")
                else:
                    log.error("No SMS code received from Dialpad")
                    await save_ss(dialpad_page, f"dialpad_no_code_{attempt}")
            else:
                log.error("_try_chase_2fa_selection returned False")
                await save_ss(chase_page, f"2fa_select_failed_{attempt}")
            continue

        if state in ("2fa_prompt", "2fa_code_entry", "verification"):
            log.info("Direct code entry prompt (no method selection)")
            # Same code entry flow as above
            sms_result = await poll_dialpad_sms(dialpad_page, sender_hint=job.tfa_sender, timeout_s=60)
            if sms_result:
                code, sender = sms_result
                log.info(f"Got code: {code}")
                for f in chase_page.frames:
                    try:
                        if await f.locator("[name='identificationCode']").count() > 0:
                            await f.locator("[name='identificationCode']").fill(code)
                            try:
                                pw = f.locator("#password-input-field-input")
                                if await pw.count():
                                    await pw.fill(job.password)
                            except Exception:
                                pass
                            await f.get_by_role("button", name="Next").click()
                            log.info("Entered code + clicked Next")
                            break
                    except Exception:
                        pass
                await asyncio.sleep(8)
                await save_ss(chase_page, f"after_direct_code_{attempt}")
            continue

        log.warning(f"Unexpected state: {state}")
        # Dump page text
        try:
            for f in chase_page.frames:
                t = await f.locator("body").text_content()
                if t and len(t) > 50:
                    log.info(f"Frame text: {t[:300]}")
        except Exception:
            pass
        break

    # --- Final ---
    log.info("=== FINAL STATE ===")
    final_ss = await save_ss(chase_page, "final")
    final_r = skill_classify_page(final_ss)
    log.info(f"Final: {final_r.page_state} (conf={final_r.confidence:.2f})")

    log.info(f"Screenshots: {DEBUG_DIR}")
    log.info("Browsers open for 5 min. Ctrl+C to exit.")
    try:
        await asyncio.sleep(300)
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        await chase_ctx.close()
        await dialpad_ctx.close()


if __name__ == "__main__":
    asyncio.run(main())
