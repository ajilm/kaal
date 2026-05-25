import * as storage from './storage.js';

// Default: Chennai, India
const DEFAULT_LOCATION = { lat: 13.0827, lng: 80.2707, name: 'Chennai' };

function checkNative() {
  try {
    // @capacitor/core sets window.Capacitor when running natively
    return window.Capacitor?.isNativePlatform?.() ?? false;
  } catch {
    return false;
  }
}

/**
 * Get current GPS coordinates.
 * Uses Capacitor on native, browser Geolocation API on web.
 */
export async function getCurrentLocation() {
  try {
    if (checkNative()) {
      const { Geolocation } = await import('@capacitor/geolocation');
      const perm = await Geolocation.requestPermissions();
      if (perm.location === 'denied') {
        throw new Error('Location permission denied');
      }
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
      return { lat: pos.coords.latitude, lng: pos.coords.longitude };
    }

    // Browser fallback
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, timeout: 10000 }
      );
    });
  } catch (err) {
    console.warn('GPS failed, using saved/default location:', err.message);
    return null;
  }
}

/**
 * Reverse geocode lat/lng to a city name via Nominatim.
 */
export async function getLocationName(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    const data = await res.json();
    return data.address?.city
      || data.address?.town
      || data.address?.village
      || data.address?.state
      || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Search cities by query via Nominatim.
 */
export async function searchCities(query) {
  if (!query || query.length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en' },
    });
    const data = await res.json();
    return data.map((item) => ({
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      name: item.address?.city || item.address?.town || item.address?.village || item.display_name.split(',')[0],
      display: item.display_name,
    }));
  } catch {
    return [];
  }
}

/**
 * Load saved location from storage, or return default.
 */
export function getSavedLocation() {
  return storage.load('location', DEFAULT_LOCATION);
}

/**
 * Save location to storage.
 */
export function saveLocation(location) {
  storage.save('location', location);
}

export { DEFAULT_LOCATION };
