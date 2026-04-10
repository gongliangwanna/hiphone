import { create } from 'zustand';

export interface PlaceResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  type: string;
  category?: string;
  address?: string;
}

export type SheetMode = 'explore' | 'search' | 'detail';

interface MapsState {
  /** Bottom sheet mode */
  sheetMode: SheetMode;
  /** Search query text */
  query: string;
  /** Search results */
  results: PlaceResult[];
  /** Currently selected place */
  selectedPlace: PlaceResult | null;
  /** Whether search is in progress */
  searching: boolean;
  /** Map center [lat, lon] */
  mapCenter: [number, number];
  /** Map zoom level */
  mapZoom: number;

  setQuery: (q: string) => void;
  setResults: (results: PlaceResult[]) => void;
  setSearching: (v: boolean) => void;
  selectPlace: (place: PlaceResult | null) => void;
  setSheetMode: (mode: SheetMode) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  reset: () => void;
}

const INITIAL_STATE = {
  sheetMode: 'explore' as SheetMode,
  query: '',
  results: [],
  selectedPlace: null,
  searching: false,
  mapCenter: [31.2304, 121.4737] as [number, number],
  mapZoom: 13,
};

export const useMapsStore = create<MapsState>()((set) => ({
  ...INITIAL_STATE,

  setQuery: (query) => set({ query }),
  setResults: (results) => set({ results, searching: false }),
  setSearching: (searching) => set({ searching }),
  selectPlace: (place) =>
    set({
      selectedPlace: place,
      sheetMode: place ? 'detail' : 'explore',
    }),
  setSheetMode: (sheetMode) => set({ sheetMode }),
  setMapView: (mapCenter, mapZoom) => set({ mapCenter, mapZoom }),
  reset: () => set(INITIAL_STATE),
}));
