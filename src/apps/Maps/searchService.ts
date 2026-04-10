import { NOMINATIM_SEARCH_URL } from './mapConfig';
import type { PlaceResult } from './mapsStore';

/** Debounce timer handle */
let _timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Search places via Nominatim (OpenStreetMap geocoding).
 * Debounced to avoid rate-limiting.
 */
export function searchPlaces(
  query: string,
  viewbox?: { south: number; west: number; north: number; east: number },
): Promise<PlaceResult[]> {
  return new Promise((resolve, reject) => {
    if (_timer) clearTimeout(_timer);
    _timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          format: 'json',
          addressdetails: '1',
          limit: '15',
          'accept-language': 'zh-CN,zh,en',
        });
        if (viewbox) {
          params.set('viewbox', `${viewbox.west},${viewbox.north},${viewbox.east},${viewbox.south}`);
          params.set('bounded', '0');
        }

        const res = await fetch(`${NOMINATIM_SEARCH_URL}?${params}`, {
          headers: { 'User-Agent': 'hiPhone-Maps/1.0' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const results: PlaceResult[] = data.map((item: Record<string, unknown>) => ({
          id: String(item.place_id),
          name: String(item.name || item.display_name || '').split(',')[0],
          displayName: String(item.display_name || ''),
          lat: Number(item.lat),
          lon: Number(item.lon),
          type: String(item.type || ''),
          category: String(item.category || ''),
          address: formatAddress(item.address as Record<string, string> | undefined),
        }));
        resolve(results);
      } catch (err) {
        reject(err);
      }
    }, 350);
  });
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
