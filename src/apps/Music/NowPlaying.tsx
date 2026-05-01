import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';
import { formatDuration } from './data';
import { seekAudio } from './usePlaybackEngine';
import { MusicArtwork } from './MusicArtwork';
import { spring } from '@/platform/design-tokens/motion';
import {
  Loader2,
  Volume1,
  Volume2,
  MessageSquareText,
  Share2,
  ListMusic,
  Shuffle,
  Repeat,
  Repeat1,
} from 'lucide-react';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPrevIcon } from './PlaybackIcons';
import { LyricsView } from './LyricsView';
import { MusicShareSheet } from './MusicShareSheet';
import {
  MUSIC_ACCENT,
  MUSIC_BG,
  MUSIC_LABEL,
  MUSIC_SECONDARY,
  MUSIC_SEPARATOR,
  MUSIC_TERTIARY,
  createMusicBackdrop,
  glassStyle,
} from './musicUi';

const DISMISS_DIST = 100;
const DISMISS_VEL = 0.5;

export function NowPlaying() {
  const currentSong = useCurrentSong();
  const [showLyrics, setShowLyrics] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const isBuffering = useMusicDataStore((s) => s.isBuffering);
  const failedSongName = useMusicDataStore((s) => s.failedSongName);
  const progress = useMusicDataStore((s) => s.progress);
  const shuffle = useMusicDataStore((s) => s.shuffle);
  const repeat = useMusicDataStore((s) => s.repeat);
  const togglePlay = useMusicDataStore((s) => s.togglePlay);
  const skipNext = useMusicDataStore((s) => s.skipNext);
  const skipPrev = useMusicDataStore((s) => s.skipPrev);
  const toggleShuffle = useMusicDataStore((s) => s.toggleShuffle);
  const cycleRepeat = useMusicDataStore((s) => s.cycleRepeat);
  const closeNowPlaying = useMusicNavStore((s) => s.closeNowPlaying);

  const handleSeek = useCallback((seconds: number) => {
    useMusicDataStore.getState().setProgress(seconds);
    seekAudio(seconds);
  }, []);

  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const prevY = useRef(0);
  const prevTime = useRef(0);
  const velocityY = useRef(0);
  const dragFrameRef = useRef<number | null>(null);
  const pendingDragY = useRef(0);

  useEffect(() => {
    return () => {
      if (dragFrameRef.current != null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    prevY.current = e.clientY;
    prevTime.current = performance.now();
    velocityY.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (contentRef.current) {
      contentRef.current.style.transition = 'none';
      contentRef.current.style.willChange = 'transform';
    }
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    pendingDragY.current = dy;
    if (dragFrameRef.current == null) {
      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = null;
        if (contentRef.current) {
          contentRef.current.style.transform = `translateY(${pendingDragY.current}px)`;
        }
      });
    }

    const now = performance.now();
    const dt = now - prevTime.current;
    if (dt > 0) velocityY.current = (e.clientY - prevY.current) / dt;
    prevY.current = e.clientY;
    prevTime.current = now;
  }, []);

  const onDragEnd = useCallback(() => {
    if (dragStartY.current === null) return;
    const dy = Math.max(0, prevY.current - dragStartY.current);
    dragStartY.current = null;
    if (dragFrameRef.current != null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }

    if (dy > DISMISS_DIST || velocityY.current > DISMISS_VEL) {
      closeNowPlaying();
    } else if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      contentRef.current.style.transform = 'translateY(0)';
      window.setTimeout(() => {
        if (contentRef.current) contentRef.current.style.willChange = '';
      }, 360);
    }
  }, [closeNowPlaying]);

  if (!currentSong) return null;

  const duration = currentSong.duration;
  const progressRatio = duration > 0 ? Math.min(progress / duration, 1) : 0;
  const elapsed = formatDuration(Math.floor(progress));
  const remaining = `-${formatDuration(Math.max(0, Math.floor(duration - progress)))}`;

  return (
    <motion.div
      className="absolute"
      data-testid="music-now-playing"
      style={{
        top: 'calc(-1 * var(--app-safe-top, 0px))',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
      }}
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', ...spring.smooth }}
    >
      <div
        ref={contentRef}
        className="relative flex h-full flex-col overflow-hidden"
        style={{ background: createMusicBackdrop(currentSong.title) }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(6,6,9,0.28) 0%, rgba(7,7,10,0.72) 48%, rgba(4,4,6,0.96) 100%)',
          }}
        />

        <div
          className="relative flex min-h-0 flex-1 flex-col"
          style={{
            paddingTop: 'var(--app-safe-top, 0px)',
            paddingBottom: 'max(18px, var(--app-safe-bottom, 0px))',
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{ width: '100%', height: 42, touchAction: 'none', cursor: 'grab' }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onClick={closeNowPlaying}
          >
            <div
              style={{
                width: 42,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.34)',
              }}
            />
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col"
            style={{ padding: '0 24px 0' }}
          >
            <div
              className="flex min-h-0 flex-1 items-center justify-center"
              style={{
                touchAction: showLyrics ? undefined : 'none',
                padding: '8px 0 18px',
              }}
              onPointerDown={showLyrics ? undefined : onDragStart}
              onPointerMove={showLyrics ? undefined : onDragMove}
              onPointerUp={showLyrics ? undefined : onDragEnd}
              onPointerCancel={showLyrics ? undefined : onDragEnd}
            >
              <AnimatePresence mode="wait" initial={false}>
                {showLyrics ? (
                  <motion.div
                    key="lyrics"
                    className="h-full w-full"
                    style={{
                      minHeight: 260,
                      overflow: 'hidden',
                    }}
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -20, scale: 0.96 }}
                    transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <LyricsView />
                  </motion.div>
                ) : (
                  <motion.div
                    key="artwork"
                    initial={{ opacity: 0, y: 18, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: isPlaying ? 1 : 0.97 }}
                    exit={{ opacity: 0, y: -18, scale: 0.96 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                    style={{
                      width: 'min(76vw, 340px)',
                      maxWidth: '100%',
                      aspectRatio: '1',
                      borderRadius: 20,
                      overflow: 'hidden',
                      boxShadow: '0 32px 72px rgba(0, 0, 0, 0.56), 0 0 0 0.5px rgba(255,255,255,0.12)',
                    }}
                  >
                    <MusicArtwork
                      src={currentSong.artworkUrl}
                      alt={currentSong.title}
                      iconSize={62}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div style={{ width: '100%' }}>
              <div style={{ marginBottom: 18 }}>
                <div
                  style={{
                    fontSize: 29,
                    fontWeight: 820,
                    color: MUSIC_LABEL,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.12,
                    letterSpacing: 0,
                  }}
                >
                  {currentSong.title}
                </div>
                <div
                  style={{
                    fontSize: 19,
                    fontWeight: 600,
                    color: MUSIC_SECONDARY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 4,
                    lineHeight: 1.18,
                  }}
                >
                  {currentSong.artist}
                </div>
              </div>

              <ProgressBar
                ratio={progressRatio}
                elapsed={elapsed}
                remaining={remaining}
                duration={duration}
                onSeek={handleSeek}
              />

              <div className="flex items-center justify-between" style={{ marginTop: 18 }}>
                <TransportButton active={shuffle} onClick={toggleShuffle}>
                  <Shuffle size={22} color={shuffle ? MUSIC_ACCENT : MUSIC_TERTIARY} />
                </TransportButton>
                <TransportButton onClick={skipPrev} size={54}>
                  <SkipPrevIcon size={35} color={MUSIC_LABEL} />
                </TransportButton>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  className="flex items-center justify-center"
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 35,
                    backgroundColor: MUSIC_LABEL,
                    boxShadow: '0 16px 36px rgba(0,0,0,0.34)',
                  }}
                  onClick={togglePlay}
                  data-testid="music-now-play-pause"
                >
                  {isBuffering ? (
                    <Loader2 size={36} color={MUSIC_BG} className="animate-spin" />
                  ) : isPlaying ? (
                    <PauseIcon size={34} color={MUSIC_BG} />
                  ) : (
                    <PlayIcon size={34} color={MUSIC_BG} />
                  )}
                </motion.button>
                <TransportButton onClick={skipNext} size={54}>
                  <SkipNextIcon size={35} color={MUSIC_LABEL} />
                </TransportButton>
                <TransportButton active={repeat !== 'off'} onClick={cycleRepeat}>
                  {repeat === 'one' ? (
                    <Repeat1 size={22} color={MUSIC_ACCENT} />
                  ) : (
                    <Repeat size={22} color={repeat !== 'off' ? MUSIC_ACCENT : MUSIC_TERTIARY} />
                  )}
                </TransportButton>
              </div>

              <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
                <Volume1 size={15} color={MUSIC_TERTIARY} />
                <div
                  style={{
                    flex: 1,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '62%',
                      height: '100%',
                      borderRadius: 3,
                      backgroundColor: MUSIC_LABEL,
                    }}
                  />
                </div>
                <Volume2 size={15} color={MUSIC_TERTIARY} />
              </div>

              <div
                data-testid="music-now-actions"
                className="flex items-center justify-between"
                style={{ marginTop: 16, paddingInline: 10 }}
              >
                <ActionButton active={showLyrics} onClick={() => setShowLyrics((v) => !v)}>
                  <MessageSquareText size={21} color={showLyrics ? MUSIC_LABEL : MUSIC_TERTIARY} />
                </ActionButton>
                <ActionButton onClick={() => setShowShareSheet(true)}>
                  <Share2 size={21} color={MUSIC_TERTIARY} />
                </ActionButton>
                <ActionButton>
                  <ListMusic size={21} color={MUSIC_TERTIARY} />
                </ActionButton>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {failedSongName && (
              <motion.div
                className="absolute left-0 right-0 flex justify-center"
                style={{ top: 60, zIndex: 60 }}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div
                  style={{
                    ...glassStyle,
                    borderRadius: 14,
                    padding: '10px 18px',
                    fontSize: 14,
                    color: MUSIC_LABEL,
                    maxWidth: '82%',
                    textAlign: 'center',
                  }}
                >
                  「{failedSongName}」暂时无法播放，已跳过
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showShareSheet && (
            <MusicShareSheet onClose={() => setShowShareSheet(false)} />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function TransportButton({
  children,
  onClick,
  active = false,
  size = 44,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  size?: number;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      className="flex items-center justify-center"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: active ? 'rgba(255, 59, 73, 0.14)' : 'transparent',
      }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

function ActionButton({
  children,
  onClick,
  active = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      className="flex items-center justify-center"
      style={{
        width: 48,
        height: 42,
        borderRadius: 16,
        backgroundColor: active ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
        border: `0.5px solid ${MUSIC_SEPARATOR}`,
      }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}

function ProgressBar({
  ratio,
  elapsed,
  remaining,
  duration,
  onSeek,
}: {
  ratio: number;
  elapsed: string;
  remaining: string;
  duration: number;
  onSeek: (seconds: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const [dragging, setDragging] = useState(false);

  const seekFromEvent = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || duration <= 0) return;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      onSeek((x / rect.width) * duration);
    },
    [duration, onSeek],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      setDragging(true);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      seekFromEvent(e.clientX);
    },
    [seekFromEvent],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
    setDragging(false);
  }, []);

  return (
    <div data-testid="music-now-progress">
      <div
        ref={trackRef}
        className="relative"
        style={{
          height: 34,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          style={{
            width: '100%',
            height: dragging ? 7 : 4,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
            position: 'relative',
            transition: 'height 0.2s',
          }}
        >
          <div
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: dragging ? MUSIC_LABEL : 'rgba(255, 255, 255, 0.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${ratio * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: dragging ? 18 : 0,
              height: dragging ? 18 : 0,
              borderRadius: '50%',
              backgroundColor: MUSIC_LABEL,
              transition: 'width 0.2s, height 0.2s',
              boxShadow: dragging ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            }}
          />
        </div>
      </div>
      <div className="flex justify-between" style={{ marginTop: -2 }}>
        <span style={{ fontSize: 12, color: MUSIC_TERTIARY }}>{elapsed}</span>
        <span style={{ fontSize: 12, color: MUSIC_TERTIARY }}>{remaining}</span>
      </div>
    </div>
  );
}
