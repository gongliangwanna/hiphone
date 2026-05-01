import { useMemo, useCallback } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { useNotesNavStore } from './notesNavStore';
import { useActiveNotesStore } from './notesDataStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { getIdol } from '@/apps/XingYu/data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useToastStore } from '@/system';
import { Avatar } from '@/apps/XingYu/components/Avatar';
import { stripHtml } from './richTextUtils';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface ShareSheetProps {
  noteId: string;
}

interface ShareTarget {
  convId: string;
  name: string;
  avatar: string;
  fallbackText?: string;
  ringIndex: number;
}

export function ShareSheet({ noteId }: ShareSheetProps) {
  const close = useNotesNavStore((s) => s.closeShareSheet);
  const note = useActiveNotesStore((s) => s.notes.find((n) => n.id === noteId));
  const conversations = useXYData((s) => s.conversations);
  const characters = useCharacterStore((s) => s.characters);

  const targets = useMemo<ShareTarget[]>(() => {
    return conversations
      .filter((c) => !c.aiChatParticipants) // exclude AI-AI conversations
      .map((conv) => {
        // Character-backed conversation
        if (conv.characterId) {
          const ch = characters.find((c) => c.id === conv.characterId);
          if (!ch) return null;
          return {
            convId: conv.id,
            name: conv.remarkName || ch.name,
            avatar: ch.avatar?.trim() || CHAR_FALLBACK_AVATAR,
            ringIndex: 0,
          };
        }
        // Group conversation
        if (conv.groupName) {
          return {
            convId: conv.id,
            name: conv.groupName,
            avatar: conv.groupAvatar?.trim() || '',
            fallbackText: '群',
            ringIndex: 0,
          };
        }
        // Mock idol conversation
        const idol = getIdol(conv.idolId);
        if (!idol) return null;
        return {
          convId: conv.id,
          name: conv.remarkName || idol.name,
          avatar: idol.avatar,
          ringIndex: idol.ringIndex,
        };
      })
      .filter((t): t is ShareTarget => t !== null)
      .sort((a, b) => {
        const convA = conversations.find((c) => c.id === a.convId);
        const convB = conversations.find((c) => c.id === b.convId);
        return (convB?.lastTime ?? 0) - (convA?.lastTime ?? 0);
      });
  }, [conversations, characters]);

  const handleShare = useCallback(
    (target: ShareTarget) => {
      if (!note) return;
      useXYData.getState().sendNoteMessage(target.convId, {
        noteId: noteId,
        title: note.title,
        body: stripHtml(note.body),
      });
      useToastStore.getState().show(`已分享到 ${target.name}`);
      close();
    },
    [note, noteId, close],
  );

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={close} />

      {/* Bottom sheet */}
      <motion.div
        className="relative mt-auto flex flex-col"
        style={{
          backgroundColor: 'var(--color-secondarySystemBackground)',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          maxHeight: '60%',
          paddingBottom: 'var(--app-safe-bottom, 0px)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}
      >
        {/* Drag indicator */}
        <div className="flex justify-center py-2">
          <div
            style={{
              width: 36,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: 'var(--color-tertiaryLabel)',
              opacity: 0.4,
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <span
            style={{
              fontSize: 'var(--font-size-headline)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-label)',
            }}
          >
            分享到信语
          </span>
          <button
            type="button"
            className="flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(118,118,128,0.12)',
              color: 'var(--color-secondaryLabel)',
            }}
            onClick={close}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-auto">
          {targets.length === 0 ? (
            <div
              className="flex items-center justify-center py-8"
              style={{
                color: 'var(--color-secondaryLabel)',
                fontSize: 'var(--font-size-footnote)',
              }}
            >
              暂无可分享的联系人
            </div>
          ) : (
            targets.map((target) => (
              <button
                key={target.convId}
                type="button"
                className="flex w-full items-center gap-3 px-4"
                style={{ minHeight: 56 }}
                onClick={() => handleShare(target)}
              >
                <Avatar
                  src={target.avatar}
                  fallbackText={target.fallbackText}
                  size={40}
                  ringIndex={target.ringIndex}
                />
                <span
                  className="truncate"
                  style={{
                    fontSize: 'var(--font-size-body)',
                    color: 'var(--color-label)',
                    fontWeight: 'var(--font-weight-regular)',
                  }}
                >
                  {target.name}
                </span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
