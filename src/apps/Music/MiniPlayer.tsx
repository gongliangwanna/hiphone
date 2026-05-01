import { useMusicDataStore, useCurrentSong } from './musicDataStore';
import { useMusicNavStore } from './musicStore';
import { MusicArtwork } from './MusicArtwork';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { PlayIcon, PauseIcon, SkipNextIcon } from './PlaybackIcons';
import { MUSIC_ACCENT, MUSIC_LABEL, MUSIC_SECONDARY, MUSIC_SEPARATOR, glassStyle } from './musicUi';

export function MiniPlayer() {
  const currentSong = useCurrentSong();
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const isBuffering = useMusicDataStore((s) => s.isBuffering);
  const progress = useMusicDataStore((s) => s.progress);
  const togglePlay = useMusicDataStore((s) => s.togglePlay);
  const skipNext = useMusicDataStore((s) => s.skipNext);
  const openNowPlaying = useMusicNavStore((s) => s.openNowPlaying);

  if (!currentSong) return null;

  const progressRatio = currentSong.duration > 0 ? Math.min(progress / currentSong.duration, 1) : 0;

  return (
    <motion.div
      whileTap={{ scale: 0.975 }}
      className="flex w-full cursor-pointer items-center text-left"
      role="button"
      tabIndex={0}
      data-testid="music-mini-player"
      style={{
        ...glassStyle,
        height: 68,
        marginInline: 12,
        width: 'calc(100% - 24px)',
        borderRadius: 22,
        padding: '0 12px',
        overflow: 'hidden',
        position: 'relative',
      }}
      onClick={openNowPlaying}
    >
      <div
        data-testid="music-mini-progress"
        style={{
          position: 'absolute',
          left: 18,
          right: 18,
          top: 0,
          height: 2,
          backgroundColor: 'rgba(255,255,255,0.10)',
        }}
      >
        <div
          style={{
            width: `${progressRatio * 100}%`,
            height: '100%',
            backgroundColor: MUSIC_ACCENT,
            borderRadius: 2,
          }}
        />
      </div>

      <MusicArtwork
        src={currentSong.artworkUrl}
        alt={currentSong.title}
        iconSize={20}
        style={{
          width: 44,
          height: 44,
          borderRadius: 9,
          flexShrink: 0,
          objectFit: 'cover',
          backgroundColor: '#1c1c1e',
          boxShadow: '0 8px 20px rgba(0,0,0,0.26)',
        }}
      />

      <div className="flex-1" style={{ padding: '0 14px', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: MUSIC_LABEL,
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
            fontWeight: 500,
            color: MUSIC_SECONDARY,
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

      <div
        className="flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: 19,
            backgroundColor: 'rgba(255,255,255,0.08)',
            border: `0.5px solid ${MUSIC_SEPARATOR}`,
          }}
          onClick={togglePlay}
          data-testid="mini-play-pause"
        >
          {isBuffering ? (
            <Loader2 size={22} color={MUSIC_LABEL} className="animate-spin" />
          ) : isPlaying ? (
            <PauseIcon size={20} color={MUSIC_LABEL} />
          ) : (
            <PlayIcon size={20} color={MUSIC_LABEL} />
          )}
        </button>
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={skipNext}
          data-testid="mini-skip-next"
        >
          <SkipNextIcon size={20} color={MUSIC_LABEL} />
        </button>
      </div>
    </motion.div>
  );
}
