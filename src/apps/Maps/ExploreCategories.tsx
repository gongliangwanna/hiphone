import { EXPLORE_CATEGORIES, type ExploreCategory } from './mapConfig';

// ---------------------------------------------------------------------------
// ExploreCategories — horizontal scroll of place categories
// ---------------------------------------------------------------------------

interface ExploreCategoriesProps {
  onSelect: (cat: ExploreCategory) => void;
}

export function ExploreCategories({ onSelect }: ExploreCategoriesProps) {
  return (
    <div style={{ padding: '16px 0 8px' }}>
      <div
        className="overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex" style={{ padding: '0 16px', gap: 10 }}>
          {EXPLORE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat)}
              className="flex flex-col items-center"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: 0,
                minWidth: 64,
                gap: 6,
                flexShrink: 0,
              }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: cat.color,
                  fontSize: 24,
                }}
              >
                {cat.icon}
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--color-label)',
                  lineHeight: 1.2,
                }}
              >
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FavoritesList — nearby favorites (static for now)
// ---------------------------------------------------------------------------

const FAVORITES = [
  { name: '东方明珠', desc: '上海市浦东新区世纪大道1号', distance: '3.2 公里' },
  { name: '外滩', desc: '上海市黄浦区中山东一路', distance: '1.8 公里' },
  { name: '豫园', desc: '上海市黄浦区安仁街137号', distance: '2.1 公里' },
];

export function FavoritesList() {
  return (
    <div style={{ padding: '8px 0' }}>
      <div
        style={{
          padding: '0 16px 8px',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-label)',
        }}
      >
        附近的地点
      </div>
      {FAVORITES.map((fav, i) => (
        <div key={fav.name}>
          {i > 0 && (
            <div
              style={{
                height: 0.5,
                background: 'var(--color-separator)',
                marginLeft: 16,
              }}
            />
          )}
          <div
            className="flex items-center"
            style={{
              padding: '12px 16px',
              gap: 12,
              cursor: 'pointer',
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: 'var(--color-systemBlue)',
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
                }}
              >
                {fav.name}
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
                {fav.desc}
              </span>
            </div>
            <span
              style={{
                fontSize: 13,
                color: 'var(--color-tertiaryLabel)',
                flexShrink: 0,
              }}
            >
              {fav.distance}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
