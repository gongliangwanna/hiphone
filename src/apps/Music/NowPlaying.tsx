import { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';
import { formatDuration } from './data';
import { seekAudio } from './usePlaybackEngine';
import { spring } from '@/platform/design-tokens/motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  MoreVertical,
  Volume1,
  Volume2,
  MessageSquareText,
  Airplay,
  ListMusic,
} from 'lucide-react';

export function NowPlaying() {
  const currentSong = useCurrentSong();
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
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

  if (!currentSong) return null;

  const duration = currentSong.duration;
  const progressRatio = duration > 0 ? Math.min(progress / duration, 1) : 0;
  const elapsed = formatDuration(Math.floor(progress));
  const remaining = `-${formatDuration(Math.max(0, Math.floor(duration - progress)))}`;

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ zIndex: 50, overflow: 'hidden' }}
      initial={{ y: '100%' }}
      animate={{ y: '0%' }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', ...spring.smooth }}
    >
      {/* Adaptive background from album artwork */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${currentSong.artworkUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
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
              overflow: 'hidden',
              boxShadow: '0 8px 28px rgba(0, 0, 0, 0.4)',
            }}
          >
            <img
              src={currentSong.artworkUrl}
              alt={currentSong.album}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </motion.div>
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
              <MoreVertical size={22} color="rgba(255,255,255,0.5)" />
            </button>
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
            style={{ marginTop: 20, paddingInline: 8 }}
          >
            <button
              className="flex items-center justify-center"
              style={{ width: 44, height: 44 }}
              onClick={toggleShuffle}
            >
              <Shuffle
                size={22}
                color={shuffle ? '#fff' : 'rgba(255,255,255,0.5)'}
              />
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 52, height: 52 }}
              onClick={skipPrev}
            >
              <SkipBack size={32} fill="#fff" color="#fff" />
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 64, height: 64 }}
              onClick={togglePlay}
            >
              {isPlaying ? (
                <Pause size={44} fill="#fff" color="#fff" />
              ) : (
                <Play size={44} fill="#fff" color="#fff" />
              )}
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 52, height: 52 }}
              onClick={skipNext}
            >
              <SkipForward size={32} fill="#fff" color="#fff" />
            </button>
            <button
              className="flex items-center justify-center"
              style={{ width: 44, height: 44 }}
              onClick={cycleRepeat}
            >
              {repeat === 'one' ? (
                <Repeat1 size={22} color="#fff" />
              ) : (
                <Repeat
                  size={22}
                  color={repeat !== 'off' ? '#fff' : 'rgba(255,255,255,0.5)'}
                />
              )}
            </button>
          </div>

          {/* Volume slider */}
          <div className="flex items-center gap-2" style={{ marginTop: 24 }}>
            <Volume1 size={14} color="rgba(255,255,255,0.5)" />
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
            <Volume2 size={14} color="rgba(255,255,255,0.5)" />
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
              <MessageSquareText size={22} color="currentColor" />
            </button>
            <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <Airplay size={22} color="currentColor" />
            </button>
            <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
              <ListMusic size={22} color="currentColor" />
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
      onSeek((x / rect.width) * duration);
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
      onSeek((x / rect.width) * duration);
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
