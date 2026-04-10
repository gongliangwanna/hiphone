import { MapPin } from 'lucide-react';
import type { PlaceResult } from './mapsStore';

// ---------------------------------------------------------------------------
// Category color mapping for search results
// ---------------------------------------------------------------------------

function getCategoryColor(category?: string, type?: string): string {
  const t = type?.toLowerCase() || '';
  const c = category?.toLowerCase() || '';

  if (['restaurant', 'fast_food', 'food_court', 'bbq'].includes(t) || c === 'restaurant')
    return '#FF9500';
  if (['cafe', 'coffee'].includes(t)) return '#A2845E';
  if (['fuel', 'charging_station'].includes(t)) return '#34C759';
  if (['parking', 'bicycle_parking'].includes(t)) return '#007AFF';
  if (c === 'shop' || ['mall', 'marketplace', 'supermarket'].includes(t)) return '#007AFF';
  if (['hotel', 'hostel', 'motel', 'guest_house'].includes(t) || c === 'tourism') return '#5856D6';
  if (['hospital', 'clinic', 'doctors'].includes(t)) return '#FF3B30';
  if (['pharmacy', 'chemist'].includes(t)) return '#34C759';
  if (['school', 'university', 'college', 'library'].includes(t)) return '#5856D6';

  return '#FF3B30';
}

// ---------------------------------------------------------------------------
// SearchResults — list of matching places
// ---------------------------------------------------------------------------

interface SearchResultsProps {
  results: PlaceResult[];
  searching: boolean;
  query: string;
  onSelect: (place: PlaceResult) => void;
}

export function SearchResults({ results, searching, query, onSelect }: SearchResultsProps) {
  if (searching) {
    return (
      <div className="flex flex-col items-center" style={{ padding: '32px 16px', gap: 8 }}>
        <div
          style={{
            width: 24,
            height: 24,
            border: '3px solid var(--color-separator)',
            borderTopColor: 'var(--color-systemBlue)',
            borderRadius: '50%',
            animation: 'maps-spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: 15, color: 'var(--color-secondaryLabel)' }}>搜索中...</span>
        <style>{`@keyframes maps-spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (query && results.length === 0) {
    return (
      <div className="flex flex-col items-center" style={{ padding: '32px 16px', gap: 4 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: 'var(--color-label)' }}>
          无结果
        </span>
        <span style={{ fontSize: 15, color: 'var(--color-secondaryLabel)' }}>
          未找到"{query}"的相关地点
        </span>
      </div>
    );
  }

  return (
    <div>
      {results.map((place, i) => (
        <div key={place.id}>
          {i > 0 && (
            <div
              style={{
                height: 0.5,
                background: 'var(--color-separator)',
                marginLeft: 52,
              }}
            />
          )}
          <button
            onClick={() => onSelect(place)}
            className="flex w-full items-center text-left"
            style={{
              padding: '10px 16px',
              gap: 12,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: getCategoryColor(place.category, place.type),
                flexShrink: 0,
              }}
            >
              <MapPin size={18} strokeWidth={2} color="white" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: 'var(--color-label)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {place.name}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: 'var(--color-secondaryLabel)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {place.address || place.displayName}
              </span>
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
