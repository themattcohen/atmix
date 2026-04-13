/**
 * Treatment Sync -- Auto-updates WordPress treatment pages from Cloudflare config.
 *
 * Add data-wizard-field="fieldName" to any element on a treatment page.
 * The script reads ?slug= from the URL, fetches the live config, and
 * replaces matching elements with current data.
 *
 * Supported fields: price, name, shortDesc, duration, whyMatch, ingredients, bestFor
 *
 * If the config fetch fails, WordPress content stays unchanged (graceful fallback).
 */
(function () {
  'use strict';

  var WORKER_URL = 'https://wizard-config.shiny-field-7198.workers.dev';

  // Get the treatment slug from the URL
  var params = new URLSearchParams(window.location.search);
  var slug = params.get('slug');
  if (!slug) return;

  // Fetch config and update elements
  fetch(WORKER_URL + '/config', { headers: { Accept: 'application/json' } })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (config) {
      if (!config || !config.treatments) return;

      var t = config.treatments[slug];
      if (!t) return;

      var els = document.querySelectorAll('[data-wizard-field]');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var field = el.getAttribute('data-wizard-field');

        switch (field) {
          case 'price':
            var price = typeof t.price === 'number' ? '$' + t.price : t.price;
            if (t.priceLabel) price = t.priceLabel;
            el.textContent = price;
            break;

          case 'name':
            el.textContent = t.name;
            break;

          case 'shortDesc':
            el.textContent = t.shortDesc || '';
            break;

          case 'duration':
            el.textContent = t.duration || '';
            break;

          case 'whyMatch':
            el.textContent = t.whyMatch || '';
            break;

          case 'ingredients':
            if (t.ingredients && t.ingredients.length) {
              var html = '';
              for (var j = 0; j < t.ingredients.length; j++) {
                var ing = t.ingredients[j];
                html += '<li><strong>' + escapeHtml(ing.name) + '</strong>';
                if (ing.benefit) html += ' &mdash; ' + escapeHtml(ing.benefit);
                html += '</li>';
              }
              el.innerHTML = html;
            }
            break;

          case 'bestFor':
            if (t.bestFor && t.bestFor.length) {
              var tags = '';
              for (var k = 0; k < t.bestFor.length; k++) {
                tags += '<span class="best-for-tag">' + escapeHtml(t.bestFor[k]) + '</span> ';
              }
              el.innerHTML = tags.trim();
            }
            break;
        }
      }
    })
    .catch(function () {
      // Silent fail -- WordPress content stays as-is
    });

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
