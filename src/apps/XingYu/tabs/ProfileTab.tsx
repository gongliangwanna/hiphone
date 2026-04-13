import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Star, Heart, Clock, ChevronRight, Settings, Image as ImageIcon, Smile, Settings2 } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { useStickerStore } from '../stickerStore';
import { DEFAULT_COVER, DEFAULT_AVATAR } from '../data';
import { T, springs } from '../theme';

const DEFAULT_SIGNATURE = '还没有个性签名';

export function ProfileTab() {
  const openSettings = useXYNav((s) => s.openSettings);
  const openStickerManager = useXYNav((s) => s.openStickerManager);
  const settings = useXYData((s) => s.userSettings);
  const stickerPacks = useStickerStore((s) => s.packs);
  const conversations = useXYData((s) => s.conversations);
  const moments = useXYData((s) => s.moments);
  const userSignatureHistory = useXYData((s) => s.userSignatureHistory);
  const [showHistory, setShowHistory] = useState(false);

  const myMomentsCount = moments.filter((m) => m.idolId === 'me').length;
  const totalChats = conversations.length;

  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });

  // 滚动时的顶部渐变效果
  const headerBgOpacity = useTransform(scrollY, [0, 100], [0, 0.85]);
  const headerBlur = useTransform(scrollY, [0, 100], [0, 20]);
  const headerIconColor = useTransform(scrollY, [0, 80], ['#FFFFFF', T.textPrimary]);

  return (
    <div className="relative flex h-full flex-col bg-[#F5F5F7]">
      {/* 动态导航栏 */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-20 px-4 pt-2 pb-2 flex items-center justify-end"
        style={{
          backgroundColor: useTransform(headerBgOpacity, (v) => `rgba(245, 245, 247, ${v})`),
          backdropFilter: useTransform(headerBlur, (v) => `blur(${v}px)`),
          WebkitBackdropFilter: useTransform(headerBlur, (v) => `blur(${v}px)`),
          borderBottom: useTransform(headerBgOpacity, (v) => `0.5px solid rgba(0,0,0,${v * 0.05})`),
        }}
      >
        <motion.button
          whileTap={{ scale: 0.85, opacity: 0.7 }}
          transition={springs.press}
          onClick={openSettings}
          style={{ width: 32, height: 32 }}
          className="flex items-center justify-center"
        >
          <motion.div style={{ color: headerIconColor }}>
            <Settings size={22} strokeWidth={2} color="inherit" />
          </motion.div>
        </motion.button>
      </motion.div>

      <div ref={scrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {/* 封面图 - 正常文档流，随滚动走 */}
        <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
          <img
            src={settings.coverUrl || DEFAULT_COVER}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* 底部渐变遮罩 */}
          <div
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: 60,
              background: `linear-gradient(180deg, transparent 0%, #F5F5F7 100%)`,
            }}
          />
        </div>

        {/* 个人资料卡片 - 负 margin 叠在封面上 */}
        <div className="relative px-4 pb-6" style={{ marginTop: -50, zIndex: 1 }}>
          <motion.div
            className="flex flex-col items-center bg-white"
            style={{
              borderRadius: 24,
              padding: '0 20px 24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.gentle}
          >
            {/* 头像 - 突破卡片顶部 */}
            <div
              className="relative"
              style={{
                marginTop: -40,
                marginBottom: 12,
                padding: 4,
                backgroundColor: '#fff',
                borderRadius: '50%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
              }}
            >
              <img
                src={settings.avatarUrl || DEFAULT_AVATAR}
                alt=""
                style={{ width: 88, height: 88, borderRadius: '50%', objectFit: 'cover' }}
              />
            </div>

            <span style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary }}>
              {settings.nickname}
            </span>
            <span
              style={{
                fontSize: 14,
                color: T.textSecondary,
                marginTop: 6,
                textAlign: 'center',
                lineHeight: 1.4,
                fontStyle: settings.bio ? 'normal' : 'italic',
              }}
            >
              {settings.bio || DEFAULT_SIGNATURE}
            </span>

            {/* 签名历史 */}
            {userSignatureHistory.length > 0 && (
              <>
                <motion.button
                  className="mt-2 flex items-center gap-1"
                  onClick={() => setShowHistory((p) => !p)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Clock size={11} strokeWidth={2} color={T.textMuted} />
                  <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 500 }}>
                    {showHistory ? '收起' : `历史签名 (${userSignatureHistory.length})`}
                  </span>
                </motion.button>
                <AnimatePresence>
                  {showHistory && (
                    <motion.div
                      className="mt-1.5 flex w-full flex-col gap-1"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      {userSignatureHistory.slice(0, 20).map((record, i) => (
                        <div
                          key={`${record.timestamp}-${i}`}
                          className="flex items-baseline justify-between gap-2"
                          style={{
                            padding: '4px 10px',
                            borderRadius: 8,
                            backgroundColor: `${T.accent}08`,
                          }}
                        >
                          <span style={{ fontSize: 12, color: T.textSecondary, flex: 1 }}>
                            {record.text}
                          </span>
                          <span style={{ fontSize: 10, color: T.textMuted, whiteSpace: 'nowrap' }}>
                            {formatDate(record.timestamp)}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {/* 统计数据 */}
            <div className="mt-6 flex w-full justify-around pt-5" style={{ borderTop: `0.5px solid ${T.separator}` }}>
              {[
                { label: '信件', value: String(totalChats) },
                { label: '收藏', value: '42' },
                { label: '星球', value: String(myMomentsCount) },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1">
                  <span style={{ fontSize: 20, fontWeight: 700, color: T.textPrimary }}>{s.value}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: T.textSecondary }}>{s.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* 菜单列表区域 - 实色背景确保遮盖封面 */}
        <div className="relative px-4 pb-8 flex flex-col gap-4" style={{ zIndex: 1 }}>
          <MenuSection>
            <MenuItem icon={Star} label="我的收藏" desc="42 条内容" color="#FFD700" />
            <MenuItem icon={Heart} label="特别关心" desc="3 人" color="#FF2D55" />
            <MenuItem icon={Clock} label="互动历史" desc="" color="#5AC8FA" isLast />
          </MenuSection>

          <MenuSection>
            <MenuItem icon={ImageIcon} label="个性装扮" desc="聊天背景/气泡" color="#34C759" />
            <MenuItem icon={Smile} label="表情包库" desc={`已添加 ${stickerPacks.length} 个`} color="#007AFF" isLast onClick={() => openStickerManager()} />
          </MenuSection>

          <MenuSection>
            <MenuItem icon={Settings2} label="系统设置" desc="" color="#A1C4FD" isLast onClick={openSettings} />
          </MenuSection>
        </div>
      </div>
    </div>
  );
}

function MenuSection({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="flex flex-col bg-white"
      style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
    >
      {children}
    </motion.div>
  );
}

function MenuItem({ icon: Icon, label, desc, color, isLast, onClick }: any) {
  return (
    <motion.button
      className="flex w-full items-center gap-3.5 relative"
      style={{ padding: '16px 16px' }}
      whileTap={{ backgroundColor: 'rgba(0,0,0,0.03)' }}
      transition={{ duration: 0 }}
      onClick={onClick}
    >
      <div
        className="flex items-center justify-center rounded-[10px]"
        style={{ width: 30, height: 30, backgroundColor: `${color}1A` }}
      >
        <Icon size={16} strokeWidth={2.5} color={color} />
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary }}>
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {desc && <span style={{ fontSize: 13, color: T.textMuted }}>{desc}</span>}
          <ChevronRight size={16} color={T.textMuted} strokeWidth={2} />
        </div>
      </div>
      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{ height: 0.5, backgroundColor: T.separator, left: 60 }}
        />
      )}
    </motion.button>
  );
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const mo = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${mo}/${dd} ${hh}:${mm}`;
}
