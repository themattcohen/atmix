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
    ruName: redirectUri,
    authToken: refreshToken,
  })

  // Set the refresh token so the SDK can auto-refresh access tokens
  ebayClient.OAuth2.setCredentials({
    access_token: '',
    refresh_token: refreshToken,
  })

  return ebayClient
}
