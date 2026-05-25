import SunCalc from 'suncalc';

/**
 * Weekday segment mappings (1-indexed segments of the daytime divided into 8 parts)
 * Index 0 = Sunday, 1 = Monday, ..., 6 = Saturday
 */
const RAHU_KAAL_SEGMENTS =   [8, 2, 7, 5, 6, 4, 3];
const YAMAGANDAM_SEGMENTS =  [5, 4, 3, 2, 1, 7, 6];
const GULIKA_KAAL_SEGMENTS = [7, 6, 5, 4, 3, 2, 1];

/**
 * Calculate the start/end time for a given segment number (1-8)
 * of the daytime period between sunrise and sunset.
 */
function getSegmentTime(sunrise, sunset, segmentNumber) {
  const dayDuration = sunset.getTime() - sunrise.getTime();
  const segmentDuration = dayDuration / 8;
  const start = new Date(sunrise.getTime() + (segmentNumber - 1) * segmentDuration);
  const end = new Date(start.getTime() + segmentDuration);
  return { start, end };
}

/**
 * Get Rahu Kaal, Yamagandam, and Gulika Kaal timings for a given date and location.
 * @param {Date} date - The date to calculate for
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {{ sunrise: Date, sunset: Date, rahuKaal: {start, end}, yamagandam: {start, end}, gulikaKaal: {start, end} } | null}
 */
export function getKaalTimings(date, lat, lng) {
  const times = SunCalc.getTimes(date, lat, lng);
  const sunrise = times.sunrise;
  const sunset = times.sunset;

  // Guard against invalid sunrise/sunset at extreme latitudes
  if (!sunrise || !sunset || isNaN(sunrise.getTime()) || isNaN(sunset.getTime())) {
    return null;
  }

  const dayOfWeek = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat

  return {
    date: new Date(date),
    sunrise,
    sunset,
    rahuKaal: getSegmentTime(sunrise, sunset, RAHU_KAAL_SEGMENTS[dayOfWeek]),
    yamagandam: getSegmentTime(sunrise, sunset, YAMAGANDAM_SEGMENTS[dayOfWeek]),
    gulikaKaal: getSegmentTime(sunrise, sunset, GULIKA_KAAL_SEGMENTS[dayOfWeek]),
  };
}

/**
 * Determine which kaal is next (or currently active).
 * Returns { type, label, start, end, isActive, timeUntilStart } or null if all ended.
 */
export function getNextKaal(timings) {
  if (!timings) return null;

  const now = new Date();
  const kaals = [
    { type: 'rahuKaal', label: 'Rahu Kaal', ...timings.rahuKaal },
    { type: 'yamagandam', label: 'Yamagandam', ...timings.yamagandam },
    { type: 'gulikaKaal', label: 'Gulika Kaal', ...timings.gulikaKaal },
  ];

  // Sort by start time
  kaals.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Check if any is currently active
  for (const k of kaals) {
    if (now >= k.start && now < k.end) {
      return { ...k, isActive: true, timeUntilStart: 0 };
    }
  }

  // Find next upcoming
  for (const k of kaals) {
    if (now < k.start) {
      return { ...k, isActive: false, timeUntilStart: k.start.getTime() - now.getTime() };
    }
  }

  // All ended for today
  return null;
}

/**
 * Get the status of a kaal period relative to now.
 * @returns {'upcoming' | 'active' | 'ended'}
 */
export function getKaalStatus(kaal) {
  const now = new Date();
  if (now < kaal.start) return 'upcoming';
  if (now >= kaal.start && now < kaal.end) return 'active';
  return 'ended';
}

/**
 * Get timings for multiple days starting from today.
 * @param {number} lat
 * @param {number} lng
 * @param {number} days - Number of days (default 7)
 * @returns {Array}
 */
export function getWeekTimings(lat, lng, days = 7) {
  const results = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Use noon to avoid DST edge cases

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    const timings = getKaalTimings(date, lat, lng);
    if (timings) {
      results.push(timings);
    }
  }
  return results;
}

/**
 * Format a Date to HH:MM AM/PM
 */
export function formatTime(date) {
  if (!date || isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format milliseconds to HH:MM:SS countdown string
 */
export function formatCountdown(ms) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/** Day names for display */
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
