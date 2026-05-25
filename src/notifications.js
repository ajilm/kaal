import * as storage from './storage.js';
import { getWeekTimings, formatTime, DAY_SHORT } from './kaal.js';

// Track browser setTimeout IDs so we can clear them on reschedule
let webTimeoutIds = [];

function checkNative() {
  try {
    return window.Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Request notification permissions.
 */
export async function requestPermission() {
  try {
    if (checkNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const result = await LocalNotifications.requestPermissions();
      return result.display === 'granted';
    }
    // Browser Notification API
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      return perm === 'granted';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Build notification objects for a single day's timings.
 * @param {object} timings - Output from getKaalTimings()
 * @param {object} settings - Notification settings
 * @param {number} dayOffset - Day offset from today (0=today, 1=tomorrow, etc.)
 * @returns {Array} Array of notification objects
 */
function buildDayNotifications(timings, settings, dayOffset) {
  if (!timings) return [];

  const { alertMinutes = 10, notifyRahu = true, notifyYama = true, notifyGulika = true } = settings;
  const alertMs = alertMinutes * 60 * 1000;
  const now = Date.now();
  const channelId = settings.alarmSound ? 'kaal-alarms' : 'kaal-alerts';

  // Unique IDs: base = dayOffset * 100, so days don't collide
  // Up to 100 days * 3 kaals each = safe range
  let id = 2000 + dayOffset * 10;
  const notifications = [];

  const dayLabel = dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : DAY_SHORT[timings.date.getDay()];

  const kaals = [
    { enabled: notifyRahu, name: 'Rahu Kaal', kaal: timings.rahuKaal },
    { enabled: notifyYama, name: 'Yamagandam', kaal: timings.yamagandam },
    { enabled: notifyGulika, name: 'Gulika Kaal', kaal: timings.gulikaKaal },
  ];

  for (const { enabled, name, kaal } of kaals) {
    if (!enabled) continue;
    const alertTime = kaal.start.getTime() - alertMs;
    if (alertTime <= now) continue;

    notifications.push({
      id: id++,
      title: `${name} — ${dayLabel}`,
      body: `${name} starts at ${formatTime(kaal.start)} (in ${alertMinutes} min)`,
      schedule: { at: new Date(alertTime) },
      channelId,
      sound: settings.alarmSound ? 'default' : null,
      importance: settings.alarmSound ? 5 : 3,
    });
  }

  return notifications;
}

/**
 * Schedule notifications for multiple days of kaal timings.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {object} settings - { alertMinutes, notifyRahu, notifyYama, notifyGulika, alarmSound, scheduleDays }
 */
export async function scheduleMultiDay(lat, lng, settings) {
  const days = settings.scheduleDays || 7;
  const weekTimings = getWeekTimings(lat, lng, days);

  const allNotifications = [];
  for (let i = 0; i < weekTimings.length; i++) {
    const dayNotifs = buildDayNotifications(weekTimings[i], settings, i);
    allNotifications.push(...dayNotifs);
  }

  if (allNotifications.length === 0) {
    storage.save('scheduledAlarms', []);
    storage.save('lastScheduledDate', new Date().toDateString());
    return;
  }

  try {
    if (checkNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');

      // Create both channels (silent + alarm)
      await LocalNotifications.createChannel({
        id: 'kaal-alerts',
        name: 'Kaal Alerts',
        description: 'Silent notifications before kaals',
        importance: 3,
        visibility: 1,
        sound: '',
      }).catch(() => {});

      await LocalNotifications.createChannel({
        id: 'kaal-alarms',
        name: 'Kaal Alarms',
        description: 'Alarm-style alerts before kaals with sound',
        importance: 5,
        visibility: 1,
        sound: 'default',
        vibration: true,
      }).catch(() => {});

      // Cancel all existing
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }

      await LocalNotifications.schedule({ notifications: allNotifications });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      // Clear previous browser timeouts
      for (const tid of webTimeoutIds) clearTimeout(tid);
      webTimeoutIds = [];

      for (const n of allNotifications) {
        const delay = n.schedule.at.getTime() - Date.now();
        if (delay > 0) {
          const tid = setTimeout(() => {
            new Notification(n.title, { body: n.body, icon: '/icons/icon-192.png' });
          }, delay);
          webTimeoutIds.push(tid);
        }
      }
    }

    // Save a readable list of scheduled alarms for the UI
    const alarmList = allNotifications.map((n) => ({
      title: n.title,
      body: n.body,
      at: n.schedule.at.toISOString(),
    }));
    storage.save('scheduledAlarms', alarmList);
    storage.save('lastScheduledDate', new Date().toDateString());
  } catch (err) {
    console.warn('Failed to schedule notifications:', err);
  }
}

/**
 * Get the list of currently scheduled alarms (for display in settings).
 * @returns {Array<{title, body, at}>}
 */
export function getScheduledAlarms() {
  const raw = storage.load('scheduledAlarms', []);
  const now = Date.now();
  // Filter out past alarms
  return raw
    .filter((a) => new Date(a.at).getTime() > now)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/**
 * Cancel all scheduled alarms.
 */
export async function cancelAllAlarms() {
  try {
    if (checkNative()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: pending.notifications });
      }
    }
    // Clear browser timeouts
    for (const tid of webTimeoutIds) clearTimeout(tid);
    webTimeoutIds = [];
    storage.save('scheduledAlarms', []);
  } catch (err) {
    console.warn('Failed to cancel alarms:', err);
  }
}

/**
 * Load notification settings.
 */
export function getNotificationSettings() {
  return storage.load('notificationSettings', {
    alertMinutes: 10,
    notifyRahu: true,
    notifyYama: true,
    notifyGulika: true,
    alarmSound: false,
    scheduleDays: 7,
  });
}

/**
 * Save notification settings.
 */
export function saveNotificationSettings(settings) {
  storage.save('notificationSettings', settings);
}
