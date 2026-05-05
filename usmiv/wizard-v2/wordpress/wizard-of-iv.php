<?php
/**
 * Plugin Name: Wizard of IV
 * Description: Treatment recommendation wizard for US Mobile IV & Labs
 * Version: 2.0.0
 * Author: atmix
 *
 * Usage: Add [treatment-wizard] anywhere in a page or post.
 * Optional: [treatment-wizard text="Find My Treatment"] to customize button text.
 */

defined('ABSPATH') || exit;

define('WIZARD_OF_IV_VERSION', '2.0.3');
define('WIZARD_OF_IV_OPTION', 'wizard_of_iv_config');
define('WIZARD_OF_IV_HISTORY_OPTION', 'wizard_of_iv_config_history');
define('WIZARD_OF_IV_HISTORY_MAX', 20);

// ---------------------------------------------------------------------------
// WP Rocket integration
// ---------------------------------------------------------------------------

// Never page-cache the dynamic Learn More pages or the wizard landing.
// The v1 renderer relies on inline scripts that WP Rocket's combine/delay
// optimizations have been observed to interfere with, leaving the rendered
// HTML missing the renderer entirely.
add_filter('rocket_cache_reject_uri', 'wizard_of_iv_rocket_cache_reject');
function wizard_of_iv_rocket_cache_reject($uris) {
    $uris[] = '/treatments/(.+)';
    $uris[] = '/find-my-treatment(/?)$';
    return $uris;
}

// Exclude wizard scripts from WP Rocket's "Combine JS" so the IIFE bundle
// does not get bundled with unrelated site scripts.
add_filter('rocket_exclude_js', 'wizard_of_iv_rocket_exclude_js');
function wizard_of_iv_rocket_exclude_js($jsfiles) {
    $jsfiles[] = '/wp-content/plugins/wizard-of-iv/assets/wizard.js';
    $jsfiles[] = '/wp-content/plugins/wizard-of-iv/assets/treatment-sync.js';
    $jsfiles[] = '/wp-content/plugins/wizard-of-iv/assets/admin-dashboard.js';
    return $jsfiles;
}

// Exclude wizard scripts from WP Rocket's "Delay JavaScript Execution"
// so window.TreatmentWizard is bound before the user's first click.
add_filter('rocket_delay_js_exclusions', 'wizard_of_iv_rocket_delay_exclusions');
function wizard_of_iv_rocket_delay_exclusions($exclusions) {
    $exclusions[] = '/wp-content/plugins/wizard-of-iv/assets/wizard.js';
    $exclusions[] = '/wp-content/plugins/wizard-of-iv/assets/treatment-sync.js';
    $exclusions[] = '/wp-content/plugins/wizard-of-iv/assets/admin-dashboard.js';
    return $exclusions;
}

// Auto-purge WP Rocket cache on treatment pages whenever the config option
// changes, so price/copy edits propagate without a manual purge.
// Also bust the REST config transient on any wp_options write to this key
// (covers WP-CLI, migration scripts, and admin meta editors in addition to
// the REST save handler).
add_action('update_option_wizard_of_iv_config', 'wizard_of_iv_rocket_purge_after_save', 10, 2);
function wizard_of_iv_rocket_purge_after_save($old_value, $new_value) {
    delete_transient('wizard_of_iv_config_cache');
    if (function_exists('rocket_clean_domain')) {
        rocket_clean_domain();
    }
}

// ---------------------------------------------------------------------------
// OG / Twitter Card meta injection
//
// SEOPress stores the per-page social meta fields correctly but does not
// output them to wp_head on Bricks-rendered pages (a known SEOPress/Bricks
// conflict). This hook reads the stored _seopress_social_* post meta and
// emits the og: and twitter: meta tags directly, bypassing SEOPress output.
//
// Applies to all treatment Learn More pages (/treatments/<id>/) and the
// /find-my-treatment/ landing page. Runs at priority 5 so it fires before
// most other head hooks.
// ---------------------------------------------------------------------------

add_action('wp_head', 'wizard_of_iv_inject_og_meta', 5);

function wizard_of_iv_inject_og_meta() {
    global $post;
    if (!is_a($post, 'WP_Post')) {
        return;
    }

    $id = $post->ID;

    // Determine if we should inject: treatment pages or landing page.
    $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $path        = rtrim(strtok($request_uri, '?'), '/') . '/';
    $is_treatment_page = preg_match('#^/treatments/([^/]+)/$#', $path);
    $is_landing        = ($path === '/find-my-treatment/');

    if (!$is_treatment_page && !$is_landing) {
        return;
    }

    $fb_title = get_post_meta($id, '_seopress_social_fb_title', true);
    $fb_desc  = get_post_meta($id, '_seopress_social_fb_desc', true);
    $fb_img   = get_post_meta($id, '_seopress_social_fb_img', true);
    $tw_title = get_post_meta($id, '_seopress_social_twitter_title', true);
    $tw_desc  = get_post_meta($id, '_seopress_social_twitter_desc', true);
    $tw_img   = get_post_meta($id, '_seopress_social_twitter_img', true);

    if (empty($fb_title) && empty($fb_img)) {
        return;
    }

    $canonical = get_permalink($id);

    echo "\n<!-- wizard-of-iv: OG / Twitter Card meta -->\n";

    if ($fb_title) {
        printf('<meta property="og:title" content="%s" />' . "\n", esc_attr($fb_title));
        printf('<meta property="og:site_name" content="U.S. Mobile IV" />' . "\n");
        printf('<meta property="og:type" content="website" />' . "\n");
    }
    if ($canonical) {
        printf('<meta property="og:url" content="%s" />' . "\n", esc_url($canonical));
    }
    if ($fb_desc) {
        printf('<meta property="og:description" content="%s" />' . "\n", esc_attr($fb_desc));
    }
    if ($fb_img) {
        printf('<meta property="og:image" content="%s" />' . "\n", esc_url($fb_img));
        printf('<meta property="og:image:width" content="2560" />' . "\n");
        printf('<meta property="og:image:height" content="1707" />' . "\n");
    }

    echo "\n";

    if ($tw_title) {
        printf('<meta name="twitter:card" content="summary_large_image" />' . "\n");
        printf('<meta name="twitter:title" content="%s" />' . "\n", esc_attr($tw_title));
    }
    if ($tw_desc) {
        printf('<meta name="twitter:description" content="%s" />' . "\n", esc_attr($tw_desc));
    }
    if ($tw_img) {
        printf('<meta name="twitter:image" content="%s" />' . "\n", esc_url($tw_img));
    }

    echo "<!-- /wizard-of-iv OG meta -->\n\n";
}

// ---------------------------------------------------------------------------
// Asset enqueueing
// ---------------------------------------------------------------------------

function wizard_of_iv_enqueue() {
    global $post;
    if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'treatment-wizard')) {
        wp_enqueue_style(
            'wizard-of-iv',
            plugins_url('assets/wizard.css', __FILE__),
            [],
            WIZARD_OF_IV_VERSION
        );
        wp_enqueue_script(
            'wizard-of-iv',
            plugins_url('assets/wizard.js', __FILE__),
            [],
            WIZARD_OF_IV_VERSION,
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'wizard_of_iv_enqueue');

// Auto-enqueue treatment-sync.js on Learn More pages.
// Matches /treatments/<id>/ (clean URLs), skips the parent /treatments/ page.
function wizard_of_iv_treatment_sync() {
    $request_uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '';
    $path = strtok($request_uri, '?');
    $path = rtrim($path, '/') . '/';

    // Must match /treatments/<segment>/ and not the bare parent /treatments/
    if (preg_match('#^/treatments/([^/]+)/$#', $path, $matches)) {
        wp_enqueue_script(
            'wizard-of-iv-sync',
            plugins_url('assets/treatment-sync.js', __FILE__),
            [],
            WIZARD_OF_IV_VERSION,
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'wizard_of_iv_treatment_sync');

// ---------------------------------------------------------------------------
// Shortcode
// ---------------------------------------------------------------------------

function wizard_of_iv_shortcode($atts) {
    $atts = shortcode_atts([
        'text'  => 'Find My Treatment',
        'class' => '',
        'style' => '',
    ], $atts, 'treatment-wizard');

    $class = 'wizard-of-iv-trigger';
    if (!empty($atts['class'])) {
        $class .= ' ' . esc_attr($atts['class']);
    }

    $style = '';
    if (!empty($atts['style'])) {
        $style = ' style="' . esc_attr($atts['style']) . '"';
    }

    return sprintf(
        '<button class="%s" data-treatment-wizard%s>%s</button>',
        esc_attr($class),
        $style,
        esc_html($atts['text'])
    );
}
add_shortcode('treatment-wizard', 'wizard_of_iv_shortcode');

// ---------------------------------------------------------------------------
// REST API
// ---------------------------------------------------------------------------

add_action('rest_api_init', 'wizard_of_iv_register_routes');

function wizard_of_iv_register_routes() {
    register_rest_route('wizard-of-iv/v1', '/config', [
        [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => 'wizard_of_iv_get_config',
            'permission_callback' => '__return_true',
        ],
        [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => 'wizard_of_iv_save_config',
            'permission_callback' => 'wizard_of_iv_can_manage',
        ],
    ]);

    register_rest_route('wizard-of-iv/v1', '/config/history', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'wizard_of_iv_get_history',
        'permission_callback' => 'wizard_of_iv_can_manage',
    ]);

    // Bulk post-meta write endpoint.
    // Accepts: { "post_id": 123, "meta": { "key": "value", ... } }
    // Restricted to manage_options (admin only).
    // Used by backfill-og-meta.mjs to write SEOPress social meta fields that
    // are not registered for the wp/v2/pages REST schema.
    register_rest_route('wizard-of-iv/v1', '/post-meta', [
        'methods'             => WP_REST_Server::CREATABLE,
        'callback'            => 'wizard_of_iv_update_post_meta',
        'permission_callback' => 'wizard_of_iv_can_manage',
        'args'                => [
            'post_id' => [
                'required'          => true,
                'validate_callback' => 'wizard_of_iv_validate_numeric',
                'sanitize_callback' => 'absint',
            ],
            'meta' => [
                'required' => true,
            ],
        ],
    ]);

    // ---------------------------------------------------------------------------
    // Acuity availability proxy routes
    //
    // These replace the Cloudflare Worker at usmiv-acuity-proxy.shiny-field-7198.workers.dev.
    // All routes are public (no auth required from the browser) because availability
    // data is not sensitive. Auth to Acuity uses HTTP Basic with credentials stored
    // in wp-config.php constants (preferred) or wp_options (fallback).
    //
    // Creds (define in wp-config.php for production):
    //   define( 'ACUITY_USER_ID', '<user_id>' );
    //   define( 'ACUITY_API_KEY', '<api_key>' );
    // Fallback: wp_option('wizard_of_iv_acuity_user_id') / wizard_of_iv_acuity_api_key
    // ---------------------------------------------------------------------------

    register_rest_route('wizard-of-iv/v1', '/acuity/dates', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'wizard_of_iv_acuity_dates',
        'permission_callback' => '__return_true',
        'args'                => [
            'appointmentTypeID' => [
                'required'          => true,
                'validate_callback' => 'wizard_of_iv_validate_numeric',
                'sanitize_callback' => 'absint',
            ],
            'month' => [
                'required'          => true,
                'validate_callback' => 'wizard_of_iv_validate_month',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);

    register_rest_route('wizard-of-iv/v1', '/acuity/times', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'wizard_of_iv_acuity_times',
        'permission_callback' => '__return_true',
        'args'                => [
            'appointmentTypeID' => [
                'required'          => true,
                'validate_callback' => 'wizard_of_iv_validate_numeric',
                'sanitize_callback' => 'absint',
            ],
            'date' => [
                'required'          => true,
                'validate_callback' => 'wizard_of_iv_validate_date',
                'sanitize_callback' => 'sanitize_text_field',
            ],
        ],
    ]);

    register_rest_route('wizard-of-iv/v1', '/acuity/appointment-types', [
        'methods'             => WP_REST_Server::READABLE,
        'callback'            => 'wizard_of_iv_acuity_appointment_types',
        'permission_callback' => '__return_true',
    ]);
}

// ---------------------------------------------------------------------------
// Acuity proxy: input validators
// ---------------------------------------------------------------------------

function wizard_of_iv_validate_numeric($value) {
    return is_numeric($value) && (int) $value > 0;
}

function wizard_of_iv_validate_month($value) {
    // Accepts YYYY-MM
    return (bool) preg_match('/^\d{4}-(?:0[1-9]|1[0-2])$/', $value);
}

function wizard_of_iv_validate_date($value) {
    // Accepts YYYY-MM-DD
    return (bool) preg_match('/^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/', $value);
}

// ---------------------------------------------------------------------------
// Acuity proxy: credential resolver
// ---------------------------------------------------------------------------

/**
 * Returns [ user_id, api_key ] from wp-config.php constants or wp_options fallback.
 * Returns [ null, null ] if credentials are not configured.
 *
 * Preferred (define in wp-config.php):
 *   define( 'ACUITY_USER_ID', '...' );
 *   define( 'ACUITY_API_KEY', '...' );
 *
 * Fallback (write via wp-admin or WP REST):
 *   update_option( 'wizard_of_iv_acuity_user_id', '...' );
 *   update_option( 'wizard_of_iv_acuity_api_key', '...' );
 */
function wizard_of_iv_acuity_credentials() {
    if (defined('ACUITY_USER_ID') && defined('ACUITY_API_KEY')) {
        return [ ACUITY_USER_ID, ACUITY_API_KEY ];
    }

    $user_id = get_option('wizard_of_iv_acuity_user_id', '');
    $api_key = get_option('wizard_of_iv_acuity_api_key', '');

    if (!empty($user_id) && !empty($api_key)) {
        return [ $user_id, $api_key ];
    }

    return [ null, null ];
}

// ---------------------------------------------------------------------------
// Acuity proxy: shared HTTP fetch helper
// ---------------------------------------------------------------------------

/**
 * Issues a GET request to the Acuity API and returns the decoded JSON body.
 *
 * @param  string          $endpoint  Path after https://acuityscheduling.com/api/v1
 *                                    (e.g. '/availability/dates')
 * @param  array           $params    Query parameters to append.
 * @param  string          $cache_key Unique transient key for this request.
 * @param  int             $ttl       Transient TTL in seconds.
 * @return mixed|WP_Error             Decoded JSON on success, WP_Error on failure.
 */
function wizard_of_iv_acuity_fetch($endpoint, $params, $cache_key, $ttl) {
    // Serve from transient cache if available.
    $cached = get_transient($cache_key);
    if ($cached !== false) {
        return $cached;
    }

    list($user_id, $api_key) = wizard_of_iv_acuity_credentials();

    if ($user_id === null) {
        error_log('wizard-of-iv: Acuity credentials not configured (ACUITY_USER_ID / ACUITY_API_KEY missing)');
        return new WP_Error(
            'wizard_acuity_no_creds',
            'Acuity credentials are not configured.',
            ['status' => 503]
        );
    }

    $auth  = 'Basic ' . base64_encode($user_id . ':' . $api_key);
    $url   = 'https://acuityscheduling.com/api/v1' . $endpoint;

    if (!empty($params)) {
        $url .= '?' . http_build_query($params);
    }

    $response = wp_remote_get($url, [
        'headers' => [
            'Authorization' => $auth,
            'Accept'        => 'application/json',
        ],
        'timeout' => 10,
    ]);

    if (is_wp_error($response)) {
        error_log('wizard-of-iv: Acuity request failed: ' . $response->get_error_message());
        return $response;
    }

    $status = wp_remote_retrieve_response_code($response);
    $body   = wp_remote_retrieve_body($response);

    if ($status !== 200) {
        error_log(sprintf('wizard-of-iv: Acuity returned HTTP %d for %s: %s', $status, $endpoint, $body));
        return new WP_Error(
            'wizard_acuity_upstream',
            sprintf('Acuity returned HTTP %d.', $status),
            ['status' => $status === 401 || $status === 403 ? $status : 502]
        );
    }

    $decoded = json_decode($body);
    if ($decoded === null) {
        error_log('wizard-of-iv: Acuity returned non-JSON body for ' . $endpoint);
        return new WP_Error('wizard_acuity_bad_json', 'Upstream returned non-JSON.', ['status' => 502]);
    }

    set_transient($cache_key, $decoded, $ttl);

    return $decoded;
}

// ---------------------------------------------------------------------------
// Acuity proxy: route callbacks
// ---------------------------------------------------------------------------

function wizard_of_iv_acuity_dates(WP_REST_Request $request) {
    $type_id = $request->get_param('appointmentTypeID');
    $month   = $request->get_param('month');

    $cache_key = 'wiv_acuity_dates_' . $type_id . '_' . str_replace('-', '', $month);
    $data = wizard_of_iv_acuity_fetch(
        '/availability/dates',
        [ 'appointmentTypeID' => $type_id, 'month' => $month ],
        $cache_key,
        300 // 5 minutes
    );

    if (is_wp_error($data)) {
        return $data;
    }

    $response = rest_ensure_response($data);
    $response->header('Cache-Control', 'public, max-age=300');
    return $response;
}

function wizard_of_iv_acuity_times(WP_REST_Request $request) {
    $type_id = $request->get_param('appointmentTypeID');
    $date    = $request->get_param('date');

    $cache_key = 'wiv_acuity_times_' . $type_id . '_' . str_replace('-', '', $date);
    $data = wizard_of_iv_acuity_fetch(
        '/availability/times',
        [ 'appointmentTypeID' => $type_id, 'date' => $date ],
        $cache_key,
        300 // 5 minutes
    );

    if (is_wp_error($data)) {
        return $data;
    }

    $response = rest_ensure_response($data);
    $response->header('Cache-Control', 'public, max-age=300');
    return $response;
}

function wizard_of_iv_acuity_appointment_types(WP_REST_Request $request) {
    $cache_key = 'wiv_acuity_appt_types';
    $data = wizard_of_iv_acuity_fetch(
        '/appointment-types',
        [],
        $cache_key,
        3600 // 1 hour
    );

    if (is_wp_error($data)) {
        return $data;
    }

    $response = rest_ensure_response($data);
    $response->header('Cache-Control', 'public, max-age=3600');
    return $response;
}

function wizard_of_iv_can_manage() {
    return current_user_can('manage_options');
}

function wizard_of_iv_update_post_meta(WP_REST_Request $request) {
    $post_id = (int) $request->get_param('post_id');
    $meta    = $request->get_param('meta');

    if (!is_array($meta) && !is_object($meta)) {
        return new WP_Error('wizard_invalid_meta', 'meta must be an object.', ['status' => 400]);
    }

    $post = get_post($post_id);
    if (!$post) {
        return new WP_Error('wizard_not_found', 'Post not found.', ['status' => 404]);
    }

    $updated = [];
    $skipped = [];

    foreach ((array) $meta as $key => $value) {
        // Only allow keys that start with _seopress_ to limit blast radius.
        if (strpos($key, '_seopress_') !== 0) {
            $skipped[] = $key;
            continue;
        }
        $sanitized = sanitize_text_field((string) $value);
        update_post_meta($post_id, $key, $sanitized);
        $updated[] = $key;
    }

    return rest_ensure_response([
        'success' => true,
        'post_id' => $post_id,
        'updated' => $updated,
        'skipped' => $skipped,
    ]);
}

function wizard_of_iv_get_config(WP_REST_Request $request) {
    // Serve from transient for anonymous requests. Logged-in users (admin
    // editing) always get a fresh read so they see their own saves immediately.
    if (!is_user_logged_in()) {
        $cached = get_transient('wizard_of_iv_config_cache');
        if ($cached !== false) {
            $response = rest_ensure_response($cached);
            $response->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
            return $response;
        }
    }

    $raw = get_option(WIZARD_OF_IV_OPTION, '');

    if (empty($raw)) {
        $response = rest_ensure_response((object)[]);
        if (!is_user_logged_in()) {
            $response->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        }
        return $response;
    }

    $data = json_decode($raw);
    if ($data === null) {
        return new WP_Error(
            'wizard_corrupt_config',
            'Stored config is not valid JSON.',
            ['status' => 500]
        );
    }

    if (!is_user_logged_in()) {
        set_transient('wizard_of_iv_config_cache', $data, MINUTE_IN_SECONDS);
    }

    $response = rest_ensure_response($data);
    if (!is_user_logged_in()) {
        $response->header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    }
    return $response;
}

function wizard_of_iv_save_config(WP_REST_Request $request) {
    $body = $request->get_body();

    if (empty($body)) {
        return new WP_Error('wizard_empty_body', 'Request body is empty.', ['status' => 400]);
    }

    $decoded = json_decode($body);
    if ($decoded === null) {
        return new WP_Error('wizard_invalid_json', 'Request body is not valid JSON.', ['status' => 400]);
    }

    if (!isset($decoded->treatments) || !is_object($decoded->treatments)) {
        return new WP_Error(
            'wizard_invalid_shape',
            'Config must have a top-level "treatments" object.',
            ['status' => 400]
        );
    }

    // Rotate current value into history before overwriting.
    $current = get_option(WIZARD_OF_IV_OPTION, '');
    if (!empty($current)) {
        $history = get_option(WIZARD_OF_IV_HISTORY_OPTION, []);
        if (!is_array($history)) {
            $history = [];
        }
        $history[] = [
            'timestamp'  => gmdate('c'),
            'by_user_id' => get_current_user_id(),
            'snapshot'   => $current,
        ];
        if (count($history) > WIZARD_OF_IV_HISTORY_MAX) {
            $history = array_slice($history, -WIZARD_OF_IV_HISTORY_MAX);
        }
        update_option(WIZARD_OF_IV_HISTORY_OPTION, $history, false);
    }

    // Normalise to compact JSON for storage.
    $json = wp_json_encode($decoded);
    update_option(WIZARD_OF_IV_OPTION, $json, 'yes');
    // Bust the GET transient immediately so the next anonymous request sees
    // the new value. The update_option hook also calls this, but calling it
    // here is an explicit belt-and-suspenders guarantee for the REST path.
    delete_transient('wizard_of_iv_config_cache');
    update_option('wizard_of_iv_config_updated_at', gmdate('c'), 'yes');

    return rest_ensure_response([
        'success'    => true,
        'updated_at' => get_option('wizard_of_iv_config_updated_at'),
    ]);
}

function wizard_of_iv_get_history(WP_REST_Request $request) {
    $history = get_option(WIZARD_OF_IV_HISTORY_OPTION, []);
    if (!is_array($history)) {
        $history = [];
    }
    return rest_ensure_response($history);
}

// ---------------------------------------------------------------------------
// Admin page
// ---------------------------------------------------------------------------

add_action('admin_menu', 'wizard_of_iv_admin_menu');

function wizard_of_iv_admin_menu() {
    add_menu_page(
        'Wizard of IV',
        'Wizard of IV',
        'manage_options',
        'wizard-of-iv',
        'wizard_of_iv_admin_page',
        'dashicons-list-view',
        75
    );
}

function wizard_of_iv_admin_page() {
    if (!current_user_can('manage_options')) {
        wp_die(__('You do not have permission to access this page.'));
    }

    // Load the server-rendered shell (nonce injection lives there).
    require_once plugin_dir_path(__FILE__) . 'admin-page.php';
}

add_action('admin_enqueue_scripts', 'wizard_of_iv_admin_enqueue');

function wizard_of_iv_admin_enqueue($hook) {
    if ($hook !== 'toplevel_page_wizard-of-iv') {
        return;
    }
    wp_enqueue_style(
        'wizard-of-iv-admin',
        plugins_url('assets/admin-dashboard.css', __FILE__),
        [],
        WIZARD_OF_IV_VERSION
    );
    wp_enqueue_script(
        'wizard-of-iv-admin',
        plugins_url('assets/admin-dashboard.js', __FILE__),
        [],
        WIZARD_OF_IV_VERSION,
        true
    );
}
