import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Check, Camera, Image as ImageIcon } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { PRESET_AVATARS, PRESET_COVERS, DEFAULT_AVATAR, DEFAULT_COVER } from '../data';
import { Avatar } from '../components/Avatar';
import { PickerSheet } from '../components/PickerSheet';
import { T, springs } from '../theme';

const ACCENT_COLORS = [
  { label: '天蓝', value: '#007AFF' },
  { label: '翠绿', value: '#34C759' },
  { label: '紫色', value: '#AF52DE' },
  { label: '橙色', value: '#FF9500' },
  { label: '靛蓝', value: '#5856D6' },
  { label: '红色', value: '#FF2D55' },
  { label: '青色', value: '#5AC8FA' },
  { label: '薄荷', value: '#00C7BE' },
];

export function Settings() {
  const closeSettings = useXYNav((s) => s.closeSettings);
  const settings = useXYData((s) => s.userSettings);
  const updateSettings = useXYData((s) => s.updateSettings);

  const [nickname, setNickname] = useState(settings.nickname);
  const [bio, setBio] = useState(settings.bio);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);

  const handleSaveNickname = () => {
    const trimmed = nickname.trim();
    if (trimmed && trimmed !== settings.nickname) {
      updateSettings({ nickname: trimmed });
    }
  };

  const handleSaveBio = () => {
    const trimmed = bio.trim();
    if (trimmed !== settings.bio) {
      updateSettings({ bio: trimmed });
    }
  };

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
          onClick={closeSettings}
          whileTap={{ scale: 0.85 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>设置</span>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {/* 封面图 */}
        <motion.div
          style={{
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
            overflow: 'hidden',
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <motion.button
            className="relative w-full"
            style={{ height: 120 }}
            onClick={() => setShowCoverPicker(true)}
            whileTap={{ scale: 0.98 }}
          >
            <img
              src={settings.coverUrl || DEFAULT_COVER}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.3) 100%)' }}
            />
            <div className="absolute bottom-2.5 right-3 flex items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <ImageIcon size={12} color="#fff" strokeWidth={2.5} />
              <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>更换封面</span>
            </div>
          </motion.button>
        </motion.div>

        {/* Avatar & Nickname */}
        <motion.div
          className="flex flex-col items-center"
          style={{
            padding: '24px 20px',
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
            marginTop: -36,
            position: 'relative',
            zIndex: 1,
            marginLeft: 16,
            marginRight: 16,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <motion.button
            className="relative"
            onClick={() => setShowAvatarPicker(true)}
            whileTap={{ scale: 0.9 }}
            style={{ marginTop: -52 }}
          >
            <Avatar src={settings.avatarUrl || DEFAULT_AVATAR} size={72} ringIndex={0} />
            <div
              className="absolute bottom-0 right-0 flex items-center justify-center rounded-full"
              style={{
                width: 24, height: 24,
                backgroundColor: T.accent,
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              }}
            >
              <Camera size={12} color="#fff" strokeWidth={2.5} />
            </div>
          </motion.button>
          <div className="mt-4 w-full">
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: 0.5 }}>
              昵称
            </label>
            <input
              className="mt-1 w-full bg-transparent outline-none"
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: T.textPrimary,
                padding: '8px 0',
                borderBottom: `1px solid ${T.border}`,
              }}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={handleSaveNickname}
              maxLength={20}
            />
          </div>
          <div className="mt-3 w-full">
            <label style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, letterSpacing: 0.5 }}>
              个性签名
            </label>
            <input
              className="mt-1 w-full bg-transparent outline-none"
              style={{
                fontSize: 14,
                color: T.textPrimary,
                padding: '8px 0',
                borderBottom: `1px solid ${T.border}`,
              }}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              onBlur={handleSaveBio}
              maxLength={50}
              placeholder="写一句介绍自己的话..."
            />
          </div>
        </motion.div>

        {/* Theme Color */}
        <motion.div
          className="mt-4"
          style={{
            padding: '16px 20px',
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...springs.gentle }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            主题色
          </span>
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2, marginBottom: 12 }}>
            选择你喜欢的颜色风格
          </p>
          <div className="grid grid-cols-4 gap-3">
            {ACCENT_COLORS.map((c) => {
              const isActive = settings.accentColor === c.value;
              return (
                <motion.button
                  key={c.value}
                  className="flex flex-col items-center gap-1.5"
                  onClick={() => updateSettings({ accentColor: c.value })}
                  whileTap={{ scale: 0.9 }}
                >
                  <div
                    className="relative flex items-center justify-center rounded-full"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: c.value,
                      boxShadow: isActive ? `0 0 0 3px ${T.bg}, 0 0 0 5px ${c.value}` : T.shadow1,
                    }}
                  >
                    {isActive && <Check size={18} strokeWidth={3} color="#fff" />}
                  </div>
                  <span style={{ fontSize: 10, color: isActive ? T.textPrimary : T.textMuted, fontWeight: isActive ? 600 : 400 }}>
                    {c.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* About */}
        <motion.div
          className="mt-4"
          style={{
            padding: '16px 20px',
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...springs.gentle }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            关于
          </span>
          <div className="mt-3 flex flex-col gap-2">
            <InfoRow label="版本" value="v1.0.0" />
            <InfoRow label="开发者" value="可爱信团队" />
            <InfoRow label="设计理念" value="Macaron Dream" />
          </div>
        </motion.div>

        <div className="mt-8 flex flex-col items-center" style={{ opacity: 0.3 }}>
          <span style={{ fontSize: 11, color: T.textMuted, letterSpacing: 1 }}>可爱信 v1.0</span>
        </div>
      </div>

      {/* 头像选择器 */}
      <AnimatePresence>
        {showAvatarPicker && (
          <PickerSheet
            title="选择头像"
            images={PRESET_AVATARS}
            currentImage={settings.avatarUrl || DEFAULT_AVATAR}
            onSelect={(url) => {
              updateSettings({ avatarUrl: url });
              setShowAvatarPicker(false);
            }}
            onClose={() => setShowAvatarPicker(false)}
            isAvatar
          />
        )}
      </AnimatePresence>

      {/* 封面选择器 */}
      <AnimatePresence>
        {showCoverPicker && (
          <PickerSheet
            title="选择封面"
            images={PRESET_COVERS}
            currentImage={settings.coverUrl || DEFAULT_COVER}
            onSelect={(url) => {
              updateSettings({ coverUrl: url });
              setShowCoverPicker(false);
            }}
            onClose={() => setShowCoverPicker(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: `0.5px solid ${T.separator}` }}>
      <span style={{ fontSize: 13, color: T.textSecondary }}>{label}</span>
      <span style={{ fontSize: 13, color: T.textMuted }}>{value}</span>
    </div>
  );
}
