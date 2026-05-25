import { formatTime, formatCountdown, getKaalStatus, getNextKaal, DAY_SHORT, DAY_NAMES } from './kaal.js';

let countdownInterval = null;
let cardRefreshInterval = null;

// Callback set by main.js when a week row is tapped
let onWeekRowTap = null;

/**
 * Register a callback for when a week table row is tapped.
 */
export function setWeekRowTapHandler(fn) {
  onWeekRowTap = fn;
}

/**
 * Render the three kaal cards for the Today view.
 * @param {object} timings
 * @param {Date} selectedDate - the date being viewed (to decide LIVE/ENDED badges)
 */
export function renderKaalCards(timings, selectedDate) {
  const container = document.getElementById('kaal-cards');
  if (!timings) {
    container.innerHTML = '<p class="error-msg">Unable to calculate timings for this location.</p>';
    return;
  }

  const isToday = isSameDay(selectedDate, new Date());

  const kaals = [
    { key: 'rahuKaal', label: 'Rahu Kaal', accent: 'rahu' },
    { key: 'yamagandam', label: 'Yamagandam', accent: 'yama' },
    { key: 'gulikaKaal', label: 'Gulika Kaal', accent: 'gulika' },
  ];

  container.innerHTML = kaals.map(({ key, label, accent }) => {
    const kaal = timings[key];
    // Only show live/ended status for today
    const status = isToday ? getKaalStatus(kaal) : 'upcoming';
    return `
      <div class="kaal-card ${accent} ${status}">
        <div class="kaal-card-header">
          <span class="kaal-label">${label}</span>
          ${status === 'active' ? '<span class="badge live">LIVE</span>' : ''}
          ${status === 'ended' ? '<span class="badge ended">ENDED</span>' : ''}
        </div>
        <div class="kaal-times">
          <span class="kaal-start">${formatTime(kaal.start)}</span>
          <span class="kaal-separator">—</span>
          <span class="kaal-end">${formatTime(kaal.end)}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Update the sunrise/sunset display.
 */
export function renderSunTimes(timings) {
  document.getElementById('sunrise-time').textContent = timings ? formatTime(timings.sunrise) : '--:--';
  document.getElementById('sunset-time').textContent = timings ? formatTime(timings.sunset) : '--:--';
}

/**
 * Start or stop the countdown timer based on selected date.
 */
export function startCountdown(timings, selectedDate) {
  if (countdownInterval) clearInterval(countdownInterval);
  if (cardRefreshInterval) clearInterval(cardRefreshInterval);

  const countdownSection = document.getElementById('countdown-section');
  const isToday = isSameDay(selectedDate, new Date());

  // Only show live countdown for today
  if (!isToday) {
    countdownSection.style.display = 'none';
    return;
  }

  countdownSection.style.display = '';

  const update = () => {
    const next = getNextKaal(timings);
    const labelEl = document.getElementById('countdown-label');
    const timerEl = document.getElementById('countdown-timer');

    if (!next) {
      labelEl.textContent = 'All kaals ended for today';
      timerEl.textContent = '--:--:--';
      clearInterval(countdownInterval);
      clearInterval(cardRefreshInterval);
      renderKaalCards(timings, selectedDate);
      return;
    }

    if (next.isActive) {
      labelEl.textContent = `${next.label} ends in`;
      const remaining = next.end.getTime() - Date.now();
      timerEl.textContent = formatCountdown(remaining);
      if (remaining <= 0) {
        renderKaalCards(timings, selectedDate);
      }
    } else {
      labelEl.textContent = `${next.label} starts in`;
      timerEl.textContent = formatCountdown(next.timeUntilStart);
    }
  };

  update();
  countdownInterval = setInterval(update, 1000);
  cardRefreshInterval = setInterval(() => renderKaalCards(timings, selectedDate), 30000);
}

/**
 * Render the date navigation display.
 */
export function renderDateNav(selectedDate) {
  const displayEl = document.getElementById('date-display');
  const textEl = document.getElementById('date-display-text');
  const today = new Date();
  const isToday = isSameDay(selectedDate, today);
  const isTomorrow = isSameDay(selectedDate, addDays(today, 1));
  const isYesterday = isSameDay(selectedDate, addDays(today, -1));

  let label;
  if (isToday) {
    label = 'Today';
  } else if (isTomorrow) {
    label = 'Tomorrow';
  } else if (isYesterday) {
    label = 'Yesterday';
  } else {
    label = selectedDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  textEl.textContent = label;

  if (isToday) {
    displayEl.classList.add('is-today');
  } else {
    displayEl.classList.remove('is-today');
  }

  // Sync the hidden date picker value
  const picker = document.getElementById('date-picker');
  picker.value = toISODate(selectedDate);
}

/**
 * Render the week view table. Rows are tappable.
 */
export function renderWeekTable(weekTimings) {
  const container = document.getElementById('week-table-container');
  if (!weekTimings || weekTimings.length === 0) {
    container.innerHTML = '<p class="error-msg">Unable to load weekly data.</p>';
    return;
  }

  const today = new Date().toDateString();

  const rows = weekTimings.map((t, idx) => {
    const dateStr = t.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const day = DAY_SHORT[t.date.getDay()];
    const isToday = t.date.toDateString() === today;
    return `
      <tr class="${isToday ? 'today-row' : ''}" data-week-idx="${idx}">
        <td class="week-day">
          <span class="week-day-name">${day}</span>
          <span class="week-date">${dateStr}</span>
        </td>
        <td class="week-rahu">${formatTime(t.rahuKaal.start)}<br/>${formatTime(t.rahuKaal.end)}</td>
        <td class="week-yama">${formatTime(t.yamagandam.start)}<br/>${formatTime(t.yamagandam.end)}</td>
        <td class="week-gulika">${formatTime(t.gulikaKaal.start)}<br/>${formatTime(t.gulikaKaal.end)}</td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="week-table">
      <thead>
        <tr>
          <th>Day</th>
          <th class="rahu-col">Rahu</th>
          <th class="yama-col">Yama</th>
          <th class="gulika-col">Gulika</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Attach row click handlers
  container.querySelectorAll('tr[data-week-idx]').forEach((row) => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.weekIdx);
      const tapped = weekTimings[idx];
      if (tapped && onWeekRowTap) {
        onWeekRowTap(tapped.date);
      }
    });
  });
}

/**
 * Update the header date display.
 */
export function renderDate(selectedDate) {
  const el = document.getElementById('current-date');
  const d = selectedDate || new Date();
  el.textContent = d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Update the location name chip.
 */
export function renderLocationName(name) {
  document.getElementById('location-name').textContent = name || 'Unknown';
}

/**
 * Setup bottom navigation view switching.
 */
export function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const target = item.dataset.view;

      navItems.forEach((n) => n.classList.remove('active'));
      item.classList.add('active');

      views.forEach((v) => {
        v.classList.toggle('active', v.id === `view-${target}`);
      });
    });
  });
}

/**
 * Switch to a specific view programmatically.
 */
export function switchToView(viewName) {
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById(`view-${viewName}`).classList.add('active');
}

/**
 * Setup dark/light theme toggle.
 */
export function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  const html = document.documentElement;

  // Load saved theme
  const savedTheme = localStorage.getItem('kaal_theme') || 'dark';
  html.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
  updateThemeColor(savedTheme);

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('kaal_theme', next);
    updateThemeIcon(next);
    updateThemeColor(next);
  });
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('.theme-icon');
  icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function updateThemeColor(theme) {
  const color = theme === 'dark' ? '#1a1a2e' : '#f0f0f5';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', color);
}

/**
 * Show/hide the location modal.
 */
export function showLocationModal() {
  document.getElementById('location-modal').classList.remove('hidden');
}

export function hideLocationModal() {
  document.getElementById('location-modal').classList.add('hidden');
}

/* ===== Helpers ===== */

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
