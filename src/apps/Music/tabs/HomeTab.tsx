import { useEffect, useMemo } from 'react';
import type { Song } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';
import { MusicArtwork } from '../MusicArtwork';
import {
  AlbumCard,
  HorizontalShelf,
  MUSIC_ACCENT,
  MUSIC_LABEL,
  MUSIC_SECONDARY,
  MUSIC_TERTIARY,
  MusicHeader,
  MusicPage,
  MusicSection,
  RowGroup,
  SongRow,
  glassStyle,
} from '../musicUi';
import { Loader2, Play, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export function HomeTab() {
  const pushPage = useMusicNavStore((s) => s.pushPage);
  const playSong = useMusicDataStore((s) => s.playSong);
  const featuredIds = useMusicDataStore((s) => s.featuredIds);
  const songMap = useMusicDataStore((s) => s.songMap);
  const isLoading = useMusicDataStore((s) => s.isLoadingFeatured);
  const fetchFeatured = useMusicDataStore((s) => s.fetchFeatured);

  useEffect(() => {
    // Defer the network call until after the app-launch spring animation
    // has had time to settle. `fetchFeatured` is async, but the store
    // update it eventually fires triggers a re-render of the full song
    // grid (hero banner + 3 horizontal carousels of ~30 MusicArtwork
    // cards). That commit is expensive enough to fight the widget→app
    // morph spring for the main thread and shows up as "laggy" launches.
    // A ~200ms delay lets the spring run to its perceived end point
    // before we start rendering content — the user sees a smooth morph
    // followed by content populating, instead of a stutter mid-animation.
    if (typeof window === 'undefined') {
      fetchFeatured();
      return;
    }
    const id = window.setTimeout(() => fetchFeatured(), 200);
    return () => window.clearTimeout(id);
  }, [fetchFeatured]);

  const songs = useMemo(
    () => featuredIds.map((id) => songMap[id]).filter((s): s is Song => !!s),
    [featuredIds, songMap],
  );

  // Split songs into sections
  const heroSong = songs[0];
  const recentSongs = useMemo(() => songs.slice(0, 6), [songs]);
  const forYouSongs = useMemo(() => songs.slice(6, 16), [songs]);
  const newSongs = useMemo(() => songs.slice(16, 30), [songs]);

  if (isLoading && songs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={{ color: MUSIC_SECONDARY, background: '#07070a' }}>
        <Loader2 size={32} className="animate-spin" style={{ marginBottom: 12 }} />
        <span style={{ fontSize: 15 }}>正在加载音乐...</span>
      </div>
    );
  }

  if (!isLoading && songs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={{ color: MUSIC_SECONDARY, background: '#07070a' }}>
        <span style={{ fontSize: 15 }}>无法加载音乐，请稍后再试</span>
      </div>
    );
  }

  return (
    <MusicPage testId="music-home-surface" seed={heroSong?.title}>
      <MusicHeader title="现在就听" eyebrow="为你精选" />

      {heroSong && (
        <FeaturedHero
          song={heroSong}
          onOpen={() => {
            if (heroSong.albumId) pushPage('album-detail', { albumId: heroSong.albumId });
            else playSong(heroSong.id, featuredIds);
          }}
        />
      )}

      {recentSongs.length > 0 && (
        <MusicSection title="最近播放">
          <HorizontalScroll>
            {recentSongs.map((song) => (
              <AlbumCard
                key={song.id}
                title={song.title}
                subtitle={song.artist}
                artworkUrl={song.artworkUrl}
                size={136}
                onClick={() => playSong(song.id, featuredIds)}
              />
            ))}
          </HorizontalScroll>
        </MusicSection>
      )}

      {forYouSongs.length > 0 && (
        <MusicSection title="专属推荐">
          <HorizontalScroll>
            {forYouSongs.map((song) => (
              <AlbumCard
                key={song.id}
                title={song.title}
                subtitle={song.artist}
                artworkUrl={song.artworkUrl}
                size={154}
                onClick={() => playSong(song.id, featuredIds)}
              />
            ))}
          </HorizontalScroll>
        </MusicSection>
      )}

      {newSongs.length > 0 && (
        <MusicSection title="新歌速递">
          <RowGroup>
            {newSongs.slice(0, 9).map((song) => (
              <SongRow
                key={song.id}
                song={song}
                queue={featuredIds}
                onClick={() => playSong(song.id, featuredIds)}
              />
            ))}
          </RowGroup>
        </MusicSection>
      )}
    </MusicPage>
  );
}

/* ── Shared sub-components ── */

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <HorizontalShelf>{children}</HorizontalShelf>
  );
}

function FeaturedHero({ song, onOpen }: { song: Song; onOpen: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.975 }}
      className="w-full text-left"
      onClick={onOpen}
      style={{
        ...glassStyle,
        display: 'block',
        margin: '0 20px 30px',
        width: 'calc(100% - 40px)',
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        aspectRatio: '1.58',
      }}
    >
      <MusicArtwork
        src={song.artworkUrl}
        alt={song.title}
        iconSize={52}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.18) 42%, rgba(0,0,0,0.74) 100%)',
        }}
      />
      <div
        className="absolute left-4 right-4 top-4 flex items-center justify-between"
        style={{
          color: 'rgba(255,255,255,0.78)',
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        <span className="flex items-center gap-1">
          <Sparkles size={14} color={MUSIC_ACCENT} />
          精选推荐
        </span>
        <span style={{ color: MUSIC_TERTIARY }}>HiPhone Music</span>
      </div>
      <div className="absolute bottom-0 left-0 right-0" style={{ padding: '54px 18px 18px' }}>
        <div
          style={{
            color: MUSIC_LABEL,
            fontSize: 28,
            fontWeight: 800,
            lineHeight: 1.05,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {song.title}
        </div>
        <div
          className="flex items-center justify-between"
          style={{ color: MUSIC_SECONDARY, fontSize: 15, marginTop: 7 }}
        >
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {song.artist}
          </span>
          <span
            className="flex items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.16)',
              border: '0.5px solid rgba(255,255,255,0.16)',
              marginLeft: 12,
              flexShrink: 0,
            }}
          >
            <Play size={17} fill={MUSIC_LABEL} color={MUSIC_LABEL} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
