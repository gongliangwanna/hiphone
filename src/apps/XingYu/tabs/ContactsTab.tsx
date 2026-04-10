import { motion } from 'motion/react';
import { MessageCircle, Users as UsersIcon, ChevronRight } from 'lucide-react';
import { IDOLS } from '../data';
import type { Idol } from '../data';
import { useXYNav } from '../xingYuNavStore';
import { Avatar } from '../components/Avatar';
import { T, springs } from '../theme';

export function ContactsTab() {
  const openChat = useXYNav((s) => s.openChat);
  const openIdol = useXYNav((s) => s.openIdol);

  const singles = IDOLS.filter((i) => !i.isGroup);
  const groups = IDOLS.filter((i) => i.isGroup);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div className="shrink-0 px-5 pt-3 pb-1">
        <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.5 }}>
          通讯录
        </h1>
      </div>

      <div className="scrollbar-hide mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <Section
          icon={<MessageCircle size={13} strokeWidth={2} color={T.accent} />}
          title="我的偶像"
        />
        {singles.map((idol, i) => (
          <motion.div
            key={idol.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, ...springs.gentle }}
          >
            <IdolRow idol={idol} onTap={() => openChat(`c-${idol.id}`)} onAvatarTap={() => openIdol(idol.id)} />
          </motion.div>
        ))}

        <Section
          icon={<UsersIcon size={13} strokeWidth={2} color={T.accent} />}
          title="群聊"
        />
        {groups.map((idol, i) => (
          <motion.div
            key={idol.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (singles.length + i) * 0.04, ...springs.gentle }}
          >
            <IdolRow idol={idol} onTap={() => openChat(`c-${idol.id}`)} onAvatarTap={() => openIdol(idol.id)} />
          </motion.div>
        ))}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function Section({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-1.5 px-1">
      {icon}
      <span style={{ fontSize: 12, fontWeight: 600, color: T.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {title}
      </span>
    </div>
  );
}

function IdolRow({ idol, onTap, onAvatarTap }: { idol: Idol; onTap: () => void; onAvatarTap: () => void }) {
  return (
    <motion.div
      className="flex w-full items-center gap-3"
      style={{
        padding: '12px 14px',
        marginBottom: 4,
        borderRadius: T.r.lg,
        backgroundColor: T.card,
        boxShadow: T.shadow1,
      }}
    >
      <motion.button
        onClick={(e) => { e.stopPropagation(); onAvatarTap(); }}
        whileTap={{ scale: 0.9 }}
      >
        <Avatar src={idol.avatar} size={42} ringIndex={idol.ringIndex} online={idol.online} />
      </motion.button>

      <motion.button
        className="flex min-w-0 flex-1 items-center gap-3"
        onClick={onTap}
        whileTap={{ scale: 0.98 }}
        transition={springs.press}
      >
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <div className="flex items-center gap-1.5">
            <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
              {idol.name}
            </span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 500,
                color: T.accent,
                backgroundColor: `${T.accent}10`,
                borderRadius: T.r.xs,
                padding: '1px 6px',
              }}
            >
              {idol.title}
            </span>
          </div>
          <span className="truncate" style={{ fontSize: 12, color: T.textMuted, maxWidth: '100%' }}>
            {idol.bio}
          </span>
        </div>
        <ChevronRight size={16} strokeWidth={1.5} color={T.textMuted} />
      </motion.button>
    </motion.div>
  );
}
