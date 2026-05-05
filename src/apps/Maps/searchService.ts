import { NOMINATIM_REVERSE_URL, NOMINATIM_SEARCH_URL } from './mapConfig';
import type { PlaceResult } from './mapsStore';

/**
 * Search places via Nominatim (OpenStreetMap geocoding).
 * No internal debouncing — callers are responsible for debounce.
 * Pass `center` to bias results toward that location.
 */
export async function searchPlaces(
  query: string,
  center?: [number, number],
): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    limit: '15',
    'accept-language': 'zh-CN,zh,en',
  });

  // Restrict results to area around the current map center (~100km radius)
  if (center) {
    const [lat, lon] = center;
    const d = 1.0; // ~111km latitude, ~85-100km longitude
    params.set('viewbox', `${lon - d},${lat - d},${lon + d},${lat + d}`);
    params.set('bounded', '1');
  }

  const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
    headers: { 'User-Agent': 'hiPhone-Maps/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  return data.map((item: Record<string, unknown>) => placeFromNominatim(item));
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<PlaceResult> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
    'accept-language': 'zh-CN,zh,en',
  });

  const res = await fetch(`${NOMINATIM_REVERSE_URL}?${params}`, {
    headers: { 'User-Agent': 'hiPhone-Maps/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const item = (await res.json()) as Record<string, unknown>;
  return placeFromNominatim(item, latitude, longitude);
}

function placeFromNominatim(
  item: Record<string, unknown>,
  fallbackLat?: number,
  fallbackLon?: number,
): PlaceResult {
  const address = item.address as Record<string, string> | undefined;
  const displayName = String(item.display_name || '');
  return {
    id: String(item.place_id || `${fallbackLat ?? item.lat},${fallbackLon ?? item.lon}`),
    name: resolvePlaceName(item, address),
    displayName,
    lat: Number(item.lat ?? fallbackLat),
    lon: Number(item.lon ?? fallbackLon),
    type: String(item.type || ''),
    category: String(item.category || ''),
    address: formatAddress(address),
  };
}

function resolvePlaceName(item: Record<string, unknown>, addr?: Record<string, string>): string {
  const directName = String(item.name || '').trim();
  if (directName) return directName;
  const fromAddress = [
    addr?.amenity,
    addr?.tourism,
    addr?.leisure,
    addr?.shop,
    addr?.building,
    addr?.road,
    addr?.neighbourhood,
    addr?.suburb,
    addr?.city_district,
    addr?.city,
    addr?.town,
    addr?.village,
  ].find((part) => part?.trim());
  if (fromAddress) return fromAddress;
  return String(item.display_name || '').split(',')[0] || '当前位置';
}

function formatAddress(addr?: Record<string, string>): string {
  if (!addr) return '';
  const parts = [
    addr.road,
    addr.neighbourhood || addr.suburb,
    addr.city_district,
    addr.city || addr.town || addr.village,
    addr.state || addr.province,
    addr.country,
  ].filter(Boolean);
  return [...new Set(parts)].join(', ');
}
