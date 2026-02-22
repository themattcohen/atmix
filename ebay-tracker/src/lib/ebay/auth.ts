import eBayApi from 'ebay-api'

let ebayClient: eBayApi | null = null

export function getEbayClient(): eBayApi {
  if (ebayClient) return ebayClient

  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  const devId = process.env.EBAY_DEV_ID
  const redirectUri = process.env.EBAY_REDIRECT_URI
  const refreshToken = process.env.EBAY_REFRESH_TOKEN
  const environment = process.env.EBAY_ENVIRONMENT || 'production'

  if (!clientId || !clientSecret || !devId || !redirectUri || !refreshToken) {
    throw new Error('Missing eBay API credentials. Check your .env file.')
  }

  const sandbox = environment === 'sandbox'

  ebayClient = new eBayApi({
    appId: clientId,
    certId: clientSecret,
    devId: devId,
    sandbox,
    siteId: eBayApi.SiteId.EBAY_US,
    ruName: redirectUri,
    // No authToken — that field is for legacy Auth'n'Auth tokens only.
    // OAuth tokens go through OAuth2.setCredentials below.
  })

  // Set OAuth2 credentials — the SDK auto-refreshes access tokens using the refresh token
  ebayClient.OAuth2.setCredentials({
    access_token: '',
    refresh_token: refreshToken,
    expires_in: 0,
  })

  return ebayClient
}
