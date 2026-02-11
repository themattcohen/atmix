// Main JavaScript for Accounting Analyzer Web App

// Global utilities
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
};

const formatPercent = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }).format(value / 100);
};

// Show loading overlay
const showLoading = (message = 'Loading...') => {
    const loadingHtml = `
        <div class="loading-overlay">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">${message}</p>
        </div>
    `;
    $('body').append(loadingHtml);
};

// Hide loading overlay
const hideLoading = () => {
    $('.loading-overlay').remove();
};

// Show toast notification
const showToast = (message, type = 'info') => {
    const toastHtml = `
        <div class="toast align-items-center text-white bg-${type} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    const toastContainer = $('#toastContainer');
    if (!toastContainer.length) {
        $('body').append('<div id="toastContainer" class="toast-container position-fixed bottom-0 end-0 p-3"></div>');
    }
    
    const toastElement = $(toastHtml);
    $('#toastContainer').append(toastElement);
    
    const toast = new bootstrap.Toast(toastElement[0]);
    toast.show();
    
    // Remove after hidden
    toastElement.on('hidden.bs.toast', function() {
        $(this).remove();
    });
};

// Handle API errors
const handleApiError = (xhr) => {
    const error = xhr.responseJSON?.detail || 'An unexpected error occurred';
    showToast(error, 'danger');
};

// Session management
const checkSession = async (sessionId) => {
    try {
        const response = await $.get(`/api/upload/status/${sessionId}`);
        return response;
    } catch (error) {
        console.error('Session check failed:', error);
        return null;
    }
};

// File size formatter
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Debounce function
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Initialize tooltips
$(document).ready(() => {
    // Initialize Bootstrap tooltips
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
    
    // Initialize popovers
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
});

// Export functions for use in other scripts
window.accountingAnalyzer = {
    formatCurrency,
    formatPercent,
    showLoading,
    hideLoading,
    showToast,
    handleApiError,
    checkSession,
    formatFileSize,
    debounce
};
