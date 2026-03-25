/**
 * Jobber GraphQL Queries and Mutations
 *
 * Verified against Jobber GraphQL schema (API Version: 2025-04-16).
 * Based on GraphiQL introspection - January 2026.
 *
 * Key Schema Notes:
 * - jobCreate requires: propertyId (NOT clientId), invoicing object, scheduling object
 * - visits filter uses: startAt: { after, before } - NOT { gte, lte }
 * - Request provides: property.id (for propertyId), client, phone, email, lineItems
 * - Users have availableForScheduling field for team assignment
 */

/**
 * GET_REQUEST - Retrieve a Request by ID with full details
 *
 * Used for Angi lead workflow:
 * 1. Angi webhook creates Request with Client + Property automatically
 * 2. Store phone -> requestId mapping in webhook handler
 * 3. On call, lookup requestId from phone mapping
 * 4. Call this query to get property.id (required for jobCreate) and client info
 *
 * @param {EncodedId} $id - The encoded Request ID from Jobber
 * @returns Request object with property, client, lineItems, and contact info
 */
const GET_REQUEST = `
  query GetRequest($id: EncodedId!) {
    request(id: $id) {
      id
      title
      contactName
      companyName
      phone
      email
      requestStatus
      isScheduled
      createdAt
      updatedAt
      jobberWebUri
      source {
        type
        name
      }
      property {
        id
        name
        address {
          street
          city
          province
          postalCode
          country
        }
      }
      client {
        id
        name
        firstName
        lastName
        companyName
        emails {
          address
          primary
        }
        phones {
          number
          primary
        }
      }
      arrivalWindow {
        startAt
        endAt
      }
      lineItems {
        nodes {
          name
          description
          quantity
          unitPrice
        }
      }
      notes {
        nodes {
          message
          createdAt
        }
      }
      jobs {
        nodes {
          id
          jobNumber
          title
        }
      }
    }
  }
`;

/**
 * GET_VISITS - Retrieve scheduled visits within a date range
 *
 * IMPORTANT: Uses { after, before } filter - NOT { gte, lte }
 * This was verified against the actual Jobber GraphQL schema.
 *
 * Used for availability calculation:
 * - Fetch booked visits for date range
 * - Calculate available slots based on team capacity
 * - Filter by SCHEDULED status to exclude completed/cancelled
 *
 * @param {ISO8601DateTime} $after - Start of date range (exclusive)
 * @param {ISO8601DateTime} $before - End of date range (exclusive)
 * @returns Array of Visit objects with job, property, and assigned users
 */
const GET_VISITS = `
  query GetScheduledVisits($after: ISO8601DateTime!, $before: ISO8601DateTime!) {
    visits(
      first: 100,
      filter: {
        startAt: { after: $after, before: $before }
        status: SCHEDULED
      }
    ) {
      nodes {
        id
        title
        startAt
        endAt
        status
        allDay
        instructions
        job {
          id
          jobNumber
          title
        }
        property {
          id
          address {
            street
            city
          }
        }
        assignedUsers {
          nodes {
            id
            name
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * GET_USERS - Retrieve team members available for scheduling
 *
 * Used to:
 * - Get team capacity for availability calculation
 * - Populate assignedTo field in job scheduling
 * - Filter by availableForScheduling = true and status = ACTIVE
 *
 * @returns Array of User objects with scheduling availability
 */
const GET_USERS = `
  query GetAvailableUsers {
    users(first: 50) {
      nodes {
        id
        name
        email
        phone {
          number
        }
        availableForScheduling
        status
        timezone
        assignedColor
      }
    }
  }
`;

/**
 * JOB_CREATE - Create a new job with scheduled visit
 *
 * VERIFIED SCHEMA REQUIREMENTS:
 * - propertyId: REQUIRED (from Request.property.id)
 * - invoicing: REQUIRED object with invoicingType and invoicingSchedule
 * - scheduling: REQUIRED object with createVisits, startTime, endTime
 *
 * @param {JobCreateAttributes} $input - Job creation input object
 *
 * Input structure:
 * {
 *   propertyId: EncodedId!        // Get from Request.property.id
 *   requestId: EncodedId          // Optional: link to Angi Request
 *   title: String                 // Job title
 *   instructions: String          // Job notes/instructions
 *   scheduling: {
 *     createVisits: Boolean!      // Must be true to create visit
 *     notifyTeam: Boolean         // Send notifications to assigned team
 *     startTime: ISO8601DateTime! // Visit start time
 *     endTime: ISO8601DateTime!   // Visit end time
 *     assignedTo: [EncodedId]     // User IDs to assign
 *   }
 *   invoicing: {
 *     invoicingType: InvoicingType!     // ON_COMPLETION, MANUAL, etc.
 *     invoicingSchedule: InvoicingSchedule! // VISIT_BASED, JOB_BASED
 *   }
 *   lineItems: [{
 *     name: String!
 *     description: String
 *     quantity: Float
 *     unitPrice: Float
 *   }]
 * }
 *
 * @returns Created job with id, jobNumber, visits, client, and property
 */
const JOB_CREATE = `
  mutation CreateJob($input: JobCreateAttributes!) {
    jobCreate(input: $input) {
      job {
        id
        jobNumber
        title
        instructions
        jobberWebUri
        visits {
          nodes {
            id
            startAt
            endAt
            status
            assignedUsers {
              nodes {
                id
                name
              }
            }
          }
        }
        client {
          id
          name
          firstName
          lastName
        }
        property {
          id
          address {
            street
            city
            province
            postalCode
          }
        }
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * Additional utility queries for common operations
 */

/**
 * GET_CLIENT_BY_ID - Retrieve a client by their ID
 *
 * @param {EncodedId} $id - The encoded Client ID
 * @returns Client object with contact info and properties
 */
const GET_CLIENT_BY_ID = `
  query GetClient($id: EncodedId!) {
    client(id: $id) {
      id
      name
      firstName
      lastName
      companyName
      emails {
        address
        primary
      }
      phones {
        number
        primary
      }
      properties {
        nodes {
          id
          name
          address {
            street
            city
            province
            postalCode
          }
        }
      }
      defaultProperty {
        id
        address {
          street
          city
        }
      }
    }
  }
`;

/**
 * GET_JOB_BY_ID - Retrieve a job by its ID
 *
 * @param {EncodedId} $id - The encoded Job ID
 * @returns Job object with visits, client, and property details
 */
const GET_JOB_BY_ID = `
  query GetJob($id: EncodedId!) {
    job(id: $id) {
      id
      jobNumber
      title
      instructions
      jobStatus
      jobberWebUri
      createdAt
      visits {
        nodes {
          id
          startAt
          endAt
          status
          assignedUsers {
            nodes {
              id
              name
            }
          }
        }
      }
      client {
        id
        name
        firstName
        lastName
        phones {
          number
          primary
        }
      }
      property {
        id
        address {
          street
          city
          province
          postalCode
        }
      }
      lineItems {
        nodes {
          name
          description
          quantity
          unitPrice
          totalPrice
        }
      }
    }
  }
`;

/**
 * SEARCH_CLIENTS - Search for clients by text query
 *
 * Note: Jobber does NOT support phone number filtering in ClientFilterAttributes.
 * Use text search and filter results client-side if needed.
 *
 * @param {String} $searchTerm - Text to search in client names/companies
 * @returns Array of matching clients
 */
const SEARCH_CLIENTS = `
  query SearchClients($searchTerm: String!) {
    clients(
      first: 20,
      searchTerm: $searchTerm
    ) {
      nodes {
        id
        name
        firstName
        lastName
        companyName
        phones {
          number
          primary
        }
        emails {
          address
          primary
        }
        defaultProperty {
          id
          address {
            street
            city
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * GET_RECENT_REQUESTS - Get recent requests for dashboard/overview
 *
 * @param {Int} $first - Number of requests to retrieve
 * @returns Array of recent Request objects
 */
const GET_RECENT_REQUESTS = `
  query GetRecentRequests($first: Int!) {
    requests(
      first: $first,
      sort: { by: CREATED_AT, direction: DESCENDING }
    ) {
      nodes {
        id
        title
        contactName
        phone
        email
        requestStatus
        isScheduled
        createdAt
        source {
          type
          name
        }
        property {
          id
          address {
            street
            city
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/**
 * NOTE_CREATE - Create a note attached to a record
 *
 * Used to log call outcomes to Request records.
 *
 * @param {NoteCreateAttributes} $input - Note creation input
 *   - linkedToId: EncodedId! (Request ID)
 *   - message: String! (max 10,000 characters)
 *   - isVisibleToClient: Boolean (default: false)
 * @returns Created note with id and message
 */
const NOTE_CREATE = `
  mutation CreateNote($input: NoteCreateAttributes!) {
    noteCreate(input: $input) {
      note {
        id
        message
        createdAt
        createdBy {
          id
          name
        }
      }
      userErrors {
        message
        path
      }
    }
  }
`;

/**
 * REQUEST_UPDATE_STATUS - Update a Request's status
 *
 * Used to mark requests as converted or archived after call outcomes.
 *
 * @param {EncodedId} $requestId - The request ID to update
 * @param {RequestStatusEnum} $status - New status value
 *   - LEAD: New lead, not yet contacted
 *   - CONVERTED: Converted to job (use when booked)
 *   - ARCHIVED: Lead archived/lost (use when not interested)
 * @returns Updated request with new status
 */
const REQUEST_UPDATE_STATUS = `
  mutation UpdateRequestStatus($requestId: EncodedId!, $status: RequestStatusEnum!) {
    requestUpdate(
      requestId: $requestId,
      attributes: { requestStatus: $status }
    ) {
      request {
        id
        requestStatus
      }
      userErrors {
        message
        path
      }
    }
  }
`;

module.exports = {
  // Primary queries for voice agent workflow
  GET_REQUEST,
  GET_VISITS,
  GET_USERS,
  JOB_CREATE,

  // Additional utility queries
  GET_CLIENT_BY_ID,
  GET_JOB_BY_ID,
  SEARCH_CLIENTS,
  GET_RECENT_REQUESTS,

  // Call outcome logging mutations
  NOTE_CREATE,
  REQUEST_UPDATE_STATUS,
};
