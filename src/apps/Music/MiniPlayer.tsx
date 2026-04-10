import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';

export function MiniPlayer() {
  const currentSong = useCurrentSong();
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const togglePlay = useMusicDataStore((s) => s.togglePlay);
  const skipNext = useMusicDataStore((s) => s.skipNext);
  const openNowPlaying = useMusicNavStore((s) => s.openNowPlaying);

  if (!currentSong) return null;

  return (
    <button
      className="flex w-full items-center text-left"
      style={{
        height: 56,
        marginInline: 8,
        width: 'calc(100% - 16px)',
        borderRadius: 12,
        backgroundColor: 'rgba(50, 50, 54, 0.9)',
        padding: '0 12px',
        overflow: 'hidden',
      }}
      onClick={openNowPlaying}
    >
      {/* Album art */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          background: currentSong.cover,
          flexShrink: 0,
        }}
      />

      {/* Song info */}
      <div className="flex-1" style={{ padding: '0 12px', minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: '#fff',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentSong.title}
        </div>
      </div>

      {/* Controls */}
      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={togglePlay}
          data-testid="mini-play-pause"
        >
          {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={skipNext}
          data-testid="mini-skip-next"
        >
          <SkipNextIcon />
        </button>
      </div>
    </button>
  );
}

/* ── SF Symbol style icons ── */

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 4l14 8-14 8V4z" fill="#fff" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="5" y="4" width="4.5" height="16" rx="1" fill="#fff" />
      <rect x="14.5" y="4" width="4.5" height="16" rx="1" fill="#fff" />
    </svg>
  );
}

function SkipNextIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M4 4l12 8-12 8V4z" fill="#fff" />
      <rect x="18" y="4" width="3" height="16" rx="1" fill="#fff" />
    </svg>
  );
}
