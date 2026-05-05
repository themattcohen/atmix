<?php
/**
 * Admin page shell for the Wizard of IV admin dashboard.
 *
 * Rendered by wizard_of_iv_admin_page() in wizard-of-iv.php.
 * Injects window.wizardOfIvBootstrap so the React app has its initial
 * config and nonce without making a second HTTP request.
 */

defined('ABSPATH') || exit;

$config_raw  = get_option(WIZARD_OF_IV_OPTION, '');
$config_data = (!empty($config_raw) && json_decode($config_raw) !== null) ? $config_raw : '{}';
$nonce       = wp_create_nonce('wp_rest');
$rest_url    = esc_url(rest_url('wizard-of-iv/v1/config'));
?>
<div class="wrap" id="wizard-of-iv-wrap">
    <div id="wizard-admin-root"></div>
</div>
<script>
window.wizardOfIvBootstrap = {
    config:  <?php echo $config_data; ?>,
    nonce:   <?php echo wp_json_encode($nonce); ?>,
    restUrl: <?php echo wp_json_encode($rest_url); ?>
};
</script>
