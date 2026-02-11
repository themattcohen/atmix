/**
 * Blue Bucket Server - Webhook Routers
 *
 * Exports all webhook routers for mounting in the main Express app.
 */

const retellRouter = require('./retell');
const jobberRouter = require('./jobber');

module.exports = {
  retellRouter,
  jobberRouter,
};
