import { useState, useRef, useMemo } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Heart } from 'lucide-react';
import { useXYData } from '../xingYuDataStore';
import { useXYNav } from '../xingYuNavStore';
import { MomentCard } from '../components/MomentCard';
import { DEFAULT_AVATAR, DEFAULT_COVER } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { T, springs } from '../theme';

export function MomentsTab() {
  const moments = useXYData((s) => s.moments);
  const userSettings = useXYData((s) => s.userSettings);
  const unreadInteractionCount = useXYData((s) => s.unreadInteractionCount);
  const openInteractions = useXYNav((s) => s.openInteractions);
  const characters = useCharacterStore((s) => s.characters);
  const { phoneOwnerId } = usePerspective();

  // 查手机模式: 显示角色的资料
  const displayProfile = useMemo(() => {
    if (!phoneOwnerId) {
      return {
        nickname: userSettings.nickname,
        avatarUrl: userSettings.avatarUrl,
        coverUrl: userSettings.coverUrl,
      };
    }
    const char = characters.find((c) => c.id === phoneOwnerId);
    return {
      nickname: char?.name || '???',
      avatarUrl: char?.avatar || '',
      coverUrl: '', // AI characters don't have cover images yet
    };
  }, [phoneOwnerId, userSettings, characters]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  
  // 导航栏毛玻璃渐变过渡
  const headerBgOpacity = useTransform(scrollY, [0, 100], [0, 0.85]);
  const headerBlur = useTransform(scrollY, [0, 100], [0, 20]);
  const headerTitleOpacity = useTransform(scrollY, [80, 120], [0, 1]);


  return (
    <div className="relative flex h-full flex-col bg-white">
      {/* 动态渐变导航栏 */}
      <motion.div
        className="absolute top-0 left-0 right-0 z-20 px-4 pt-2 pb-2 flex items-center justify-center"
        style={{
          backgroundColor: useTransform(headerBgOpacity, (v) => `rgba(255, 255, 255, ${v})`),
          backdropFilter: useTransform(headerBlur, (v) => `blur(${v}px)`),
          WebkitBackdropFilter: useTransform(headerBlur, (v) => `blur(${v}px)`),
          borderBottom: useTransform(headerBgOpacity, (v) => `0.5px solid rgba(0,0,0,${v * 0.05})`),
        }}
      >
        <motion.span
          style={{
            opacity: headerTitleOpacity,
            fontSize: 17,
            fontWeight: 600,
            color: T.textPrimary,
          }}
        >
          星球
        </motion.span>
      </motion.div>

      <div ref={scrollRef} className="scrollbar-hide relative z-0 min-h-0 flex-1 overflow-y-auto">
        {/* 个人封面区域 (类似朋友圈) */}
        <div className="relative" style={{ height: 280, backgroundColor: T.bg }}>
          {/* 封面图 */}
          <motion.button
            className="absolute inset-0 w-full overflow-hidden"
            onClick={() => setViewingImage('cover')}
            whileTap={{ opacity: 0.8 }}
          >
            <img
              src={displayProfile.coverUrl || DEFAULT_COVER}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </motion.button>

          {/* 底部渐变遮罩让头像过渡更自然 */}
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, white)' }}
          />

          {/* 名字和头像悬浮层 */}
          <div className="absolute right-4 bottom-[-20px] flex items-end gap-4 z-10">
            <span
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: '#fff',
                textShadow: '0 1px 3px rgba(0,0,0,0.3)',
                marginBottom: 30
              }}
            >
              {displayProfile.nickname}
            </span>
            <motion.button
              style={{
                padding: 3,
                backgroundColor: '#fff',
                borderRadius: '20%', // 微信风格的圆角矩形
                boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
              }}
              onClick={() => setViewingImage(displayProfile.avatarUrl || DEFAULT_AVATAR)}
              whileTap={{ scale: 0.95 }}
            >
              <img
                src={displayProfile.avatarUrl || DEFAULT_AVATAR}
                alt=""
                style={{ width: 68, height: 68, borderRadius: '15%', objectFit: 'cover' }}
              />
            </motion.button>
          </div>
        </div>

        {/* 互动通知入口 — 仅在有未读互动时显示 */}
        {unreadInteractionCount > 0 && (
          <motion.button
            className="mx-auto mt-8 flex items-center gap-3 px-5 py-3"
            style={{
              borderRadius: T.r.md,
              backgroundColor: T.card,
              boxShadow: T.shadow2,
            }}
            onClick={openInteractions}
            whileTap={{ scale: 0.98 }}
            transition={springs.press}
          >
            <div
              className="flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: T.r.sm,
                background: T.accentGrad,
              }}
            >
              <Heart size={18} color="#fff" fill="#fff" />
            </div>
            <span style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary }}>
              {unreadInteractionCount} 条新互动
            </span>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: T.rose,
              }}
            />
          </motion.button>
        )}

        {/* 动态列表 */}
        <div className="px-4 pt-4 pb-4">
          {moments.map((mo, i) => (
            <motion.div
              key={mo.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, ...springs.gentle }}
            >
              <MomentCard moment={mo} onImageClick={(img) => setViewingImage(img)} />
            </motion.div>
          ))}
          <div className="flex justify-center py-8">
            <span style={{ fontSize: 12, color: T.textMuted }}>没有更多动态了</span>
          </div>
          <div style={{ height: 16 }} />
        </div>
      </div>

      {/* Image Viewer Overlay */}
      <AnimatePresence>
        {viewingImage && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/90"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setViewingImage(null)}
          >
            {viewingImage === 'cover' ? (
              <motion.img
                src={displayProfile.coverUrl || DEFAULT_COVER}
                alt=""
                className="w-full"
                style={{ maxHeight: '80%', objectFit: 'contain' }}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                transition={springs.gentle}
              />
            ) : (
              <motion.img
                src={viewingImage}
                alt=""
                className="w-full"
                style={{ maxHeight: '80%', objectFit: 'contain' }}
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                transition={springs.gentle}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
