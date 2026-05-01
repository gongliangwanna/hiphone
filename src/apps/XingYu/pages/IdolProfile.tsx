import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, MessageCircle, Settings, Clock } from 'lucide-react';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useXYNav } from '../xingYuNavStore';
import { useXYData, type SignatureRecord } from '../xingYuDataStore';
import { getIdol, DEFAULT_AVATAR } from '../data';
import { Avatar } from '../components/Avatar';
import { MomentCard } from '../components/MomentCard';
import { T, springs } from '../theme';

const FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';
const DEFAULT_SIGNATURE = '还没有个性签名';

export function IdolProfile() {
  const activeIdolId = useXYNav((s) => s.activeIdolId);
  const closeIdol = useXYNav((s) => s.closeIdol);
  const openChat = useXYNav((s) => s.openChat);
  const openSettings = useXYNav((s) => s.openSettings);
  const moments = useXYData((s) => s.moments);
  const userSettings = useXYData((s) => s.userSettings);
  const ensureCharacterConversation = useXYData((s) => s.ensureCharacterConversation);
  const characterSignatures = useXYData((s) => s.characterSignatures);
  const userSignatureHistory = useXYData((s) => s.userSignatureHistory);
  const characters = useCharacterStore((s) => s.characters);

  const [showHistory, setShowHistory] = useState(false);

  const isMe = activeIdolId === 'me';
  const idol = activeIdolId && !isMe ? getIdol(activeIdolId) : undefined;
  const character = activeIdolId && !isMe && !idol
    ? characters.find((c) => c.id === activeIdolId)
    : undefined;

  const charSig = character ? characterSignatures[character.id] : undefined;

  const profileData = isMe
    ? {
        name: userSettings.nickname,
        avatar: userSettings.avatarUrl || DEFAULT_AVATAR,
        signature: userSettings.bio || DEFAULT_SIGNATURE,
        ringIndex: 0,
        online: true,
      }
    : idol
      ? {
          name: idol.name,
          avatar: idol.avatar,
          signature: idol.bio || DEFAULT_SIGNATURE,
          ringIndex: idol.ringIndex,
          online: idol.online,
        }
      : character
        ? {
            name: character.name,
            avatar: character.avatar?.trim() || FALLBACK_AVATAR,
            signature: charSig?.current || DEFAULT_SIGNATURE,
            ringIndex: 0,
            online: true,
          }
        : null;

  const signatureHistory: SignatureRecord[] = isMe
    ? userSignatureHistory
    : character
      ? charSig?.history ?? []
      : [];

  const profileMoments = useMemo(
    () => moments.filter((m) => m.idolId === activeIdolId),
    [moments, activeIdolId],
  );

  if (!profileData) {
    return (
      <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
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
        </div>
        <div className="flex flex-1 items-center justify-center px-6">
          <span style={{ fontSize: 14, color: T.textSecondary, textAlign: 'center' }}>
            未找到该资料页
          </span>
        </div>
      </div>
    );
  }

  const handleSendMessage = () => {
    if (idol) {
      openChat(`c-${idol.id}`);
    } else if (character) {
      const convId = ensureCharacterConversation(character.id);
      openChat(convId);
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
          onClick={closeIdol}
          whileTap={{ scale: 0.85 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span className="flex-1" style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>
          {isMe ? '我的空间' : `${profileData.name}的星球`}
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
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(circle at 80% 20%, rgba(255,255,255,0.15), transparent 60%)',
            }}
          />
          <div className="relative flex items-center gap-4">
            <Avatar src={profileData.avatar} size={60} ringIndex={profileData.ringIndex} online={profileData.online} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span style={{ fontSize: 18, fontWeight: 700, color: T.textOnAccent }}>
                {profileData.name}
              </span>
              <span
                className="mt-1.5"
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.4,
                  fontStyle: profileData.signature === DEFAULT_SIGNATURE ? 'italic' : 'normal',
                }}
              >
                {profileData.signature}
              </span>
            </div>
          </div>

          {/* Signature History Toggle */}
          {signatureHistory.length > 0 && (
            <motion.button
              className="mt-3 flex items-center gap-1.5"
              style={{ alignSelf: 'flex-start' }}
              onClick={() => setShowHistory((p) => !p)}
              whileTap={{ scale: 0.95 }}
            >
              <Clock size={12} strokeWidth={2} color="rgba(255,255,255,0.6)" />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                {showHistory ? '收起历史签名' : `历史签名 (${signatureHistory.length})`}
              </span>
            </motion.button>
          )}

          <AnimatePresence>
            {showHistory && signatureHistory.length > 0 && (
              <motion.div
                className="mt-2 flex flex-col gap-1.5"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {signatureHistory.slice(0, 20).map((record, i) => (
                  <div
                    key={`${record.timestamp}-${i}`}
                    className="flex items-baseline justify-between gap-2"
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', flex: 1 }}>
                      {record.text}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                      {formatDate(record.timestamp)}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action Button */}
          {!isMe && (idol || character) && (
            <motion.button
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl"
              style={{
                padding: '10px 0',
                backgroundColor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.3)',
              }}
              onClick={handleSendMessage}
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

function formatDate(ts: number): string {
  const d = new Date(ts);
  const mo = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${mo}/${dd} ${hh}:${mm}`;
}
