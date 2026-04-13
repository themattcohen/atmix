Wizard of IV v2
================

A treatment recommendation wizard for US Mobile IV & Labs. Patients
answer questions and get matched with the right IV therapy, injection,
or wellness program. Includes a booking integration with Acuity.


QUICK START (WordPress)
------------------------

1. In your WordPress admin, go to Plugins > Add New > Upload Plugin.
2. Upload the file: wordpress-plugin/wizard-of-iv.php
3. Activate the plugin.
4. On any page or post, add the shortcode:

     [treatment-wizard]

   That's it. A "Find My Treatment" button appears. Clicking it opens
   the wizard modal.

Optional shortcode attributes:

   [treatment-wizard text="Get Started"]        -- custom button text
   [treatment-wizard class="my-btn"]            -- add a CSS class
   [treatment-wizard style="margin-top: 20px;"] -- inline styles


QUICK START (any site, no WordPress)
--------------------------------------

Add these two lines to your page's <head>:

   <link rel="stylesheet" href="https://atmix.org/wizard-of-iv-v2/wizard.css">
   <script src="https://atmix.org/wizard-of-iv-v2/wizard.js" defer></script>

Then add a button anywhere:

   <button data-treatment-wizard>Find My Treatment</button>

Any HTML element with the data-treatment-wizard attribute will open
the wizard when clicked. It can be a button, link, div, or image.


SELF-HOSTING (instead of loading from atmix.org)
-------------------------------------------------

If you want to host the wizard files on your own server:

1. Copy the two files from the embed/ folder:
     embed/wizard.js   -> your server (e.g. /assets/wizard/wizard.js)
     embed/wizard.css  -> your server (e.g. /assets/wizard/wizard.css)

2. Update the URLs in wizard-of-iv.php (lines 20 and 25) to point
   to your server instead of atmix.org.

The wizard works from any HTTP server. No special server-side
requirements. The config is loaded from Cloudflare (separate from
where the JS/CSS is hosted).


ADMIN DASHBOARD
----------------

The admin dashboard lets you edit treatments, bundles, and the
question flow without touching any code.

URL: https://atmix.org/wizard-of-iv-v2/?wizard-dev=true

First-time visitors get a guided tour explaining each section.
You can re-open the tour anytime from the ? button in the header.

See admin-dashboard.txt for detailed instructions on each tab.


PUBLISHING CHANGES
-------------------

When you make changes in the admin dashboard:

1. Edit the treatment, bundle, or question.
2. Click "Publish Live" (the indigo button in the header).
3. Enter the API key when prompted (first time only -- it's remembered
   for the browser session).
4. Changes go live immediately. The wizard and treatment detail pages
   will show updated data on the next page load.

API key: Ask Matt for the admin API key.

If "Publish Live" is not visible, the config backend may not be
connected. Contact Matt.


TREATMENT DETAIL PAGES
-----------------------

The wizard links to treatment detail pages (e.g. ?slug=revival).
These pages automatically pull live data from the config backend.

If you're building new treatment pages, you can add data-wizard-field
attributes to elements that should stay in sync:

   <h1 data-wizard-field="name">Revival IV</h1>
   <span data-wizard-field="price">$395</span>
   <span data-wizard-field="duration">30-45 min</span>
   <p data-wizard-field="shortDesc">Description here</p>
   <p data-wizard-field="whyMatch">Why this matches text</p>
   <ul data-wizard-field="ingredients">...</ul>
   <div data-wizard-field="bestFor">...</div>

Load the sync script on those pages:

   <script src="https://atmix.org/wizard-of-iv-v2/treatment-sync.js" defer></script>

The script reads the ?slug= parameter, fetches the live config, and
updates those elements. If the config can't be loaded, the static
HTML content stays unchanged.


WHAT'S IN THIS PACKAGE
-----------------------

   README.txt              -- this file
   admin-dashboard.txt     -- how to use the admin dashboard
   wordpress-plugin/
     wizard-of-iv.php      -- WordPress plugin (upload to WP)
     treatment-sync.js     -- syncs treatment page data (auto-loaded by plugin)
   embed/
     wizard.js             -- the wizard (self-contained, ~95KB gzip)
     wizard.css            -- wizard styles (~15KB gzip)
     treatment-sync.js     -- same sync script (for non-WP sites)
   demo.html               -- standalone demo page


TROUBLESHOOTING
----------------

Wizard doesn't open:
  Check the browser console (F12) for JavaScript errors.
  Verify wizard.js loaded in the Network tab.
  Verify the trigger has a data-treatment-wizard attribute.

Wizard shows old data:
  Hard refresh the page (Ctrl+Shift+R).
  If using the config backend: check that "Publish Live" succeeded.

"Save requires local dev server":
  The "Save" button writes to local files (developer workflow).
  Use "Publish Live" to push changes to the live config.
  Use "Copy TS" to copy code to clipboard for manual use.

Admin dashboard doesn't load:
  Verify the URL includes ?wizard-dev=true.
  Try clearing localStorage (browser dev tools > Application > Clear).

Treatment page shows wrong price:
  The page may be cached. Hard refresh.
  Verify treatment-sync.js is loaded on that page.
  Verify the URL has ?slug=correct-slug.


CONTACT
--------

Questions? Contact Matt at matt@atmix.org
