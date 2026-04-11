import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';
import { MusicArtwork } from './MusicArtwork';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { PlayIcon, PauseIcon, SkipNextIcon } from './PlaybackIcons';

export function MiniPlayer() {
  const currentSong = useCurrentSong();
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const isBuffering = useMusicDataStore((s) => s.isBuffering);
  const togglePlay = useMusicDataStore((s) => s.togglePlay);
  const skipNext = useMusicDataStore((s) => s.skipNext);
  const openNowPlaying = useMusicNavStore((s) => s.openNowPlaying);

  if (!currentSong) return null;

  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className="flex w-full cursor-pointer items-center text-left"
      role="button"
      tabIndex={0}
      style={{
        height: 64,
        marginInline: 12,
        width: 'calc(100% - 24px)',
        borderRadius: 20,
        backgroundColor: 'rgba(40, 40, 44, 0.65)',
        backdropFilter: 'blur(30px) saturate(200%)',
        WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.5), inset 0 0.5px 0.5px rgba(255,255,255,0.2)',
        padding: '0 12px',
        overflow: 'hidden',
      }}
      onClick={openNowPlaying}
    >
      {/* Album art */}
      <MusicArtwork
        src={currentSong.artworkUrl}
        alt={currentSong.title}
        iconSize={20}
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          flexShrink: 0,
          objectFit: 'cover',
          backgroundColor: '#1c1c1e',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      />

      {/* Song info */}
      <div className="flex-1" style={{ padding: '0 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
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
            fontSize: 14,
            fontWeight: 400,
            color: 'rgba(235, 235, 245, 0.6)',
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
          {isBuffering ? (
            <Loader2 size={22} color="#fff" className="animate-spin" />
          ) : isPlaying ? (
            <PauseIcon size={20} color="#fff" />
          ) : (
            <PlayIcon size={20} color="#fff" />
          )}
        </button>
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={skipNext}
          data-testid="mini-skip-next"
        >
          <SkipNextIcon size={20} color="#fff" />
        </button>
      </div>
    </motion.div>
  );
}
