import { motion } from 'motion/react';
import { MessageCircle, Users, Sparkles, User } from 'lucide-react';
import type { XYTab } from './xingYuNavStore';
import { T, springs } from './theme';

interface TabDef {
  key: XYTab;
  label: string;
  Icon: typeof MessageCircle;
}

const tabs: TabDef[] = [
  { key: 'chat', label: '信箱', Icon: MessageCircle },
  { key: 'contacts', label: '通讯录', Icon: Users },
  { key: 'moments', label: '星球', Icon: Sparkles },
  { key: 'profile', label: '我的', Icon: User },
];

interface TabBarProps {
  active: XYTab;
  onChange: (tab: XYTab) => void;
}

export function XYTabBar({ active, onChange }: TabBarProps) {
  return (
    <div
      className="flex shrink-0 items-end justify-around"
      style={{
        minHeight: 54,
        paddingTop: 8,
        paddingBottom: 'var(--app-safe-bottom, 8px)',
        background: T.overlay,
        borderTop: `0.5px solid ${T.separator}`,
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <motion.button
            key={tab.key}
            className="relative flex flex-col items-center justify-center"
            style={{ flex: 1, minHeight: 48, gap: 3 }}
            onClick={() => onChange(tab.key)}
            whileTap={{ scale: 0.88 }}
            transition={springs.press}
            data-testid={`xy-tab-${tab.key}`}
          >
            <div className="relative flex flex-col items-center">
              <tab.Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                color={isActive ? T.accent : T.textMuted}
              />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? T.accent : T.textMuted,
                letterSpacing: 0.2,
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
