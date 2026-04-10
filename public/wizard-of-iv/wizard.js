/**
 * Treatment Wizard — US Mobile IV Medics
 * Config-driven decision-tree modal wizard.
 * Zero dependencies. Classic script (IIFE). ES6+.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // Icon map — inline SVG, medical/wellness aesthetic, 20x20 viewBox
  // ---------------------------------------------------------------------------
  var ICONS = {
    bolt: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 2 7 11 10 11 7 18 13 9 10 9 13 2"/></svg>',
    heart: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17s-7-4.5-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 17 8c0 4.5-7 9-7 9z"/></svg>',
    scale: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="3" x2="10" y2="17"/><path d="M4 8l-2 5h4l-2-5z"/><path d="M16 8l-2 5h4l-2-5z"/><line x1="4" y1="8" x2="16" y2="8"/></svg>',
    vial: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2l6 0"/><path d="M8 2v8l-3 5a1.5 1.5 0 0 0 1.3 2.3h7.4A1.5 1.5 0 0 0 15 15l-3-5V2"/><line x1="6" y1="12" x2="14" y2="12"/></svg>',
    help: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><path d="M7.5 7.5a2.5 2.5 0 0 1 5 .8c0 2-3 2.5-3 4.2"/><line x1="10" y1="16" x2="10.01" y2="16" stroke-width="2.5"/></svg>',
    glass: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h10l-2 9a3 3 0 0 1-6 0L5 3z"/><line x1="4" y1="6" x2="16" y2="6"/></svg>',
    head: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3a7 7 0 0 1 7 7v3h-3v4H6v-4H3v-3A7 7 0 0 1 10 3z"/><line x1="7" y1="8" x2="7.01" y2="8" stroke-width="2.5"/><line x1="13" y1="8" x2="13.01" y2="8" stroke-width="2.5"/></svg>',
    virus: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="4"/><line x1="10" y1="2" x2="10" y2="6"/><line x1="10" y1="14" x2="10" y2="18"/><line x1="2" y1="10" x2="6" y2="10"/><line x1="14" y1="10" x2="18" y2="10"/><line x1="4.2" y1="4.2" x2="7" y2="7"/><line x1="13" y1="13" x2="15.8" y2="15.8"/><line x1="15.8" y1="4.2" x2="13" y2="7"/><line x1="7" y1="13" x2="4.2" y2="15.8"/></svg>',
    droplet: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2.5S5 8 5 12a5 5 0 0 0 10 0c0-4-5-9.5-5-9.5z"/></svg>',
    mountain: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="2 17 8 7 12 12 14.5 9 18 17"/><line x1="2" y1="17" x2="18" y2="17"/></svg>',
    plane: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 10L11 6V3a1 1 0 0 0-2 0v3L2.2 10l1 1 5.8-2v5l-2 1.5V17l3-1 3 1v-1.5L11 14V9l5.8 2 1-1z"/></svg>',
    battery: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="7" width="15" height="6" rx="1.5"/><line x1="18" y1="9" x2="18" y2="11" stroke-width="2.5" stroke-linecap="round"/><line x1="4" y1="10" x2="7" y2="10"/></svg>',
    zap: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 2 3 12 10 12 9 18 17 8 10 8 11 2"/></svg>',
    sparkle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v3M10 15v3M2 10h3M15 10h3M4.2 4.2l2.1 2.1M13.7 13.7l2.1 2.1M15.8 4.2l-2.1 2.1M6.3 13.7l-2.1 2.1"/><circle cx="10" cy="10" r="3"/></svg>',
    dumbbell: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="8.5" width="3" height="3" rx="0.5"/><rect x="15" y="8.5" width="3" height="3" rx="0.5"/><line x1="5" y1="10" x2="15" y2="10"/><rect x="6.5" y="7" width="2" height="6" rx="0.5"/><rect x="11.5" y="7" width="2" height="6" rx="0.5"/></svg>',
    hourglass: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h10M5 17h10M6 3v3l4 4M14 3v3l-4 4M6 17v-3l4-4M14 17v-3l-4-4"/></svg>',
    refresh: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4a8 8 0 1 1-1.5 5"/><polyline points="1 3 4 4 5 7"/></svg>',
    shield: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2l7 3v5c0 4-3 7-7 8-4-1-7-4-7-8V5l7-3z"/><polyline points="7 10 9 12 13 8"/></svg>',
    baby: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="6" r="3"/><path d="M6 18v-3a4 4 0 0 1 8 0v3"/><line x1="7" y1="18" x2="13" y2="18"/></svg>',
    cloud: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 13.5A3.5 3.5 0 0 0 14 7a5 5 0 1 0-9.8 2A3 3 0 0 0 5 15h11a2 2 0 0 0 .5-.5"/><line x1="10" y1="17" x2="10" y2="19"/><line x1="7" y1="17" x2="7" y2="18"/><line x1="13" y1="17" x2="13" y2="18"/></svg>',
    fire: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18c-4 0-6-2.5-6-5.5C4 9 7 7 7 4c1.5 2 2 3 2 3s1-2 1-4c2 1.5 4 4 4 7.5 0 3-2 5.5-4 7.5z"/><path d="M10 18c-1.5 0-3-1-3-3 0-1.5 1.5-2.5 1.5-4C9 12 9 13 10 14c.5-1 1-2 1-3 1 1 2 2 2 3.5 0 2-1.5 3.5-3 3.5z"/></svg>',
    star: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><polygon points="10 2 12.4 7.5 18.5 7.9 14 11.9 15.5 18 10 14.8 4.5 18 6 11.9 1.5 7.9 7.6 7.5"/></svg>'
  };

  function getIcon(name) {
    return ICONS[name] || ICONS.help;
  }

  // ---------------------------------------------------------------------------
  // Analytics helpers
  // ---------------------------------------------------------------------------
  function pushEvent(eventData) {
    root.dataLayer = root.dataLayer || [];
    root.dataLayer.push(eventData);
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var state = {
    config: null,
    isOpen: false,
    currentQuestionId: 'start',
    currentView: 'question',  // 'question' | 'result' | 'multi-results'
    history: [],          // array of question IDs for back nav
    stepNumber: 0,        // total steps taken
    selectedOption: null, // for single-select
    selectedMulti: [],    // for multi-select (option indices)
    multiResults: [],     // array of scored recommendation objects
    sessionPlan: [],      // array of treatment IDs added to session
    source: 'button'
  };

  // ---------------------------------------------------------------------------
  // DOM references (set after modal is first created)
  // ---------------------------------------------------------------------------
  var dom = {
    overlay: null,
    modal: null,
    progressFill: null,
    contentArea: null,
    closeBtn: null
  };

  // ---------------------------------------------------------------------------
  // Modal HTML scaffold — built once, reused
  // ---------------------------------------------------------------------------
  function buildModalScaffold() {
    var overlay = document.createElement('div');
    overlay.className = 'tw-overlay';

    overlay.innerHTML =
      '<div class="tw-modal" role="dialog" aria-modal="true" aria-label="Treatment recommendation wizard">' +
        '<button class="tw-close" aria-label="Close wizard" type="button">' +
          '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="4" x2="16" y2="16"/><line x1="16" y1="4" x2="4" y2="16"/></svg>' +
        '</button>' +
        '<div class="tw-progress"><div class="tw-progress-fill" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div></div>' +
        '<div class="tw-content-area"></div>' +
      '</div>';

    dom.overlay    = overlay;
    dom.modal      = overlay.querySelector('.tw-modal');
    dom.progressFill = overlay.querySelector('.tw-progress-fill');
    dom.contentArea  = overlay.querySelector('.tw-content-area');
    dom.closeBtn     = overlay.querySelector('.tw-close');

    // Close on backdrop click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeWizard();
    });

    dom.closeBtn.addEventListener('click', closeWizard);

    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------------------
  // Progress bar
  // ---------------------------------------------------------------------------
  var EXPECTED_MAX_STEPS = 4; // max question depth before result

  function updateProgress() {
    var pct = Math.min(Math.round((state.stepNumber / EXPECTED_MAX_STEPS) * 100), 90);
    dom.progressFill.style.width = pct + '%';
    dom.progressFill.setAttribute('aria-valuenow', pct);
  }

  // ---------------------------------------------------------------------------
  // Open / close
  // ---------------------------------------------------------------------------
  function openWizard(source) {
    if (!state.config) { return; }
    if (state.isOpen) { return; }

    state.isOpen = true;
    state.currentQuestionId = 'start';
    state.currentView = 'question';
    state.history = [];
    state.stepNumber = 0;
    state.selectedOption = null;
    state.selectedMulti = [];
    state.multiResults = [];
    state.sessionPlan = [];
    state.source = source || 'button';

    document.body.style.overflow = 'hidden';
    dom.overlay.classList.add('tw-overlay--visible');

    pushEvent({ event: 'wizard_opened', source: state.source });

    renderCurrentStep();
    updateProgress();

    // Focus the modal after a short delay (allows CSS transition to start)
    setTimeout(function () {
      var first = getFocusableElements()[0];
      if (first) { first.focus(); }
    }, 50);
  }

  function closeWizard() {
    if (!state.isOpen) { return; }

    pushEvent({
      event: 'wizard_abandoned',
      step_id: state.currentQuestionId,
      step_number: state.stepNumber
    });

    _doClose();
  }

  function _doClose() {
    state.isOpen = false;
    document.body.style.overflow = '';
    dom.overlay.classList.remove('tw-overlay--visible');
  }

  // ---------------------------------------------------------------------------
  // Focus trap
  // ---------------------------------------------------------------------------
  function getFocusableElements() {
    return Array.prototype.slice.call(
      dom.modal.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function handleKeyDown(e) {
    if (!state.isOpen) { return; }

    if (e.key === 'Escape') {
      closeWizard();
      return;
    }

    if (e.key === 'Tab') {
      var focusable = getFocusableElements();
      if (!focusable.length) { e.preventDefault(); return; }

      var first = focusable[0];
      var last  = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  }

  document.addEventListener('keydown', handleKeyDown);

  // ---------------------------------------------------------------------------
  // Step transition helper
  // ---------------------------------------------------------------------------
  function transitionStep(renderFn) {
    var area = dom.contentArea;

    // Mark existing content as exiting
    var existing = area.firstElementChild;
    if (existing) {
      existing.classList.add('tw-step-exiting');
    }

    // Wait for exit animation then swap
    var ANIM_MS = 200;
    setTimeout(function () {
      area.innerHTML = '';
      var newContent = renderFn();
      area.appendChild(newContent);
      // Force reflow
      void newContent.offsetWidth;
      newContent.classList.add('tw-step-entering');

      // Focus first interactive element
      setTimeout(function () {
        var first = getFocusableElements()[0];
        if (first) { first.focus(); }
      }, 30);
    }, existing ? ANIM_MS : 0);
  }

  // ---------------------------------------------------------------------------
  // Render dispatch
  // ---------------------------------------------------------------------------
  function renderCurrentStep() {
    var q = state.config.questions[state.currentQuestionId];
    if (!q) { return; }

    transitionStep(function () {
      return renderQuestion(q);
    });

    updateProgress();
  }

  // ---------------------------------------------------------------------------
  // Render question
  // ---------------------------------------------------------------------------
  function renderQuestion(q) {
    var wrap = document.createElement('div');
    wrap.className = 'tw-question';

    var header = document.createElement('div');
    header.className = 'tw-question-header';

    var title = document.createElement('h2');
    title.className = 'tw-title';
    title.textContent = q.title;

    header.appendChild(title);

    if (q.subtitle) {
      var sub = document.createElement('p');
      sub.className = 'tw-subtitle';
      sub.textContent = q.subtitle;
      header.appendChild(sub);
    }

    wrap.appendChild(header);

    var optionsGrid = document.createElement('div');
    optionsGrid.className = 'tw-options tw-options--' + q.type;
    if (q.type === 'multi') {
      optionsGrid.setAttribute('role', 'group');
      optionsGrid.setAttribute('aria-label', 'Select all that apply');
    }

    q.options.forEach(function (opt, idx) {
      var card = buildOptionCard(opt, idx, q.type);
      optionsGrid.appendChild(card);
    });

    wrap.appendChild(optionsGrid);

    // Navigation bar
    var nav = buildNav(q);
    wrap.appendChild(nav);

    return wrap;
  }

  function buildOptionCard(opt, idx, type) {
    var card = document.createElement('button');
    card.type = 'button';
    card.className = 'tw-option';
    card.setAttribute('data-idx', idx);

    if (type === 'multi') {
      card.setAttribute('role', 'checkbox');
      card.setAttribute('aria-checked', 'false');
      if (state.selectedMulti.indexOf(idx) !== -1) {
        card.classList.add('tw-option--selected');
        card.setAttribute('aria-checked', 'true');
      }
    } else {
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', state.selectedOption === idx ? 'true' : 'false');
      if (state.selectedOption === idx) {
        card.classList.add('tw-option--selected');
      }
    }

    var iconWrap = document.createElement('span');
    iconWrap.className = 'tw-option-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    if (opt.icon) {
      iconWrap.innerHTML = getIcon(opt.icon);
    }

    var labelWrap = document.createElement('span');
    labelWrap.className = 'tw-option-labels';

    var labelEl = document.createElement('span');
    labelEl.className = 'tw-option-label';
    labelEl.textContent = opt.label;
    labelWrap.appendChild(labelEl);

    if (opt.sublabel) {
      var subEl = document.createElement('span');
      subEl.className = 'tw-option-sublabel';
      subEl.textContent = opt.sublabel;
      labelWrap.appendChild(subEl);
    }

    card.appendChild(iconWrap);
    card.appendChild(labelWrap);

    // Checkmark indicator
    var checkEl = document.createElement('span');
    checkEl.className = 'tw-option-check';
    checkEl.setAttribute('aria-hidden', 'true');
    checkEl.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 10 8 14 16 6"/></svg>';
    card.appendChild(checkEl);

    card.addEventListener('click', function () {
      handleOptionClick(idx, opt, type);
    });

    return card;
  }

  function buildNav(q) {
    var nav = document.createElement('div');
    nav.className = 'tw-nav';

    // Back button
    if (state.history.length > 0) {
      var backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'tw-btn-back';
      backBtn.textContent = 'Back';
      backBtn.setAttribute('aria-label', 'Go back to previous question');
      backBtn.addEventListener('click', handleBack);
      nav.appendChild(backBtn);
    } else {
      // placeholder to keep layout stable
      var spacer = document.createElement('span');
      spacer.className = 'tw-nav-spacer';
      spacer.setAttribute('aria-hidden', 'true');
      nav.appendChild(spacer);
    }

    // Continue button (multi only — single auto-advances)
    if (q.type === 'multi') {
      var cont = document.createElement('button');
      cont.type = 'button';
      cont.className = 'tw-btn-continue';
      cont.textContent = 'Find My Treatment';
      cont.setAttribute('aria-label', 'Submit selections and see recommendation');
      if (state.selectedMulti.length === 0) {
        cont.setAttribute('disabled', 'disabled');
      }
      cont.addEventListener('click', handleMultiContinue);
      nav.appendChild(cont);

      var errMsg = document.createElement('span');
      errMsg.className = 'tw-error-msg';
      errMsg.setAttribute('aria-live', 'polite');
      errMsg.setAttribute('role', 'alert');
      nav.appendChild(errMsg);
    }

    return nav;
  }

  // ---------------------------------------------------------------------------
  // Option click handlers
  // ---------------------------------------------------------------------------
  function handleOptionClick(idx, opt, type) {
    if (type === 'multi') {
      toggleMultiOption(idx);
    } else {
      handleSingleOption(idx, opt);
    }
  }

  function toggleMultiOption(idx) {
    var pos = state.selectedMulti.indexOf(idx);
    if (pos === -1) {
      state.selectedMulti.push(idx);
    } else {
      state.selectedMulti.splice(pos, 1);
    }

    // Update DOM without full re-render
    var cards = dom.contentArea.querySelectorAll('.tw-option');
    cards.forEach(function (card) {
      var cardIdx = parseInt(card.getAttribute('data-idx'), 10);
      var selected = state.selectedMulti.indexOf(cardIdx) !== -1;
      card.classList.toggle('tw-option--selected', selected);
      card.setAttribute('aria-checked', selected ? 'true' : 'false');
    });

    // Enable / disable continue button based on selection count
    var contBtn = dom.contentArea.querySelector('.tw-btn-continue');
    if (contBtn) {
      if (state.selectedMulti.length > 0) {
        contBtn.removeAttribute('disabled');
        // Hide error message if visible
        var errEl = dom.contentArea.querySelector('.tw-error-msg');
        if (errEl) { errEl.classList.remove('tw-error-msg--visible'); }
      } else {
        contBtn.setAttribute('disabled', 'disabled');
      }
    }
  }

  function handleSingleOption(idx, opt) {
    state.selectedOption = idx;

    pushEvent({
      event: 'wizard_step_completed',
      step_id: state.currentQuestionId,
      step_number: state.stepNumber,
      answer: opt.label
    });

    state.stepNumber++;

    if (opt.recommend) {
      showResult(opt.recommend);
    } else if (opt.next) {
      state.history.push(state.currentQuestionId);
      state.currentQuestionId = opt.next;
      state.selectedOption = null;
      renderCurrentStep();
    }
  }

  // ---------------------------------------------------------------------------
  // Weighted symptom scoring — replaces tag-based logic
  // ---------------------------------------------------------------------------
  function scoreSymptoms() {
    var q = state.config.questions[state.currentQuestionId];
    var treatments = state.config.treatments;

    // Accumulate scores and symptom tracking per treatment ID
    var scores = {};          // treatmentId -> total score
    var matching = {};        // treatmentId -> [symptom label, ...]
    var addressed = {};       // treatmentId -> [addressedBy text, ...]

    state.selectedMulti.forEach(function (idx) {
      var opt = q.options[idx];
      if (!opt.scores) { return; }

      Object.keys(opt.scores).forEach(function (treatmentId) {
        scores[treatmentId] = (scores[treatmentId] || 0) + opt.scores[treatmentId];

        if (!matching[treatmentId]) { matching[treatmentId] = []; }
        matching[treatmentId].push(opt.label);

        if (!addressed[treatmentId]) { addressed[treatmentId] = []; }
        if (opt.addressedBy && opt.addressedBy[treatmentId]) {
          var text = opt.addressedBy[treatmentId];
          if (addressed[treatmentId].indexOf(text) === -1) {
            addressed[treatmentId].push(text);
          }
        }
      });
    });

    // Build candidate list with category lookup
    var candidates = Object.keys(scores).map(function (treatmentId) {
      var t = treatments[treatmentId];
      return {
        treatmentId: treatmentId,
        score: scores[treatmentId],
        category: t ? t.category : 'iv',
        matchingSymptoms: matching[treatmentId] || [],
        addressedByTexts: addressed[treatmentId] || []
      };
    });

    // Sort descending by score
    candidates.sort(function (a, b) { return b.score - a.score; });

    // Deduplicate: keep highest scorer per category
    var seenCategories = {};
    var deduped = [];
    candidates.forEach(function (c) {
      if (!seenCategories[c.category]) {
        seenCategories[c.category] = true;
        deduped.push(c);
      }
    });

    // Split by category bucket
    var ivResults = deduped.filter(function (c) {
      return c.category === 'iv' || c.category === 'nad';
    });
    var programResults = deduped.filter(function (c) {
      return c.category === 'weightLoss';
    });
    var labResults = deduped.filter(function (c) {
      return c.category === 'lab' || c.category === 'injection';
    });

    // Top 3 IV/NAD + all programs + all labs
    var results = ivResults.slice(0, 3).concat(programResults).concat(labResults);

    return results;
  }

  function handleMultiContinue() {
    // Show error if nothing selected (button should be disabled, but guard anyway)
    if (state.selectedMulti.length === 0) {
      var errEl = dom.contentArea.querySelector('.tw-error-msg');
      if (errEl) {
        errEl.textContent = 'Please select at least one symptom to continue.';
        errEl.classList.add('tw-error-msg--visible');
      }
      return;
    }

    var q = state.config.questions[state.currentQuestionId];

    // Collect selected labels for analytics
    var labels = state.selectedMulti.map(function (idx) {
      return q.options[idx].label;
    }).join(', ');

    pushEvent({
      event: 'wizard_step_completed',
      step_id: state.currentQuestionId,
      step_number: state.stepNumber,
      answer: labels
    });

    state.stepNumber++;
    state.multiResults = scoreSymptoms();
    state.currentView = 'multi-results';

    // Progress to 100%
    dom.progressFill.style.width = '100%';
    dom.progressFill.setAttribute('aria-valuenow', 100);

    showMultiResults();
  }

  function handleBack() {
    // If on multi-results, go back to the symptoms question
    if (state.currentView === 'multi-results') {
      state.currentView = 'question';
      state.multiResults = [];
      state.sessionPlan = [];
      state.stepNumber = Math.max(0, state.stepNumber - 1);
      dom.progressFill.style.width = Math.min(Math.round(((state.stepNumber) / EXPECTED_MAX_STEPS) * 100), 90) + '%';
      dom.progressFill.setAttribute('aria-valuenow', Math.min(Math.round(((state.stepNumber) / EXPECTED_MAX_STEPS) * 100), 90));
      renderCurrentStep();
      return;
    }

    if (state.history.length === 0) { return; }

    state.currentView = 'question';
    state.currentQuestionId = state.history.pop();
    state.stepNumber = Math.max(0, state.stepNumber - 1);
    state.selectedOption = null;
    state.selectedMulti = [];
    renderCurrentStep();
  }

  // ---------------------------------------------------------------------------
  // Resolve treatment — handles bundles, placeholders, direct IDs
  // ---------------------------------------------------------------------------
  function resolveRecommendation(id) {
    var config = state.config;

    // Check bundles first
    if (config.bundles && config.bundles[id]) {
      var bundle = config.bundles[id];
      return {
        isBundleResult: true,
        bundle: bundle,
        primary: config.treatments[bundle.primary],
        primaryId: bundle.primary,
        addOn: bundle.addOn ? config.treatments[bundle.addOn] : null,
        addOnId: bundle.addOn || null,
        isConsultation: !!bundle.isConsultation,
        whyMatch: bundle.whyMatch
      };
    }

    // Direct treatment
    if (config.treatments[id]) {
      return {
        isBundleResult: false,
        primary: config.treatments[id],
        primaryId: id,
        addOn: null,
        addOnId: null,
        whyMatch: (config.whyMatch && config.whyMatch[id]) || ''
      };
    }

    // Fallback — log warning for debugging
    if (root.console && root.console.warn) {
      root.console.warn('[TreatmentWizard] Unknown treatment/bundle ID: "' + id + '", falling back to Myers\'');
    }
    return {
      isBundleResult: false,
      primary: config.treatments['myers'],
      primaryId: 'myers',
      addOn: null,
      addOnId: null,
      whyMatch: (config.whyMatch && config.whyMatch['myers']) || ''
    };
  }

  // ---------------------------------------------------------------------------
  // Show result screen
  // ---------------------------------------------------------------------------
  function showResult(treatmentId) {
    var rec = resolveRecommendation(treatmentId);
    var t = rec.primary;

    state.currentView = 'result';

    pushEvent({
      event: 'wizard_recommendation',
      treatment_id: rec.isBundleResult ? treatmentId : rec.primaryId,
      treatment_name: rec.isBundleResult ? rec.bundle.name : t.name,
      price: t.priceLabel || ('$' + t.price),
      is_bundle: rec.isBundleResult
    });

    // Progress to 100%
    dom.progressFill.style.width = '100%';
    dom.progressFill.setAttribute('aria-valuenow', 100);

    transitionStep(function () {
      return renderResult(rec);
    });
  }

  function renderResult(rec) {
    var config = state.config;
    var t = rec.primary;
    var meta = config.meta;

    var wrap = document.createElement('div');
    wrap.className = 'tw-result';

    // --- Header ---
    var header = document.createElement('div');
    header.className = 'tw-result-header';

    var matchLabel = document.createElement('p');
    matchLabel.className = 'tw-result-match-label';
    matchLabel.textContent = 'Your recommended treatment';
    header.appendChild(matchLabel);

    var name = document.createElement('h2');
    name.className = 'tw-result-name';
    name.textContent = rec.isBundleResult ? rec.bundle.name : t.name;
    header.appendChild(name);

    var priceRow = document.createElement('div');
    priceRow.className = 'tw-result-price-row';

    var price = document.createElement('span');
    price.className = 'tw-result-price';
    price.textContent = t.priceLabel || ('$' + t.price);
    priceRow.appendChild(price);

    var dur = document.createElement('span');
    dur.className = 'tw-result-duration';
    dur.textContent = t.duration;
    priceRow.appendChild(dur);

    header.appendChild(priceRow);

    if (t.shortDesc) {
      var desc = document.createElement('p');
      desc.className = 'tw-result-desc';
      desc.textContent = t.shortDesc;
      header.appendChild(desc);
    }

    wrap.appendChild(header);

    // --- Why match ---
    if (rec.whyMatch) {
      var matchSection = document.createElement('div');
      matchSection.className = 'tw-result-match';

      var matchTitle = document.createElement('p');
      matchTitle.className = 'tw-result-match-title';
      matchTitle.textContent = 'Why this is your match';
      matchSection.appendChild(matchTitle);

      var matchText = document.createElement('p');
      matchText.className = 'tw-result-match-text';
      matchText.textContent = rec.whyMatch;
      matchSection.appendChild(matchText);

      wrap.appendChild(matchSection);
    }

    // --- Ingredients ---
    if (t.ingredients && t.ingredients.length) {
      var ingSection = document.createElement('div');
      ingSection.className = 'tw-result-ingredients';

      var ingTitle = document.createElement('p');
      ingTitle.className = 'tw-result-section-title';
      ingTitle.textContent = (t.category === 'lab') ? "What's tested" : "What's inside";
      ingSection.appendChild(ingTitle);

      var ingList = document.createElement('ul');
      ingList.className = 'tw-result-ing-list';

      t.ingredients.forEach(function (ing) {
        var li = document.createElement('li');
        li.className = 'tw-result-ing-item';

        var ingName = document.createElement('span');
        ingName.className = 'tw-result-ing-name';
        ingName.textContent = ing.name;

        var ingBenefit = document.createElement('span');
        ingBenefit.className = 'tw-result-ing-benefit';
        ingBenefit.textContent = ing.benefit;

        li.appendChild(ingName);
        li.appendChild(ingBenefit);
        ingList.appendChild(li);
      });

      ingSection.appendChild(ingList);
      wrap.appendChild(ingSection);
    }

    // --- Best for tags ---
    if (t.bestFor && t.bestFor.length) {
      var bestForSection = document.createElement('div');
      bestForSection.className = 'tw-result-bestfor';

      var bestForLabel = document.createElement('span');
      bestForLabel.className = 'tw-result-bestfor-label';
      bestForLabel.textContent = 'Best for:';
      bestForSection.appendChild(bestForLabel);

      var bestForTags = document.createElement('div');
      bestForTags.className = 'tw-result-bestfor-tags';

      t.bestFor.forEach(function (tag) {
        var tagEl = document.createElement('span');
        tagEl.className = 'tw-result-bestfor-tag';
        tagEl.textContent = tag;
        bestForTags.appendChild(tagEl);
      });

      bestForSection.appendChild(bestForTags);
      wrap.appendChild(bestForSection);
    }

    // --- Add-on / Bundle suggestion ---
    if (rec.addOn && !rec.isConsultation) {
      var isInteractive = rec.bundle && rec.bundle.addOnInteractive;
      var addOnLabelText = rec.isBundleResult ? rec.bundle.addOnLabel : ('Pair with ' + rec.addOn.name + ' (+$' + rec.addOn.price + ')');

      if (isInteractive) {
        var addOn = document.createElement('button');
        addOn.type = 'button';
        addOn.className = 'tw-result-addon tw-result-addon--interactive';
        addOn.setAttribute('aria-pressed', 'false');

        var addOnIcon = document.createElement('span');
        addOnIcon.className = 'tw-result-addon-icon';
        addOnIcon.setAttribute('aria-hidden', 'true');
        addOnIcon.innerHTML = getIcon('sparkle');

        var addOnText = document.createElement('div');
        addOnText.className = 'tw-result-addon-text';

        var addOnLabelEl = document.createElement('p');
        addOnLabelEl.className = 'tw-result-addon-label';
        addOnLabelEl.textContent = addOnLabelText;

        var addOnStatus = document.createElement('span');
        addOnStatus.className = 'tw-result-addon-status';
        addOnStatus.setAttribute('aria-hidden', 'true');

        addOnText.appendChild(addOnLabelEl);
        addOnText.appendChild(addOnStatus);
        addOn.appendChild(addOnIcon);
        addOn.appendChild(addOnText);

        addOn.addEventListener('click', function () {
          var pressed = addOn.getAttribute('aria-pressed') === 'true';
          var nowPressed = !pressed;
          addOn.setAttribute('aria-pressed', nowPressed ? 'true' : 'false');
          addOn.classList.toggle('tw-result-addon--added', nowPressed);
          addOnStatus.textContent = nowPressed ? 'Added' : '';
          pushEvent({
            event: 'wizard_addon_toggled',
            addon_id: rec.addOnId,
            addon_name: rec.addOn.name,
            added: nowPressed
          });
        });

        wrap.appendChild(addOn);
      } else {
        var addOn = document.createElement('div');
        addOn.className = 'tw-result-addon';

        var addOnIcon = document.createElement('span');
        addOnIcon.className = 'tw-result-addon-icon';
        addOnIcon.setAttribute('aria-hidden', 'true');
        addOnIcon.innerHTML = getIcon('sparkle');

        var addOnText = document.createElement('div');
        addOnText.className = 'tw-result-addon-text';

        var addOnLabelEl = document.createElement('p');
        addOnLabelEl.className = 'tw-result-addon-label';
        addOnLabelEl.textContent = addOnLabelText;

        addOnText.appendChild(addOnLabelEl);
        addOn.appendChild(addOnIcon);
        addOn.appendChild(addOnText);
        wrap.appendChild(addOn);
      }
    }

    // --- Note (e.g., "Requires initial bloodwork") ---
    if (t.note) {
      var noteEl = document.createElement('p');
      noteEl.className = 'tw-result-note';
      noteEl.textContent = t.note;
      wrap.appendChild(noteEl);
    }

    // --- Trust bar ---
    var trust = document.createElement('div');
    trust.className = 'tw-result-trust';

    var starRow = document.createElement('span');
    starRow.className = 'tw-result-stars';
    starRow.setAttribute('aria-label', meta.reviewRating + ' stars');

    for (var s = 0; s < 5; s++) {
      var starEl = document.createElement('span');
      starEl.className = 'tw-star';
      starEl.setAttribute('aria-hidden', 'true');
      starEl.innerHTML = getIcon('star');
      starRow.appendChild(starEl);
    }

    var reviewText = document.createElement('span');
    reviewText.className = 'tw-result-reviews';
    reviewText.textContent = meta.reviewRating + ' (' + meta.reviewCount + ' reviews)';

    trust.appendChild(starRow);
    trust.appendChild(reviewText);
    wrap.appendChild(trust);

    // --- CTAs ---
    var ctas = document.createElement('div');
    ctas.className = 'tw-result-ctas tw-result-ctas--horizontal';

    // Book button
    var bookBtn = document.createElement('a');
    bookBtn.className = 'tw-btn-primary';
    bookBtn.textContent = 'Book This Treatment';
    bookBtn.setAttribute('target', '_blank');
    bookBtn.setAttribute('rel', 'noopener noreferrer');

    var acuityUrl = meta.acuityBase;
    if (t.acuityTypeId) {
      acuityUrl += '?appointmentTypeID=' + encodeURIComponent(t.acuityTypeId);
    }
    bookBtn.href = acuityUrl;

    bookBtn.addEventListener('click', function () {
      pushEvent({
        event: 'wizard_book_clicked',
        treatment_id: rec.primaryId,
        treatment_name: t.name
      });
      _doClose();
    });

    ctas.appendChild(bookBtn);

    // Learn more button (if pageUrl exists)
    if (t.pageUrl) {
      var learnBtn = document.createElement('a');
      learnBtn.className = 'tw-btn-secondary';
      learnBtn.textContent = 'Learn More';
      learnBtn.href = t.pageUrl;

      learnBtn.addEventListener('click', function () {
        pushEvent({
          event: 'wizard_learn_more',
          treatment_id: rec.primaryId,
          treatment_name: t.name
        });
        _doClose();
      });

      ctas.appendChild(learnBtn);
    }

    wrap.appendChild(ctas);

    // --- Nav row (back + start over) ---
    var nav = document.createElement('div');
    nav.className = 'tw-nav tw-nav--result';

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'tw-btn-back';
    backBtn.textContent = 'Back';
    backBtn.setAttribute('aria-label', 'Go back to previous question');
    backBtn.addEventListener('click', handleBack);
    nav.appendChild(backBtn);

    var restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'tw-btn-restart';
    restartBtn.textContent = 'Start Over';
    restartBtn.setAttribute('aria-label', 'Restart the wizard from the beginning');
    restartBtn.addEventListener('click', function () {
      pushEvent({ event: 'wizard_restarted' });
      state.currentQuestionId = 'start';
      state.currentView = 'question';
      state.history = [];
      state.stepNumber = 0;
      state.selectedOption = null;
      state.selectedMulti = [];
      state.multiResults = [];
      state.sessionPlan = [];
      dom.progressFill.style.width = '0%';
      dom.progressFill.setAttribute('aria-valuenow', 0);
      renderCurrentStep();
    });
    nav.appendChild(restartBtn);

    wrap.appendChild(nav);

    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Multi-result display — scored symptom recommendations
  // ---------------------------------------------------------------------------
  function showMultiResults() {
    transitionStep(function () {
      return renderMultiResults();
    });
  }

  function renderMultiResults() {
    var config = state.config;
    var results = state.multiResults;
    var selectedCount = state.selectedMulti.length;
    // Resolve the question that produced these results to get option labels
    var q = config.questions[state.currentQuestionId];

    var wrap = document.createElement('div');
    wrap.className = 'tw-result';

    // Header
    var header = document.createElement('div');
    header.className = 'tw-multi-header';

    var title = document.createElement('h2');
    title.className = 'tw-multi-title tw-result-name';
    title.textContent = 'Your matches';
    header.appendChild(title);

    var subtitle = document.createElement('p');
    subtitle.className = 'tw-multi-subtitle tw-result-desc';
    subtitle.textContent = 'Based on ' + selectedCount + ' symptom' + (selectedCount !== 1 ? 's' : '') + ' you selected';
    header.appendChild(subtitle);

    wrap.appendChild(header);

    // Recommendation cards
    var cardsSection = document.createElement('div');
    cardsSection.className = 'tw-rec-cards';

    results.forEach(function (rec, i) {
      var card = renderRecommendationCard(rec, i + 1);
      cardsSection.appendChild(card);
    });

    wrap.appendChild(cardsSection);

    // Add-on suggestions (based on first / primary result)
    if (results.length > 0) {
      var addonSection = renderAddonSuggestions(results[0].treatmentId);
      if (addonSection) {
        wrap.appendChild(addonSection);
      }
    }

    // Session plan (sticky)
    var planSection = renderSessionPlan();
    wrap.appendChild(planSection);

    // Nav
    var nav = document.createElement('div');
    nav.className = 'tw-nav tw-nav--result';

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'tw-btn-back';
    backBtn.textContent = 'Back';
    backBtn.setAttribute('aria-label', 'Go back to symptoms question');
    backBtn.addEventListener('click', handleBack);
    nav.appendChild(backBtn);

    var restartBtn = document.createElement('button');
    restartBtn.type = 'button';
    restartBtn.className = 'tw-btn-restart';
    restartBtn.textContent = 'Start Over';
    restartBtn.setAttribute('aria-label', 'Restart the wizard from the beginning');
    restartBtn.addEventListener('click', function () {
      pushEvent({ event: 'wizard_restarted' });
      state.currentQuestionId = 'start';
      state.currentView = 'question';
      state.history = [];
      state.stepNumber = 0;
      state.selectedOption = null;
      state.selectedMulti = [];
      state.multiResults = [];
      state.sessionPlan = [];
      dom.progressFill.style.width = '0%';
      dom.progressFill.setAttribute('aria-valuenow', 0);
      renderCurrentStep();
    });
    nav.appendChild(restartBtn);

    wrap.appendChild(nav);

    return wrap;
  }

  function renderRecommendationCard(rec, rank) {
    var config = state.config;
    var t = config.treatments[rec.treatmentId];
    if (!t) { return document.createElement('div'); }

    var card = document.createElement('div');
    card.className = 'tw-rec-card';
    card.setAttribute('data-treatment-id', rec.treatmentId);

    // Rank badge
    var rankBadge = document.createElement('span');
    rankBadge.className = 'tw-rec-rank' + (rank === 1 ? ' tw-rec-rank--top' : '');
    rankBadge.setAttribute('aria-label', 'Match number ' + rank);
    rankBadge.textContent = '#' + rank;
    card.appendChild(rankBadge);

    // Name
    var name = document.createElement('p');
    name.className = 'tw-rec-name';
    name.textContent = t.name;
    card.appendChild(name);

    // Price
    var price = document.createElement('p');
    price.className = 'tw-rec-price';
    price.textContent = t.priceLabel || ('$' + t.price);
    card.appendChild(price);

    // Addresses row
    if (rec.matchingSymptoms && rec.matchingSymptoms.length) {
      var addressesRow = document.createElement('div');
      addressesRow.className = 'tw-rec-addresses';

      var addressesLabel = document.createElement('span');
      addressesLabel.className = 'tw-rec-addresses-label';
      addressesLabel.textContent = 'Addresses:';
      addressesRow.appendChild(addressesLabel);

      var tagsWrap = document.createElement('div');
      tagsWrap.className = 'tw-rec-address-tags';

      rec.matchingSymptoms.forEach(function (symptom) {
        var tag = document.createElement('span');
        tag.className = 'tw-rec-address-tag';
        tag.textContent = symptom;
        tagsWrap.appendChild(tag);
      });

      addressesRow.appendChild(tagsWrap);
      card.appendChild(addressesRow);
    }

    // Short explanation from addressedBy
    if (rec.addressedByTexts && rec.addressedByTexts.length) {
      var why = document.createElement('p');
      why.className = 'tw-rec-why';
      why.textContent = rec.addressedByTexts[0];
      card.appendChild(why);
    }

    // Actions
    var actions = document.createElement('div');
    actions.className = 'tw-rec-actions';

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'tw-btn-add-session';
    addBtn.setAttribute('data-treatment-id', rec.treatmentId);
    addBtn.setAttribute('aria-label', 'Add ' + t.name + ' to session');

    var isInSession = state.sessionPlan.indexOf(rec.treatmentId) !== -1;
    if (isInSession) {
      addBtn.classList.add('tw-btn-added');
      addBtn.textContent = 'Added';
    } else {
      addBtn.textContent = '+ Add to Session';
    }

    addBtn.addEventListener('click', function () {
      addToSession(rec.treatmentId);
    });

    actions.appendChild(addBtn);

    if (t.pageUrl) {
      var detailsBtn = document.createElement('a');
      detailsBtn.className = 'tw-btn-details';
      detailsBtn.href = t.pageUrl;
      detailsBtn.textContent = 'Details';
      detailsBtn.setAttribute('target', '_blank');
      detailsBtn.setAttribute('rel', 'noopener noreferrer');
      detailsBtn.addEventListener('click', function () {
        pushEvent({
          event: 'wizard_learn_more',
          treatment_id: rec.treatmentId,
          treatment_name: t.name
        });
      });
      actions.appendChild(detailsBtn);
    }

    card.appendChild(actions);

    return card;
  }

  // ---------------------------------------------------------------------------
  // Add-on suggestions section
  // ---------------------------------------------------------------------------
  function renderAddonSuggestions(primaryTreatmentId) {
    var config = state.config;
    var symptomsQ = config.questions && config.questions.symptoms;
    if (!symptomsQ) { return null; }

    var rules = symptomsQ.symptomRules;
    if (!rules || !rules.addonSuggestions) { return null; }

    var suggestions = rules.addonSuggestions[primaryTreatmentId];
    if (!suggestions || !suggestions.length) { return null; }

    var section = document.createElement('div');
    section.className = 'tw-addon-chips';

    var label = document.createElement('p');
    label.className = 'tw-result-section-title';
    label.textContent = 'Suggested add-ons';
    section.appendChild(label);

    // Promo notice
    var promo = document.createElement('p');
    promo.className = 'tw-promo-notice';
    promo.textContent = 'Buy 3 injections, get 4th free';
    section.appendChild(promo);

    var chipsWrap = document.createElement('div');
    chipsWrap.className = 'tw-addon-chips-list';

    suggestions.forEach(function (addonId) {
      var t = config.treatments[addonId];
      if (!t) { return; }

      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'tw-addon-chip';
      chip.setAttribute('data-treatment-id', addonId);
      chip.setAttribute('aria-label', 'Add ' + t.name + ' to session');

      var chipName = document.createElement('span');
      chipName.className = 'tw-addon-chip-name';
      chipName.textContent = t.name;
      chip.appendChild(chipName);

      var chipPrice = document.createElement('span');
      chipPrice.className = 'tw-addon-chip-price';
      chipPrice.textContent = t.priceLabel || ('$' + t.price);
      chip.appendChild(chipPrice);

      var chipAdd = document.createElement('span');
      chipAdd.className = 'tw-addon-chip-add';
      chipAdd.setAttribute('aria-hidden', 'true');
      chipAdd.textContent = '+';
      chip.appendChild(chipAdd);

      chip.addEventListener('click', function () {
        addToSession(addonId);
        // Update chip appearance
        chip.classList.add('tw-addon-chip--added');
        chipAdd.textContent = 'Added';
      });

      chipsWrap.appendChild(chip);
    });

    section.appendChild(chipsWrap);

    return section;
  }

  // ---------------------------------------------------------------------------
  // Session plan — add, remove, render, book
  // ---------------------------------------------------------------------------
  function addToSession(treatmentId) {
    var config = state.config;
    var t = config.treatments[treatmentId];
    if (!t) { return; }

    var isInjection = t.category === 'injection';

    if (!isInjection) {
      // Only 1 IV/NAD/program primary — replace existing non-injection
      var existingPrimaryIdx = -1;
      state.sessionPlan.forEach(function (id, i) {
        var existing = config.treatments[id];
        if (existing && existing.category !== 'injection') {
          existingPrimaryIdx = i;
        }
      });

      if (existingPrimaryIdx !== -1) {
        state.sessionPlan.splice(existingPrimaryIdx, 1);
      }
    } else {
      // Max 3 injections
      var injectionCount = 0;
      state.sessionPlan.forEach(function (id) {
        var existing = config.treatments[id];
        if (existing && existing.category === 'injection') {
          injectionCount++;
        }
      });
      if (injectionCount >= 3) { return; }
    }

    // Don't add duplicate
    if (state.sessionPlan.indexOf(treatmentId) === -1) {
      state.sessionPlan.push(treatmentId);
    }

    pushEvent({
      event: 'wizard_item_added',
      treatment_id: treatmentId,
      treatment_name: t.name,
      session_size: state.sessionPlan.length
    });

    // Re-render just the session plan section
    var existing = dom.contentArea.querySelector('.tw-session-plan');
    if (existing) {
      var fresh = renderSessionPlan();
      existing.parentNode.replaceChild(fresh, existing);
    }

    // Update add buttons on rec cards
    dom.contentArea.querySelectorAll('.tw-btn-add-session').forEach(function (btn) {
      var btnId = btn.getAttribute('data-treatment-id');
      var inPlan = state.sessionPlan.indexOf(btnId) !== -1;
      btn.classList.toggle('tw-btn-added', inPlan);
      btn.textContent = inPlan ? 'Added' : '+ Add to Session';
    });
  }

  function removeFromSession(treatmentId) {
    var idx = state.sessionPlan.indexOf(treatmentId);
    if (idx !== -1) {
      state.sessionPlan.splice(idx, 1);
    }

    // Re-render just the session plan section
    var existing = dom.contentArea.querySelector('.tw-session-plan');
    if (existing) {
      var fresh = renderSessionPlan();
      existing.parentNode.replaceChild(fresh, existing);
    }

    // Update add buttons on rec cards
    dom.contentArea.querySelectorAll('.tw-btn-add-session').forEach(function (btn) {
      var btnId = btn.getAttribute('data-treatment-id');
      var inPlan = state.sessionPlan.indexOf(btnId) !== -1;
      btn.classList.toggle('tw-btn-added', inPlan);
      btn.textContent = inPlan ? 'Added' : '+ Add to Session';
    });
  }

  function buildAcuityUrl() {
    var config = state.config;
    var meta = config.meta;
    var base = meta.acuityBase || '';

    // Find primary (first non-injection item)
    var primaryId = null;
    state.sessionPlan.forEach(function (id) {
      if (primaryId) { return; }
      var t = config.treatments[id];
      if (t && t.category !== 'injection') {
        primaryId = id;
      }
    });

    if (!primaryId && state.sessionPlan.length > 0) {
      primaryId = state.sessionPlan[0];
    }

    if (!primaryId) {
      return base;
    }

    var primary = config.treatments[primaryId];
    var url = base;

    if (primary && primary.acuityTypeId) {
      url += '?appointmentTypeID=' + encodeURIComponent(primary.acuityTypeId);
    }

    // Add-ons as notes param
    var addons = state.sessionPlan.filter(function (id) { return id !== primaryId; });
    if (addons.length) {
      var addonNames = addons.map(function (id) {
        var t = config.treatments[id];
        return t ? t.name : id;
      });
      var notesParam = 'Session: ' + (primary ? primary.name : '') +
        (addonNames.length ? ' + ' + addonNames.join(', ') : '');
      var sep = url.indexOf('?') === -1 ? '?' : '&';
      url += sep + 'notes=' + encodeURIComponent(notesParam);
    }

    return url;
  }

  function renderSessionPlan() {
    var config = state.config;
    var plan = state.sessionPlan;

    var section = document.createElement('div');
    section.className = 'tw-session-plan';

    if (plan.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'tw-session-empty';
      empty.textContent = 'Add treatments above to build your session';
      section.appendChild(empty);
      return section;
    }

    var itemsList = document.createElement('ul');
    itemsList.className = 'tw-session-items';

    var total = 0;

    plan.forEach(function (treatmentId) {
      var t = config.treatments[treatmentId];
      if (!t) { return; }

      var price = t.price || 0;
      total += price;

      var li = document.createElement('li');
      li.className = 'tw-session-item';

      var nameEl = document.createElement('span');
      nameEl.className = 'tw-session-item-name';
      nameEl.textContent = t.name;
      li.appendChild(nameEl);

      var priceEl = document.createElement('span');
      priceEl.className = 'tw-session-item-price';
      priceEl.textContent = t.priceLabel || ('$' + price);
      li.appendChild(priceEl);

      var removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'tw-session-item-remove';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('aria-label', 'Remove ' + t.name + ' from session');
      removeBtn.setAttribute('data-treatment-id', treatmentId);
      removeBtn.addEventListener('click', function () {
        removeFromSession(treatmentId);
      });
      li.appendChild(removeBtn);

      itemsList.appendChild(li);
    });

    section.appendChild(itemsList);

    var totalEl = document.createElement('p');
    totalEl.className = 'tw-session-total';
    totalEl.textContent = 'Total: $' + total;
    section.appendChild(totalEl);

    var bookBtn = document.createElement('a');
    bookBtn.className = 'tw-btn-primary tw-session-book';
    bookBtn.textContent = 'Book This Session';
    bookBtn.setAttribute('target', '_blank');
    bookBtn.setAttribute('rel', 'noopener noreferrer');
    bookBtn.href = buildAcuityUrl();

    bookBtn.addEventListener('click', function () {
      pushEvent({
        event: 'wizard_book_clicked',
        session_plan: state.sessionPlan.join(','),
        total: total
      });
      _doClose();
    });

    section.appendChild(bookBtn);

    return section;
  }

  // ---------------------------------------------------------------------------
  // Config loading
  // ---------------------------------------------------------------------------
  function loadConfig(configUrl) {
    return fetch(configUrl)
      .then(function (res) {
        if (!res.ok) {
          throw new Error('Failed to load wizard config: ' + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        state.config = data;
      });
  }

  function getConfigUrl() {
    // Allow override via data-config on the script tag
    var scripts = document.querySelectorAll('script[data-treatment-wizard]');
    if (scripts.length) {
      var cfg = scripts[0].getAttribute('data-config');
      if (cfg) { return cfg; }
    }

    // Default: same directory as current script
    var thisScript = document.currentScript ||
      (function () {
        var tags = document.querySelectorAll('script');
        return tags[tags.length - 1];
      }());

    if (thisScript && thisScript.src) {
      return thisScript.src.replace(/\/[^\/]+$/, '/wizard-config.json');
    }

    return '/wizard-config.json';
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  function init() {
    var configUrl = getConfigUrl();

    loadConfig(configUrl)
      .then(function () {
        buildModalScaffold();
        bindTriggers();
        checkExitIntent();
      })
      .catch(function (err) {
        // Silent fail in production — wizard simply won't open
        if (root.console && root.console.warn) {
          root.console.warn('[TreatmentWizard]', err.message);
        }
      });
  }

  function bindTriggers() {
    // All elements with data-treatment-wizard attribute
    var triggers = document.querySelectorAll('[data-treatment-wizard]');
    Array.prototype.forEach.call(triggers, function (el) {
      el.addEventListener('click', function (e) {
        e.preventDefault();
        openWizard('button');
      });
    });
  }

  function checkExitIntent() {
    // Simple exit-intent: mouse leaves viewport near top edge
    var fired = false;
    document.addEventListener('mouseleave', function (e) {
      if (fired) { return; }
      if (e.clientY <= 10 && !state.isOpen) {
        fired = true;
        openWizard('exit_intent');
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------
  root.TreatmentWizard = {
    open: function (source) {
      if (!state.config) {
        // Config not yet loaded — wait briefly and retry
        var attempts = 0;
        var interval = setInterval(function () {
          attempts++;
          if (state.config) {
            clearInterval(interval);
            openWizard(source || 'button');
          } else if (attempts > 20) {
            clearInterval(interval);
          }
        }, 100);
        return;
      }
      openWizard(source || 'button');
    },
    close: closeWizard
  };

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));
