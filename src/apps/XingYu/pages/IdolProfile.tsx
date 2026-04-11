import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, MessageCircle, Settings } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol, DEFAULT_AVATAR } from '../data';
import { Avatar } from '../components/Avatar';
import { MomentCard } from '../components/MomentCard';
import { T, springs } from '../theme';

export function IdolProfile() {
  const activeIdolId = useXYNav((s) => s.activeIdolId);
  const closeIdol = useXYNav((s) => s.closeIdol);
  const openChat = useXYNav((s) => s.openChat);
  const openSettings = useXYNav((s) => s.openSettings);
  const moments = useXYData((s) => s.moments);
  const userSettings = useXYData((s) => s.userSettings);

  const isMe = activeIdolId === 'me';
  const idol = activeIdolId && !isMe ? getIdol(activeIdolId) : undefined;

  const profileData = isMe
    ? {
        name: userSettings.nickname,
        avatar: userSettings.avatarUrl || DEFAULT_AVATAR,
        title: '可爱信用户',
        bio: userSettings.bio,
        ringIndex: 0,
        online: true,
      }
    : idol
      ? {
          name: idol.name,
          avatar: idol.avatar,
          title: idol.title,
          bio: idol.bio,
          ringIndex: idol.ringIndex,
          online: idol.online,
        }
      : null;

  const profileMoments = useMemo(
    () => moments.filter((m) => m.idolId === activeIdolId),
    [moments, activeIdolId],
  );

  if (!profileData) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-2.5 px-2"
        style={{
          height: 56,
          backgroundColor: T.overlay,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <motion.button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={closeIdol}
          whileTap={{ scale: 0.85 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span className="flex-1" style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
          {isMe ? '我的空间' : profileData.name}
        </span>
        {isMe && (
          <motion.button
            className="flex items-center justify-center"
            style={{ width: 36, height: 36 }}
            onClick={openSettings}
            whileTap={{ scale: 0.85 }}
          >
            <Settings size={18} strokeWidth={1.8} color={T.textSecondary} />
          </motion.button>
        )}
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* Profile Card */}
        <motion.div
          style={{
            padding: '24px 20px',
            borderRadius: T.r.xl,
            background: isMe
              ? `linear-gradient(135deg, ${userSettings.accentColor}CC 0%, ${userSettings.accentColor} 100%)`
              : T.accentGrad,
            boxShadow: T.shadow3,
            position: 'relative',
            overflow: 'hidden',
          }}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15), transparent 60%)',
            }}
          />
          <div className="relative flex items-center gap-4">
            <Avatar src={profileData.avatar} size={60} ringIndex={profileData.ringIndex} online={profileData.online} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 18, fontWeight: 700, color: T.textOnAccent }}>
                  {profileData.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.8)',
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    borderRadius: T.r.xs,
                    padding: '2px 8px',
                  }}
                >
                  {profileData.title}
                </span>
              </div>
              <span
                className="mt-1"
                style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}
              >
                {profileData.bio}
              </span>
              {!isMe && (
                <div className="mt-1 flex items-center gap-1">
                  <span
                    className="rounded-full"
                    style={{
                      width: 6,
                      height: 6,
                      backgroundColor: profileData.online ? '#8BC5A7' : 'rgba(255,255,255,0.4)',
                      display: 'inline-block',
                    }}
                  />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>
                    {profileData.online ? '在线' : '离线'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          {!isMe && idol && (
            <motion.button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl"
              style={{
                padding: '10px 0',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
              onClick={() => openChat(`c-${idol.id}`)}
              whileTap={{ scale: 0.97 }}
              transition={springs.press}
            >
              <MessageCircle size={16} strokeWidth={2} color={T.textOnAccent} />
              <span style={{ fontSize: 14, fontWeight: 600, color: T.textOnAccent }}>发消息</span>
            </motion.button>
          )}
        </motion.div>

        {/* Moments */}
        <div className="mt-5">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary, marginBottom: 12, paddingLeft: 2 }}>
            {isMe ? '我的动态' : 'TA的动态'} ({profileMoments.length})
          </h3>
          {profileMoments.length === 0 ? (
            <div className="flex flex-col items-center py-12" style={{ opacity: 0.4 }}>
              <span style={{ fontSize: 13, color: T.textMuted }}>暂无动态</span>
            </div>
          ) : (
            profileMoments.map((mo, i) => (
              <motion.div
                key={mo.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05, ...springs.gentle }}
              >
                <MomentCard moment={mo} disableAvatarNav />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
