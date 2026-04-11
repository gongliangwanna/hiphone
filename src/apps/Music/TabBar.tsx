import { motion } from 'motion/react';
import type { MusicTab } from './musicStore';

const MUSIC_RED = '#FC3C44';
const INACTIVE_COLOR = '#8E8E93';

interface TabDef {
  key: MusicTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const tabDefs: TabDef[] = [
  {
    key: 'home',
    label: '现在就听',
    icon: (active) => <HomeIcon color={active ? MUSIC_RED : INACTIVE_COLOR} />,
  },
  {
    key: 'browse',
    label: '浏览',
    icon: (active) => <BrowseIcon color={active ? MUSIC_RED : INACTIVE_COLOR} />,
  },
  {
    key: 'radio',
    label: '广播',
    icon: (active) => <RadioIcon color={active ? MUSIC_RED : INACTIVE_COLOR} />,
  },
  {
    key: 'library',
    label: '资料库',
    icon: (active) => <LibraryIcon color={active ? MUSIC_RED : INACTIVE_COLOR} />,
  },
];

interface MusicTabBarProps {
  activeTab: MusicTab;
  onTabChange: (tab: MusicTab) => void;
  /** Extra bottom padding for the mini player */
  className?: string;
}

export function MusicTabBar({ activeTab, onTabChange }: MusicTabBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-around"
      style={{
        height: 50,
        borderTop: '0.5px solid rgba(84, 84, 88, 0.65)',
        backgroundColor: 'rgba(28, 28, 30, 0.65)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
      }}
    >
      {tabDefs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <motion.button
            whileTap={{ scale: 0.9 }}
            key={tab.key}
            className="relative flex flex-col items-center justify-center"
            style={{ flex: 1, minHeight: 44, gap: 2 }}
            onClick={() => onTabChange(tab.key)}
            data-testid={`music-tab-${tab.key}`}
          >
            {tab.icon(isActive)}
            <span
              style={{
                fontSize: 10,
                color: isActive ? MUSIC_RED : INACTIVE_COLOR,
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {tab.label}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── SF Symbol style tab icons ── */

function HomeIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 22V12h6v10"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrowseIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="3" width="8" height="8" rx="2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="3" y="13" width="8" height="8" rx="2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="13" width="8" height="8" rx="2" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RadioIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="14" r="3" stroke={color} strokeWidth="1.6" />
      <path
        d="M7.5 10.5a6 6 0 019 0"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4.5 7.5a10 10 0 0115 0"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 17v4"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LibraryIcon({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 4h4v16H4z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 4h4v16h-4z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 4l4 2v14l-4-2V4z" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
