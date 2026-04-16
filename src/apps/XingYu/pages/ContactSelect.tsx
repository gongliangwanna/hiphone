import { useMemo, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol } from '../data';
import type { Conversation } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useToastStore } from '@/system';
import { Avatar } from '../components/Avatar';
import { T } from '../theme';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface ConvOption {
  id: string;
  name: string;
  avatar: string;
}

export function ContactSelect() {
  const pendingForward = useXYNav((s) => s.pendingForward);
  const close = useXYNav((s) => s.closeContactSelect);
  const conversations = useXYData((s) => s.conversations);
  const userSettings = useXYData((s) => s.userSettings);
  const forwardMessage = useXYData((s) => s.forwardMessage);
  const forwardMessages = useXYData((s) => s.forwardMessages);
  const forwardAsCard = useXYData((s) => s.forwardAsCard);
  const characters = useCharacterStore((s) => s.characters);
  const persona = usePersonaStore((s) => s.getActivePersona());
  const { phoneOwnerId } = usePerspective();
  const [submitting, setSubmitting] = useState(false);

  const getSenderName = useCallback(
    (senderId: string): string => {
      if (senderId === 'me') return persona?.name || userSettings.nickname || '我';
      const charId = senderId.replace(/^char-/, '');
      const ch = characters.find((c) => c.id === charId);
      if (ch) return ch.name;
      const idol = getIdol(senderId);
      return idol?.name || senderId;
    },
    [persona, userSettings, characters],
  );

  const sourceConvId = pendingForward?.msgs[0]?.convId;

  const options = useMemo<ConvOption[]>(() => {
    const filtered = conversations.filter((c) => {
      if (c.id === sourceConvId) return false;
      // 玩家手机隐藏 AI-AI 对话；AI 手机只看自己参与的
      if (phoneOwnerId === null) return !c.aiChatParticipants;
      return (
        c.characterId === phoneOwnerId ||
        c.aiChatParticipants?.includes(phoneOwnerId)
      );
    });

    return filtered
      .sort((a, b) => b.lastTime - a.lastTime)
      .map((conv) => convOption(conv, characters));
  }, [conversations, sourceConvId, phoneOwnerId, characters]);

  const handlePick = useCallback(
    (targetConvId: string) => {
      if (!pendingForward || submitting) return;
      setSubmitting(true);
      try {
        const { msgs, mode } = pendingForward;
        if (mode === 'single') {
          if (msgs[0]) forwardMessage(msgs[0], targetConvId);
        } else if (mode === 'batch') {
          forwardMessages(msgs, targetConvId);
        } else {
          // merge
          const sourceConv = conversations.find((c) => c.id === sourceConvId);
          const sourcePeer = sourceConv ? convOption(sourceConv, characters) : null;
          const title = sourcePeer ? `${sourcePeer.name}的聊天记录` : '聊天记录';
          forwardAsCard(msgs, targetConvId, title, getSenderName);
        }
        useToastStore.getState().show('已转发');
      } finally {
        setSubmitting(false);
        close();
      }
    },
    [
      pendingForward,
      submitting,
      forwardMessage,
      forwardMessages,
      forwardAsCard,
      conversations,
      sourceConvId,
      characters,
      getSenderName,
      close,
    ],
  );

  if (!pendingForward) return null;

  const modeLabel =
    pendingForward.mode === 'merge'
      ? '合并转发'
      : pendingForward.mode === 'batch'
        ? '逐条转发'
        : '转发';

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div
        className="shrink-0"
        style={{
          backgroundColor: 'rgba(248,246,249,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <div className="flex items-center justify-between px-2" style={{ height: 44 }}>
          <div className="flex w-1/4 items-center justify-start">
            <motion.button
              className="flex items-center justify-center gap-1"
              onClick={close}
              whileTap={{ opacity: 0.5 }}
              transition={{ duration: 0 }}
            >
              <ChevronLeft size={24} strokeWidth={2} color={T.accent} />
              <span style={{ fontSize: 16, color: T.accent, marginLeft: -4 }}>取消</span>
            </motion.button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <span style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
              选择联系人
            </span>
          </div>
          <div className="w-1/4 pr-2 text-right" style={{ fontSize: 13, color: T.textMuted }}>
            {modeLabel}
          </div>
        </div>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {options.length === 0 ? (
          <div
            className="flex h-full items-center justify-center"
            style={{ fontSize: 14, color: T.textMuted }}
          >
            没有可转发的会话
          </div>
        ) : (
          options.map((opt) => (
            <motion.button
              key={opt.id}
              type="button"
              className="flex w-full items-center gap-3 px-4"
              style={{
                paddingTop: 12,
                paddingBottom: 12,
                borderBottom: `0.5px solid ${T.separator}`,
                background: 'transparent',
                textAlign: 'left',
              }}
              whileTap={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
              transition={{ duration: 0 }}
              onClick={() => handlePick(opt.id)}
            >
              <Avatar src={opt.avatar} size={44} ringIndex={0} />
              <span
                className="truncate"
                style={{ fontSize: 16, color: T.textPrimary, flex: 1 }}
              >
                {opt.name}
              </span>
            </motion.button>
          ))
        )}
      </div>
    </div>
  );
}

function convOption(
  conv: Conversation,
  characters: ReturnType<typeof useCharacterStore.getState>['characters'],
): ConvOption {
  if (conv.groupName) {
    return {
      id: conv.id,
      name: conv.groupName,
      avatar: '/resource/avatars/idol-starlight.jpg',
    };
  }
  if (conv.characterId) {
    const ch = characters.find((c) => c.id === conv.characterId);
    return {
      id: conv.id,
      name: conv.remarkName || ch?.name || '?',
      avatar: ch?.avatar?.trim() || CHAR_FALLBACK_AVATAR,
    };
  }
  if (conv.aiChatParticipants) {
    const [a, b] = conv.aiChatParticipants;
    const ch1 = characters.find((c) => c.id === a);
    const ch2 = characters.find((c) => c.id === b);
    return {
      id: conv.id,
      name: `${ch1?.name ?? '?'} & ${ch2?.name ?? '?'}`,
      avatar: ch1?.avatar?.trim() || CHAR_FALLBACK_AVATAR,
    };
  }
  const idol = getIdol(conv.idolId);
  return {
    id: conv.id,
    name: conv.remarkName || idol?.name || conv.idolId,
    avatar: idol?.avatar || CHAR_FALLBACK_AVATAR,
  };
}
