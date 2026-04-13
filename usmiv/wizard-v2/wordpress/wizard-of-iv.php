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

// Enqueue the wizard assets on pages that use the shortcode.
function wizard_of_iv_enqueue() {
    global $post;
    if (is_a($post, 'WP_Post') && has_shortcode($post->post_content, 'treatment-wizard')) {
        wp_enqueue_style(
            'wizard-of-iv',
            'https://atmix.org/wizard-of-iv-v2/wizard.css',
            [],
            '2.0.0'
        );
        wp_enqueue_script(
            'wizard-of-iv',
            'https://atmix.org/wizard-of-iv-v2/wizard.js',
            [],
            '2.0.0',
            true // load in footer
        );
    }
}
add_action('wp_enqueue_scripts', 'wizard_of_iv_enqueue');

// Register the [treatment-wizard] shortcode.
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

// Auto-load the treatment sync script on pages with ?slug= parameter.
// This keeps treatment detail pages in sync with the Cloudflare config.
function wizard_of_iv_treatment_sync() {
    if (isset($_GET['slug']) && !empty($_GET['slug'])) {
        wp_enqueue_script(
            'wizard-of-iv-sync',
            'https://atmix.org/wizard-of-iv-v2/treatment-sync.js',
            [],
            '2.0.0',
            true
        );
    }
}
add_action('wp_enqueue_scripts', 'wizard_of_iv_treatment_sync');
