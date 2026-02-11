/**
 * Jobber OAuth Token Management
 *
 * Handles OAuth 2.0 authorization flow for Jobber API:
 * - Authorization URL generation with required scopes
 * - Authorization code exchange for access/refresh tokens
 * - Token refresh with automatic expiration handling
 * - Secure token storage via Redis
 */

const axios = require('axios');
const config = require('../config');
const redis = require('../redis');

/**
 * OAuth scopes required for Blue Bucket voice agent operations.
 * - read_clients / write_clients: Client lookup and management
 * - read_jobs / write_jobs: Job creation and updates
 * - read_schedule: Availability checking
 * - read_requests: Access to Angi lead requests
 */
const OAUTH_SCOPES = [
  'read_clients',
  'write_clients',
  'read_jobs',
  'write_jobs',
  'read_schedule',
  'read_requests',
];

/**
 * Token refresh buffer in milliseconds.
 * Refresh tokens 60 seconds before actual expiration.
 */
const TOKEN_REFRESH_BUFFER_MS = 60 * 1000;

/**
 * Build the Jobber OAuth authorization URL.
 * Redirect users to this URL to initiate the OAuth flow.
 *
 * @param {string} state - State parameter for CSRF protection (required)
 * @returns {string} The full authorization URL
 * @throws {Error} If state parameter is not provided
 *
 * @example
 * const authUrl = getAuthorizationUrl('random-csrf-token');
 * res.redirect(authUrl);
 */
function getAuthorizationUrl(state) {
  if (!state) {
    throw new Error('State parameter is required for CSRF protection');
  }

  const params = new URLSearchParams({
    client_id: config.jobber.clientId,
    redirect_uri: config.jobber.redirectUri,
    response_type: 'code',
    scope: OAUTH_SCOPES.join(' '),
    state,
  });

  const url = `${config.jobber.authUrl}?${params.toString()}`;
  console.log('[OAuth] Generated authorization URL');
  return url;
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * Called after user approves the OAuth authorization request.
 *
 * @param {string} code - The authorization code from Jobber callback
 * @returns {Promise<Object>} Token response with access_token, refresh_token, expires_in
 * @throws {Error} If token exchange fails
 *
 * @example
 * // In OAuth callback handler:
 * const tokens = await exchangeCodeForTokens(req.query.code);
 * // tokens = { access_token, refresh_token, expires_in, token_type }
 */
async function exchangeCodeForTokens(code) {
  if (!code) {
    throw new Error('Authorization code is required');
  }

  console.log('[OAuth] Exchanging authorization code for tokens');

  try {
    const response = await axios.post(
      config.jobber.tokenUrl,
      {
        client_id: config.jobber.clientId,
        client_secret: config.jobber.clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.jobber.redirectUri,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const tokens = response.data;

    // Store tokens in Redis with calculated expiration
    await redis.storeTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type || 'Bearer',
    });

    console.log('[OAuth] Tokens exchanged and stored successfully');
    return tokens;
  } catch (error) {
    const message = error.response?.data?.error_description ||
      error.response?.data?.error ||
      error.message;
    console.error('[OAuth] Token exchange failed:', message);
    throw new Error(`Token exchange failed: ${message}`);
  }
}

/**
 * Refresh the access token using the stored refresh token.
 *
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<Object>} New token response with access_token, refresh_token, expires_in
 * @throws {Error} If refresh fails (may indicate need to re-authorize)
 *
 * @example
 * const newTokens = await refreshAccessToken(storedRefreshToken);
 */
async function refreshAccessToken(refreshToken) {
  if (!refreshToken) {
    throw new Error('Refresh token is required');
  }

  console.log('[OAuth] Refreshing access token');

  try {
    const response = await axios.post(
      config.jobber.tokenUrl,
      {
        client_id: config.jobber.clientId,
        client_secret: config.jobber.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const tokens = response.data;

    // Store new tokens in Redis
    await redis.storeTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type || 'Bearer',
    });

    console.log('[OAuth] Access token refreshed successfully');
    // Return normalized camelCase to match Redis storage format
    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type || 'Bearer',
    };
  } catch (error) {
    const message = error.response?.data?.error_description ||
      error.response?.data?.error ||
      error.message;
    console.error('[OAuth] Token refresh failed:', message);

    // If refresh fails, tokens may be invalidated
    if (error.response?.status === 400 || error.response?.status === 401) {
      console.error('[OAuth] Refresh token may be invalid - re-authorization required');
      await redis.deleteTokens();
    }

    throw new Error(`Token refresh failed: ${message}`);
  }
}

/**
 * Check if a token is expired or about to expire.
 * Uses a 60-second buffer to proactively refresh tokens.
 *
 * @param {string|Date} expiresAt - Expiration timestamp (ISO string or Date)
 * @returns {boolean} True if token is expired or expires within 60 seconds
 *
 * @example
 * if (isTokenExpired(tokens.expiresAt)) {
 *   await refreshAccessToken(tokens.refreshToken);
 * }
 */
function isTokenExpired(expiresAt) {
  if (!expiresAt) {
    return true;
  }

  const expiration = new Date(expiresAt);
  const now = new Date();
  const bufferTime = new Date(now.getTime() + TOKEN_REFRESH_BUFFER_MS);

  return expiration <= bufferTime;
}

/**
 * Get a valid access token, refreshing if necessary.
 * This is the main function to call before making Jobber API requests.
 *
 * Workflow:
 * 1. Retrieve stored tokens from Redis
 * 2. Check if access token is expired (with 60s buffer)
 * 3. If expired, refresh using stored refresh token
 * 4. Return valid access token
 *
 * @returns {Promise<string>} A valid access token
 * @throws {Error} If no tokens exist or refresh fails
 *
 * @example
 * const accessToken = await getValidAccessToken();
 * const response = await axios.get(url, {
 *   headers: { Authorization: `Bearer ${accessToken}` }
 * });
 */
async function getValidAccessToken() {
  // Retrieve stored tokens
  const storedTokens = await redis.getTokens();

  if (!storedTokens) {
    throw new Error('No stored tokens found - OAuth authorization required');
  }

  // Check if token needs refresh
  if (isTokenExpired(storedTokens.expiresAt)) {
    console.log('[OAuth] Access token expired or expiring soon, refreshing...');

    if (!storedTokens.refreshToken) {
      throw new Error('No refresh token available - re-authorization required');
    }

    const newTokens = await refreshAccessToken(storedTokens.refreshToken);
    return newTokens.accessToken;
  }

  return storedTokens.accessToken;
}

/**
 * Check if the application has valid OAuth tokens.
 * Useful for health checks and status endpoints.
 *
 * @returns {Promise<Object>} Status object with authorized and details
 *
 * @example
 * const status = await checkAuthorizationStatus();
 * // { authorized: true, expiresAt: '...', isExpired: false }
 */
async function checkAuthorizationStatus() {
  try {
    const tokens = await redis.getTokens();

    if (!tokens) {
      return {
        authorized: false,
        reason: 'No tokens stored',
      };
    }

    return {
      authorized: true,
      expiresAt: tokens.expiresAt,
      isExpired: isTokenExpired(tokens.expiresAt),
      hasRefreshToken: !!tokens.refreshToken,
    };
  } catch (error) {
    return {
      authorized: false,
      reason: error.message,
    };
  }
}

/**
 * Revoke current tokens and clear storage.
 * Use when disconnecting the Jobber integration.
 *
 * @returns {Promise<boolean>} True if tokens were cleared
 */
async function revokeTokens() {
  console.log('[OAuth] Revoking tokens');
  await redis.deleteTokens();
  return true;
}

module.exports = {
  OAUTH_SCOPES,
  getAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  isTokenExpired,
  getValidAccessToken,
  checkAuthorizationStatus,
  revokeTokens,
};
