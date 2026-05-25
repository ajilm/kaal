import './styles.css';
import { getKaalTimings, getWeekTimings } from './kaal.js';
import {
  getCurrentLocation,
  getLocationName,
  searchCities,
  getSavedLocation,
  saveLocation,
} from './location.js';
import {
  requestPermission,
  scheduleMultiDay,
  getNotificationSettings,
  saveNotificationSettings,
  getScheduledAlarms,
  cancelAllAlarms,
} from './notifications.js';
import {
  renderKaalCards,
  renderSunTimes,
  startCountdown,
  renderWeekTable,
  renderDate,
  renderDateNav,
  renderLocationName,
  setupNavigation,
  setupThemeToggle,
  showLocationModal,
  hideLocationModal,
  setWeekRowTapHandler,
  switchToView,
} from './ui.js';
import * as storage from './storage.js';

// App state
let currentLocation = null;
let todayTimings = null;
let selectedDate = new Date();

/**
 * Main initialization
 */
async function init() {
  setupNavigation();
  setupThemeToggle();
  setupSettingsUI();
  setupLocationModal();
  setupDateNav();

  // Load saved location
  currentLocation = getSavedLocation();
  renderLocationName(currentLocation.name);
  refreshTimings();

  // Try GPS on first launch
  const hasLaunched = storage.load('hasLaunched', false);
  if (!hasLaunched) {
    storage.save('hasLaunched', true);
    showLocationModal();
  }

  // Auto-reschedule alarms daily (or on first open)
  const lastScheduled = storage.load('lastScheduledDate');
  if (lastScheduled !== new Date().toDateString() && currentLocation) {
    const settings = getNotificationSettings();
    const granted = await requestPermission();
    if (granted) {
      await scheduleMultiDay(currentLocation.lat, currentLocation.lng, settings);
    }
  }

  renderAlarmList();
}

/**
 * Recalculate and re-render timings for the selected date and current location.
 */
function refreshTimings() {
  const dateForCalc = new Date(selectedDate);
  dateForCalc.setHours(12, 0, 0, 0);

  const timings = getKaalTimings(dateForCalc, currentLocation.lat, currentLocation.lng);

  // Keep todayTimings in sync for notifications (always today)
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  todayTimings = getKaalTimings(today, currentLocation.lat, currentLocation.lng);

  renderDate(selectedDate);
  renderDateNav(selectedDate);
  renderSunTimes(timings);
  renderKaalCards(timings, selectedDate);
  startCountdown(timings, selectedDate);

  // Week view always shows 7 days from today
  const weekTimings = getWeekTimings(currentLocation.lat, currentLocation.lng, 7);
  renderWeekTable(weekTimings);

  storage.save('lastTimingsDate', today.toDateString());
}

/**
 * Navigate to a specific date and re-render.
 */
function goToDate(date) {
  selectedDate = new Date(date);
  refreshTimings();
}

/**
 * Setup date navigation (prev/next arrows, date display tap, date picker).
 */
function setupDateNav() {
  // Previous day
  document.getElementById('date-prev').addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() - 1);
    refreshTimings();
  });

  // Next day
  document.getElementById('date-next').addEventListener('click', () => {
    selectedDate.setDate(selectedDate.getDate() + 1);
    refreshTimings();
  });

  // Tap date display: open native date picker
  const datePicker = document.getElementById('date-picker');
  document.getElementById('date-display').addEventListener('click', () => {
    datePicker.showPicker?.();
    datePicker.click();
  });

  // Date picker change
  datePicker.addEventListener('change', (e) => {
    if (e.target.value) {
      // Parse YYYY-MM-DD (local timezone)
      const [y, m, d] = e.target.value.split('-').map(Number);
      goToDate(new Date(y, m - 1, d));
    }
  });

  // Week row tap: navigate to that date and switch to Today view
  setWeekRowTapHandler((date) => {
    goToDate(date);
    switchToView('today');
  });
}

/**
 * Update location, re-render, and persist.
 */
async function setLocation(lat, lng, name) {
  currentLocation = { lat, lng, name };
  saveLocation(currentLocation);
  renderLocationName(name);
  refreshTimings();
}

/**
 * Setup location modal handlers.
 */
function setupLocationModal() {
  document.getElementById('modal-allow').addEventListener('click', async () => {
    hideLocationModal();
    const coords = await getCurrentLocation();
    if (coords) {
      const name = await getLocationName(coords.lat, coords.lng);
      await setLocation(coords.lat, coords.lng, name);
    }
  });

  document.getElementById('modal-deny').addEventListener('click', () => {
    hideLocationModal();
  });

  document.querySelector('.modal-backdrop')?.addEventListener('click', () => {
    hideLocationModal();
  });

  // Location chip opens settings view with search focused
  document.getElementById('location-btn').addEventListener('click', () => {
    switchToView('settings');
    document.getElementById('city-search').focus();
  });
}

/**
 * Setup settings page interactions.
 */
function setupSettingsUI() {
  // City search with debounce and race condition guard
  let searchTimeout = null;
  let searchRequestId = 0;
  const searchInput = document.getElementById('city-search');
  const searchResults = document.getElementById('search-results');

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    if (query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }
    searchTimeout = setTimeout(async () => {
      const thisRequest = ++searchRequestId;
      const results = await searchCities(query);
      // Discard if a newer request has been made
      if (thisRequest !== searchRequestId) return;
      if (results.length === 0) {
        searchResults.classList.add('hidden');
        return;
      }

      searchResults.innerHTML = '';
      results.forEach((r, i) => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.dataset.index = i;
        item.textContent = r.display; // Safely sets text, preventing XSS
        searchResults.appendChild(item);
      });

      searchResults.classList.remove('hidden');

      // Attach click handlers
      searchResults.querySelectorAll('.search-result-item').forEach((el) => {
        el.addEventListener('click', async () => {
          const idx = parseInt(el.dataset.index);
          const chosen = results[idx];
          await setLocation(chosen.lat, chosen.lng, chosen.name);
          searchInput.value = '';
          searchResults.classList.add('hidden');
          switchToView('today');
        });
      });
    }, 500);
  });

  // Close search results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) {
      searchResults.classList.add('hidden');
    }
  });

  // GPS button
  document.getElementById('gps-btn').addEventListener('click', async () => {
    const btn = document.getElementById('gps-btn');
    btn.textContent = 'Locating...';
    btn.disabled = true;
    const coords = await getCurrentLocation();
    if (coords) {
      const name = await getLocationName(coords.lat, coords.lng);
      await setLocation(coords.lat, coords.lng, name);
    } else {
      btn.textContent = 'Location unavailable';
    }
    setTimeout(() => {
      btn.innerHTML = '<span>📍</span> Use Current Location';
      btn.disabled = false;
    }, 2000);
  });

  // Load notification settings into UI
  const settings = getNotificationSettings();
  document.getElementById('alert-minutes').value = settings.alertMinutes;
  document.getElementById('schedule-days').value = settings.scheduleDays;
  document.getElementById('alarm-sound').checked = settings.alarmSound;
  document.getElementById('notify-rahu').checked = settings.notifyRahu;
  document.getElementById('notify-yama').checked = settings.notifyYama;
  document.getElementById('notify-gulika').checked = settings.notifyGulika;

  // Save & schedule button
  document.getElementById('save-notifications').addEventListener('click', async () => {
    const newSettings = {
      alertMinutes: parseInt(document.getElementById('alert-minutes').value),
      scheduleDays: parseInt(document.getElementById('schedule-days').value),
      alarmSound: document.getElementById('alarm-sound').checked,
      notifyRahu: document.getElementById('notify-rahu').checked,
      notifyYama: document.getElementById('notify-yama').checked,
      notifyGulika: document.getElementById('notify-gulika').checked,
    };
    saveNotificationSettings(newSettings);

    const granted = await requestPermission();
    if (granted && currentLocation) {
      const btn = document.getElementById('save-notifications');
      btn.textContent = 'Scheduling...';
      btn.disabled = true;
      await scheduleMultiDay(currentLocation.lat, currentLocation.lng, newSettings);
      renderAlarmList();
      btn.textContent = 'Scheduled!';
      btn.disabled = false;
      setTimeout(() => {
        btn.textContent = 'Save & Schedule Alarms';
      }, 2000);
    } else {
      const btn = document.getElementById('save-notifications');
      btn.textContent = 'Permission denied';
      setTimeout(() => {
        btn.textContent = 'Save & Schedule Alarms';
      }, 2000);
    }
  });

  // Cancel all alarms button
  document.getElementById('cancel-alarms').addEventListener('click', async () => {
    await cancelAllAlarms();
    renderAlarmList();
    const btn = document.getElementById('cancel-alarms');
    btn.textContent = 'All alarms cancelled';
    setTimeout(() => {
      btn.textContent = 'Cancel All Alarms';
    }, 2000);
  });
}

/**
 * Render the list of upcoming scheduled alarms in Settings.
 */
function renderAlarmList() {
  const container = document.getElementById('alarm-list');
  const alarms = getScheduledAlarms();

  if (alarms.length === 0) {
    container.innerHTML = '<p class="alarm-empty">No upcoming alarms scheduled.</p>';
    return;
  }

  container.innerHTML = '';
  alarms.forEach((a) => {
    const at = new Date(a.at);
    const time = at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const date = at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    const alarmItem = document.createElement('div');
    alarmItem.className = 'alarm-item';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'alarm-time';
    timeSpan.textContent = time;

    const detailDiv = document.createElement('div');
    detailDiv.className = 'alarm-detail';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'alarm-title';
    if (a.title.includes('Rahu')) titleDiv.classList.add('rahu');
    else if (a.title.includes('Yama')) titleDiv.classList.add('yama');
    else if (a.title.includes('Gulika')) titleDiv.classList.add('gulika');
    titleDiv.textContent = a.title;

    const dateDiv = document.createElement('div');
    dateDiv.className = 'alarm-date';
    dateDiv.textContent = date;

    detailDiv.appendChild(titleDiv);
    detailDiv.appendChild(dateDiv);
    alarmItem.appendChild(timeSpan);
    alarmItem.appendChild(detailDiv);
    container.appendChild(alarmItem);
  });
}

// Start the app
init();
