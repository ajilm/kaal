const PREFIX = 'kaal_';

export function save(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable -- silently fail
  }
}

export function load(key, defaultValue = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw !== null ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Ignore
  }
}
