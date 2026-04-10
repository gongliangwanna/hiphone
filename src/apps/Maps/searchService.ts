import { NOMINATIM_SEARCH_URL } from './mapConfig';
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
  return data.map((item: Record<string, unknown>) => ({
    id: String(item.place_id),
    name: String(item.name || item.display_name || '').split(',')[0],
    displayName: String(item.display_name || ''),
    lat: Number(item.lat),
    lon: Number(item.lon),
    type: String(item.type || ''),
    category: String(item.category || ''),
    address: formatAddress(item.address as Record<string, string> | undefined),
  }));
}

function formatAddress(addr?: Record<string, string>): string {
  if (!addr) return '';
  const parts = [
    addr.city || addr.town || addr.village,
    addr.state || addr.province,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}
