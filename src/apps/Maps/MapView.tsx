import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  DEFAULT_CENTER,
  DEFAULT_ZOOM,
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
    <filter id="ds" x="-20%" y="-10%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="rgba(0,0,0,0.25)"/>
    </filter>
  </defs>
  <path d="M15 0C6.716 0 0 6.716 0 15c0 10.5 15 27 15 27s15-16.5 15-27C30 6.716 23.284 0 15 0z" fill="#007AFF" filter="url(#ds)"/>
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
const LOCATION_DOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <circle cx="11" cy="11" r="11" fill="rgba(0,122,255,0.15)"/>
  <circle cx="11" cy="11" r="6" fill="#007AFF" stroke="white" stroke-width="2.5"/>
</svg>`;

const locationIcon = L.divIcon({
  html: LOCATION_DOT_SVG,
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

// ---------------------------------------------------------------------------
// Map event handler — syncs store
// ---------------------------------------------------------------------------

function MapEventHandler() {
  const setMapView = useMapsStore((s) => s.setMapView);

  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const c = map.getCenter();
      setMapView([c.lat, c.lng], map.getZoom());
    },
  });

  return null;
}

// ---------------------------------------------------------------------------
// FlyTo — animated view transition
// ---------------------------------------------------------------------------

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  const prevCenter = useRef(center);

  useEffect(() => {
    if (prevCenter.current[0] !== center[0] || prevCenter.current[1] !== center[1]) {
      map.flyTo(center, zoom, { duration: 1.2 });
      prevCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
}

// ---------------------------------------------------------------------------
// MapView
// ---------------------------------------------------------------------------

interface MapViewProps {
  selectedPlace: PlaceResult | null;
  searchResults: PlaceResult[];
  userLocation: [number, number] | null;
  flyTarget: { center: [number, number]; zoom: number } | null;
}

export function MapView({ selectedPlace, searchResults, userLocation, flyTarget }: MapViewProps) {
  const markers = selectedPlace ? [selectedPlace] : searchResults;

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
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

      {flyTarget && <FlyTo center={flyTarget.center} zoom={flyTarget.zoom} />}

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
