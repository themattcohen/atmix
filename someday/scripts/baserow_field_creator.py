#!/usr/bin/env python3
"""
Create Baserow fields via browser automation.
"""

import asyncio
import sys
import os

async def create_fields():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("Installing playwright...")
        os.system(f"{sys.executable} -m pip install playwright -q")
        os.system(f"{sys.executable} -m playwright install chromium")
        from playwright.async_api import async_playwright

    print("=== Baserow Field Creator ===\n")

    async with async_playwright() as p:
        print("Launching browser...")
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        # Go to Baserow login
        print("Opening Baserow...")
        await page.goto("https://baserow.io/login")

        # Wait for user to log in or for redirect to dashboard
        print("\n>>> WAITING FOR LOGIN <<<")
        print(">>> If you're already logged in, we'll continue automatically.")
        print(">>> Otherwise, please log in now.\n")

        try:
            # Wait for either dashboard or database URL
            await page.wait_for_url("**/dashboard/**", timeout=5000)
        except:
            try:
                await page.wait_for_url("**/database/**", timeout=5000)
            except:
                # Still on login - wait for user
                print("Waiting for you to log in...")
                await page.wait_for_url("**/dashboard/**", timeout=300000)  # 5 min timeout

        print("Logged in!")

        # Navigate to Contacts table
        print("\n1. Opening Contacts table (817355)...")
        await page.goto("https://baserow.io/database/360423/table/817355")
        await asyncio.sleep(3)

        # Take screenshot to see current state
        await page.screenshot(path="/tmp/baserow_before.png")
        print("   Screenshot saved to /tmp/baserow_before.png")

        # Try to add field using keyboard shortcut or button
        print("\n2. Adding ghl_contact_id field...")

        # Scroll to end of table to find add field button
        await page.keyboard.press("End")
        await asyncio.sleep(1)

        # Look for add field button and click it
        add_field_clicked = False

        # Method 1: Look for + icon in header
        selectors = [
            '.grid-view__add-column',
            '[class*="add-field"]',
            '[class*="add-column"]',
            'button[title*="Add"]',
            '.header-cell--add',
        ]

        for selector in selectors:
            try:
                elem = page.locator(selector).first
                if await elem.is_visible(timeout=1000):
                    await elem.click()
                    add_field_clicked = True
                    print(f"   Clicked add field using: {selector}")
                    break
            except:
                continue

        if not add_field_clicked:
            print("   Could not find add field button. Taking screenshot...")
            await page.screenshot(path="/tmp/baserow_nobutton.png")
            print("   Screenshot: /tmp/baserow_nobutton.png")
            print("\n   Please manually add these fields in Baserow UI:")
            print("   - Contacts table: text field named 'ghl_contact_id'")
            print("   - Deals table: text field named 'ghl_opportunity_id'")
            print("   - Contacts > Source field: add option 'Deal Academy'")
            await browser.close()
            return

        await asyncio.sleep(1)

        # Fill in field name
        try:
            # Find the field name input
            name_input = page.locator('input[placeholder*="Field name"], input[placeholder*="field name"], input[name="name"], .field-form input[type="text"]').first
            await name_input.fill("ghl_contact_id")
            print("   Filled field name: ghl_contact_id")

            # Make sure "Text" type is selected (usually default)
            await asyncio.sleep(0.5)

            # Click create button
            create_btn = page.locator('button:has-text("Create field"), button:has-text("Add field"), button.button--primary').first
            await create_btn.click()
            print("   Created field!")
            await asyncio.sleep(2)

        except Exception as e:
            print(f"   Error: {e}")
            await page.screenshot(path="/tmp/baserow_error1.png")

        # Now do Deals table
        print("\n3. Opening Deals table (817373)...")
        await page.goto("https://baserow.io/database/360423/table/817373")
        await asyncio.sleep(3)

        print("\n4. Adding ghl_opportunity_id field...")
        await page.keyboard.press("End")
        await asyncio.sleep(1)

        for selector in selectors:
            try:
                elem = page.locator(selector).first
                if await elem.is_visible(timeout=1000):
                    await elem.click()
                    print(f"   Clicked add field using: {selector}")
                    break
            except:
                continue

        await asyncio.sleep(1)

        try:
            name_input = page.locator('input[placeholder*="Field name"], input[placeholder*="field name"], input[name="name"], .field-form input[type="text"]').first
            await name_input.fill("ghl_opportunity_id")
            print("   Filled field name: ghl_opportunity_id")

            await asyncio.sleep(0.5)
            create_btn = page.locator('button:has-text("Create field"), button:has-text("Add field"), button.button--primary').first
            await create_btn.click()
            print("   Created field!")
            await asyncio.sleep(2)

        except Exception as e:
            print(f"   Error: {e}")
            await page.screenshot(path="/tmp/baserow_error2.png")

        # Final screenshot
        await page.screenshot(path="/tmp/baserow_after.png")
        print("\n=== Done! ===")
        print("Final screenshot: /tmp/baserow_after.png")

        print("\nClosing browser in 3 seconds...")
        await asyncio.sleep(3)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(create_fields())
