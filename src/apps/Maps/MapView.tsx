import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MIN_ZOOM,
  MAX_ZOOM,
  TILE_URL,
  TILE_ATTRIBUTION,
} from './mapConfig';
import { useMapsStore, type PlaceResult } from './mapsStore';

// ---------------------------------------------------------------------------
// Custom marker icon (iOS-style blue pin)
// ---------------------------------------------------------------------------

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
  <defs>
    <filter id="ds" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="#FF3B30" filter="url(#ds)"/>
  <circle cx="15" cy="14" r="6" fill="white"/>
</svg>`;

const markerIcon = L.divIcon({
  html: PIN_SVG,
  className: '',
  iconSize: [30, 42],
  iconAnchor: [15, 42],
  popupAnchor: [0, -42],
});

// Blue dot for current location
const LOCATION_DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" style="overflow: visible;">
  <style>
    @keyframes pulse-ring {
      0% { transform: scale(0.3); opacity: 0.8; }
      80%, 100% { transform: scale(2); opacity: 0; }
    }
  </style>
  <circle cx="30" cy="30" r="16" fill="#007AFF" opacity="0.4" style="transform-origin: 30px 30px; animation: pulse-ring 2.5s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;"/>
  <circle cx="30" cy="30" r="9" fill="#007AFF" stroke="white" stroke-width="3.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.2))" />
</svg>`;

const locationIcon = L.divIcon({
  html: LOCATION_DOT_SVG,
  className: '',
  iconSize: [60, 60],
  iconAnchor: [30, 30],
});

// ---------------------------------------------------------------------------
// Map event handler — syncs store
// ---------------------------------------------------------------------------

function MapEventHandler() {
  const map = useMap();
  const setMapView = useMapsStore((s) => s.setMapView);

  // Sync store on mount — Leaflet doesn't fire moveend on initial creation,
  // so without this the store can retain a stale center from a previous session.
  useEffect(() => {
    const c = map.getCenter();
    setMapView([c.lat, c.lng], map.getZoom());
  }, [map, setMapView]);

  useMapEvents({
    moveend: (e) => {
      const m = e.target;
      const c = m.getCenter();
      setMapView([c.lat, c.lng], m.getZoom());
    },
  });

  return null;
}

// ---------------------------------------------------------------------------
// TileLoadingBar — thin iOS-style progress bar while tiles load
// ---------------------------------------------------------------------------

function TileLoadingBar() {
  const map = useMap();
  const [loading, setLoading] = useState(true);
  const pendingRef = useRef(0);

  useEffect(() => {
    const onLoading = () => {
      pendingRef.current += 1;
      setLoading(true);
    };
    const onLoad = () => {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (pendingRef.current === 0) setLoading(false);
    };
    const onTileLoadStart = () => {
      pendingRef.current += 1;
      setLoading(true);
    };
    const onTileLoad = () => {
      pendingRef.current = Math.max(0, pendingRef.current - 1);
      if (pendingRef.current === 0) setLoading(false);
    };

    map.on('loading', onLoading);
    map.on('load', onLoad);
    map.on('tileloadstart', onTileLoadStart);
    map.on('tileload', onTileLoad);
    map.on('tileerror', onTileLoad);

    // Clear initial loading after short delay if no tile events
    const initTimer = setTimeout(() => {
      if (pendingRef.current === 0) setLoading(false);
    }, 2000);

    return () => {
      clearTimeout(initTimer);
      map.off('loading', onLoading);
      map.off('load', onLoad);
      map.off('tileloadstart', onTileLoadStart);
      map.off('tileload', onTileLoad);
      map.off('tileerror', onTileLoad);
    };
  }, [map]);

  if (!loading) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 1000,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '40%',
          height: '100%',
          backgroundColor: '#007AFF',
          borderRadius: 2,
          animation: 'maps-tile-load 1.2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes maps-tile-load {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlyTo — animated view transition. Uses `key` to handle re-selection
// of the same location (same coordinates but new key = new fly).
// ---------------------------------------------------------------------------

function FlyTo({ center, zoom, triggerKey }: { center: [number, number]; zoom: number; triggerKey: number }) {
  const map = useMap();
  const prevKey = useRef(-1);

  useEffect(() => {
    if (prevKey.current !== triggerKey) {
      map.flyTo(center, zoom, { duration: 1.2 });
      prevKey.current = triggerKey;
    }
  }, [center, zoom, triggerKey, map]);

  return null;
}

// ---------------------------------------------------------------------------
// MapView
// ---------------------------------------------------------------------------

interface MapViewProps {
  selectedPlace: PlaceResult | null;
  searchResults: PlaceResult[];
  userLocation: [number, number] | null;
  flyTarget: { center: [number, number]; zoom: number; key: number } | null;
}

export function MapView({ selectedPlace, searchResults, userLocation, flyTarget }: MapViewProps) {
  const markers = selectedPlace ? [selectedPlace] : searchResults;

  // Read store once on mount — MapContainer's center/zoom are immutable after creation.
  // This ensures re-mounts (going home then reopening) resume at the user's last position
  // instead of always resetting to the hardcoded Shanghai default.
  const [initialCenter] = useState(() => useMapsStore.getState().mapCenter);
  const [initialZoom] = useState(() => useMapsStore.getState().mapZoom);

  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      zoomControl={false}
      attributionControl={false}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        background: '#f2f1ed',
      }}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
      <MapEventHandler />
      <TileLoadingBar />

      {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} triggerKey={flyTarget.key} />}

      {/* User location blue dot */}
      {userLocation && (
        <Marker position={userLocation} icon={locationIcon} />
      )}

      {/* Place markers */}
      {markers.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lon]} icon={markerIcon}>
          <Popup>
            <div style={{ fontSize: 14, fontWeight: 600, minWidth: 120 }}>{place.name}</div>
            {place.address && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{place.address}</div>
            )}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
