/**
 * Global type declarations for the Wizard of IV admin bundle.
 *
 * The PHP admin page (wordpress/admin-page.php) injects
 * window.wizardOfIvBootstrap before the React app mounts.
 */

interface WizardOfIvBootstrap {
  /** The full config JSON from wp_option('wizard_of_iv_config'). */
  config: Record<string, unknown>;
  /** WP REST nonce for POST requests requiring manage_options capability. */
  nonce: string;
  /** Full URL of the WP REST config endpoint, e.g. https://usmobileiv.com/wp-json/wizard-of-iv/v1/config */
  restUrl: string;
}

declare global {
  interface Window {
    wizardOfIvBootstrap?: WizardOfIvBootstrap;
  }
}

export {};
