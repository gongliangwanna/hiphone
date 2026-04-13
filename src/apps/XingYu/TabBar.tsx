import { motion } from 'motion/react';
import { MessageCircle, Users, Sparkles, User, Plus } from 'lucide-react';
import type { XYTab } from './xingYuNavStore';
import { T, springs } from './theme';

interface TabDef {
  key: XYTab;
  label: string;
  Icon: typeof MessageCircle;
}

const LEFT_TABS: TabDef[] = [
  { key: 'chat', label: '信箱', Icon: MessageCircle },
  { key: 'contacts', label: '通讯录', Icon: Users },
];

const RIGHT_TABS: TabDef[] = [
  { key: 'moments', label: '星球', Icon: Sparkles },
  { key: 'profile', label: '我的', Icon: User },
];

interface TabBarProps {
  active: XYTab;
  onChange: (tab: XYTab) => void;
}

export function XYTabBar({ active, onChange }: TabBarProps) {
  const isComposeActive = active === 'compose';

  const renderTab = (tab: TabDef) => {
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
        <tab.Icon
          size={22}
          strokeWidth={isActive ? 2.2 : 1.8}
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
  };

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
      {LEFT_TABS.map(renderTab)}

      {/* 中间发动态按钮 — 和其他 tab 一样的切换逻辑 */}
      <motion.button
        className="flex flex-col items-center justify-center"
        style={{ flex: 1, minHeight: 48, gap: 3 }}
        onClick={() => onChange('compose')}
        whileTap={{ scale: 0.85 }}
        transition={springs.press}
        data-testid="xy-tab-compose"
      >
        <motion.div
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: isComposeActive ? T.accent : T.accentGrad,
            boxShadow: isComposeActive ? `0 2px 12px ${T.accent}60` : `0 2px 8px ${T.accent}40`,
          }}
          animate={{ rotate: isComposeActive ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 20 }}
        >
          <Plus size={20} strokeWidth={2.5} color="#fff" />
        </motion.div>
      </motion.button>

      {RIGHT_TABS.map(renderTab)}
    </div>
  );
}
