Wizard of IV -- WordPress Integration
======================================

Two options for adding the wizard to a WordPress site.


OPTION 1: Shortcode Plugin (recommended)
-----------------------------------------

1. Copy wizard-of-iv.php to wp-content/plugins/wizard-of-iv/wizard-of-iv.php
2. Activate the plugin in WordPress Admin > Plugins
3. Add [treatment-wizard] to any page or post

Optional attributes:
  [treatment-wizard text="Get Started"]
  [treatment-wizard class="my-custom-class"]
  [treatment-wizard style="margin-top: 20px;"]

The plugin automatically loads wizard.js and wizard.css from atmix.org
only on pages that use the shortcode (no unnecessary loading on other pages).


OPTION 2: Manual Embed (no plugin needed)
------------------------------------------

Add this to the theme's header.php or via a "Custom HTML" block:

  <link rel="stylesheet" href="https://atmix.org/wizard-of-iv-v2/wizard.css">
  <script src="https://atmix.org/wizard-of-iv-v2/wizard.js" defer></script>

Then add a button anywhere:

  <button data-treatment-wizard>Find My Treatment</button>

Any element with the data-treatment-wizard attribute will open the wizard
when clicked. It can be a button, link, div, image -- anything.


SELF-HOSTING (instead of loading from atmix.org)
-------------------------------------------------

If you want to host the files on the WordPress server instead of atmix.org:

1. Copy dist/wizard.js and dist/wizard.css to your theme or uploads folder
2. Update the URLs in either the plugin file or the embed snippet
3. Example: /wp-content/themes/yourtheme/wizard/wizard.js


HOW IT WORKS
-------------

The wizard is a self-contained React app compiled to a single IIFE bundle.
When wizard.js loads, it:

1. Creates an invisible mount point in the page
2. Attaches click handlers to all [data-treatment-wizard] elements
3. Opens a modal overlay when any trigger is clicked
4. Runs the treatment recommendation flow
5. Links to Acuity Scheduling for booking

The wizard does not modify the host page's DOM, styles, or JavaScript.
All CSS classes are prefixed with "tw-" to avoid conflicts.
