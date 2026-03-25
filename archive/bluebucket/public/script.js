/**
 * Blue Bucket Cleaning - Lead Form Handler
 * Supports both phone calls (requires Retell phone number) and web calls (browser-based)
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('lead-form');
  const phoneCallBtn = document.getElementById('phone-call-btn');
  const webCallBtn = document.getElementById('web-call-btn');
  const loadingSpinner = document.getElementById('loading-spinner');
  const successMessage = document.getElementById('success-message');
  const errorMessage = document.getElementById('error-message');

  let retellClient = null;
  let currentCallId = null;

  /**
   * Format phone number for display
   */
  function formatPhoneForDisplay(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  }

  /**
   * Gather form data
   */
  function getFormData() {
    return {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
      serviceType: document.getElementById('serviceType').value,
      additionalInfo: document.getElementById('additionalInfo').value.trim()
    };
  }

  /**
   * Format phone for API
   */
  function formatPhoneForApi(phone) {
    let formatted = phone.replace(/\D/g, '');
    if (formatted.length === 10) {
      return '+1' + formatted;
    } else if (formatted.length === 11 && formatted.startsWith('1')) {
      return '+' + formatted;
    }
    return phone.startsWith('+') ? phone : '+1' + formatted;
  }

  /**
   * Show error
   */
  function showError(message) {
    loadingSpinner.style.display = 'none';
    errorMessage.style.display = 'block';
    errorMessage.innerHTML = `
      <strong>⚠️ Error</strong><br>
      ${message}<br>
      <span style="font-size: 12px; margin-top: 8px; display: block;">Please try again or use the browser call option.</span>
    `;
    phoneCallBtn.disabled = false;
    webCallBtn.disabled = false;
  }

  /**
   * Handle PHONE call (form submit)
   */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = getFormData();

    // Validate
    if (!formData.firstName || !formData.phone) {
      showError('First name and phone number are required for phone calls.');
      return;
    }

    // Disable buttons
    errorMessage.style.display = 'none';
    phoneCallBtn.disabled = true;
    webCallBtn.disabled = true;
    loadingSpinner.style.display = 'block';

    formData.phone = formatPhoneForApi(formData.phone);

    try {
      const response = await fetch('/trigger-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        form.style.display = 'none';
        loadingSpinner.style.display = 'none';
        successMessage.style.display = 'block';
        successMessage.innerHTML = `
          <h2>📞 Calling You Now!</h2>
          <p>Please answer your phone. Alex from Blue Bucket Cleaning will be calling you at:</p>
          <p class="phone-display phone-ringing">${formatPhoneForDisplay(formData.phone)}</p>
          <p>Alex is our AI assistant who can answer your questions, provide a quote, and book your appointment.</p>
          <div style="margin-top: 24px; padding: 16px; background: #F0FFF4; border-radius: 10px;">
            <p style="color: #276749; font-weight: 600; margin-bottom: 8px;">💡 Tips for your call:</p>
            <ul style="text-align: left; color: #2D3748; font-size: 14px; margin-left: 20px;">
              <li>Confirm your property details (bedrooms, bathrooms, sqft)</li>
              <li>Ask about our bi-weekly discount</li>
              <li>Book an appointment right on the call</li>
            </ul>
          </div>
          <p class="call-id">Call ID: ${result.callId}</p>
        `;
      } else if (result.useWebCall) {
        // Phone calls not available, suggest web call
        loadingSpinner.style.display = 'none';
        showError('Phone calls are not available. Please use "Talk in Browser" instead.');
      } else {
        throw new Error(result.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Phone call error:', error);
      showError(error.message);
    }
  });

  /**
   * Handle WEB call (browser-based)
   */
  webCallBtn.addEventListener('click', async () => {
    const formData = getFormData();

    // Validate
    if (!formData.firstName) {
      showError('First name is required.');
      return;
    }

    // Disable buttons
    errorMessage.style.display = 'none';
    phoneCallBtn.disabled = true;
    webCallBtn.disabled = true;
    loadingSpinner.style.display = 'block';
    loadingSpinner.querySelector('p').textContent = 'Connecting to Alex...';
    loadingSpinner.querySelector('.loading-subtext').textContent = 'Please allow microphone access when prompted';

    try {
      const response = await fetch('/trigger-web-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        currentCallId = result.callId;

        // Initialize Retell Web SDK (UMD bundle exports to retellClientJsSdk)
        const RetellWebClient = window.retellClientJsSdk?.RetellWebClient;
        if (RetellWebClient) {
          retellClient = new RetellWebClient();

          // Set up event handlers
          retellClient.on('call_started', () => {
            console.log('Call started');
            showActiveCall(formData.firstName);
          });

          retellClient.on('call_ended', () => {
            console.log('Call ended');
            showCallEnded();
          });

          retellClient.on('agent_start_talking', () => {
            console.log('Agent speaking');
            updateCallStatus('Alex is speaking...');
          });

          retellClient.on('agent_stop_talking', () => {
            console.log('Agent stopped');
            updateCallStatus('Listening...');
          });

          retellClient.on('error', (error) => {
            console.error('Retell error:', error);
            showError('Connection error: ' + error.message);
          });

          // Start the call
          await retellClient.startCall({
            accessToken: result.accessToken,
            sampleRate: 24000,
            captureDeviceId: 'default'
          });

        } else {
          throw new Error('Voice SDK not loaded. Please refresh the page.');
        }
      } else {
        throw new Error(result.error || 'Failed to start web call');
      }
    } catch (error) {
      console.error('Web call error:', error);
      showError(error.message);
    }
  });

  /**
   * Show active web call UI
   */
  function showActiveCall(customerName) {
    form.style.display = 'none';
    loadingSpinner.style.display = 'none';
    successMessage.style.display = 'block';
    successMessage.innerHTML = `
      <div class="web-call-active">
        <h2>🎙️ Connected with Alex</h2>
        <p class="call-status" id="call-status">Listening...</p>
        <div class="audio-indicator">
          <div class="audio-bar"></div>
          <div class="audio-bar"></div>
          <div class="audio-bar"></div>
          <div class="audio-bar"></div>
          <div class="audio-bar"></div>
        </div>
        <p style="margin-bottom: 20px; color: #4A5568;">Hi ${customerName}! Alex from Blue Bucket Cleaning is ready to help you.</p>
        <button class="end-call-btn" onclick="endWebCall()">End Call</button>
        <p class="call-id" style="margin-top: 16px;">Call ID: ${currentCallId}</p>
      </div>
    `;
  }

  /**
   * Update call status
   */
  function updateCallStatus(status) {
    const statusEl = document.getElementById('call-status');
    if (statusEl) {
      statusEl.textContent = status;
    }
  }

  /**
   * Show call ended UI
   */
  function showCallEnded() {
    successMessage.innerHTML = `
      <h2>✅ Call Complete</h2>
      <p>Thank you for speaking with Alex!</p>
      <p style="margin-top: 16px; color: #4A5568;">If you booked an appointment, you'll receive a confirmation email shortly.</p>
      <div style="margin-top: 24px;">
        <button class="submit-button" onclick="location.reload()">Start New Inquiry</button>
      </div>
      <p class="call-id">Call ID: ${currentCallId}</p>
    `;
  }

  /**
   * End web call (global function for button)
   */
  window.endWebCall = function() {
    if (retellClient) {
      retellClient.stopCall();
    }
    showCallEnded();
  };

  /**
   * Phone number formatting as user types
   */
  const phoneInput = document.getElementById('phone');
  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.startsWith('1') && value.length > 10) {
      value = value.slice(1);
    }
    if (value.length > 0) {
      if (value.length <= 3) {
        value = `(${value}`;
      } else if (value.length <= 6) {
        value = `(${value.slice(0, 3)}) ${value.slice(3)}`;
      } else {
        value = `(${value.slice(0, 3)}) ${value.slice(3, 6)}-${value.slice(6, 10)}`;
      }
    }
    e.target.value = value;
  });

  /**
   * Form validation - visual feedback
   */
  const requiredInputs = form.querySelectorAll('input[required], select[required]');
  requiredInputs.forEach(input => {
    input.addEventListener('blur', () => {
      if (input.value.trim() === '') {
        input.style.borderColor = '#E53E3E';
      } else {
        input.style.borderColor = '#48BB78';
      }
    });
    input.addEventListener('focus', () => {
      input.style.borderColor = '#4169E1';
    });
  });

  /**
   * Demo mode
   */
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('demo') === 'true') {
    document.getElementById('firstName').value = 'John';
    document.getElementById('lastName').value = 'Doe';
    document.getElementById('phone').value = '(303) 555-1234';
    document.getElementById('address').value = '1234 Cherry Creek Dr, Denver, CO 80206';
    document.getElementById('serviceType').value = 'House Cleaning';
    document.getElementById('additionalInfo').value = '3 bed, 2 bath, about 1800 sqft. Interested in bi-weekly cleaning.';
  }
});
