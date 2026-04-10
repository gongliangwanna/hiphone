import type { PlaceResult } from './mapsStore';

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
                backgroundColor: 'var(--color-systemRed)',
                flexShrink: 0,
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="12" cy="10" r="3" stroke="white" strokeWidth="2" />
              </svg>
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
