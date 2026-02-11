#!/usr/bin/env python3
"""Simple Baserow field creator via browser."""

import asyncio
from playwright.async_api import async_playwright

async def main():
    print("Starting Baserow field creator...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, slow_mo=500)
        page = await browser.new_page()

        # Go directly to the Contacts table
        print("1. Going to Contacts table...")
        await page.goto("https://baserow.io/database/360423/table/817355")

        # Wait for page to load
        print("   Waiting for table to load...")
        await page.wait_for_selector('.grid-view', timeout=30000)
        print("   Table loaded!")

        # Screenshot
        await page.screenshot(path="/tmp/br1_table_loaded.png")
        print("   Screenshot: /tmp/br1_table_loaded.png")

        # Scroll right to find the add column button
        print("\n2. Looking for add field button...")

        # Method: Click on the "+" at the end of the headers
        # First scroll right
        await page.keyboard.press("End")
        await asyncio.sleep(1)

        # Try multiple selectors for the add field button
        add_selectors = [
            '.grid-view__add-column',
            '.grid-view__add-column-icon',
            '[class*="add-column"]',
            'div.grid-view-head__add-column',
            '.add-column-icon',
            'svg.iconoir-plus',
            'button.button--ghost >> nth=-1',  # Last ghost button
        ]

        clicked = False
        for sel in add_selectors:
            try:
                btn = page.locator(sel).first
                if await btn.count() > 0 and await btn.is_visible():
                    print(f"   Found button with: {sel}")
                    await btn.click()
                    clicked = True
                    break
            except Exception as e:
                continue

        if not clicked:
            # Try clicking at the rightmost header cell
            print("   Trying to find + button visually...")
            await page.screenshot(path="/tmp/br2_looking.png")

            # Let's try finding any clickable + icon
            plus_icons = page.locator('svg, i, span').filter(has_text='+')
            count = await plus_icons.count()
            print(f"   Found {count} potential + elements")

            if count > 0:
                await plus_icons.last.click()
                clicked = True

        if not clicked:
            print("   Could not find add field button!")
            print("   Please look at the browser and add the field manually:")
            print("   - Field name: ghl_contact_id")
            print("   - Type: Text")
            await asyncio.sleep(60)  # Keep browser open
            await browser.close()
            return

        await asyncio.sleep(1)
        await page.screenshot(path="/tmp/br3_add_clicked.png")
        print("   Screenshot: /tmp/br3_add_clicked.png")

        # Now fill in the field name
        print("\n3. Filling field name...")
        try:
            # Find the name input - it should be in a modal or dropdown
            name_input = page.locator('input').filter(has=page.locator('[placeholder]')).first
            if await name_input.count() == 0:
                name_input = page.locator('.context-form input[type="text"]').first
            if await name_input.count() == 0:
                name_input = page.locator('input').first

            await name_input.fill("ghl_contact_id")
            print("   Filled: ghl_contact_id")

            await page.screenshot(path="/tmp/br4_name_filled.png")

            # Click create/save
            create_btn = page.locator('button').filter(has_text='Create').first
            if await create_btn.count() == 0:
                create_btn = page.locator('button.button--primary').first
            if await create_btn.count() == 0:
                create_btn = page.locator('button').filter(has_text='Save').first

            await create_btn.click()
            print("   Clicked create!")

            await asyncio.sleep(2)
            await page.screenshot(path="/tmp/br5_created.png")
            print("   Screenshot: /tmp/br5_created.png")

        except Exception as e:
            print(f"   Error: {e}")
            await page.screenshot(path="/tmp/br_error.png")

        # Now do the same for Deals table
        print("\n4. Going to Deals table...")
        await page.goto("https://baserow.io/database/360423/table/817373")
        await page.wait_for_selector('.grid-view', timeout=30000)

        await page.keyboard.press("End")
        await asyncio.sleep(1)

        for sel in add_selectors:
            try:
                btn = page.locator(sel).first
                if await btn.count() > 0 and await btn.is_visible():
                    await btn.click()
                    break
            except:
                continue

        await asyncio.sleep(1)

        try:
            name_input = page.locator('input').first
            await name_input.fill("ghl_opportunity_id")
            print("   Filled: ghl_opportunity_id")

            create_btn = page.locator('button').filter(has_text='Create').first
            if await create_btn.count() == 0:
                create_btn = page.locator('button.button--primary').first
            await create_btn.click()
            print("   Created!")

            await asyncio.sleep(2)

        except Exception as e:
            print(f"   Error: {e}")

        print("\n=== Done! ===")
        await page.screenshot(path="/tmp/br_final.png")
        print("Final screenshot: /tmp/br_final.png")

        print("Closing in 5 seconds...")
        await asyncio.sleep(5)
        await browser.close()

asyncio.run(main())
