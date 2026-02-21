import eBayApi from 'ebay-api'
import http from 'http'
import { URL } from 'url'
import fs from 'fs'
import path from 'path'

const CLIENT_ID = process.env.EBAY_CLIENT_ID || ''
const CLIENT_SECRET = process.env.EBAY_CLIENT_SECRET || ''
const DEV_ID = process.env.EBAY_DEV_ID || ''
const REDIRECT_URI = process.env.EBAY_REDIRECT_URI || ''
const PORT = parseInt(process.env.PORT || '3000', 10)
const IS_SANDBOX = process.env.EBAY_ENVIRONMENT === 'sandbox'

if (!CLIENT_ID || !CLIENT_SECRET || !DEV_ID || !REDIRECT_URI) {
  console.error('Missing required env vars: EBAY_CLIENT_ID, EBAY_CLIENT_SECRET, EBAY_DEV_ID, EBAY_REDIRECT_URI')
  console.error('Set these in your .env file first (copy from .env.example)')
  process.exit(1)
}

const ebay = new eBayApi({
  appId: CLIENT_ID,
  certId: CLIENT_SECRET,
  devId: DEV_ID,
  sandbox: IS_SANDBOX,
  ruName: REDIRECT_URI,
})

const scopes = [
  'https://api.ebay.com/oauth/api_scope',
  'https://api.ebay.com/oauth/api_scope/buy.browse',
  'https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly',
]

async function main() {
  const authUrl = ebay.OAuth2.generateAuthUrl(undefined, scopes)
  console.log('\n=== eBay OAuth Setup ===\n')
  console.log('Open this URL in your browser to authorize:\n')
  console.log(authUrl)
  console.log('\nWaiting for redirect on port', PORT, '...\n')

  // Try to open browser automatically
  const open = await import('child_process').then(cp => {
    const cmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open'
    cp.exec(`${cmd} "${authUrl}"`)
  }).catch(() => {
    // Ignore errors, user can open manually
  })

  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith('/auth/callback')) {
      res.writeHead(404)
      res.end('Not found')
      return
    }

    const url = new URL(req.url, `http://localhost:${PORT}`)
    const code = url.searchParams.get('code')

    if (!code) {
      res.writeHead(400)
      res.end('No authorization code received')
      return
    }

    try {
      const token = await ebay.OAuth2.getToken(code)
      const refreshToken = token.refresh_token

      if (!refreshToken) {
        throw new Error('No refresh token in response')
      }

      // Write to .env file
      const envPath = path.resolve(process.cwd(), '.env')
      let envContent = ''

      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8')
        // Replace existing EBAY_REFRESH_TOKEN or append
        if (envContent.includes('EBAY_REFRESH_TOKEN=')) {
          envContent = envContent.replace(/EBAY_REFRESH_TOKEN=.*/, `EBAY_REFRESH_TOKEN=${refreshToken}`)
        } else {
          envContent += `\nEBAY_REFRESH_TOKEN=${refreshToken}\n`
        }
      } else {
        envContent = `EBAY_CLIENT_ID=${CLIENT_ID}\nEBAY_CLIENT_SECRET=${CLIENT_SECRET}\nEBAY_DEV_ID=${DEV_ID}\nEBAY_REDIRECT_URI=${REDIRECT_URI}\nEBAY_REFRESH_TOKEN=${refreshToken}\nEBAY_ENVIRONMENT=${IS_SANDBOX ? 'sandbox' : 'production'}\nSYNC_INTERVAL_MINUTES=10\nPORT=3000\nDATABASE_PATH=./db/watchlist.db\n`
      }

      fs.writeFileSync(envPath, envContent)

      console.log('Refresh token obtained and saved to .env')
      console.log('Token expires in ~18 months. Rerun this script when it expires.')

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>Authorization successful!</h1><p>Refresh token saved to .env. You can close this tab.</p>')

      setTimeout(() => {
        server.close()
        process.exit(0)
      }, 1000)
    } catch (err) {
      console.error('Failed to exchange code for token:', err)
      res.writeHead(500)
      res.end('Failed to get token. Check console for details.')
    }
  })

  server.listen(PORT, () => {
    console.log(`Listening for callback on http://localhost:${PORT}/auth/callback`)
  })
}

main().catch(err => {
  console.error('Auth script failed:', err)
  process.exit(1)
})
