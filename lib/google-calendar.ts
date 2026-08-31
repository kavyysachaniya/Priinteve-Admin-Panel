/**
 * Utility functions for Google Calendar integration
 */

export interface GoogleCalendarEventOptions {
  title: string;
  description?: string | null;
  startDate: Date | string;
  endDate?: Date | string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
}

/**
 * Formats a Date + optional time into Google Calendar's required compact ISO string
 */
function formatDateForGoogle(dateInput: Date | string, timeInput?: string | null): string {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";

  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");

  if (!timeInput) {
    return `${yyyy}${mm}${dd}`;
  }

  const [hours = "00", minutes = "00"] = timeInput.split(":");
  const hh = hours.padStart(2, "0");
  const min = minutes.padStart(2, "0");

  return `${yyyy}${mm}${dd}T${hh}${min}00Z`;
}

/**
 * Builds a direct 1-click Google Calendar Web Intent URL
 */
export function buildGoogleCalendarUrl(options: GoogleCalendarEventOptions): string {
  const startFormatted = formatDateForGoogle(options.startDate, options.startTime);
  const endFormatted = options.endDate
    ? formatDateForGoogle(options.endDate, options.endTime || options.startTime)
    : startFormatted;

  const datesParam = `${startFormatted}/${endFormatted}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: options.title,
    dates: datesParam,
  });

  if (options.description) {
    params.set("details", options.description);
  }

  if (options.location) {
    params.set("location", options.location);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
