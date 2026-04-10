import { useState, useMemo } from 'react';
import { allPhotos } from '../photosData';
import { usePhotosStore } from '../photosStore';

interface CategorySuggestion {
  label: string;
  icon: React.ReactNode;
  /** Sample photo IDs to show in the category preview */
  sampleIds: number[];
}

const CATEGORIES: CategorySuggestion[] = [
  {
    label: '人物',
    icon: <PersonIcon />,
    sampleIds: [1, 2, 3, 5],
  },
  {
    label: '地点',
    icon: <LocationIcon />,
    sampleIds: [6, 7, 8, 10],
  },
  {
    label: '类别',
    icon: <CategoryIcon />,
    sampleIds: [11, 12, 13, 14],
  },
];

export function SearchTab() {
  const openPhoto = usePhotosStore((s) => s.openPhoto);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    // Simple mock search: return photos whose IDs contain the query digit
    return allPhotos.filter((p) => String(p.id).includes(query.trim()));
  }, [query]);

  const showResults = query.trim().length > 0;

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
      data-testid="photos-search"
    >
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-label)', margin: 0 }}>
          搜索
        </h1>
      </div>

      {/* Search bar */}
      <div style={{ paddingInline: 20, marginBottom: 20 }}>
        <div
          className="flex items-center"
          style={{
            height: 36,
            borderRadius: 10,
            backgroundColor: 'var(--color-tertiarySystemFill)',
            paddingInline: 8,
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle
              cx="11" cy="11" r="7"
              stroke="var(--color-secondaryLabel)" strokeWidth="1.8" strokeLinecap="round"
            />
            <path
              d="M16.5 16.5L21 21"
              stroke="var(--color-secondaryLabel)" strokeWidth="1.8" strokeLinecap="round"
            />
          </svg>
          <input
            type="text"
            placeholder="搜索照片"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none"
            style={{
              fontSize: 16,
              color: 'var(--color-label)',
              border: 'none',
            }}
            data-testid="photos-search-input"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="flex items-center justify-center"
              style={{ minWidth: 20, minHeight: 20 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" fill="var(--color-secondaryLabel)" />
                <path d="M8 8l8 8M16 8l-8 8" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {showResults ? (
        /* Search results grid */
        <div style={{ paddingInline: 20 }}>
          {filtered.length > 0 ? (
            <>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-secondaryLabel)',
                  marginBottom: 8,
                }}
              >
                {filtered.length} 个结果
              </div>
              <div
                className="grid"
                style={{
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 1,
                }}
              >
                {filtered.map((photo) => (
                  <button
                    key={photo.id}
                    className="relative block w-full"
                    style={{ aspectRatio: '1', overflow: 'hidden' }}
                    onClick={() => openPhoto(photo.id)}
                  >
                    <img
                      src={photo.thumbnail}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div
              className="flex items-center justify-center"
              style={{ height: 200 }}
            >
              <span style={{ fontSize: 15, color: 'var(--color-secondaryLabel)' }}>
                无结果
              </span>
            </div>
          )}
        </div>
      ) : (
        /* Category suggestions */
        <div style={{ paddingInline: 20 }}>
          {CATEGORIES.map((cat) => (
            <div key={cat.label} style={{ marginBottom: 24 }}>
              <div className="flex items-center" style={{ gap: 8, marginBottom: 10 }}>
                {cat.icon}
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: 'var(--color-label)',
                  }}
                >
                  {cat.label}
                </span>
              </div>
              <div
                className="flex gap-2 overflow-x-auto"
                style={{ scrollbarWidth: 'none' }}
              >
                {cat.sampleIds.map((id) => {
                  const photo = allPhotos.find((p) => p.id === id);
                  if (!photo) return null;
                  return (
                    <button
                      key={id}
                      className="shrink-0"
                      style={{
                        width: 100,
                        height: 100,
                        borderRadius: 8,
                        overflow: 'hidden',
                      }}
                      onClick={() => openPhoto(id)}
                    >
                      <img
                        src={photo.thumbnail}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: 20 }} />
    </div>
  );
}

/* ── SF Symbol style category icons ── */

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
        stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round"
      />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
        stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="12" cy="9" r="2.5" stroke="var(--color-systemBlue)" strokeWidth="1.6" />
    </svg>
  );
}

function CategoryIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke="var(--color-systemBlue)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
