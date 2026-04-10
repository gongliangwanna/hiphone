import type { PhotosTab } from './photosStore';
import { Material } from '@/system';

const ACTIVE_COLOR = 'var(--color-systemBlue)';
const INACTIVE_COLOR = '#8E8E93';

interface TabDef {
  key: PhotosTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const tabDefs: TabDef[] = [
  {
    key: 'library',
    label: '图库',
    icon: (active) => <LibraryIcon color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />,
  },
  {
    key: 'foryou',
    label: '为你推荐',
    icon: (active) => <ForYouIcon color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />,
  },
  {
    key: 'albums',
    label: '相簿',
    icon: (active) => <AlbumsIcon color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />,
  },
  {
    key: 'search',
    label: '搜索',
    icon: (active) => <SearchIcon color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />,
  },
];

interface PhotosTabBarProps {
  activeTab: PhotosTab;
  onTabChange: (tab: PhotosTab) => void;
}

export function PhotosTabBar({ activeTab, onTabChange }: PhotosTabBarProps) {
  return (
    <Material
      variant="chrome"
      className="flex shrink-0 items-center justify-around"
      style={{
        height: 49,
        borderTop: '0.5px solid var(--color-separator)',
      }}
    >
      {tabDefs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            className="relative flex flex-col items-center justify-center"
            style={{ flex: 1, minHeight: 44, gap: 2 }}
            onClick={() => onTabChange(tab.key)}
            data-testid={`photos-tab-${tab.key}`}
          >
            {tab.icon(isActive)}
            <span
              style={{
                fontSize: 10,
                color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </Material>
  );
}

/* ── SF Symbol style tab icons ── */

function LibraryIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* photo.on.rectangle — stacked photo frames */}
      <rect
        x="3" y="5" width="18" height="14" rx="2"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M3 15l5-4 3 3 4-5 6 6"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <circle cx="8.5" cy="10" r="1.5" stroke={color} strokeWidth="1.4" />
    </svg>
  );
}

function ForYouIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* heart icon */}
      <path
        d="M12 21s-7-4.35-7-10A4.5 4.5 0 0112 7.5 4.5 4.5 0 0119 11c0 5.65-7 10-7 10z"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function AlbumsIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {/* rectangle.stack — stacked rectangles */}
      <rect
        x="4" y="6" width="16" height="13" rx="2"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M6 6V5a2 2 0 012-2h8a2 2 0 012 2v1"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle
        cx="11" cy="11" r="7"
        stroke={color} strokeWidth="1.6" strokeLinecap="round"
      />
      <path
        d="M16.5 16.5L21 21"
        stroke={color} strokeWidth="1.6" strokeLinecap="round"
      />
    </svg>
  );
}
