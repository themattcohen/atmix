/**
 * Sara Sharp Knowledge Base - Frontend Application
 *
 * A clean, accessible search interface for the RAG knowledge base.
 * Features:
 * - Debounced search
 * - Source filtering
 * - Dark/light mode
 * - Keyboard navigation
 * - Accessible UI
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    API_BASE_URL: 'http://localhost:8000',
    DEBOUNCE_DELAY: 300,
    DEFAULT_TOP_K: 10,
    CACHE_DURATION_MS: 5 * 60 * 1000, // 5 minutes
};

// =============================================================================
// STATE
// =============================================================================

const state = {
    query: '',
    source: 'all',
    results: [],
    isLoading: false,
    error: null,
    stats: null,
    lastQuery: '',
};

// =============================================================================
// DOM ELEMENTS
// =============================================================================

const elements = {
    // Search
    searchInput: document.getElementById('search-input'),
    searchLoading: document.getElementById('search-loading'),
    searchClear: document.getElementById('search-clear'),

    // Filters
    filterTabs: document.querySelectorAll('.filter-tab'),

    // Results
    resultsHeader: document.getElementById('results-header'),
    resultsCount: document.getElementById('results-count'),
    resultsTime: document.getElementById('results-time'),
    resultsList: document.getElementById('results-list'),

    // States
    emptyState: document.getElementById('empty-state'),
    loadingState: document.getElementById('loading-state'),
    errorState: document.getElementById('error-state'),
    errorMessage: document.getElementById('error-message'),
    noResultsState: document.getElementById('no-results-state'),
    noResultsMessage: document.getElementById('no-results-message'),

    // Actions
    retryButton: document.getElementById('retry-button'),
    exampleQueries: document.querySelectorAll('.example-query'),

    // Theme
    themeToggle: document.getElementById('theme-toggle'),

    // Footer
    statsInfo: document.getElementById('stats-info'),
};

// =============================================================================
// API CLIENT
// =============================================================================

const api = {
    /**
     * Execute a search query
     */
    async search(query, options = {}) {
        const { topK = CONFIG.DEFAULT_TOP_K, source = 'all' } = options;

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                query,
                top_k: topK,
                source,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.detail || `Search failed: ${response.status}`);
        }

        return response.json();
    },

    /**
     * Check API health
     */
    async health() {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/health`);

        if (!response.ok) {
            throw new Error(`Health check failed: ${response.status}`);
        }

        return response.json();
    },

    /**
     * Get knowledge base statistics
     */
    async stats() {
        const response = await fetch(`${CONFIG.API_BASE_URL}/api/stats`);

        if (!response.ok) {
            throw new Error(`Stats fetch failed: ${response.status}`);
        }

        return response.json();
    },
};

// =============================================================================
// UI RENDERING
// =============================================================================

const ui = {
    /**
     * Show a specific state, hiding all others
     */
    showState(stateName) {
        // Hide all states
        elements.emptyState.hidden = true;
        elements.loadingState.hidden = true;
        elements.errorState.hidden = true;
        elements.noResultsState.hidden = true;
        elements.resultsHeader.hidden = true;
        elements.resultsList.innerHTML = '';

        // Show requested state
        switch (stateName) {
            case 'empty':
                elements.emptyState.hidden = false;
                break;
            case 'loading':
                elements.loadingState.hidden = false;
                break;
            case 'error':
                elements.errorState.hidden = false;
                break;
            case 'no-results':
                elements.noResultsState.hidden = false;
                break;
            case 'results':
                elements.resultsHeader.hidden = false;
                break;
        }
    },

    /**
     * Update search loading indicator
     */
    setSearchLoading(isLoading) {
        if (isLoading) {
            elements.searchLoading.classList.add('visible');
            elements.searchClear.hidden = true;
        } else {
            elements.searchLoading.classList.remove('visible');
            elements.searchClear.hidden = !elements.searchInput.value;
        }
    },

    /**
     * Update clear button visibility
     */
    updateClearButton() {
        elements.searchClear.hidden = !elements.searchInput.value || state.isLoading;
    },

    /**
     * Render search results
     */
    renderResults(results, queryTimeMs) {
        // Update header
        elements.resultsCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
        elements.resultsTime.textContent = `${queryTimeMs.toFixed(0)}ms`;

        // Render result cards
        elements.resultsList.innerHTML = results.map((result, index) => {
            const scoreClass = result.score > 0.8 ? 'high' : result.score > 0.5 ? 'medium' : '';
            const sourceClass = result.source_type.toLowerCase();
            const sourceLabel = result.source_type === 'youtube' ? 'YouTube' : 'Blog';

            return `
                <article class="result-card" aria-labelledby="result-title-${index}">
                    <div class="result-header">
                        <div class="result-badges">
                            <span class="source-badge ${sourceClass}">${sourceLabel}</span>
                        </div>
                        <span class="score-badge ${scoreClass}">Score: ${result.score.toFixed(3)}</span>
                    </div>
                    <h3 class="result-title" id="result-title-${index}">
                        ${escapeHtml(result.title || 'Untitled')}
                    </h3>
                    <p class="result-content">
                        ${escapeHtml(truncateText(result.content, 300))}
                    </p>
                    ${result.url ? `
                        <a href="${escapeHtml(result.url)}" class="result-link" target="_blank" rel="noopener noreferrer">
                            View Original
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                <polyline points="15 3 21 3 21 9"></polyline>
                                <line x1="10" y1="14" x2="21" y2="3"></line>
                            </svg>
                        </a>
                    ` : ''}
                </article>
            `;
        }).join('');

        this.showState('results');
    },

    /**
     * Show error message
     */
    showError(message) {
        elements.errorMessage.textContent = message;
        this.showState('error');
    },

    /**
     * Show no results message
     */
    showNoResults(query) {
        elements.noResultsMessage.textContent = `No results found for "${query}". Try a different search or remove filters.`;
        this.showState('no-results');
    },

    /**
     * Update active filter tab
     */
    setActiveFilter(source) {
        elements.filterTabs.forEach(tab => {
            const isActive = tab.dataset.source === source;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive);
        });
    },

    /**
     * Update footer stats
     */
    updateStats(stats) {
        if (stats) {
            const sources = Object.entries(stats.sources || {})
                .map(([key, value]) => `${value} ${key}`)
                .join(', ');
            elements.statsInfo.textContent = `${stats.total_chunks} chunks | ${sources}`;
        } else {
            elements.statsInfo.textContent = 'Knowledge base unavailable';
        }
    },
};

// =============================================================================
// SEARCH LOGIC
// =============================================================================

/**
 * Debounce function to limit API calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Execute search with current state
 */
async function executeSearch() {
    const query = state.query.trim();
    console.log('executeSearch called with query:', query);

    // Don't search empty queries
    if (!query) {
        console.log('Empty query, showing empty state');
        ui.showState('empty');
        state.lastQuery = '';
        return;
    }

    // Don't repeat the same search
    if (query === state.lastQuery && state.results.length > 0) {
        return;
    }

    state.isLoading = true;
    state.error = null;
    ui.setSearchLoading(true);
    ui.showState('loading');

    try {
        console.log('Calling API with:', { query, topK: CONFIG.DEFAULT_TOP_K, source: state.source });
        const response = await api.search(query, {
            topK: CONFIG.DEFAULT_TOP_K,
            source: state.source,
        });
        console.log('API response:', response);

        state.results = response.results;
        state.lastQuery = query;

        if (response.results.length === 0) {
            console.log('No results, showing no-results state');
            ui.showNoResults(query);
        } else {
            console.log('Rendering', response.results.length, 'results');
            ui.renderResults(response.results, response.query_time_ms);
        }
    } catch (error) {
        console.error('Search error:', error);
        state.error = error.message;
        ui.showError(error.message || 'Failed to search. Please try again.');
    } finally {
        state.isLoading = false;
        ui.setSearchLoading(false);
    }
}

// Debounced search
const debouncedSearch = debounce(executeSearch, CONFIG.DEBOUNCE_DELAY);

/**
 * Handle search input changes
 */
function handleSearchInput(event) {
    state.query = event.target.value;
    ui.updateClearButton();

    if (state.query.trim()) {
        debouncedSearch();
    } else {
        state.lastQuery = '';
        ui.showState('empty');
    }
}

/**
 * Handle filter changes
 */
function handleFilterChange(source) {
    if (state.source === source) return;

    state.source = source;
    state.lastQuery = ''; // Force re-search
    ui.setActiveFilter(source);

    if (state.query.trim()) {
        executeSearch();
    }
}

/**
 * Clear search
 */
function clearSearch() {
    state.query = '';
    state.results = [];
    state.lastQuery = '';
    elements.searchInput.value = '';
    elements.searchInput.focus();
    ui.updateClearButton();
    ui.showState('empty');
}

/**
 * Use example query
 */
function useExampleQuery(query) {
    state.query = query;
    elements.searchInput.value = query;
    elements.searchInput.focus();
    executeSearch();
}

// =============================================================================
// THEME MANAGEMENT
// =============================================================================

/**
 * Get current theme preference
 */
function getThemePreference() {
    const stored = localStorage.getItem('theme');
    if (stored) return stored;

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    const current = document.documentElement.dataset.theme;
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
}

// =============================================================================
// KEYBOARD NAVIGATION
// =============================================================================

/**
 * Handle global keyboard shortcuts
 */
function handleKeyboard(event) {
    // Focus search on "/"
    if (event.key === '/' && document.activeElement !== elements.searchInput) {
        event.preventDefault();
        elements.searchInput.focus();
    }

    // Clear search on Escape
    if (event.key === 'Escape' && document.activeElement === elements.searchInput) {
        if (state.query) {
            clearSearch();
        } else {
            elements.searchInput.blur();
        }
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing app...');
    console.log('Elements found:', {
        searchInput: !!elements.searchInput,
        resultsList: !!elements.resultsList,
        emptyState: !!elements.emptyState,
    });

    // Apply saved theme
    applyTheme(getThemePreference());

    // Set up event listeners
    elements.searchInput.addEventListener('input', handleSearchInput);
    console.log('Event listeners attached');
    elements.searchClear.addEventListener('click', clearSearch);
    elements.retryButton.addEventListener('click', executeSearch);
    elements.themeToggle.addEventListener('click', toggleTheme);

    elements.filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            handleFilterChange(tab.dataset.source);
        });
    });

    elements.exampleQueries.forEach(button => {
        button.addEventListener('click', () => {
            useExampleQuery(button.dataset.query);
        });
    });

    document.addEventListener('keydown', handleKeyboard);

    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light');
        }
    });

    // Load stats
    try {
        state.stats = await api.stats();
        ui.updateStats(state.stats);
    } catch (error) {
        console.warn('Failed to load stats:', error);
        ui.updateStats(null);
    }

    // Show initial state
    ui.showState('empty');

    // Focus search input
    elements.searchInput.focus();
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Truncate text to a maximum length
 */
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
}

// =============================================================================
// START APPLICATION
// =============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
