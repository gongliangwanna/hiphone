import type { LatLngExpression } from 'leaflet';

/** Default center: Shanghai */
export const DEFAULT_CENTER: LatLngExpression = [31.2304, 121.4737];
export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;

/** Light-style tile — close to Apple Maps look */
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

/** Explore category definitions */
export interface ExploreCategory {
  id: string;
  label: string;
  icon: string; // emoji fallback for simplicity
  color: string;
  query: string;
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { id: 'restaurant', label: '餐厅', icon: '🍽️', color: '#FF9500', query: 'restaurant' },
  { id: 'coffee', label: '咖啡', icon: '☕', color: '#A0522D', query: 'cafe' },
  { id: 'gas', label: '加油站', icon: '⛽', color: '#34C759', query: 'fuel' },
  { id: 'shopping', label: '购物', icon: '🛍️', color: '#AF52DE', query: 'mall' },
  { id: 'hotel', label: '酒店', icon: '🏨', color: '#007AFF', query: 'hotel' },
  { id: 'parking', label: '停车场', icon: '🅿️', color: '#5856D6', query: 'parking' },
  { id: 'hospital', label: '医院', icon: '🏥', color: '#FF3B30', query: 'hospital' },
  { id: 'pharmacy', label: '药店', icon: '💊', color: '#30D158', query: 'pharmacy' },
];

/** Nominatim API */
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/** Sheet snap points (fraction of screen height) */
export const SHEET_PEEK = 0.35; // collapsed — search bar + categories visible
export const SHEET_EXPANDED = 0.85; // expanded — full results
export const SHEET_MINI = 0.12; // minimized — just the handle + search hint
