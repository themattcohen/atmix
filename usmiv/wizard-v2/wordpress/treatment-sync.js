/**
 * Treatment Sync -- Auto-updates WordPress treatment pages from WP REST config.
 *
 * Add data-wizard-field="fieldName" to any element on a treatment page.
 * The script reads the treatment slug from the last non-empty segment of
 * window.location.pathname and fetches the config from the WP REST API.
 *
 * Supported fields: price, name, shortDesc, duration, whyMatch, ingredients, bestFor
 *
 * If the config fetch fails, WordPress content stays unchanged (graceful fallback).
 * If the slug is missing or resolves to "treatments" (the parent page), exits early.
 */
(function () {
  'use strict';

  // Exit early if this page has no data-wizard-field elements.
  // On treatment pages rendered by nextpt_front.js (or similar), those elements
  // are present. On all other pages (including /find-my-treatment/) they are
  // absent and there is no reason to fetch the config endpoint.
  if (document.querySelectorAll('[data-wizard-field]').length === 0) return;

  // Derive the treatment slug from the URL path.
  // /treatments/myers/ -> "myers"
  // /treatments/ or / -> exit early
  var pathSegments = window.location.pathname
    .split('/')
    .filter(function (s) { return s.length > 0; });

  var slug = pathSegments[pathSegments.length - 1] || '';

  if (!slug || slug === 'treatments') return;

  // Config URL is same-origin WP REST endpoint.
  var configUrl = window.location.origin + '/wp-json/wizard-of-iv/v1/config';

  fetch(configUrl, { headers: { Accept: 'application/json' } })
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
                if (ing.benefit) html += '. ' + escapeHtml(ing.benefit);
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

          case 'note':
            if (t.note) {
              el.innerHTML = '<em>' + escapeHtml(t.note) + '</em>';
            }
            break;
        }
      }
    })
    .catch(function () {
      // Silent fail -- WordPress content stays as-is.
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
