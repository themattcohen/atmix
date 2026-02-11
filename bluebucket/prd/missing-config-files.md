# Missing Configuration Files for Blue Bucket Demo

These files should be created by Claude Code in addition to the code in the PRD.

---

## package.json

```json
{
  "name": "blue-bucket-voice-demo",
  "version": "1.0.0",
  "description": "AI voice agent demo for Blue Bucket Cleaning lead conversion",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["voice-ai", "retell", "cleaning", "lead-conversion"],
  "author": "Blue Bucket Cleaning",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "@retellai/retell-sdk": "^3.0.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

**Note for Claude Code**: After creating this file, run:
```bash
npm install
```

---

## .env.example

```env
# Retell AI Configuration
RETELL_API_KEY=your_retell_api_key_here
RETELL_AGENT_ID=agent_abc123xyz
RETELL_PHONE_NUMBER=+13035551234

# CEO Transfer (Optional - only if implementing transfer)
CEO_PHONE_NUMBER=+13035555678

# LLM Configuration (Optional - Retell provides hosted LLM)
# Only needed if using custom LLM setup
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# Server Configuration
PORT=3000
NODE_ENV=development
```

**Instructions**: Copy this to `.env` and fill in real values from Retell dashboard.

---

## .gitignore

```
# Dependencies
node_modules/

# Environment variables
.env

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/

# ngrok
ngrok
```

---

## README.md

```markdown
# Blue Bucket AI Voice Demo

AI-powered voice agent that calls cleaning service leads and converts them into booked appointments.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

3. Start the server:
   ```bash
   npm run dev
   ```

4. In another terminal, expose to internet:
   ```bash
   ngrok http 3000
   ```

5. Update Retell agent webhook URL with ngrok URL

6. Open http://localhost:3000 in browser

7. Submit the form with your phone number to test!

## Project Structure

```
blue-bucket-demo/
├── server.js           # Express server + webhooks
├── functions.js        # Mock business logic
├── public/
│   ├── index.html     # Lead capture form
│   ├── styles.css     # Styling
│   └── script.js      # Form handling
├── .env               # API keys (not in git)
├── package.json       # Dependencies
└── README.md          # This file
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `RETELL_API_KEY` | Yes | From Retell dashboard |
| `RETELL_AGENT_ID` | Yes | Agent ID from Retell |
| `RETELL_PHONE_NUMBER` | No | Optional custom number |
| `CEO_PHONE_NUMBER` | No | For transfer feature |
| `PORT` | No | Defaults to 3000 |

## Testing

1. Fill out form at http://localhost:3000
2. Use your real phone number
3. Answer the call within 10 seconds
4. Walk through conversation with AI agent
5. Try different scenarios:
   - Request a quote
   - Say "that's too expensive"
   - Ask "can I talk to the owner"
   - Book an appointment

## Troubleshooting

**Call doesn't trigger:**
- Check Retell API key is correct
- Verify phone number has country code (+1)
- Check Retell dashboard for errors

**Functions not working:**
- Verify ngrok is running
- Check webhook URL in Retell dashboard
- Look at server console logs

**Agent sounds bad:**
- Try different voice in Retell dashboard
- Adjust speaking rate
- Refine system prompt

## Production Deployment

For production, deploy to:
- Railway.app (recommended, free tier)
- Heroku
- DigitalOcean App Platform
- Your own server

## License

Proprietary - Blue Bucket Cleaning
```

---

## public/script.js (Complete Implementation)

```javascript
// Form handling for Blue Bucket lead capture

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('lead-form');
  const submitButton = form.querySelector('button[type="submit"]');
  const loadingSpinner = document.getElementById('loading-spinner');
  const successMessage = document.getElementById('success-message');
  const errorMessage = document.getElementById('error-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Disable form during submission
    submitButton.disabled = true;
    submitButton.textContent = 'Calling...';
    loadingSpinner.style.display = 'block';
    errorMessage.style.display = 'none';

    // Gather form data
    const formData = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      address: document.getElementById('address').value.trim(),
      serviceType: document.getElementById('serviceType').value,
      additionalInfo: document.getElementById('additionalInfo').value.trim()
    };

    // Format phone number to E.164 if needed
    if (!formData.phone.startsWith('+')) {
      // Assume US number
      formData.phone = '+1' + formData.phone.replace(/\D/g, '');
    }

    try {
      const response = await fetch('/trigger-call', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        // Show success message
        form.style.display = 'none';
        loadingSpinner.style.display = 'none';
        successMessage.style.display = 'block';
        successMessage.innerHTML = `
          <h2>📞 Calling You Now!</h2>
          <p>Please answer your phone. Alex from Blue Bucket Cleaning will be calling you at:</p>
          <p style="font-size: 1.5em; font-weight: bold;">${formData.phone}</p>
          <p style="margin-top: 20px; font-size: 0.9em; color: #666;">
            Call ID: ${result.callId}
          </p>
        `;
      } else {
        throw new Error(result.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error:', error);
      
      // Show error message
      loadingSpinner.style.display = 'none';
      errorMessage.style.display = 'block';
      errorMessage.textContent = `Error: ${error.message}. Please try again or call us directly.`;
      
      // Re-enable form
      submitButton.disabled = false;
      submitButton.textContent = 'Get a Call from Blue Bucket';
    }
  });

  // Phone number formatting
  const phoneInput = document.getElementById('phone');
  phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
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
});
```

---

## public/styles.css (Complete Implementation)

```css
/* Blue Bucket Cleaning - Lead Form Styles */

:root {
  --blue-primary: #4169E1;
  --blue-dark: #2C4BA0;
  --yellow-accent: #FFD700;
  --gray-light: #F5F5F5;
  --gray-medium: #999;
  --text-dark: #333;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  background: linear-gradient(135deg, var(--blue-primary) 0%, var(--blue-dark) 100%);
  min-height: 100vh;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.container {
  background: white;
  border-radius: 20px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  max-width: 600px;
  width: 100%;
  padding: 40px;
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  width: 80px;
  height: 80px;
  margin: 0 auto 20px;
  background: var(--blue-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
}

h1 {
  color: var(--text-dark);
  font-size: 28px;
  margin-bottom: 10px;
}

.subtitle {
  color: var(--gray-medium);
  font-size: 16px;
}

.form-group {
  margin-bottom: 20px;
}

label {
  display: block;
  color: var(--text-dark);
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 14px;
}

input,
select,
textarea {
  width: 100%;
  padding: 12px 15px;
  border: 2px solid #E0E0E0;
  border-radius: 8px;
  font-size: 16px;
  transition: all 0.3s ease;
  font-family: inherit;
}

input:focus,
select:focus,
textarea:focus {
  outline: none;
  border-color: var(--blue-primary);
  box-shadow: 0 0 0 3px rgba(65, 105, 225, 0.1);
}

textarea {
  resize: vertical;
  min-height: 100px;
}

.submit-button {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, var(--blue-primary), var(--blue-dark));
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.submit-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px rgba(65, 105, 225, 0.3);
}

.submit-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading-spinner {
  display: none;
  text-align: center;
  padding: 30px;
}

.spinner {
  border: 4px solid var(--gray-light);
  border-top: 4px solid var(--blue-primary);
  border-radius: 50%;
  width: 50px;
  height: 50px;
  animation: spin 1s linear infinite;
  margin: 0 auto;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.success-message {
  display: none;
  text-align: center;
  animation: fadeIn 0.5s ease-in;
}

.success-message h2 {
  color: var(--blue-primary);
  margin-bottom: 20px;
  font-size: 32px;
}

.success-message p {
  color: var(--text-dark);
  line-height: 1.6;
  margin-bottom: 10px;
}

.error-message {
  display: none;
  background: #FEE;
  border: 2px solid #F88;
  border-radius: 8px;
  padding: 15px;
  color: #C33;
  margin-top: 15px;
  text-align: center;
}

.services-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid var(--gray-light);
}

.service-item {
  background: var(--gray-light);
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  font-size: 14px;
  color: var(--text-dark);
}

.footer {
  text-align: center;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 2px solid var(--gray-light);
  color: var(--gray-medium);
  font-size: 14px;
}

/* Mobile responsive */
@media (max-width: 600px) {
  .container {
    padding: 30px 20px;
  }

  h1 {
    font-size: 24px;
  }

  .services-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## public/index.html (Complete Implementation)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Get a Quote - The Blue Bucket Cleaning</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🪣</div>
      <h1>Get Your Free Quote</h1>
      <p class="subtitle">We'll call you in seconds to discuss your cleaning needs</p>
    </div>

    <form id="lead-form">
      <div class="form-group">
        <label for="firstName">First Name *</label>
        <input type="text" id="firstName" name="firstName" required placeholder="John">
      </div>

      <div class="form-group">
        <label for="lastName">Last Name *</label>
        <input type="text" id="lastName" name="lastName" required placeholder="Doe">
      </div>

      <div class="form-group">
        <label for="phone">Phone Number *</label>
        <input type="tel" id="phone" name="phone" required placeholder="(303) 555-1234">
      </div>

      <div class="form-group">
        <label for="address">Service Address *</label>
        <input type="text" id="address" name="address" required 
               placeholder="1234 Cherry Creek Dr, Denver, CO 80206">
      </div>

      <div class="form-group">
        <label for="serviceType">Service Type *</label>
        <select id="serviceType" name="serviceType" required>
          <option value="">-- Select a Service --</option>
          <option value="House Cleaning" selected>House Cleaning</option>
          <option value="Commercial Cleaning">Commercial Cleaning</option>
          <option value="Blind Cleaning">Blind Cleaning</option>
          <option value="Window Cleaning">Window Cleaning</option>
          <option value="Floor Cleaning and Waxing">Floor Cleaning and Waxing</option>
          <option value="Carpet Cleaning">Carpet Cleaning</option>
        </select>
      </div>

      <div class="form-group">
        <label for="additionalInfo">Property Details (Optional)</label>
        <textarea id="additionalInfo" name="additionalInfo" 
                  placeholder="E.g., 3 bed, 2 bath, 1800 sqft. Interested in bi-weekly cleaning."></textarea>
      </div>

      <button type="submit" class="submit-button">
        Get a Call from Blue Bucket
      </button>
    </form>

    <div id="loading-spinner" class="loading-spinner">
      <div class="spinner"></div>
      <p>Initiating call...</p>
    </div>

    <div id="success-message" class="success-message">
      <!-- Populated by JavaScript -->
    </div>

    <div id="error-message" class="error-message">
      <!-- Populated by JavaScript -->
    </div>

    <div class="footer">
      <p>🤖 Powered by AI • 📞 Instant Response • ✨ Professional Service</p>
      <p style="margin-top: 10px;">thebluebucketcleaning.com</p>
    </div>
  </div>

  <script src="script.js"></script>
</body>
</html>
```

---

## Notes for Claude Code

When implementing, make sure to:

1. ✅ Create all files in the correct directory structure
2. ✅ Run `npm install` after creating package.json
3. ✅ Copy `.env.example` to `.env` and fill in API keys
4. ✅ Test the form loads at http://localhost:3000
5. ✅ Start ngrok and update Retell webhook URL
6. ✅ Test end-to-end with a real phone call

All the business logic code is in the main PRD. These files are just the configuration/frontend that were missing!
