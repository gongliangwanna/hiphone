import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
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
  Repeat1
} from 'lucide-react';
import { PlayIcon, PauseIcon, SkipNextIcon, SkipPrevIcon } from './PlaybackIcons';
import { LyricsView } from './LyricsView';
import { MusicShareSheet } from './MusicShareSheet';
import { AnimatePresence } from 'motion/react';

/** Dismiss threshold: drag distance (px) or velocity (px/ms) to trigger close. */
const DISMISS_DIST = 100;
const DISMISS_VEL = 0.5; // px/ms ≈ 500 px/s

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

  // ── Swipe-down-to-dismiss gesture ──
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const prevY = useRef(0);
  const prevTime = useRef(0);
  const velocityY = useRef(0);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    dragStartY.current = e.clientY;
    prevY.current = e.clientY;
    prevTime.current = performance.now();
    velocityY.current = 0;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (contentRef.current) contentRef.current.style.transition = 'none';
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const dy = Math.max(0, e.clientY - dragStartY.current);
    if (contentRef.current) contentRef.current.style.transform = `translateY(${dy}px)`;
    // Track velocity
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

    if (dy > DISMISS_DIST || velocityY.current > DISMISS_VEL) {
      closeNowPlaying();
    } else if (contentRef.current) {
      contentRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      contentRef.current.style.transform = 'translateY(0)';
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
      <div ref={contentRef} className="flex h-full flex-col" style={{ overflow: 'hidden' }}>
        {/* Solid opaque background */}
        <div className="absolute inset-0 bg-[#1c1c1e]" />

        {/* Content */}
        <div
          className="relative flex min-h-0 flex-1 flex-col items-center"
          style={{ paddingTop: 'var(--app-safe-top, 0px)' }}
        >
          {/* Drag handle — always swipeable */}
          <div
            className="flex items-center justify-center"
            style={{ width: '100%', height: 36, touchAction: 'none', cursor: 'grab' }}
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onClick={closeNowPlaying}
          >
            <div
              style={{
                width: 36,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.3)',
              }}
            />
          </div>

          {/* Album artwork / Lyrics toggle area */}
          <div
            style={{
              flex: 1, width: '100%', padding: '0 24px', minHeight: 0,
              marginTop: showLyrics ? 0 : 20,
              touchAction: showLyrics ? undefined : 'none',
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
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              >
                <LyricsView />
              </motion.div>
            ) : (
              <motion.div
                key="artwork"
                className="flex h-full items-center justify-center"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                    animate={{ scale: isPlaying ? 1 : 0.85 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                    style={{
                      width: '100%',
                      maxWidth: 380,
                      aspectRatio: '1',
                      borderRadius: 16,
                      overflow: 'hidden',
                      boxShadow: isPlaying ? '0 30px 60px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255,255,255,0.05)' : '0 12px 30px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                  <MusicArtwork
                    src={currentSong.artworkUrl}
                    alt={currentSong.title}
                    iconSize={60}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Song info + controls section */}
        <div style={{ width: '100%', padding: '0 24px', paddingBottom: 24 }}>
          {/* Song info */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 26,
                fontWeight: 700,
                color: '#fff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              {currentSong.title}
            </div>
            <div
              style={{
                fontSize: 20,
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.65)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: 2,
                lineHeight: 1.2,
              }}
            >
              {currentSong.artist}
            </div>
          </div>

          {/* Progress bar */}
          <ProgressBar
            ratio={progressRatio}
            elapsed={elapsed}
            remaining={remaining}
            duration={duration}
            onSeek={handleSeek}
          />

          {/* Playback controls */}
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 20, paddingInline: 4 }}
          >
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44 }}
              onClick={toggleShuffle}
            >
              <Shuffle
                size={22}
                color={shuffle ? '#fff' : 'rgba(255,255,255,0.4)'}
              />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ width: 56, height: 56 }}
              onClick={skipPrev}
            >
              <SkipPrevIcon size={36} color="#fff" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ width: 72, height: 72 }}
              onClick={togglePlay}
            >
              {isBuffering ? (
                <Loader2 size={48} color="#fff" className="animate-spin" />
              ) : isPlaying ? (
                <PauseIcon size={44} color="#fff" />
              ) : (
                <PlayIcon size={44} color="#fff" />
              )}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ width: 56, height: 56 }}
              onClick={skipNext}
            >
              <SkipNextIcon size={36} color="#fff" />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44 }}
              onClick={cycleRepeat}
            >
              {repeat === 'one' ? (
                <Repeat1 size={22} color="#fff" />
              ) : (
                <Repeat
                  size={22}
                  color={repeat !== 'off' ? '#fff' : 'rgba(255,255,255,0.4)'}
                />
              )}
            </motion.button>
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-3" style={{ marginTop: 16 }}>
            <Volume1 size={14} color="rgba(255,255,255,0.5)" />
            <div
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: '60%',
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: '#fff',
                }}
              />
            </div>
            <Volume2 size={14} color="rgba(255,255,255,0.5)" />
          </div>

          {/* Bottom action buttons */}
          <div
            className="flex items-center justify-between"
            style={{
              marginTop: 16,
              paddingInline: 16,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ 
                width: 44, 
                height: 44, 
                backgroundColor: showLyrics ? 'rgba(255,255,255,0.2)' : 'transparent',
                borderRadius: '50%'
              }}
              onClick={() => setShowLyrics((v) => !v)}
            >
              <MessageSquareText size={20} color={showLyrics ? '#fff' : 'currentColor'} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.8 }}
              className="flex items-center justify-center"
              style={{ width: 44, height: 44 }}
              onClick={() => setShowShareSheet(true)}
            >
              <Share2 size={20} color="currentColor" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.8 }} className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <ListMusic size={20} color="currentColor" />
            </motion.button>
          </div>
        </div>

        {/* Failed song toast */}
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
                  backgroundColor: 'rgba(60, 60, 67, 0.9)',
                  borderRadius: 10,
                  padding: '10px 20px',
                  fontSize: 14,
                  color: '#fff',
                  maxWidth: '80%',
                  textAlign: 'center',
                }}
              >
                「{failedSongName}」暂时无法播放，已跳过
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>{/* end content */}

      {/* Share sheet */}
      <AnimatePresence>
        {showShareSheet && (
          <MusicShareSheet onClose={() => setShowShareSheet(false)} />
        )}
      </AnimatePresence>
      </div>{/* end contentRef */}
    </motion.div>
  );
}

/* ── Progress Bar ── */

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
    <div>
      {/* 44px tall touch target for easy scrubbing on mobile */}
      <div
        ref={trackRef}
        className="relative"
        style={{
          height: 44,
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
            height: dragging ? 8 : 4,
            borderRadius: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            position: 'relative',
            transition: 'height 0.2s',
          }}
        >
          <div
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              borderRadius: 4,
              backgroundColor: dragging ? '#fff' : 'rgba(255, 255, 255, 0.85)',
            }}
          />
          {/* Scrubber knob — hidden normally, visible when dragging */}
          <div
            style={{
              position: 'absolute',
              left: `${ratio * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: dragging ? 18 : 0,
              height: dragging ? 18 : 0,
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'width 0.2s, height 0.2s',
              boxShadow: dragging ? '0 2px 8px rgba(0,0,0,0.3)' : 'none',
            }}
          />
        </div>
      </div>
      <div className="flex justify-between" style={{ marginTop: -6 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{elapsed}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{remaining}</span>
      </div>
    </div>
  );
}
