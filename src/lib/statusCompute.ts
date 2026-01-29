import type { FormStatus } from '@/types';

/**
 * Automatically compute form status based on current time and date range
 * - If now < startDate: "Upcoming"
 * - If startDate ≤ now ≤ endDate: "Open"
 * - If now > endDate: "Closed"
 *
 * @param startDate - Form start date (string format)
 * @param endDate - Form end date (string format)
 * @param startTime - Optional start time (HH:mm format)
 * @param endTime - Optional end time (HH:mm format)
 * @returns The computed status: 'Upcoming', 'Open', or 'Closed'
 */
export function computeFormStatus(
  startDate: string,
  endDate: string,
  startTime?: string,
  endTime?: string
): FormStatus {
  const now = new Date();

  // Parse start datetime
  const startDateTime = parseDateTime(startDate, startTime);
  // Parse end datetime
  const endDateTime = parseDateTime(endDate, endTime);

  if (now < startDateTime) {
    return 'Upcoming';
  } else if (now > endDateTime) {
    return 'Closed';
  } else {
    return 'Open';
  }
}

/**
 * Parse date and optional time into a Date object
 * Handles date formats like: YYYY-MM-DD, DD/MM/YYYY, or ISO format
 *
 * @param dateStr - Date string
 * @param timeStr - Optional time string (HH:mm format)
 * @returns Date object
 */
function parseDateTime(dateStr: string, timeStr?: string): Date {
  let date: Date;

  // Try to parse date string
  if (dateStr.includes('-')) {
    // YYYY-MM-DD or ISO format
    date = new Date(dateStr);
  } else if (dateStr.includes('/')) {
    // DD/MM/YYYY format
    const [day, month, year] = dateStr.split('/');
    date = new Date(`${year}-${month}-${day}`);
  } else {
    // Fallback: try direct parsing
    date = new Date(dateStr);
  }

  // Set time if provided
  if (timeStr) {
    const [hours, minutes] = timeStr.split(':');
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  } else {
    // Default: end of day if no time specified for end dates
    // beginning of day if no time specified for start dates
    // For now, set to midnight (00:00)
    date.setHours(0, 0, 0, 0);
  }

  return date;
}

/**
 * Compute status for multiple forms
 * Useful for batch processing forms from database
 *
 * @param forms - Array of forms with date and time information
 * @returns Array of forms with computed status
 */
export function computeFormsStatus<T extends { startDate: string; endDate: string; startTime?: string; endTime?: string }>(
  forms: T[]
): (T & { status: FormStatus })[] {
  return forms.map((form) => ({
    ...form,
    status: computeFormStatus(form.startDate, form.endDate, form.startTime, form.endTime),
  }));
}
