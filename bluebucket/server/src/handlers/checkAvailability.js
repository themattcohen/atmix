/**
 * Blue Bucket Server - Check Availability Handler
 *
 * Handles availability checking by querying Jobber for scheduled visits
 * and calculating open slots based on team capacity.
 */

const { format, addDays, parseISO, startOfDay, setHours, setMinutes } = require('date-fns');
const { toZonedTime, fromZonedTime } = require('date-fns-tz');
const config = require('../config');
const { query: jobberQuery } = require('../jobber/client');
const { GET_VISITS, GET_USERS } = require('../jobber/queries');

/**
 * Check availability for scheduling a cleaning appointment.
 *
 * Process:
 * 1. Parse preferred date (handles natural language like "next Tuesday")
 * 2. Query Jobber for scheduled visits in the date range
 * 3. Query Jobber for available team members
 * 4. Calculate open slots based on team capacity vs booked visits
 * 5. Return available time slots
 *
 * @param {Object} params - Availability check parameters
 * @param {string} params.preferred_date - Preferred date (ISO date, relative, or natural language)
 * @param {string} [params.preferred_time] - Preferred time of day (morning, afternoon, specific time)
 * @param {number} [params.service_duration_hours=3] - Expected service duration in hours
 * @returns {Object} Availability result with available slots
 *
 * @example
 * const result = await handleCheckAvailability({
 *   preferred_date: '2025-01-20',
 *   preferred_time: 'morning',
 *   service_duration_hours: 3
 * });
 */
async function handleCheckAvailability({
  preferred_date,
  preferred_time,
  service_duration_hours = 3,
}) {
  console.log('[CheckAvailability] Checking availability:', {
    preferred_date,
    preferred_time,
    service_duration_hours,
  });

  try {
    const timezone = config.businessTz;
    const now = new Date();
    const today = startOfDay(toZonedTime(now, timezone));

    // Parse the preferred date
    const startDate = parsePreferredDate(preferred_date, today, timezone);
    if (!startDate) {
      return {
        success: false,
        available: false,
        error: 'Could not understand the requested date',
        message: 'Please provide a specific date like "January 20th" or "next Tuesday"',
      };
    }

    // Check if date is in the past or too close
    const minBookingDate = addDays(today, 1); // Minimum 24 hours notice
    if (startDate < minBookingDate) {
      return {
        success: true,
        available: false,
        error: 'Date too soon',
        message: 'We need at least 24 hours notice for bookings. What about tomorrow or later this week?',
        next_available: format(minBookingDate, 'EEEE, MMMM do'),
      };
    }

    // Get date range for availability check (7 days from preferred date)
    const endDate = addDays(startDate, 7);

    // Convert to ISO strings for Jobber API - use after/before format
    const afterDate = fromZonedTime(startOfDay(addDays(startDate, -1)), timezone).toISOString();
    const beforeDate = fromZonedTime(addDays(endDate, 1), timezone).toISOString();

    console.log('[CheckAvailability] Querying Jobber for date range:', {
      after: afterDate,
      before: beforeDate,
    });

    // Query Jobber for scheduled visits and available users in parallel
    let visits = [];
    let availableTeamMembers = [];

    try {
      const [visitsData, usersData] = await Promise.all([
        jobberQuery(GET_VISITS, { after: afterDate, before: beforeDate }),
        jobberQuery(GET_USERS),
      ]);

      visits = visitsData?.visits?.nodes || [];
      availableTeamMembers = (usersData?.users?.nodes || []).filter(
        (user) => user.availableForScheduling && user.status === 'ACTIVE'
      );

      console.log('[CheckAvailability] Found:', {
        scheduledVisits: visits.length,
        availableTeamMembers: availableTeamMembers.length,
      });
    } catch (jobberError) {
      console.error('[CheckAvailability] Jobber query error:', jobberError.message);
      // Continue with default availability if Jobber fails
    }

    // Calculate team capacity
    const teamCapacity = availableTeamMembers.length || config.business.teamCapacity;

    // Calculate available slots
    const slots = calculateAvailableSlots({
      startDate,
      endDate,
      visits,
      teamCapacity,
      preferredTime: preferred_time,
      serviceDuration: service_duration_hours,
      timezone,
      workDays: config.business.workDays,
      slotTimes: config.business.slotTimes,
      hoursStart: config.business.hoursStart,
      hoursEnd: config.business.hoursEnd,
    });

    if (slots.length === 0) {
      // Find next available date
      const nextAvailable = findNextAvailableDate(endDate, timezone);

      return {
        success: true,
        available: false,
        message: 'No availability in the requested timeframe',
        next_available: format(nextAvailable, 'EEEE, MMMM do'),
        suggested_date: nextAvailable.toISOString().split('T')[0],
      };
    }

    // Format slots for response
    const formattedSlots = slots.slice(0, 6).map((slot) => ({
      date: slot.date,
      day_of_week: slot.dayOfWeek,
      start_time: slot.startTime,
      end_time: slot.endTime,
      display: `${slot.dayOfWeek}, ${slot.displayDate} at ${slot.startTime}`,
    }));

    // Build user-friendly message
    const slotDescriptions = formattedSlots.slice(0, 3).map((s) => s.display);
    let message = `I have availability on ${slotDescriptions.join(', or ')}`;
    if (formattedSlots.length > 3) {
      message += `, and a few more options.`;
    }
    message += ' Which works better for you?';

    return {
      success: true,
      available: true,
      slots: formattedSlots,
      total_slots: slots.length,
      next_available: formattedSlots[0]?.display,
      message,
    };
  } catch (error) {
    console.error('[CheckAvailability] Error checking availability:', error.message);
    return {
      success: false,
      available: false,
      error: 'Unable to check availability at this time',
      message: 'Let me connect you with our team to find the best time.',
      details: config.isDevelopment ? error.message : undefined,
    };
  }
}

/**
 * Parse a preferred date string into a Date object.
 * Handles ISO dates, relative dates, and natural language.
 *
 * @param {string} dateStr - Date string to parse
 * @param {Date} today - Reference date for relative calculations
 * @param {string} timezone - Business timezone
 * @returns {Date|null} Parsed date or null if unparseable
 */
function parsePreferredDate(dateStr, today, timezone) {
  if (!dateStr) {
    return addDays(today, 1); // Default to tomorrow
  }

  const normalized = dateStr.toLowerCase().trim();

  // Handle relative dates
  if (normalized === 'today') {
    return today;
  }
  if (normalized === 'tomorrow') {
    return addDays(today, 1);
  }
  if (normalized.includes('next week')) {
    return addDays(today, 7);
  }
  if (normalized.includes('this week')) {
    return addDays(today, 1);
  }

  // Handle day names
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const nextMatch = normalized.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (nextMatch) {
    const targetDay = dayNames.indexOf(nextMatch[1]);
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil <= 0) daysUntil += 7;
    daysUntil += 7; // "next" means the following week
    return addDays(today, daysUntil);
  }

  const thisMatch = normalized.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
  if (thisMatch) {
    const targetDay = dayNames.indexOf(thisMatch[1]);
    const currentDay = today.getDay();
    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0) daysUntil += 7;
    return addDays(today, daysUntil);
  }

  // Just a day name
  for (const [index, day] of dayNames.entries()) {
    if (normalized.includes(day)) {
      const currentDay = today.getDay();
      let daysUntil = index - currentDay;
      if (daysUntil < 0) daysUntil += 7;
      return addDays(today, daysUntil);
    }
  }

  // Try ISO date format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    try {
      return parseISO(dateStr);
    } catch (e) {
      // Fall through
    }
  }

  // Try to parse other date formats
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  } catch (e) {
    // Fall through
  }

  // Default to tomorrow if we can't parse
  return addDays(today, 1);
}

/**
 * Calculate available time slots based on booked visits and team capacity.
 *
 * @param {Object} params - Calculation parameters
 * @returns {Array} Array of available slot objects
 */
function calculateAvailableSlots({
  startDate,
  endDate,
  visits,
  teamCapacity,
  preferredTime,
  serviceDuration,
  timezone,
  workDays,
  slotTimes,
  hoursStart,
  hoursEnd,
}) {
  const slots = [];
  let currentDate = startDate;

  // Build a map of visits by date and time
  const visitsByDateTime = {};
  for (const visit of visits) {
    if (!visit.startAt) continue;
    const visitDate = format(toZonedTime(parseISO(visit.startAt), timezone), 'yyyy-MM-dd');
    const visitHour = format(toZonedTime(parseISO(visit.startAt), timezone), 'HH:mm');
    const key = `${visitDate}-${visitHour}`;
    visitsByDateTime[key] = (visitsByDateTime[key] || 0) + 1;
  }

  // Filter slot times based on preferred time
  let filteredSlotTimes = [...slotTimes];
  if (preferredTime) {
    const pref = preferredTime.toLowerCase();
    if (pref.includes('morning') || pref.includes('am')) {
      filteredSlotTimes = slotTimes.filter((t) => parseInt(t.split(':')[0]) < 12);
    } else if (pref.includes('afternoon') || pref.includes('pm')) {
      filteredSlotTimes = slotTimes.filter((t) => parseInt(t.split(':')[0]) >= 12);
    }
  }

  // Iterate through dates
  while (currentDate <= endDate && slots.length < 20) {
    const dayOfWeek = currentDate.getDay();

    // Skip non-work days
    if (!workDays.includes(dayOfWeek)) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const dateStr = format(currentDate, 'yyyy-MM-dd');
    const displayDate = format(currentDate, 'MMMM do');
    const dayName = format(currentDate, 'EEEE');

    // Check each slot time
    for (const slotTime of filteredSlotTimes) {
      const key = `${dateStr}-${slotTime}`;
      const bookedCount = visitsByDateTime[key] || 0;

      // Slot is available if booked count is less than team capacity
      if (bookedCount < teamCapacity) {
        const [hours, minutes] = slotTime.split(':').map(Number);
        const endHours = hours + serviceDuration;
        const endTime = `${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

        // Format times for display
        const displayStartTime = formatTimeForDisplay(slotTime);
        const displayEndTime = formatTimeForDisplay(endTime);

        slots.push({
          date: dateStr,
          dayOfWeek: dayName,
          displayDate,
          startTime: displayStartTime,
          endTime: displayEndTime,
          isoStartTime: `${dateStr}T${slotTime}:00`,
          isoEndTime: `${dateStr}T${endTime}:00`,
          availableSlots: teamCapacity - bookedCount,
        });
      }
    }

    currentDate = addDays(currentDate, 1);
  }

  return slots;
}

/**
 * Format 24-hour time to 12-hour display format.
 * @param {string} time24 - Time in HH:mm format
 * @returns {string} Time in h:mm AM/PM format
 */
function formatTimeForDisplay(time24) {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Find the next available date when calendar is full.
 * @param {Date} afterDate - Start searching after this date
 * @param {string} timezone - Business timezone
 * @returns {Date} Next available date
 */
function findNextAvailableDate(afterDate, timezone) {
  // For simplicity, return 3 days after the end date
  return addDays(afterDate, 3);
}

module.exports = {
  handleCheckAvailability,
};
