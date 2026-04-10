import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';
import { formatDuration } from './data';
import { spring } from '@/platform/design-tokens/motion';

export function NowPlaying() {
  const currentSong = useCurrentSong();
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const progress = useMusicDataStore((s) => s.progress);
  const shuffle = useMusicDataStore((s) => s.shuffle);
  const repeat = useMusicDataStore((s) => s.repeat);
  const togglePlay = useMusicDataStore((s) => s.togglePlay);
  const skipNext = useMusicDataStore((s) => s.skipNext);
  const skipPrev = useMusicDataStore((s) => s.skipPrev);
  const setProgress = useMusicDataStore((s) => s.setProgress);
  const toggleShuffle = useMusicDataStore((s) => s.toggleShuffle);
  const cycleRepeat = useMusicDataStore((s) => s.cycleRepeat);
  const closeNowPlaying = useMusicNavStore((s) => s.closeNowPlaying);

  if (!currentSong) return null;

  const progressRatio = currentSong.duration > 0 ? progress / currentSong.duration : 0;
  const elapsed = formatDuration(Math.floor(progress));
  const remaining = `-${formatDuration(Math.floor(currentSong.duration - progress))}`;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{
        zIndex: 50,
        overflow: 'hidden',
      }}
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', ...spring.smooth }}
    >
      {/* Adaptive background from album cover */}
      <div
        className="absolute inset-0"
        style={{
          background: currentSong.cover,
          filter: 'blur(60px) saturate(1.5) brightness(0.4)',
          transform: 'scale(1.5)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
      />

      {/* Content */}
      <div
        className="relative flex min-h-0 flex-1 flex-col items-center"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Drag handle */}
        <button
          className="flex items-center justify-center"
          style={{ width: '100%', height: 36 }}
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
        </button>

        {/* Album artwork */}
        <div
          className="flex items-center justify-center"
          style={{ flex: 1, width: '100%', padding: '0 24px' }}
        >
          <motion.div
            animate={{ scale: isPlaying ? 1 : 0.85 }}
            transition={{ type: 'spring', ...spring.smooth }}
            style={{
              width: '100%',
              maxWidth: 340,
              aspectRatio: '1',
              borderRadius: 12,
              background: currentSong.cover,
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4)',
            }}
          />
        </div>

        {/* Song info + controls section */}
        <div style={{ width: '100%', padding: '0 24px', paddingBottom: 40 }}>
          {/* Song info */}
          <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: '#fff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentSong.title}
              </div>
              <div
                style={{
                  fontSize: 22,
                  color: 'rgba(255, 255, 255, 0.6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {currentSong.artist}
              </div>
            </div>
            <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <MoreDotsIcon />
            </button>
          </div>

          {/* Progress bar */}
          <ProgressBar
            ratio={progressRatio}
            elapsed={elapsed}
            remaining={remaining}
            duration={currentSong.duration}
            onSeek={setProgress}
          />

          {/* Playback controls */}
          <div
            className="flex items-center justify-between"
            style={{ marginTop: 20, paddingInline: 8 }}
          >
            <button
              className="flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                color: shuffle ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
              onClick={toggleShuffle}
            >
              <ShuffleIcon />
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, color: '#fff' }}
              onClick={skipPrev}
            >
              <SkipPrevLargeIcon />
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 64, height: 64, color: '#fff' }}
              onClick={togglePlay}
            >
              {isPlaying ? <PauseLargeIcon /> : <PlayLargeIcon />}
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 52, height: 52, color: '#fff' }}
              onClick={skipNext}
            >
              <SkipNextLargeIcon />
            </button>
            <button
              className="flex items-center justify-center"
              style={{
                width: 44,
                height: 44,
                color:
                  repeat !== 'off' ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
              onClick={cycleRepeat}
            >
              {repeat === 'one' ? <RepeatOneIcon /> : <RepeatIcon />}
            </button>
          </div>

          {/* Volume slider */}
          <div
            className="flex items-center gap-2"
            style={{ marginTop: 24 }}
          >
            <VolumeDownIcon />
            <div
              style={{
                flex: 1,
                height: 3,
                borderRadius: 1.5,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }}
            >
              <div
                style={{
                  width: '60%',
                  height: '100%',
                  borderRadius: 1.5,
                  backgroundColor: 'rgba(255, 255, 255, 0.6)',
                }}
              />
            </div>
            <VolumeUpIcon />
          </div>

          {/* Bottom action buttons */}
          <div
            className="flex items-center justify-between"
            style={{
              marginTop: 16,
              paddingInline: 24,
              color: 'rgba(255, 255, 255, 0.5)',
            }}
          >
            <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <LyricsIcon />
            </button>
            <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <AirplayIcon />
            </button>
            <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <QueueIcon />
            </button>
          </div>
        </div>
      </div>
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
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setIsDragging(true);
      const track = trackRef.current;
      if (!track) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      onSeek(Math.floor((x / rect.width) * duration));
    },
    [duration, onSeek],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging) return;
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      onSeek(Math.floor((x / rect.width) * duration));
    },
    [isDragging, duration, onSeek],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div>
      <div
        ref={trackRef}
        className="relative"
        style={{
          height: 20,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          style={{
            width: '100%',
            height: 3,
            borderRadius: 1.5,
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            position: 'relative',
          }}
        >
          <div
            style={{
              width: `${ratio * 100}%`,
              height: '100%',
              borderRadius: 1.5,
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
            }}
          />
          {/* Scrubber knob */}
          <div
            style={{
              position: 'absolute',
              left: `${ratio * 100}%`,
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: isDragging ? 12 : 0,
              height: isDragging ? 12 : 0,
              borderRadius: '50%',
              backgroundColor: '#fff',
              transition: 'width 0.15s, height 0.15s',
            }}
          />
        </div>
      </div>
      <div className="flex justify-between">
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{elapsed}</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{remaining}</span>
      </div>
    </div>
  );
}

/* ── SF Symbol style icons ── */

function PlayLargeIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <path d="M6 3l16 9-16 9V3z" fill="currentColor" />
    </svg>
  );
}

function PauseLargeIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" />
      <rect x="14.5" y="3" width="5.5" height="18" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function SkipPrevLargeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M20 20L8 12l12-8v16z" fill="currentColor" />
      <rect x="3" y="4" width="3" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

function SkipNextLargeIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M4 4l12 8-12 8V4z" fill="currentColor" />
      <rect x="18" y="4" width="3" height="16" rx="1" fill="currentColor" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 1l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 23l-4-4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RepeatOneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M17 1l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 11V9a4 4 0 014-4h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 23l-4-4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M21 13v2a4 4 0 01-4 4H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <text x="12" y="14.5" fill="currentColor" fontSize="8" fontWeight="700" textAnchor="middle">1</text>
    </svg>
  );
}

function MoreDotsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="5" r="1.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.5)" />
      <circle cx="12" cy="19" r="1.5" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

function VolumeDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VolumeUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2v6h4l5 4V5z" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.54 8.46a5 5 0 010 7.07M19.07 4.93a10 10 0 010 14.14" stroke="rgba(255,255,255,0.5)" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function LyricsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 8h10M7 12h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AirplayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M5 17H4a2 2 0 01-2-2V5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2h-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 15l5 6H7l5-6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
