/**
 * Treatment Detail Page — US Mobile IV Medics
 * Config-driven treatment detail renderer.
 * Zero dependencies. IIFE. ES6+.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Category display labels
  // ---------------------------------------------------------------------------
  var CATEGORY_LABELS = {
    iv:         'IV Drip',
    nad:        'NAD+ IV',
    weightLoss: 'Weight Loss',
    injection:  'Injection',
    lab:        'Lab Panel'
  };

  // ---------------------------------------------------------------------------
  // Evidence level labels and CSS modifiers
  // ---------------------------------------------------------------------------
  var EVIDENCE_LABELS = {
    strong:   'Clinically supported',
    moderate: 'Well-studied',
    emerging: 'Emerging research'
  };

  var EVIDENCE_MODIFIERS = {
    strong:   'td-evidence-badge--strong',
    moderate: 'td-evidence-badge--moderate',
    emerging: 'td-evidence-badge--emerging'
  };

  // ---------------------------------------------------------------------------
  // Inline SVG icons
  // ---------------------------------------------------------------------------
  var ICONS = {
    clock:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><polyline points="10 6 10 10 13 12"/></svg>',
    calendar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="16" height="14" rx="2"/><line x1="2" y1="9" x2="18" y2="9"/><line x1="7" y1="2" x2="7" y2="6"/><line x1="13" y1="2" x2="13" y2="6"/></svg>',
    bolt:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 2 3 12 10 12 9 18 17 8 10 8 11 2"/></svg>',
    repeat:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="17 2 17 8 11 8"/><polyline points="3 18 3 12 9 12"/><path d="M17 8A8 8 0 0 0 5.3 5.3"/><path d="M3 12a8 8 0 0 0 11.7 2.7"/></svg>',
    heart:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 17 8c0 4.5-7 9-7 9z"/></svg>',
    chevron:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="5 8 10 13 15 8"/></svg>',
    check:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 10 8 14 16 6"/></svg>',
    star:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><polygon points="10 2 12.4 7.5 18.5 7.9 14 11.9 15.5 18 10 14.8 4.5 18 6 11.9 1.5 7.9 7.6 7.5"/></svg>',
    phone:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 2h4l2 5-2.5 1.5A11 11 0 0 0 13.5 14.5L15 12l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 2 4a2 2 0 0 1 2-2z"/></svg>',
    arrow:    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="10" x2="17" y2="10"/><polyline points="12 5 17 10 12 15"/></svg>',
    warning:  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2L2 17h16L10 2z"/><line x1="10" y1="8" x2="10" y2="12"/><line x1="10" y1="15" x2="10.01" y2="15" stroke-width="2.5"/></svg>',
    info:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><line x1="10" y1="9" x2="10" y2="14"/><line x1="10" y1="6" x2="10.01" y2="6" stroke-width="2.5"/></svg>',
    vial:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2l6 0"/><path d="M8 2v8l-3 5a1.5 1.5 0 0 0 1.3 2.3h7.4A1.5 1.5 0 0 0 15 15l-3-5V2"/><line x1="6" y1="12" x2="14" y2="12"/></svg>',
    shield:   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z"/></svg>'
  };

  // ---------------------------------------------------------------------------
  // Escape HTML helper
  // ---------------------------------------------------------------------------
  function esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Build Acuity booking URL
  // ---------------------------------------------------------------------------
  function buildAcuityUrl(wizardConfig, treatment) {
    var base = (wizardConfig.meta && wizardConfig.meta.acuityBase) || 'https://usmobilemedics.as.me/usmobileiv';
    if (treatment.acuityTypeId) {
      return base + '?appointmentTypeID=' + encodeURIComponent(treatment.acuityTypeId);
    }
    return base;
  }

  // ---------------------------------------------------------------------------
  // Category badge HTML
  // ---------------------------------------------------------------------------
  function renderCategoryBadge(category) {
    var label = CATEGORY_LABELS[category] || category;
    return '<span class="td-category-badge td-category-badge--' + esc(category) + '">' + esc(label) + '</span>';
  }

  // ---------------------------------------------------------------------------
  // Nav bar
  // ---------------------------------------------------------------------------
  function renderNav() {
    return [
      '<nav class="td-nav" role="navigation" aria-label="Page navigation">',
        '<a href="/wizard-of-iv/" class="td-nav__back">',
          '<span class="td-nav__back-arrow">' + ICONS.arrow.replace('line x1="3"', 'line x1="17"').replace('x2="17"', 'x2="3"').replace('points="12 5 17 10 12 15"', 'points="8 5 3 10 8 15"') + '</span>',
          'Back to Wizard',
        '</a>',
        '<span class="td-nav__wordmark">US Mobile IV</span>',
      '</nav>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Hero header
  // ---------------------------------------------------------------------------
  function renderHero(treatment, wizardConfig) {
    var acuityUrl = buildAcuityUrl(wizardConfig, treatment);
    var priceText = treatment.priceLabel || ('$' + treatment.price);
    var phone = (wizardConfig.meta && wizardConfig.meta.phoneNumber) || '';

    return [
      '<header class="td-hero">',
        '<div class="td-hero__inner">',
          renderCategoryBadge(treatment.category),
          '<h1 class="td-hero__name">' + esc(treatment.name) + '</h1>',
          '<div class="td-hero__meta">',
            '<span class="td-hero__price">' + esc(priceText) + '</span>',
            treatment.duration
              ? '<span class="td-hero__sep" aria-hidden="true">·</span><span class="td-hero__duration">' + ICONS.clock + esc(treatment.duration) + '</span>'
              : '',
          '</div>',
          '<p class="td-hero__desc">' + esc(treatment.shortDesc) + '</p>',
          '<div class="td-hero__actions">',
            '<a href="' + esc(acuityUrl) + '" class="td-hero__book-btn" target="_blank" rel="noopener">',
              'Book This Treatment',
            '</a>',
            phone
              ? '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, '')) + '" class="td-hero__phone">' + ICONS.phone + esc(phone) + '</a>'
              : '',
          '</div>',
        '</div>',
      '</header>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Why This Works
  // ---------------------------------------------------------------------------
  function renderWhySection(whyText) {
    if (!whyText) return '';
    return [
      '<section class="td-section td-why" aria-labelledby="td-why-heading">',
        '<div class="td-why__inner">',
          '<h2 class="td-section-title" id="td-why-heading">Why This Works</h2>',
          '<p class="td-why__text">' + esc(whyText) + '</p>',
        '</div>',
      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Ingredient / Lab Test cards (expandable)
  // ---------------------------------------------------------------------------
  function renderIngredientCard(item, index) {
    var evidenceLevel = item.evidence || 'moderate';
    var evidenceMod   = EVIDENCE_MODIFIERS[evidenceLevel] || EVIDENCE_MODIFIERS.moderate;
    var evidenceLabel = EVIDENCE_LABELS[evidenceLevel]    || EVIDENCE_LABELS.moderate;
    var cardId        = 'td-ingredient-' + index;
    var bodyId        = 'td-ingredient-body-' + index;

    return [
      '<div class="td-ingredient-card" id="' + cardId + '">',
        '<button class="td-ingredient-card__trigger" aria-expanded="false" aria-controls="' + bodyId + '">',
          '<span class="td-ingredient-card__name">' + esc(item.name) + '</span>',
          item.whatItDoes
            ? '<span class="td-ingredient-card__short">' + esc(item.whatItDoes) + '</span>'
            : (item.benefit ? '<span class="td-ingredient-card__short">' + esc(item.benefit) + '</span>' : ''),
          '<span class="td-ingredient-card__chevron">' + ICONS.chevron + '</span>',
        '</button>',
        '<div class="td-ingredient-card__body" id="' + bodyId + '" hidden>',
          item.whyItMatters
            ? '<p class="td-ingredient-card__detail">' + esc(item.whyItMatters) + '</p>'
            : (item.benefit && item.whatItDoes ? '<p class="td-ingredient-card__detail">' + esc(item.benefit) + '</p>' : ''),
          '<span class="td-evidence-badge ' + evidenceMod + '">' + esc(evidenceLabel) + '</span>',
        '</div>',
      '</div>'
    ].join('');
  }

  function renderLabTestCard(test, index) {
    // test may be a string or an object with name/description
    var name  = (typeof test === 'string') ? test : (test.name || test);
    var desc  = (typeof test === 'object' && test.description) ? test.description : null;
    var cardId  = 'td-lab-' + index;
    var bodyId  = 'td-lab-body-' + index;

    return [
      '<div class="td-ingredient-card" id="' + cardId + '">',
        '<button class="td-ingredient-card__trigger" aria-expanded="false" aria-controls="' + bodyId + '">',
          '<span class="td-ingredient-card__name">' + esc(name) + '</span>',
          desc
            ? '<span class="td-ingredient-card__short">' + esc(desc) + '</span>'
            : '',
          '<span class="td-ingredient-card__chevron">' + ICONS.chevron + '</span>',
        '</button>',
        '<div class="td-ingredient-card__body" id="' + bodyId + '" hidden>',
          desc
            ? '<p class="td-ingredient-card__detail">' + esc(desc) + '</p>'
            : '<p class="td-ingredient-card__detail">Standard diagnostic marker included in this panel.</p>',
          '<span class="td-evidence-badge td-evidence-badge--strong">Clinically supported</span>',
        '</div>',
      '</div>'
    ].join('');
  }

  function renderIngredientsSection(treatment, detailData) {
    var isLab  = treatment.category === 'lab';
    var heading = isLab ? "What's Tested" : "What's Inside";
    var sectionId = 'td-ingredients-heading';

    var cards = '';
    if (isLab) {
      // Prefer detail JSON labTests, fall back to wizard-config tests[]
      var tests = (detailData && detailData.labTests) || treatment.tests || [];
      if (!tests.length) return '';
      cards = tests.map(function (t, i) { return renderLabTestCard(t, i); }).join('');
    } else {
      // Prefer detail JSON ingredients, fall back to wizard-config ingredients[]
      var ingredients = (detailData && detailData.ingredients) || treatment.ingredients || [];
      if (!ingredients.length) return '';
      cards = ingredients.map(function (item, i) { return renderIngredientCard(item, i); }).join('');
    }

    return [
      '<section class="td-section td-ingredients" aria-labelledby="' + sectionId + '">',
        '<h2 class="td-section-title" id="' + sectionId + '">' + heading + '</h2>',
        '<div class="td-ingredient-list">',
          cards,
        '</div>',
      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Who This Is For
  // ---------------------------------------------------------------------------
  function renderPersonasSection(detailData, treatment) {
    // Use detail JSON personas if present; otherwise synthesise from bestFor
    var personas = (detailData && detailData.personas);
    if (!personas || !personas.length) {
      if (!treatment.bestFor || !treatment.bestFor.length) return '';
      personas = treatment.bestFor.map(function (label) {
        return { headline: label, detail: 'This treatment is an excellent fit for this need.' };
      });
    }

    var cards = personas.map(function (p) {
      return [
        '<div class="td-persona-card">',
          '<p class="td-persona-card__headline">' + esc(p.headline) + '</p>',
          p.detail ? '<p class="td-persona-card__detail">' + esc(p.detail) + '</p>' : '',
        '</div>'
      ].join('');
    }).join('');

    return [
      '<section class="td-section td-personas" aria-labelledby="td-personas-heading">',
        '<h2 class="td-section-title" id="td-personas-heading">Who This Is For</h2>',
        '<div class="td-persona-grid">',
          cards,
        '</div>',
      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // What to Expect
  // ---------------------------------------------------------------------------
  function renderExpectSection(detailData) {
    if (!detailData || !detailData.expect) return '';
    var ex = detailData.expect;

    var items = [
      ex.onset      ? { icon: ICONS.bolt,     label: 'Onset',       value: ex.onset }      : null,
      ex.duration   ? { icon: ICONS.clock,    label: 'Duration',    value: ex.duration }   : null,
      ex.frequency  ? { icon: ICONS.repeat,   label: 'Frequency',   value: ex.frequency }  : null,
      ex.howItFeels ? { icon: ICONS.heart,    label: 'Sensation',   value: ex.howItFeels } : null
    ].filter(Boolean);

    if (!items.length) return '';

    var cells = items.map(function (item) {
      return [
        '<div class="td-expect-cell">',
          '<span class="td-expect-cell__icon">' + item.icon + '</span>',
          '<span class="td-expect-cell__label">' + esc(item.label) + '</span>',
          '<span class="td-expect-cell__value">' + esc(item.value) + '</span>',
        '</div>'
      ].join('');
    }).join('');

    return [
      '<section class="td-section td-expect" aria-labelledby="td-expect-heading">',
        '<h2 class="td-section-title" id="td-expect-heading">What to Expect</h2>',
        '<div class="td-expect-grid">',
          cells,
        '</div>',
      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // GLP-1 Section (semaglutide / tirzepatide only)
  // ---------------------------------------------------------------------------
  function renderGlp1Section(slug, detailData) {
    var isGlp1 = (slug === 'semaglutide' || slug === 'tirzepatide');
    if (!isGlp1) return '';

    var glp1 = (detailData && detailData.glp1) || {};

    // Eligibility
    var eligibilityItems = glp1.eligibility || [
      'BMI of 30 or higher',
      'BMI of 27 or higher with a weight-related health condition (type 2 diabetes, high blood pressure, high cholesterol)',
      'No personal or family history of medullary thyroid cancer or MEN2 syndrome',
      'Not currently pregnant or planning to become pregnant'
    ];
    var eligibilityList = eligibilityItems.map(function (e) {
      return '<li class="td-glp1__eligibility-item">' + ICONS.check + '<span>' + esc(e) + '</span></li>';
    }).join('');

    // Dosing schedule
    var dosingRows = (glp1.dosing || []);
    var dosingTable = '';
    if (dosingRows.length) {
      var tableRows = dosingRows.map(function (row) {
        return '<tr><td>' + esc(row.period) + '</td><td>' + esc(row.dose) + '</td><td>' + esc(row.notes || '') + '</td></tr>';
      }).join('');
      dosingTable = [
        '<div class="td-glp1__table-wrap">',
          '<table class="td-glp1-table" aria-label="Dosing schedule">',
            '<thead><tr><th>Period</th><th>Dose</th><th>Notes</th></tr></thead>',
            '<tbody>' + tableRows + '</tbody>',
          '</table>',
        '</div>'
      ].join('');
    }

    // Side effects
    var sideEffects = glp1.sideEffects || {
      common:    ['Nausea (most common, typically improves over time)', 'Constipation or diarrhea', 'Reduced appetite', 'Mild fatigue'],
      lessCommon: ['Vomiting', 'Acid reflux', 'Injection site reactions'],
      serious:   ['Pancreatitis (severe abdominal pain — seek immediate care)', 'Gallbladder problems', 'Allergic reactions']
    };

    var commonList    = (sideEffects.common    || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var lessCommonList= (sideEffects.lessCommon|| []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var seriousList   = (sideEffects.serious   || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');

    var bloodworkNote = glp1.bloodworkNote || 'Initial bloodwork ($99) is required before starting. This typically includes a CBC, CMP, HbA1c, and lipid panel to establish your baseline and ensure safe prescribing.';

    return [
      '<section class="td-section td-glp1" aria-labelledby="td-glp1-heading">',
        '<h2 class="td-section-title" id="td-glp1-heading">Program Information</h2>',

        '<div class="td-glp1__block">',
          '<h3 class="td-glp1__subheading">Eligibility Criteria</h3>',
          '<ul class="td-glp1__eligibility-list">' + eligibilityList + '</ul>',
        '</div>',

        dosingTable
          ? '<div class="td-glp1__block"><h3 class="td-glp1__subheading">Dosing Schedule</h3>' + dosingTable + '</div>'
          : '',

        '<div class="td-glp1__block">',
          '<h3 class="td-glp1__subheading">Side Effects</h3>',
          commonList
            ? '<div class="td-glp1__se-group"><p class="td-glp1__se-label td-glp1__se-label--common">Common</p><ul class="td-glp1__se-list">' + commonList + '</ul></div>'
            : '',
          lessCommonList
            ? '<div class="td-glp1__se-group"><p class="td-glp1__se-label td-glp1__se-label--less-common">Less Common</p><ul class="td-glp1__se-list">' + lessCommonList + '</ul></div>'
            : '',
          seriousList
            ? '<div class="td-glp1__se-group"><div class="td-glp1__se-serious-header">' + ICONS.warning + '<p class="td-glp1__se-label td-glp1__se-label--serious">Serious — Seek Immediate Care</p></div><ul class="td-glp1__se-list">' + seriousList + '</ul></div>'
            : '',
        '</div>',

        '<div class="td-glp1__block td-glp1__bloodwork">',
          '<span class="td-glp1__bloodwork-icon">' + ICONS.vial + '</span>',
          '<div>',
            '<p class="td-glp1__bloodwork-label">Required Bloodwork</p>',
            '<p class="td-glp1__bloodwork-text">' + esc(bloodworkNote) + '</p>',
          '</div>',
        '</div>',

      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Trust bar
  // ---------------------------------------------------------------------------
  function renderTrustBar(wizardConfig) {
    var meta   = wizardConfig.meta || {};
    var rating = meta.reviewRating || '5.0';
    var count  = meta.reviewCount  || '';

    var stars = Array(5).fill('<span class="td-trust__star">' + ICONS.star + '</span>').join('');

    return [
      '<section class="td-trust" aria-label="Trust indicators">',
        '<div class="td-trust__inner">',
          '<div class="td-trust__reviews">',
            '<span class="td-trust__stars" aria-label="' + rating + ' out of 5 stars">' + stars + '</span>',
            '<span class="td-trust__rating">' + esc(rating) + '</span>',
            count ? '<span class="td-trust__count">(' + esc(count) + ' reviews)</span>' : '',
          '</div>',
          '<div class="td-trust__items">',
            '<span class="td-trust__item">' + ICONS.shield + 'Licensed RNs and paramedics</span>',
            '<span class="td-trust__item">' + ICONS.check + 'We come to you — home, hotel, office</span>',
          '</div>',
        '</div>',
      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Sticky mobile CTA
  // ---------------------------------------------------------------------------
  function renderStickyCta(treatment, wizardConfig) {
    var acuityUrl = buildAcuityUrl(wizardConfig, treatment);
    var phone     = (wizardConfig.meta && wizardConfig.meta.phoneNumber) || '';

    return [
      '<div class="td-sticky-cta" role="complementary" aria-label="Book this treatment">',
        '<a href="' + esc(acuityUrl) + '" class="td-sticky-cta__btn" target="_blank" rel="noopener">',
          'Book This Treatment',
        '</a>',
        phone
          ? '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, '')) + '" class="td-sticky-cta__phone">' + esc(phone) + '</a>'
          : '',
      '</div>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Related treatments
  // ---------------------------------------------------------------------------
  function renderRelatedSection(relatedSlugs, wizardConfig) {
    if (!relatedSlugs || !relatedSlugs.length) return '';

    var treatments = wizardConfig.treatments || {};
    var cards = relatedSlugs.slice(0, 3).map(function (slug) {
      var t = treatments[slug];
      if (!t) return '';
      var priceText = t.priceLabel || ('$' + t.price);
      return [
        '<a href="?slug=' + esc(slug) + '" class="td-related-card">',
          '<div class="td-related-card__body">',
            '<p class="td-related-card__name">' + esc(t.name) + '</p>',
            '<p class="td-related-card__price">' + esc(priceText) + '</p>',
            t.shortDesc
              ? '<p class="td-related-card__desc">' + esc(t.shortDesc) + '</p>'
              : '',
          '</div>',
          '<span class="td-related-card__arrow">' + ICONS.arrow + '</span>',
        '</a>'
      ].join('');
    }).filter(Boolean).join('');

    if (!cards) return '';

    return [
      '<section class="td-section td-related" aria-labelledby="td-related-heading">',
        '<h2 class="td-section-title" id="td-related-heading">Related Treatments</h2>',
        '<div class="td-related-grid">',
          cards,
        '</div>',
      '</section>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Footer
  // ---------------------------------------------------------------------------
  function renderFooter(wizardConfig) {
    var phone = (wizardConfig.meta && wizardConfig.meta.phoneNumber) || '';
    return [
      '<footer class="td-footer">',
        '<div class="td-footer__inner">',
          '<p class="td-footer__quiz">',
            'Not what you need? ',
            '<a href="/wizard-of-iv/" class="td-footer__quiz-link">Take the treatment quiz</a>',
          '</p>',
          phone
            ? '<p class="td-footer__phone">' + ICONS.phone + '<a href="tel:' + esc(phone.replace(/[^0-9+]/g, '')) + '">' + esc(phone) + '</a></p>'
            : '',
        '</div>',
      '</footer>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Not-found screen
  // ---------------------------------------------------------------------------
  function renderNotFound(slug) {
    var msg = slug
      ? 'The treatment <strong>' + esc(slug) + '</strong> was not found.'
      : 'No treatment was specified.';
    return [
      renderNav(),
      '<main class="td-not-found">',
        '<div class="td-not-found__inner">',
          '<h1 class="td-not-found__heading">Treatment Not Found</h1>',
          '<p class="td-not-found__message">' + msg + '</p>',
          '<a href="/wizard-of-iv/" class="td-not-found__btn">Take the Treatment Quiz</a>',
        '</div>',
      '</main>'
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Full page assembly
  // ---------------------------------------------------------------------------
  function renderPage(slug, detailData, wizardConfig) {
    var coreTreatment = (wizardConfig.treatments || {})[slug];
    if (!coreTreatment) {
      return renderNotFound(slug);
    }

    // Merge: detail fields overlay core fields
    var treatment = {};
    // Copy core fields
    var coreFields = ['name', 'price', 'priceLabel', 'duration', 'shortDesc', 'acuityTypeId', 'category', 'bestFor'];
    coreFields.forEach(function (k) {
      if (coreTreatment[k] !== undefined) treatment[k] = coreTreatment[k];
    });
    // Copy ingredients/tests from core as fallback
    if (coreTreatment.ingredients) treatment.ingredients = coreTreatment.ingredients;
    if (coreTreatment.tests)       treatment.tests       = coreTreatment.tests;
    // Overlay with detail data
    if (detailData) {
      Object.keys(detailData).forEach(function (k) {
        treatment[k] = detailData[k];
      });
    }

    var whyText     = (wizardConfig.whyMatch || {})[slug] || '';
    var relatedSlugs= (detailData && detailData.relatedSlugs) || [];

    // Set page title
    document.title = treatment.name + ' | US Mobile IV';

    return [
      renderNav(),
      '<main id="td-main">',
        renderHero(treatment, wizardConfig),
        renderWhySection(whyText),
        renderIngredientsSection(treatment, detailData),
        renderPersonasSection(detailData, treatment),
        renderExpectSection(detailData),
        renderGlp1Section(slug, detailData),
        renderTrustBar(wizardConfig),
        renderRelatedSection(relatedSlugs, wizardConfig),
        renderFooter(wizardConfig),
      '</main>',
      renderStickyCta(treatment, wizardConfig)
    ].join('');
  }

  // ---------------------------------------------------------------------------
  // Expand / collapse ingredient cards
  // ---------------------------------------------------------------------------
  function bindExpandCards(container) {
    var triggers = container.querySelectorAll('.td-ingredient-card__trigger');
    triggers.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var expanded = btn.getAttribute('aria-expanded') === 'true';
        var bodyId   = btn.getAttribute('aria-controls');
        var body     = document.getElementById(bodyId);
        var card     = btn.closest('.td-ingredient-card');

        btn.setAttribute('aria-expanded', String(!expanded));
        if (body) {
          if (expanded) {
            body.hidden = true;
          } else {
            body.hidden = false;
          }
        }
        if (card) {
          card.classList.toggle('td-ingredient-card--open', !expanded);
        }
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------
  function init() {
    var app  = document.getElementById('td-app');
    if (!app) return;

    var params = new URLSearchParams(root.location.search);
    var slug   = params.get('slug') || '';

    // Fetch both JSON files in parallel
    var detailUrl  = './treatments-detail.json';
    var configUrl  = '../wizard-config.json';

    Promise.all([
      fetch(detailUrl).then(function (r) {
        if (!r.ok) return {};
        return r.json().catch(function () { return {}; });
      }),
      fetch(configUrl).then(function (r) {
        if (!r.ok) throw new Error('Failed to load wizard config');
        return r.json();
      })
    ]).then(function (results) {
      var detailJson   = results[0];
      var wizardConfig = results[1];

      var detailData = slug ? (detailJson[slug] || null) : null;

      var html;
      if (!slug || !(wizardConfig.treatments || {})[slug]) {
        html = renderNotFound(slug);
      } else {
        html = renderPage(slug, detailData, wizardConfig);
      }

      app.innerHTML = html;
      bindExpandCards(app);

    }).catch(function (err) {
      console.error('[TreatmentDetail] Failed to load data:', err);
      app.innerHTML = renderNotFound(slug);
    });
  }

  // ---------------------------------------------------------------------------
  // Bootstrap
  // ---------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
