import { motion } from 'motion/react';
import { Star, Heart, Clock, ChevronRight, Settings } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { ME } from '../data';
import { T, springs } from '../theme';

export function ProfileTab() {
  const openSettings = useXYNav((s) => s.openSettings);
  const settings = useXYData((s) => s.userSettings);
  const conversations = useXYData((s) => s.conversations);
  const moments = useXYData((s) => s.moments);

  const myMomentsCount = moments.filter((m) => m.idolId === 'me').length;
  const totalChats = conversations.length;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div className="shrink-0 px-5 pt-3 pb-1">
        <div className="flex items-center justify-between" style={{ height: 44 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: T.textPrimary, letterSpacing: -0.5 }}>
            我的
          </h1>
          <motion.button
            whileTap={{ scale: 0.85, rotate: 30 }}
            transition={springs.press}
            onClick={openSettings}
          >
            <Settings size={20} strokeWidth={1.6} color={T.textSecondary} />
          </motion.button>
        </div>
      </div>

      <div className="scrollbar-hide mt-3 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {/* Profile card */}
        <motion.div
          style={{
            padding: '28px 24px 24px',
            borderRadius: T.r.xl,
            background: `linear-gradient(135deg, ${settings.accentColor}CC 0%, ${settings.accentColor} 100%)`,
            boxShadow: T.shadow3,
            position: 'relative',
            overflow: 'hidden',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          {/* Subtle texture overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15), transparent 60%)',
            }}
          />

          <div className="relative flex flex-col items-center">
            {/* Avatar */}
            <div
              className="flex items-center justify-center rounded-full"
              style={{
                width: 68,
                height: 68,
                backgroundColor: 'rgba(255,255,255,0.25)',
                border: '2px solid rgba(255,255,255,0.4)',
              }}
            >
              <img
                src={ME.avatar}
                alt=""
                className="h-full w-full rounded-full object-cover"
              />
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: T.textOnAccent, marginTop: 10 }}>
              {settings.nickname}
            </span>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {settings.bio}
            </span>

            {/* Stats */}
            <div className="mt-5 flex w-full justify-around">
              {[
                { label: '聊天', value: String(totalChats) },
                { label: '收藏', value: '42' },
                { label: '动态', value: String(myMomentsCount) },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center">
                  <span style={{ fontSize: 17, fontWeight: 700, color: T.textOnAccent }}>{s.value}</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Menu */}
        <div className="mt-4 flex flex-col gap-2">
          {[
            { icon: Star, label: '我的收藏', desc: '42 条内容', color: T.gold },
            { icon: Heart, label: '点赞记录', desc: '查看你的足迹', color: T.rose },
            { icon: Clock, label: '聊天记录', desc: '全部消息备份', color: settings.accentColor },
          ].map((item, i) => (
            <motion.button
              key={item.label}
              className="flex w-full items-center gap-3"
              style={{
                padding: '14px 16px',
                borderRadius: T.r.lg,
                backgroundColor: T.card,
                boxShadow: T.shadow1,
              }}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, ...springs.gentle }}
              whileTap={{ scale: 0.98 }}
            >
              <div
                className="flex items-center justify-center rounded-xl"
                style={{ width: 36, height: 36, backgroundColor: `${item.color}12` }}
              >
                <item.icon size={17} strokeWidth={1.8} color={item.color} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{item.label}</span>
                <span style={{ fontSize: 11, color: T.textMuted }}>{item.desc}</span>
              </div>
              <ChevronRight size={15} strokeWidth={1.5} color={T.textMuted} />
            </motion.button>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-center" style={{ opacity: 0.3 }}>
          <span style={{ fontSize: 11, color: T.textMuted, letterSpacing: 1 }}>星语 v1.0</span>
        </div>
      </div>
    </div>
  );
}
