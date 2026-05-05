# Admin Editor Smoke-Test Checklist

Plugin v2.0.7. Run in an already-authenticated Brave session.
Admin entry point: `https://usmobileiv.com/wp-admin/admin.php?page=wizard-of-iv`
Customer verification URLs: append `?cb=<random-number>` to bust WP Rocket cache.

---

## How to use this checklist

Each test follows the same pattern:

1. Make the change in the editor.
2. Click **Save & Publish** at the top-right of the dashboard header (not the per-panel "Save" button -- that writes to Vite disk only).
3. Verify on the customer side.
4. Restore the original value and click **Save & Publish** again.

A green "Saved" banner in the header confirms the POST succeeded.

---

## Test 1: Treatment price save (highest priority -- the original P0)

**Set up:** Treatments tab > select **revival** in the left sidebar.

**Change:** In the **Basic Info** section, find the **price** field (currently `395`). Change it to `400`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/treatments/revival/?cb=1` in a new tab. The price shown in the treatment card should read `$400`. Also open `https://usmobileiv.com/find-my-treatment/?cb=1`, walk to: **I need relief right now** > **Recovering from illness or burnout** -- the result card price should show `$400`.

**Restore:** Change price back to `395`. Click **Save & Publish**. Confirm `$395` on the same URLs.

---

## Test 2: Treatment name with apostrophe (encoding)

**Set up:** Treatments tab > select **revival**.

**Change:** In **Basic Info > name**, change `Revival IV` to `Revival IV's Best`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=2`, walk to: **I need relief right now** > **Recovering from illness or burnout**. The result card heading should show `Revival IV's Best` with the apostrophe intact (not `Revival IV&#39;s Best` or escaped HTML).

**Restore:** Change name back to `Revival IV`. Click **Save & Publish**.

---

## Test 3: Question title

**Set up:** Questions tab > select **start** in the left sidebar.

**Change:** In **Question Info > title**, change `What brings you in today?` to `What brings you in today? TEST`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=3` and click "Find My Treatment" to open the wizard. Step 1 heading should read `What brings you in today? TEST`.

**Restore:** Revert the title. Click **Save & Publish**.

---

## Test 4: Question option label

**Set up:** Questions tab > select **start**.

**Change:** In the **Options** section, find the first option (currently `I need relief right now`). Change its label to `I need relief right now TEST`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=4`, open the wizard. The first button on step 1 should read `I need relief right now TEST`.

**Restore:** Revert the label. Click **Save & Publish**.

---

## Test 5: Bundle name

**Set up:** Bundles tab > select **beautyBundle** in the left sidebar.

**Change:** In **Bundle Info > name**, change `Beauty Glow Package` to `Beauty Glow Package TEST`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=5`, walk to: **I want to improve my wellness** > **Better skin, hair, and nails**. The result card heading should read `Beauty Glow Package TEST`.

**Restore:** Revert the name. Click **Save & Publish**.

---

## Test 6: Bundle shortDesc -- one of the 6 new fields (were write-blocked before today)

**Set up:** Bundles tab > select **beautyBundle**.

**Change:** In the **Display** section, find **shortDesc**. Current value: `A targeted skin, hair, and nails IV with biotin, glutathione, and vitamin C for collagen and antioxidant support.` Change it to `TEST_SUBTITLE_SHORT`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=6`, walk to: **I want to improve my wellness** > **Better skin, hair, and nails**. The subtitle text below the bundle name on the result card should show `TEST_SUBTITLE_SHORT`.

**Restore:** Paste back the original text:
`A targeted skin, hair, and nails IV with biotin, glutathione, and vitamin C for collagen and antioxidant support.`
Click **Save & Publish**.

---

## Test 7: Bundle pageUrl validation (inline regex gate)

**Set up:** Bundles tab > select **beautyBundle**.

**Change (bad value):** In **Display > pageUrl**, type `bad-url-no-slash`. Do not save yet. Confirm an inline validation error appears below the field ("Must start with /").

**Change (good value):** Correct the value to `/treatments/myers/`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=7`, walk to: **I want to improve my wellness** > **Better skin, hair, and nails**. The **Learn More** link on the result card should navigate to `/treatments/myers/`.

**Restore:** Clear the pageUrl field (leave blank so the bundle inherits from its primary). Click **Save & Publish**.

---

## Test 8: Ingredients -- add a row

**Set up:** Treatments tab > select **revival**.

**Change:** In the **Ingredients** section, click **+ Add ingredient**. Fill in:
- Name: `TEST_ING`
- Benefit: `Test benefit text`

Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=8`, walk to: **I need relief right now** > **Recovering from illness or burnout**. Expand the **What's Inside** section on the result card. `TEST_ING` should appear as the last ingredient with `Test benefit text` below it.

Also check `https://usmobileiv.com/treatments/revival/?cb=8` -- the ingredients list should include `TEST_ING`.

**Restore:** Return to the Ingredients section for revival and delete the `TEST_ING` row (the x button on the right). Click **Save & Publish**.

---

## Test 9: Best-for tags

**Set up:** Treatments tab > select **revival**.

**Change:** In the **Best For** section, type `TEST_TAG` in the tag input and press Enter or click **Add**. The tag chip should appear. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/treatments/revival/?cb=9`. The **Who This Is For** section should include `TEST_TAG` as a listed item.

**Restore:** Return to Best For, click the x on the `TEST_TAG` chip. Click **Save & Publish**.

---

## Test 10: Lab Tests array (new editor -- tests on labComplete)

**Set up:** Treatments tab > select **labComplete** in the left sidebar. This is a lab-category treatment, so a **Lab Tests** section appears below Addon Suggestions.

**Change:** Click **+ Add test**. Type `TEST_CODE` in the new text field. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/treatments/labComplete/?cb=10`. The **What's Tested** section should include `TEST_CODE` in the list.

**Restore:** Return to Lab Tests for labComplete, click x on `TEST_CODE`. Click **Save & Publish**.

---

## Test 11: Treatment note field (italic footnote on modal AND Learn More)

**Set up:** Treatments tab > select **revival**.

**Change:** In **Descriptions > note**, type `TEST_NOTE for testing only`. Click **Save & Publish**.

**Verify (modal):** Open `https://usmobileiv.com/find-my-treatment/?cb=11`, walk to: **I need relief right now** > **Recovering from illness or burnout**. Below the "Why this is your match" text on the result card, an italic footnote should appear with the sentinel.

**Verify (Learn More):** Open `https://usmobileiv.com/treatments/revival/?cb=11`. Below the "Why This Works" callout, an italic footnote with the same sentinel should appear. Both consumers were wired in today's Step 3b.

**Restore:** Clear the note field (leave blank). Click **Save & Publish**.

---

## Test 12: Scoring weights -- walk the wizard to confirm ranking

**Set up:** Treatments tab > select **myers**.

**Change:** In **Scoring Weights**, find **Tired all the time** (currently `3`). Drag or type to set it to `9`. Click **Save & Publish**.

**Verify:** Open `https://usmobileiv.com/find-my-treatment/?cb=12`, walk to: **I'm not sure -- help me decide**. On the symptom picker, select **Tired all the time** only. Click **Find My Treatment**. Myers' Cocktail should rank #1 on the multi-result screen (the inflated weight of 9 guarantees it will outscore anything else for that symptom).

**Restore:** Return to myers Scoring Weights, set **Tired all the time** back to `3`. Click **Save & Publish**.

---

## Test 13: Inline validation -- acuityTypeId = 0

**Set up:** Treatments tab > select **revival** (or any treatment).

**Change:** In **Basic Info > acuityTypeId**, clear the field and type `0`. Do not click Save & Publish yet.

**Verify:** An inline validation error should appear immediately below or adjacent to the field reading something like "Required for booking" or "Must be > 0". The field border should turn red. This confirms Step 4 (editor-side validation) is working.

**Restore:** Set acuityTypeId back to `43274230` (revival's Acuity ID). The error should clear. Do not save.

---

## Pass criteria

Every test above should produce:

- A green "Saved" banner after clicking Save & Publish (not an error banner).
- The sentinel value visible on the customer-facing URL within a few seconds (no reload of the admin page required).
- Successful restore, confirmed by re-checking the customer URL.

If any test fails at the "Saved" banner step, the save flow is still broken for that panel. If it fails at the customer URL step, the consumer render has a read gap.
