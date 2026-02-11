/**
 * Jobber GraphQL Client
 *
 * Authenticated GraphQL client for Jobber API operations.
 * Features:
 * - Automatic token management with refresh on 401
 * - Proper API versioning with X-JOBBER-GRAPHQL-VERSION header
 * - GraphQL error extraction and handling
 * - Request timeout configuration
 */

const axios = require('axios');
const config = require('../config');
const oauth = require('./oauth');

/**
 * Jobber GraphQL API Client
 *
 * Provides authenticated access to Jobber's GraphQL API with automatic
 * token refresh on authentication failures.
 *
 * @example
 * const { query } = require('./jobber/client');
 *
 * const result = await query(`
 *   query GetUsers {
 *     users(first: 10) {
 *       nodes { id name }
 *     }
 *   }
 * `);
 */
class JobberClient {
  /**
   * Create a new JobberClient instance.
   * Uses configuration from config module for API URL and version.
   */
  constructor() {
    this.baseUrl = config.jobber.apiUrl;
    this.apiVersion = config.jobber.apiVersion;
    this.timeout = 15000; // 15 second timeout
  }

  /**
   * Execute a GraphQL query or mutation against the Jobber API.
   *
   * Handles:
   * - Authentication with Bearer token
   * - API versioning header
   * - Automatic token refresh on 401 responses
   * - GraphQL error extraction
   *
   * @param {string} graphqlQuery - The GraphQL query or mutation string
   * @param {Object} [variables={}] - Variables for the GraphQL operation
   * @returns {Promise<Object>} The data portion of the GraphQL response
   * @throws {Error} If GraphQL returns errors or request fails
   *
   * @example
   * // Simple query
   * const data = await client.query(`
   *   query { users(first: 5) { nodes { id name } } }
   * `);
   *
   * // Query with variables
   * const data = await client.query(`
   *   query GetRequest($id: EncodedId!) {
   *     request(id: $id) { id title }
   *   }
   * `, { id: 'UmVxdWVzdDoxMjM0NTY=' });
   *
   * // Mutation
   * const data = await client.query(`
   *   mutation CreateJob($input: JobCreateAttributes!) {
   *     jobCreate(input: $input) {
   *       job { id jobNumber }
   *       userErrors { message path }
   *     }
   *   }
   * `, { input: { propertyId: '...', ... } });
   */
  async query(graphqlQuery, variables = {}) {
    // Get valid access token (refreshes if needed)
    const accessToken = await oauth.getValidAccessToken();

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          query: graphqlQuery,
          variables,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-JOBBER-GRAPHQL-VERSION': this.apiVersion,
          },
          timeout: this.timeout,
        }
      );

      // Check for GraphQL errors in response
      if (response.data.errors && response.data.errors.length > 0) {
        const errors = response.data.errors;
        console.error('[JobberClient] GraphQL errors:', JSON.stringify(errors, null, 2));

        // Extract first error message for throwing
        const firstError = errors[0];
        const errorMessage = firstError.message || 'GraphQL operation failed';

        // Include path information if available
        const path = firstError.path ? ` (at ${firstError.path.join('.')})` : '';

        throw new Error(`${errorMessage}${path}`);
      }

      return response.data.data;
    } catch (error) {
      // Handle 401 Unauthorized - attempt token refresh and retry
      if (error.response?.status === 401) {
        console.log('[JobberClient] Received 401, attempting token refresh...');

        try {
          // Force token refresh
          const tokens = await require('../redis').getTokens();
          if (tokens?.refreshToken) {
            await oauth.refreshAccessToken(tokens.refreshToken);
            // Retry the request with new token
            return this.query(graphqlQuery, variables);
          }
        } catch (refreshError) {
          console.error('[JobberClient] Token refresh failed:', refreshError.message);
          throw new Error('Authentication failed - re-authorization required');
        }
      }

      // Re-throw GraphQL errors (already formatted)
      if (error.message && !error.response) {
        throw error;
      }

      // Handle HTTP errors
      const status = error.response?.status;
      const message = error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Unknown error';

      console.error(`[JobberClient] Request failed (${status}):`, message);
      throw new Error(`Jobber API error (${status}): ${message}`);
    }
  }

  /**
   * Execute a GraphQL query with retry logic.
   * Useful for operations that may fail due to transient issues.
   *
   * @param {string} graphqlQuery - The GraphQL query or mutation string
   * @param {Object} [variables={}] - Variables for the GraphQL operation
   * @param {number} [maxRetries=2] - Maximum number of retry attempts
   * @returns {Promise<Object>} The data portion of the GraphQL response
   * @throws {Error} If all retries fail
   */
  async queryWithRetry(graphqlQuery, variables = {}, maxRetries = 2) {
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.query(graphqlQuery, variables);
      } catch (error) {
        lastError = error;

        // Don't retry on authentication or GraphQL validation errors
        if (
          error.message.includes('Authentication failed') ||
          error.message.includes('re-authorization required') ||
          error.message.includes('Syntax Error') ||
          error.message.includes('Variable')
        ) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 500; // Exponential backoff
          console.log(`[JobberClient] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Check if the client can successfully connect to Jobber API.
   * Useful for health checks and connection validation.
   *
   * @returns {Promise<Object>} Connection status with timing info
   */
  async healthCheck() {
    const start = Date.now();

    try {
      // Simple introspection query to verify connection
      await this.query(`
        query HealthCheck {
          __typename
        }
      `);

      return {
        status: 'healthy',
        latency: `${Date.now() - start}ms`,
        apiVersion: this.apiVersion,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        latency: `${Date.now() - start}ms`,
        apiVersion: this.apiVersion,
      };
    }
  }

  /**
   * Create a note attached to a record.
   *
   * @param {string} linkedToId - EncodedId of the record (e.g., Request ID)
   * @param {string} message - Note content (max 10,000 characters)
   * @param {boolean} [isVisibleToClient=false] - Client visibility
   * @returns {Promise<Object>} Created note object
   * @throws {Error} If note creation fails
   */
  async createNote(linkedToId, message, isVisibleToClient = false) {
    const queries = require('./queries');

    const result = await this.query(queries.NOTE_CREATE, {
      input: {
        linkedToId,
        message,
        isVisibleToClient,
      },
    });

    if (result.noteCreate.userErrors?.length > 0) {
      throw new Error(result.noteCreate.userErrors[0].message);
    }

    return result.noteCreate.note;
  }

  /**
   * Update a Request's status.
   *
   * @param {string} requestId - EncodedId of the Request
   * @param {string} status - New status (LEAD, CONVERTED, ARCHIVED, etc.)
   * @returns {Promise<Object>} Updated request object
   * @throws {Error} If update fails
   */
  async updateRequestStatus(requestId, status) {
    const queries = require('./queries');

    const result = await this.query(queries.REQUEST_UPDATE_STATUS, {
      requestId,
      status,
    });

    if (result.requestUpdate.userErrors?.length > 0) {
      throw new Error(result.requestUpdate.userErrors[0].message);
    }

    return result.requestUpdate.request;
  }
}

// Export singleton instance for most use cases
const client = new JobberClient();

module.exports = {
  /**
   * Execute a GraphQL query using the singleton client.
   * @see JobberClient.query
   */
  query: client.query.bind(client),

  /**
   * Execute a GraphQL query with retry using the singleton client.
   * @see JobberClient.queryWithRetry
   */
  queryWithRetry: client.queryWithRetry.bind(client),

  /**
   * Check Jobber API health.
   * @see JobberClient.healthCheck
   */
  healthCheck: client.healthCheck.bind(client),

  /**
   * Create a note attached to a Jobber record.
   * @see JobberClient.createNote
   */
  createNote: client.createNote.bind(client),

  /**
   * Update a Request's status.
   * @see JobberClient.updateRequestStatus
   */
  updateRequestStatus: client.updateRequestStatus.bind(client),

  /**
   * JobberClient class for creating custom instances.
   */
  JobberClient,

  /**
   * Singleton client instance.
   */
  client,
};
