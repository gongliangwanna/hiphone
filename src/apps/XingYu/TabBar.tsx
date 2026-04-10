import { motion } from 'motion/react';
import { MessageCircle, Sparkles, User } from 'lucide-react';
import type { XYTab } from './xingYuNavStore';
import { T, springs } from './theme';

interface TabDef {
  key: XYTab;
  label: string;
  Icon: typeof MessageCircle;
}

const tabs: TabDef[] = [
  { key: 'chat', label: '消息', Icon: MessageCircle },
  { key: 'moments', label: '动态', Icon: Sparkles },
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
        height: 54,
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
            style={{ flex: 1, minHeight: 48, gap: 3, paddingBottom: 2 }}
            onClick={() => onChange(tab.key)}
            whileTap={{ scale: 0.88 }}
            transition={springs.press}
            data-testid={`xy-tab-${tab.key}`}
          >
            <tab.Icon
              size={20}
              strokeWidth={isActive ? 2.2 : 1.5}
              color={isActive ? T.accent : T.textMuted}
            />
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
