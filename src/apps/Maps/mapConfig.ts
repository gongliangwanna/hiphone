import type { LatLngExpression } from 'leaflet';

/** Default center: Shanghai */
export const DEFAULT_CENTER: LatLngExpression = [31.2304, 121.4737];
export const DEFAULT_ZOOM = 13;
export const MIN_ZOOM = 3;
export const MAX_ZOOM = 18;

/** Light-style tile — close to Apple Maps look */
export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
export const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

/** Explore category definitions */
export interface ExploreCategory {
  id: string;
  label: string;
  /** SF Symbol icon identifier — mapped to SVG in ExploreCategories */
  iconId: string;
  color: string;
  query: string;
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { id: 'restaurant', label: '餐厅', iconId: 'fork.knife', color: '#FF9500', query: 'restaurant' },
  { id: 'coffee', label: '咖啡', iconId: 'cup', color: '#A2845E', query: 'cafe' },
  { id: 'gas', label: '加油站', iconId: 'fuelpump', color: '#34C759', query: 'fuel' },
  { id: 'shopping', label: '购物', iconId: 'bag', color: '#007AFF', query: 'mall' },
  { id: 'hotel', label: '酒店', iconId: 'bed', color: '#5856D6', query: 'hotel' },
  { id: 'parking', label: '停车场', iconId: 'parking', color: '#007AFF', query: 'parking' },
  { id: 'hospital', label: '医院', iconId: 'cross', color: '#FF3B30', query: 'hospital' },
  { id: 'pharmacy', label: '药店', iconId: 'pills', color: '#34C759', query: 'pharmacy' },
];

/** Nominatim API */
export const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
export const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';

/** Sheet snap points (fraction of screen height visible) */
export const SHEET_PEEK = 0.48; // collapsed — search bar + 2-row categories + favorites
export const SHEET_EXPANDED = 0.85; // expanded — full results
export const SHEET_MINI = 0.12; // minimized — just the handle + search hint
