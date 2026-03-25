# Deployment Guide

This guide covers deploying the Blue Bucket Voice Demo to production environments.

## Table of Contents
1. [Deployment Options](#1-deployment-options)
2. [Railway Deployment](#2-railway-deployment)
3. [Render Deployment](#3-render-deployment)
4. [Heroku Deployment](#4-heroku-deployment)
5. [AWS/VPS Deployment](#5-awsvps-deployment)
6. [Post-Deployment Steps](#6-post-deployment-steps)
7. [Monitoring and Scaling](#7-monitoring-and-scaling)

---

## 1. Deployment Options

| Platform | Pros | Cons | Best For |
|----------|------|------|----------|
| **Railway** | Simple, fast, generous free tier | Limited customization | Quick deployments |
| **Render** | Easy, free tier, auto-deploy | Cold starts on free tier | Small to medium scale |
| **Heroku** | Mature, lots of add-ons | Expensive for scaling | Established projects |
| **AWS/VPS** | Full control, scalable | More complex setup | Production at scale |

### Minimum Requirements
- Node.js 18+
- HTTPS support (required for webhooks)
- Persistent availability (no sleeping)
- Low latency (ideally <100ms to respond)

---

## 2. Railway Deployment

Railway offers simple deployment with a generous free tier.

### Step 1: Prepare Your Repository

Ensure your project has:
```
package.json
server.js
functions.js
public/
```

### Step 2: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up / Log in with GitHub
3. Click **New Project** → **Deploy from GitHub repo**
4. Select your repository
5. Railway auto-detects Node.js

### Step 3: Configure Environment Variables

In Railway dashboard:
1. Go to your project
2. Click **Variables**
3. Add all variables from your `.env`:
   ```
   RETELL_API_KEY=key_...
   RETELL_AGENT_ID=agent_...
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+1...
   CEO_PHONE_NUMBER=+1...
   BYPASS_CALLER_ID=+1...
   PORT=3000
   NODE_ENV=production
   ```

### Step 4: Get Your Domain

1. Go to **Settings** → **Domains**
2. Generate a Railway domain or add custom domain
3. Copy the URL (e.g., `https://bluebucket.up.railway.app`)

### Step 5: Set Webhook URL

Add to Railway variables:
```
WEBHOOK_URL=https://bluebucket.up.railway.app
```

### Step 6: Update Retell

In Retell dashboard, update webhook URL:
```
https://bluebucket.up.railway.app/webhook/retell-functions
```

---

## 3. Render Deployment

Render offers easy deployment with free tier.

### Step 1: Create render.yaml

Add to project root:
```yaml
services:
  - type: web
    name: blue-bucket-voice
    env: node
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 3000
```

### Step 2: Deploy to Render

1. Go to [render.com](https://render.com)
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Render auto-detects settings

### Step 3: Configure Environment

In Render dashboard:
1. Go to your service
2. Click **Environment**
3. Add all required variables

### Step 4: Note Your URL

Render provides URL like:
```
https://blue-bucket-voice.onrender.com
```

### Important: Disable Sleep (Paid Plan)

Free tier services sleep after inactivity. For voice calls, you need:
- Upgrade to paid plan, OR
- Use external ping service to keep alive

---

## 4. Heroku Deployment

### Step 1: Create Procfile

Add to project root:
```
web: node server.js
```

### Step 2: Deploy

```bash
# Login to Heroku
heroku login

# Create app
heroku create blue-bucket-voice

# Set environment variables
heroku config:set RETELL_API_KEY=key_...
heroku config:set RETELL_AGENT_ID=agent_...
heroku config:set TWILIO_ACCOUNT_SID=AC...
# ... set all other variables

# Deploy
git push heroku main
```

### Step 3: Get URL

```bash
heroku info
# Shows your app URL
```

---

## 5. AWS/VPS Deployment

For production at scale, use AWS EC2, DigitalOcean, or similar.

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 2: Deploy Code

```bash
# Clone repository
git clone https://github.com/yourusername/bluebucket.git
cd bluebucket

# Install dependencies
npm install

# Create .env file
nano .env
# Paste your environment variables
```

### Step 3: Start with PM2

```bash
# Start server
pm2 start server.js --name blue-bucket

# Save PM2 config
pm2 save

# Setup startup script
pm2 startup
```

### Step 4: Setup Nginx (Reverse Proxy)

```nginx
# /etc/nginx/sites-available/bluebucket
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Step 5: SSL with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

---

## 6. Post-Deployment Steps

### Update Webhook URLs

After deployment, update ALL webhook URLs:

1. **Environment Variable**:
   ```
   WEBHOOK_URL=https://your-production-url.com
   ```

2. **Retell Dashboard**:
   - Agent → Settings → Webhook URL
   ```
   https://your-production-url.com/webhook/retell-functions
   ```

3. **Twilio Console** (if using):
   - Phone Numbers → Your number → Voice webhook
   ```
   https://your-production-url.com/webhook/twilio-connect-retell
   ```

### Verify Deployment

1. **Health Check**:
   ```bash
   curl https://your-production-url.com/health
   ```
   Expected:
   ```json
   {"status":"healthy","timestamp":"...","retell":true,"twilio":true}
   ```

2. **Test Call**:
   ```bash
   curl -X POST https://your-production-url.com/trigger-call-direct \
     -H "Content-Type: application/json" \
     -d '{"phoneNumber": "YOUR_TEST_NUMBER", "context": "Production test"}'
   ```

### DNS Configuration (Custom Domain)

If using custom domain:
1. Add A record pointing to your server IP
2. Or add CNAME pointing to your platform's domain
3. Wait for DNS propagation (up to 48 hours)
4. Update SSL certificate if needed

---

## 7. Monitoring and Scaling

### Basic Monitoring

**Add logging service:**
- Logtail
- Papertrail
- AWS CloudWatch

**Add uptime monitoring:**
- UptimeRobot (free)
- Pingdom
- Better Uptime

### Health Check Endpoint

The `/health` endpoint can be used for monitoring:
```bash
# Add to monitoring service
https://your-url.com/health
# Alert if not returning 200
```

### Scaling Considerations

**Horizontal Scaling:**
- Add load balancer
- Multiple server instances
- Session-less design (already implemented)

**Vertical Scaling:**
- Increase server resources
- Upgrade hosting plan

### Performance Optimization

1. **Response Time**: Keep function responses fast
   - Webhook should respond in <1 second
   - Use caching for repeated data

2. **Error Handling**: Graceful degradation
   - Return friendly error messages
   - Don't crash on bad input

3. **Rate Limiting**: Protect against abuse
   ```javascript
   const rateLimit = require('express-rate-limit');

   const limiter = rateLimit({
     windowMs: 15 * 60 * 1000, // 15 minutes
     max: 100 // limit each IP to 100 requests per window
   });

   app.use('/trigger-call', limiter);
   ```

---

## Deployment Checklist

### Pre-Deployment
- [ ] All environment variables documented
- [ ] .env.example updated with all variables
- [ ] package.json has correct start script
- [ ] Code tested locally

### Deployment
- [ ] Platform account created
- [ ] Repository connected
- [ ] Environment variables set
- [ ] Deployed successfully
- [ ] HTTPS working

### Post-Deployment
- [ ] WEBHOOK_URL updated in environment
- [ ] Retell webhook URL updated
- [ ] Health check returning healthy
- [ ] Test call successful
- [ ] Monitoring set up

### Trust Hub (CRITICAL)
- [ ] Business Profile approved
- [ ] SHAKEN/STIR Trust Product approved
- [ ] Phone numbers assigned to both
- [ ] A-attestation verified in Twilio logs

---

## Rollback Plan

If deployment fails:

1. **Railway/Render/Heroku**: Use platform's rollback feature
2. **VPS**: Keep previous version available
   ```bash
   # Using PM2
   pm2 reload blue-bucket --update-env

   # Or restart previous version
   cd bluebucket-backup
   pm2 restart blue-bucket
   ```

---

## Security Hardening

For production:

1. **Enable CORS restrictions**:
   ```javascript
   const cors = require('cors');
   app.use(cors({
     origin: ['https://yourdomain.com'],
     methods: ['GET', 'POST']
   }));
   ```

2. **Add Helmet for security headers**:
   ```javascript
   const helmet = require('helmet');
   app.use(helmet());
   ```

3. **Validate webhook signatures** (Retell provides this)

4. **Use secrets manager** for sensitive credentials

5. **Regular security updates**:
   ```bash
   npm audit
   npm audit fix
   ```
