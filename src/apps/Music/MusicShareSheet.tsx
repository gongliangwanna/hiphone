import { useMemo, useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, Loader2 } from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { useCurrentSong, useMusicDataStore } from './musicDataStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { getIdol } from '@/apps/XingYu/data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useToastStore } from '@/system';
import { Avatar } from '@/apps/XingYu/components/Avatar';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface MusicShareSheetProps {
  onClose: () => void;
}

interface ShareTarget {
  convId: string;
  name: string;
  avatar: string;
  fallbackText?: string;
  ringIndex: number;
}

export function MusicShareSheet({ onClose }: MusicShareSheetProps) {
  const song = useCurrentSong();
  const lyricsCache = useMusicDataStore((s) => s.lyricsCache);
  const loadLyrics = useMusicDataStore((s) => s.loadLyrics);
  const conversations = useXYData((s) => s.conversations);
  const characters = useCharacterStore((s) => s.characters);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Proactively load lyrics on mount
  const songId = song?.id ?? '';
  const lyricsReady = !!lyricsCache[songId];
  useEffect(() => {
    if (!songId || lyricsReady) return;
    setLyricsLoading(true);
    loadLyrics(songId).finally(() => setLyricsLoading(false));
  }, [songId, lyricsReady, loadLyrics]);

  const targets = useMemo<ShareTarget[]>(() => {
    return conversations
      .filter((c) => !c.aiChatParticipants)
      .map((conv) => {
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
        if (conv.groupName) {
          return {
            convId: conv.id,
            name: conv.groupName,
            avatar: conv.groupAvatar?.trim() || '',
            fallbackText: '群',
            ringIndex: 0,
          };
        }
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

  const doSend = useCallback(
    (target: ShareTarget, lyrics: string | undefined) => {
      if (!song) return;
      useXYData.getState().sendSongMessage(
        target.convId,
        {
          songId: song.id,
          title: song.title,
          artist: song.artist,
          artworkUrl: song.artworkUrl,
        },
        lyrics,
      );
      useToastStore.getState().show(`已分享到 ${target.name}`);
      setSendingTo(null);
      onClose();
    },
    [song, onClose],
  );

  const handleShare = useCallback(
    async (target: ShareTarget) => {
      if (!song) return;

      const cached = useMusicDataStore.getState().lyricsCache[song.id];
      if (cached?.length) {
        doSend(target, cached.map((l) => l.text).filter(Boolean).join('\n'));
        return;
      }

      // Lyrics still loading — wait for it
      if (lyricsLoading) {
        setSendingTo(target.convId);
        return;
      }

      // No lyrics available at all, send without
      doSend(target, undefined);
    },
    [song, lyricsLoading, doSend],
  );

  // When lyrics finish loading and we have a pending send target, complete it
  useEffect(() => {
    if (lyricsLoading || !sendingTo || !song) return;
    const target = targets.find((t) => t.convId === sendingTo);
    if (!target) { setSendingTo(null); return; }
    const cached = lyricsCache[song.id];
    const text = cached?.length
      ? cached.map((l) => l.text).filter(Boolean).join('\n')
      : undefined;
    doSend(target, text);
  }, [lyricsLoading, sendingTo, song, targets, lyricsCache, doSend]);

  return (
    <motion.div
      className="absolute inset-0 z-[60] flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Bottom sheet */}
      <motion.div
        className="relative mt-auto flex flex-col"
        style={{
          backgroundColor: 'rgba(30,30,30,0.95)',
          borderTopLeftRadius: 14,
          borderTopRightRadius: 14,
          maxHeight: '55%',
          paddingBottom: 'var(--app-safe-bottom, 0px)',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', ...spring.smooth }}
      >
        {/* Drag indicator */}
        <div className="flex justify-center py-2">
          <div style={{ width: 36, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.3)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3">
          <span style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>
            分享到信语
          </span>
          <button
            type="button"
            className="flex items-center justify-center"
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.7)',
            }}
            onClick={onClose}
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Song preview card */}
        {song && (
          <div
            className="mx-4 mb-3 flex items-center gap-3"
            style={{
              padding: 10,
              borderRadius: 10,
              backgroundColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <img
              src={song.artworkUrl}
              alt=""
              className="shrink-0"
              style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }}
              draggable={false}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>
                {song.title}
              </div>
              <div className="truncate" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                {song.artist}
              </div>
            </div>
            {/* Lyrics loading indicator */}
            {lyricsLoading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                className="shrink-0"
              >
                <Loader2 size={16} color="rgba(255,255,255,0.4)" />
              </motion.div>
            )}
            {!lyricsLoading && lyricsReady && (
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>
                含歌词
              </span>
            )}
          </div>
        )}

        {/* Conversation list */}
        <div className="flex-1 overflow-auto">
          {targets.length === 0 ? (
            <div
              className="flex items-center justify-center py-8"
              style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}
            >
              暂无可分享的联系人
            </div>
          ) : (
            targets.map((target) => (
              <button
                key={target.convId}
                type="button"
                className="flex w-full items-center gap-3 px-4"
                style={{ minHeight: 56, opacity: sendingTo === target.convId ? 0.5 : 1 }}
                onClick={() => handleShare(target)}
                disabled={!!sendingTo}
              >
                <Avatar src={target.avatar} fallbackText={target.fallbackText} size={40} ringIndex={target.ringIndex} />
                <span
                  className="truncate flex-1 text-left"
                  style={{ fontSize: 15, color: '#fff', fontWeight: 400 }}
                >
                  {target.name}
                </span>
                {sendingTo === target.convId && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="shrink-0"
                  >
                    <Loader2 size={16} color="rgba(255,255,255,0.5)" />
                  </motion.div>
                )}
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
