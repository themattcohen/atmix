/**
 * Jobber Module Index
 * Exports all Jobber-related functionality.
 */

const oauth = require('./oauth');
const client = require('./client');
const queries = require('./queries');

module.exports = {
  oauth,
  client,
  queries,
  // Convenience re-exports
  jobberClient: client,
  getAuthorizationUrl: oauth.getAuthorizationUrl,
  exchangeCodeForTokens: oauth.exchangeCodeForTokens,
  getValidAccessToken: oauth.getValidAccessToken,
};
