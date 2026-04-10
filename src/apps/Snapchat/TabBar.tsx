import { MapPin, MessageCircle, Camera, Users, Play } from 'lucide-react';
import type { SnapchatTab } from './snapchatNavStore';

const ACTIVE = '#000';
const INACTIVE = '#8E8E93';
const SNAP_YELLOW = '#FFFC00';

interface TabDef {
  key: SnapchatTab;
  icon: (active: boolean) => React.ReactNode;
}

const tabDefs: TabDef[] = [
  { key: 'map', icon: (a) => <MapPin size={24} strokeWidth={1.8} color={a ? ACTIVE : INACTIVE} /> },
  { key: 'chat', icon: (a) => <MessageCircle size={24} strokeWidth={1.8} color={a ? ACTIVE : INACTIVE} /> },
  { key: 'camera', icon: () => null },
  { key: 'community', icon: (a) => <Users size={24} strokeWidth={1.8} color={a ? ACTIVE : INACTIVE} /> },
  { key: 'spotlight', icon: (a) => <Play size={24} strokeWidth={1.8} color={a ? ACTIVE : INACTIVE} /> },
];

interface SnapchatTabBarProps {
  activeTab: SnapchatTab;
  onTabChange: (tab: SnapchatTab) => void;
}

export function SnapchatTabBar({ activeTab, onTabChange }: SnapchatTabBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-around"
      style={{
        height: 50,
        borderTop: '0.5px solid var(--color-separator)',
        backgroundColor: '#fff',
      }}
    >
      {tabDefs.map((tab) => {
        const isActive = activeTab === tab.key;

        if (tab.key === 'camera') {
          return (
            <button
              key="camera"
              className="flex items-center justify-center"
              style={{ flex: 1, minHeight: 44 }}
              onClick={() => onTabChange('camera')}
              data-testid="snap-tab-camera"
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: isActive ? SNAP_YELLOW : 'transparent',
                  border: isActive ? 'none' : `2px solid ${INACTIVE}`,
                  transition: 'background-color 0.15s, border 0.15s',
                }}
              >
                <Camera size={20} strokeWidth={1.8} color={isActive ? ACTIVE : INACTIVE} />
              </div>
            </button>
          );
        }

        return (
          <button
            key={tab.key}
            className="flex flex-col items-center justify-center"
            style={{ flex: 1, minHeight: 44 }}
            onClick={() => onTabChange(tab.key)}
            data-testid={`snap-tab-${tab.key}`}
          >
            {tab.icon(isActive)}
          </button>
        );
      })}
    </div>
  );
}
