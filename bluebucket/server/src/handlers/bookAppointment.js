/**
 * Blue Bucket Server - Book Appointment Handler
 *
 * Handles appointment booking by creating a Job in Jobber with scheduling.
 * CRITICAL: Requires a valid property_id from Jobber (obtained from Request lookup).
 */

const { parseISO, format, addHours } = require('date-fns');
const { fromZonedTime } = require('date-fns-tz');
const config = require('../config');
const { query: jobberQuery } = require('../jobber/client');
const { JOB_CREATE, GET_USERS } = require('../jobber/queries');

/**
 * Sanitize user input by stripping HTML tags, trimming, and enforcing max length.
 * @param {string} input - Raw user input
 * @param {number} [maxLength=200] - Maximum allowed length
 * @returns {string} Sanitized string
 */
function sanitizeInput(input, maxLength = 200) {
  if (!input || typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim().slice(0, maxLength);
}

/**
 * Book a cleaning appointment by creating a Job in Jobber.
 *
 * CRITICAL REQUIREMENTS:
 * - property_id is REQUIRED by Jobber API (cannot create job without it)
 * - property_id comes from Request.property.id in Jobber
 * - If property_id is missing, booking fails gracefully with needsCallback: true
 *
 * Process:
 * 1. Validate required fields (especially property_id)
 * 2. Build ISO8601 start and end times
 * 3. Get available team members for assignment
 * 4. Create Job in Jobber with scheduling and invoicing
 * 5. Return booking confirmation with job details
 *
 * @param {Object} params - Booking parameters
 * @param {string} params.property_id - REQUIRED: Jobber property ID (from Request.property.id)
 * @param {string} [params.request_id] - Jobber request ID (to link job to Angi lead)
 * @param {string} params.customer_name - Customer's full name
 * @param {string} params.customer_phone - Customer's phone number
 * @param {string} params.appointment_date - Appointment date (YYYY-MM-DD or ISO)
 * @param {string} params.appointment_time - Appointment time (HH:mm or display format)
 * @param {string} [params.service_type='House Cleaning'] - Type of cleaning service
 * @param {number} [params.quoted_price] - Quoted price for the service
 * @param {number} [params.estimated_hours=3] - Estimated service duration in hours
 * @param {string} [params.special_instructions] - Special instructions or notes
 * @returns {Object} Booking result with confirmation details
 *
 * @example
 * const result = await handleBookAppointment({
 *   property_id: 'UHJvcGVydHk6MTIzNDU2', // REQUIRED
 *   request_id: 'UmVxdWVzdDoxMjM0NTY=',
 *   customer_name: 'John Doe',
 *   customer_phone: '+13035551234',
 *   appointment_date: '2025-01-20',
 *   appointment_time: '9:00 AM',
 *   service_type: 'House Cleaning',
 *   quoted_price: 245,
 *   estimated_hours: 3,
 *   special_instructions: 'Dog-friendly team preferred'
 * });
 */
async function handleBookAppointment({
  property_id,
  request_id,
  customer_name,
  customer_phone,
  appointment_date,
  appointment_time,
  service_type = 'House Cleaning',
  quoted_price,
  estimated_hours = 3,
  special_instructions,
}) {
  console.log('[BookAppointment] Booking appointment:', {
    property_id,
    request_id,
    customer_name,
    appointment_date,
    appointment_time,
    service_type,
  });

  try {
    // CRITICAL: Validate property_id exists
    if (!property_id) {
      console.error('[BookAppointment] CRITICAL: Missing property_id - cannot create job');
      return {
        success: false,
        needsCallback: true,
        error: 'Unable to complete booking at this time',
        message: 'I apologize, but I\'m unable to complete the booking right now. ' +
          'Let me have our team call you back to finalize your appointment.',
        reason: 'Missing property_id - Jobber requires property_id for job creation',
      };
    }

    // Validate appointment date and time
    if (!appointment_date || !appointment_time) {
      return {
        success: false,
        error: 'Missing appointment date or time',
        message: 'I need both a date and time for your appointment. What day works best for you?',
      };
    }

    // Parse and validate date/time
    const timezone = config.businessTz;
    const { startTime, endTime } = parseAppointmentDateTime(
      appointment_date,
      appointment_time,
      estimated_hours,
      timezone
    );

    if (!startTime || !endTime) {
      return {
        success: false,
        error: 'Invalid appointment date or time',
        message: 'I couldn\'t understand that date or time. Could you try again with something like "Tuesday at 9 AM"?',
      };
    }

    // Get available team members for assignment
    let assignedUserIds = [];
    try {
      const usersData = await jobberQuery(GET_USERS);
      const availableUsers = (usersData?.users?.nodes || []).filter(
        (user) => user.availableForScheduling && user.status === 'ACTIVE'
      );
      // Assign first available user (or multiple if needed)
      assignedUserIds = availableUsers.slice(0, config.business.teamCapacity).map((u) => u.id);
      console.log('[BookAppointment] Assigned users:', assignedUserIds.length);
    } catch (userError) {
      console.warn('[BookAppointment] Could not fetch users for assignment:', userError.message);
      // Continue without assignment - Jobber will use default
    }

    // Build job creation input
    const jobTitle = `${sanitizeInput(service_type)} - ${sanitizeInput(customer_name)}`;
    const instructions = buildJobInstructions({
      customer_name,
      customer_phone,
      service_type,
      quoted_price,
      special_instructions,
    });

    const jobInput = {
      propertyId: property_id,
      title: jobTitle,
      instructions,
      scheduling: {
        createVisits: true,
        notifyTeam: true,
        startTime: startTime,
        endTime: endTime,
      },
      invoicing: {
        invoicingType: 'ON_COMPLETION',
        invoicingSchedule: 'VISIT_BASED',
      },
    };

    // Add request ID if provided (links job to Angi lead)
    if (request_id) {
      jobInput.requestId = request_id;
    }

    // Add team assignment if we have users
    if (assignedUserIds.length > 0) {
      jobInput.scheduling.assignedTo = assignedUserIds;
    }

    // Add line items if we have a quoted price
    if (quoted_price && quoted_price > 0) {
      jobInput.lineItems = [{
        name: service_type,
        description: `${service_type} service`,
        quantity: 1,
        unitPrice: quoted_price,
      }];
    }

    console.log('[BookAppointment] Creating job in Jobber:', {
      propertyId: property_id,
      title: jobTitle,
      startTime,
      endTime,
    });

    // Create the job in Jobber
    const result = await jobberQuery(JOB_CREATE, { input: jobInput });

    // Check for user errors
    if (result?.jobCreate?.userErrors?.length > 0) {
      const errors = result.jobCreate.userErrors;
      console.error('[BookAppointment] Jobber userErrors:', errors);
      return {
        success: false,
        needsCallback: true,
        error: errors[0].message,
        message: 'I encountered an issue completing your booking. Let me have our team call you back to finalize.',
      };
    }

    // Check if job was created successfully
    if (!result?.jobCreate?.job) {
      console.error('[BookAppointment] No job returned from Jobber');
      return {
        success: false,
        needsCallback: true,
        error: 'Job creation failed',
        message: 'I apologize, but the booking didn\'t go through. Let me have our team call you back.',
      };
    }

    const job = result.jobCreate.job;
    const visit = job.visits?.nodes?.[0];

    // Generate confirmation number from job number
    const confirmationNumber = `BBK-${job.jobNumber}`;

    // Format appointment details for confirmation
    const appointmentDisplay = formatAppointmentDisplay(startTime, timezone);

    console.log('[BookAppointment] Booking successful:', {
      jobId: job.id,
      jobNumber: job.jobNumber,
      confirmationNumber,
    });

    return {
      success: true,
      booking: {
        confirmation_number: confirmationNumber,
        job_id: job.id,
        job_number: job.jobNumber,
        appointment_date: appointment_date,
        appointment_time: appointment_time,
        service_type,
        quoted_price,
        estimated_hours,
        customer_name,
        property_address: formatPropertyAddress(job.property?.address),
        visit_id: visit?.id,
        jobber_web_uri: job.jobberWebUri,
      },
      notifications: {
        email_confirmation: true,
        sms_reminder: true,
        calendar_invite: true,
      },
      message: `Perfect! I've booked your ${service_type.toLowerCase()} appointment for ${appointmentDisplay}. ` +
        `Your confirmation number is ${confirmationNumber}. ` +
        `You'll receive an email confirmation shortly with all the details.`,
    };
  } catch (error) {
    console.error('[BookAppointment] Error booking appointment:', error.message);

    // NEVER fake a confirmation number on error
    return {
      success: false,
      needsCallback: true,
      error: 'Booking system error',
      message: 'I apologize, but I\'m having trouble completing your booking. ' +
        'Let me have our team call you back to confirm your appointment.',
      details: config.isDevelopment ? error.message : undefined,
    };
  }
}

/**
 * Parse appointment date and time into ISO8601 format.
 *
 * @param {string} dateStr - Date string (YYYY-MM-DD, ISO, or natural)
 * @param {string} timeStr - Time string (HH:mm, h:mm AM/PM)
 * @param {number} durationHours - Service duration in hours
 * @param {string} timezone - Business timezone
 * @returns {Object} Object with startTime and endTime as ISO strings
 */
function parseAppointmentDateTime(dateStr, timeStr, durationHours, timezone) {
  try {
    // Extract date portion
    let datePart = dateStr;
    if (dateStr.includes('T')) {
      datePart = dateStr.split('T')[0];
    }

    // Parse time string
    const timeParsed = parseTimeString(timeStr);
    if (!timeParsed) {
      return { startTime: null, endTime: null };
    }

    // Combine date and time
    const dateTimeStr = `${datePart}T${timeParsed.hours24}:${timeParsed.minutes}:00`;
    const localDateTime = parseISO(dateTimeStr);

    // Convert to UTC for Jobber API
    const startTimeUtc = fromZonedTime(localDateTime, timezone);
    const endTimeUtc = addHours(startTimeUtc, durationHours);

    return {
      startTime: startTimeUtc.toISOString(),
      endTime: endTimeUtc.toISOString(),
    };
  } catch (error) {
    console.error('[BookAppointment] Error parsing date/time:', error.message);
    return { startTime: null, endTime: null };
  }
}

/**
 * Parse a time string into hours and minutes.
 *
 * @param {string} timeStr - Time string (various formats)
 * @returns {Object|null} Object with hours24 and minutes, or null
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;

  const normalized = timeStr.trim().toUpperCase();

  // Try HH:mm or H:mm format (24-hour)
  const match24 = normalized.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return {
      hours24: String(parseInt(match24[1], 10)).padStart(2, '0'),
      minutes: match24[2],
    };
  }

  // Try h:mm AM/PM format
  const match12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = match12[2];
    const period = match12[3];

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    return {
      hours24: String(hours).padStart(2, '0'),
      minutes,
    };
  }

  // Try h AM/PM format (no minutes)
  const matchHour = normalized.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (matchHour) {
    let hours = parseInt(matchHour[1], 10);
    const period = matchHour[2];

    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }

    return {
      hours24: String(hours).padStart(2, '0'),
      minutes: '00',
    };
  }

  return null;
}

/**
 * Build job instructions from booking details.
 *
 * @param {Object} details - Booking details
 * @returns {string} Formatted instructions
 */
function buildJobInstructions({ customer_name, customer_phone, service_type, quoted_price, special_instructions }) {
  const lines = [];

  lines.push(`Customer: ${sanitizeInput(customer_name)}`);
  if (customer_phone) {
    lines.push(`Phone: ${sanitizeInput(customer_phone, 30)}`);
  }
  lines.push(`Service: ${sanitizeInput(service_type)}`);
  if (quoted_price) {
    lines.push(`Quoted Price: $${quoted_price}`);
  }
  lines.push('');
  lines.push('Booked via AI Voice Agent');

  if (special_instructions) {
    lines.push('');
    lines.push('Special Instructions:');
    lines.push(sanitizeInput(special_instructions, 1000));
  }

  return lines.join('\n');
}

/**
 * Format appointment for display confirmation.
 *
 * @param {string} isoDateTime - ISO datetime string
 * @param {string} timezone - Display timezone
 * @returns {string} Formatted display string
 */
function formatAppointmentDisplay(isoDateTime, timezone) {
  try {
    const date = parseISO(isoDateTime);
    return format(date, "EEEE, MMMM do 'at' h:mm a");
  } catch (error) {
    return isoDateTime;
  }
}

/**
 * Format property address from Jobber address object.
 *
 * @param {Object} address - Jobber address object
 * @returns {string|null} Formatted address
 */
function formatPropertyAddress(address) {
  if (!address) return null;

  const parts = [];
  if (address.street) parts.push(address.street);
  if (address.city) parts.push(address.city);
  if (address.province) parts.push(address.province);
  if (address.postalCode) parts.push(address.postalCode);

  return parts.length > 0 ? parts.join(', ') : null;
}

module.exports = {
  handleBookAppointment,
};
