import {
  UtensilsCrossed,
  Coffee,
  Fuel,
  ShoppingBag,
  Bed,
  SquareParking,
  Cross,
  Pill,
} from 'lucide-react';
import { EXPLORE_CATEGORIES, type ExploreCategory } from './mapConfig';

// ---------------------------------------------------------------------------
// Category icon mapping (lucide-react)
// ---------------------------------------------------------------------------

const ICON_SIZE = 22;
const ICON_SW = 1.8;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'fork.knife': <UtensilsCrossed size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  cup: <Coffee size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  fuelpump: <Fuel size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  bag: <ShoppingBag size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  bed: <Bed size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  parking: <SquareParking size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  cross: <Cross size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
  pills: <Pill size={ICON_SIZE} strokeWidth={ICON_SW} color="white" />,
};

// ---------------------------------------------------------------------------
// ExploreCategories — adaptive 2×4 grid (iOS Maps style)
// ---------------------------------------------------------------------------

interface ExploreCategoriesProps {
  onSelect: (cat: ExploreCategory) => void;
}

export function ExploreCategories({ onSelect }: ExploreCategoriesProps) {
  return (
    <div style={{ padding: '12px 0 0' }}>
      {/* Section header */}
      <div
        style={{
          padding: '0 16px 10px',
          fontSize: 20,
          fontWeight: 700,
          color: 'var(--color-label)',
        }}
      >
        附近热门
      </div>

      {/* Adaptive 2×4 grid — columns stretch to fill width */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '14px 0',
          padding: '0 12px 12px',
        }}
      >
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
              gap: 6,
            }}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                backgroundColor: cat.color,
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              }}
            >
              {CATEGORY_ICONS[cat.iconId]}
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: 'var(--color-label)',
                lineHeight: 1.2,
                marginTop: 2,
              }}
            >
              {cat.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
