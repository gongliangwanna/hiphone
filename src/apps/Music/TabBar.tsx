import { motion } from 'motion/react';
import { Grid2X2, House, LibraryBig, Radio } from 'lucide-react';
import type { MusicTab } from './musicStore';
import { MUSIC_ACCENT, MUSIC_SEPARATOR, MUSIC_TERTIARY } from './musicUi';

const INACTIVE_COLOR = 'rgba(235, 235, 245, 0.52)';

interface TabDef {
  key: MusicTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const tabDefs: TabDef[] = [
  {
    key: 'home',
    label: '现在就听',
    icon: (active) => <House size={24} strokeWidth={active ? 2.25 : 2} color={active ? MUSIC_ACCENT : INACTIVE_COLOR} />,
  },
  {
    key: 'browse',
    label: '浏览',
    icon: (active) => <Grid2X2 size={23} strokeWidth={active ? 2.25 : 2} color={active ? MUSIC_ACCENT : INACTIVE_COLOR} />,
  },
  {
    key: 'radio',
    label: '广播',
    icon: (active) => <Radio size={24} strokeWidth={active ? 2.25 : 2} color={active ? MUSIC_ACCENT : INACTIVE_COLOR} />,
  },
  {
    key: 'library',
    label: '资料库',
    icon: (active) => <LibraryBig size={24} strokeWidth={active ? 2.25 : 2} color={active ? MUSIC_ACCENT : INACTIVE_COLOR} />,
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
      data-testid="music-tabbar-glass"
      style={{
        height: 'calc(58px + var(--app-safe-bottom, 0px))',
        paddingBottom: 'var(--app-safe-bottom, 0px)',
        borderTop: `0.5px solid ${MUSIC_SEPARATOR}`,
        backgroundColor: 'rgba(18, 18, 22, 0.72)',
        backdropFilter: 'blur(18px) saturate(155%)',
        WebkitBackdropFilter: 'blur(18px) saturate(155%)',
        boxShadow: '0 -18px 46px rgba(0,0,0,0.35), inset 0 0.5px 0 rgba(255,255,255,0.08)',
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
                fontSize: 10.5,
                color: isActive ? MUSIC_ACCENT : MUSIC_TERTIARY,
                fontWeight: isActive ? 650 : 500,
                lineHeight: 1.1,
                marginTop: 2,
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
