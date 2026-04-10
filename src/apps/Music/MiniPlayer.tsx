import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';
import { Play, Pause, SkipForward } from 'lucide-react';

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
      <img
        src={currentSong.artworkUrl}
        alt={currentSong.album}
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          flexShrink: 0,
          objectFit: 'cover',
          backgroundColor: '#1c1c1e',
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
          {isPlaying ? (
            <Pause size={22} fill="#fff" color="#fff" />
          ) : (
            <Play size={22} fill="#fff" color="#fff" />
          )}
        </button>
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={skipNext}
          data-testid="mini-skip-next"
        >
          <SkipForward size={20} fill="#fff" color="#fff" />
        </button>
      </div>
    </button>
  );
}
