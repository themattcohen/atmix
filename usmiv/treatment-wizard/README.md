# US Mobile IV Treatment Wizard

Interactive decision-tree modal that helps website visitors find the right treatment, then hands them off to Acuity booking with the treatment pre-selected.

## Files

| File | Purpose |
|------|---------|
| `wizard-config.json` | All treatment data, questions, routing, and Acuity IDs. Edit this to update prices, add treatments, or modify the decision tree. |
| `wizard.js` | Modal UI, state machine, animations, and analytics. No dependencies. |
| `wizard.css` | Responsive styles matching the Bricks Builder theme. |

## Installation on WordPress / Bricks Builder

### Option A: Theme Assets (Recommended)

1. **Upload files** to your active theme:
   ```
   wp-content/themes/your-theme/assets/treatment-wizard/
     wizard.js
     wizard.css
     wizard-config.json
   ```

2. **Register the shortcode and enqueue scripts.** Add this to your theme's `functions.php` (or create a custom plugin file):

   ```php
   <?php
   // Treatment Wizard - Shortcode + Script Loader
   function tw_enqueue_scripts() {
       if (!is_admin()) {
           $base = get_template_directory_uri() . '/assets/treatment-wizard';
           wp_register_style('treatment-wizard', $base . '/wizard.css', [], '1.0.0');
           wp_register_script('treatment-wizard', $base . '/wizard.js', [], '1.0.0', true);
       }
   }
   add_action('wp_enqueue_scripts', 'tw_enqueue_scripts');

   function tw_shortcode($atts) {
       wp_enqueue_style('treatment-wizard');
       wp_enqueue_script('treatment-wizard');
       $btn_text = isset($atts['text']) ? esc_attr($atts['text']) : 'Find My Treatment';
       return '<button data-treatment-wizard class="tw-trigger-btn">' . $btn_text . '</button>';
   }
   add_shortcode('treatment-wizard', 'tw_shortcode');
   ```

3. **Place the shortcode** on any page or in any Bricks template:
   ```
   [treatment-wizard]
   ```
   
   Or with custom button text:
   ```
   [treatment-wizard text="Get a Recommendation"]
   ```

### Option B: Bricks HTML Element

1. Upload all 3 files to your server (e.g., `/wp-content/uploads/treatment-wizard/`)

2. Add a Bricks **Code** element (or HTML element) wherever you want the trigger button:

   ```html
   <link rel="stylesheet" href="/wp-content/uploads/treatment-wizard/wizard.css">
   <button data-treatment-wizard>Find My Treatment</button>
   <script src="/wp-content/uploads/treatment-wizard/wizard.js"></script>
   ```

### Option C: Global Trigger (All Pages)

To add a floating "Find My Treatment" button on every page, add this to your Bricks header template or via a code snippet plugin:

```html
<link rel="stylesheet" href="/wp-content/uploads/treatment-wizard/wizard.css">
<script src="/wp-content/uploads/treatment-wizard/wizard.js" defer></script>
```

Then any element with the `data-treatment-wizard` attribute becomes a trigger. You can also open the wizard programmatically:

```javascript
TreatmentWizard.open();
```

## Connecting to Acuity Booking

The wizard deep-links to Acuity using `?appointmentTypeID=X` URL parameters. To wire this up:

1. Log into Acuity Scheduling at `acuityscheduling.com`
2. Go to **Appointment Types**
3. For each treatment, note the **Appointment Type ID** (visible in the URL when editing, or via the Acuity API)
4. Open `wizard-config.json` and update the `acuityTypeId` field for each treatment:

   ```json
   "hangover": {
     "acuityTypeId": 12345678,
     ...
   }
   ```

Until IDs are added, the "Book" button will link to the general Acuity booking page.

## Updating Treatments and Prices

All data lives in `wizard-config.json`. Common updates:

**Change a price:**
```json
"hangover": {
  "price": 275,
  ...
}
```

**Add a new treatment:**
Add a new entry in the `treatments` object, add a `whyMatch` entry, and add it as a `recommend` value in the relevant question option.

**Modify the decision tree:**
Edit the `questions` object. Each question has `options` that either `next` (go to another question) or `recommend` (show a treatment result).

## Analytics (GTM/GA4)

The wizard pushes events to `window.dataLayer` for Google Tag Manager:

| Event | When |
|-------|------|
| `wizard_opened` | Modal opens |
| `wizard_step_completed` | User answers a question |
| `wizard_recommendation` | Outcome screen shown |
| `wizard_book_clicked` | "Book This Treatment" clicked |
| `wizard_learn_more` | "Learn More" clicked |
| `wizard_abandoned` | Modal closed before completing |
| `wizard_restarted` | User clicked "Start Over" |

To track these in GA4, create a GTM trigger for each event name and map it to a GA4 Event tag.

## Browser Support

- Chrome, Edge, Safari, Firefox (latest 2 versions)
- iOS Safari 15+
- Android Chrome
- No IE11 support (uses ES6+ features)

## Performance

- Zero external dependencies
- No iframe or third-party scripts
- Scripts/styles load only on pages with the shortcode (Option A) or on demand
- Modal DOM is created dynamically on first open, not on page load
- Estimated impact on Core Web Vitals: none (all code runs on user interaction)
