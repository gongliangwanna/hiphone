import { useEffect, useMemo } from 'react';
import type { Song } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';
import { MusicArtwork } from '../MusicArtwork';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';

const MUSIC_RED = '#FC3C44';

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
      <div className="flex h-full flex-col items-center justify-center" style={{ color: 'rgba(235,235,245,0.6)' }}>
        <Loader2 size={32} className="animate-spin" style={{ marginBottom: 12 }} />
        <span style={{ fontSize: 15 }}>正在加载音乐...</span>
      </div>
    );
  }

  if (!isLoading && songs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center" style={{ color: 'rgba(235,235,245,0.6)' }}>
        <span style={{ fontSize: 15 }}>无法加载音乐，请稍后再试</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: '#fff', margin: 0 }}>
          现在就听
        </h1>
      </div>

      {/* Hero Banner */}
      {heroSong && (
        <div style={{ paddingInline: 20, marginBottom: 24 }}>
          <motion.button
            whileTap={{ scale: 0.96 }}
            className="w-full text-left"
            onClick={() => {
              if (heroSong.albumId) pushPage('album-detail', { albumId: heroSong.albumId });
              else playSong(heroSong.id, featuredIds);
            }}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              aspectRatio: '16/9',
              position: 'relative',
              boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            }}
          >
            <MusicArtwork
              src={heroSong.artworkUrl}
              alt={heroSong.title}
              iconSize={48}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: '40px 16px 16px',
                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
              }}
            >
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: 0.5 }}>
                精选推荐
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {heroSong.title}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                {heroSong.artist}
              </div>
            </div>
          </motion.button>
        </div>
      )}

      {/* Recently Played */}
      {recentSongs.length > 0 && (
        <Section title="最近播放">
          <HorizontalScroll>
            {recentSongs.map((song) => (
              <SongCard
                key={song.id}
                title={song.title}
                subtitle={song.artist}
                artworkUrl={song.artworkUrl}
                onClick={() => playSong(song.id, featuredIds)}
              />
            ))}
          </HorizontalScroll>
        </Section>
      )}

      {/* For You */}
      {forYouSongs.length > 0 && (
        <Section title="专属推荐">
          <HorizontalScroll>
            {forYouSongs.map((song) => (
              <SongCard
                key={song.id}
                title={song.title}
                subtitle={song.artist}
                artworkUrl={song.artworkUrl}
                onClick={() => playSong(song.id, featuredIds)}
              />
            ))}
          </HorizontalScroll>
        </Section>
      )}

      {/* New Releases */}
      {newSongs.length > 0 && (
        <Section title="新歌速递">
          <div style={{ paddingInline: 20, paddingBottom: 120 }}>
            {newSongs.map((song, i) => (
              <motion.button
                whileTap={{ scale: 0.98, backgroundColor: 'rgba(255,255,255,0.05)' }}
                key={song.id}
                className="flex w-full items-center"
                style={{
                  height: 56,
                  borderBottom: i < newSongs.length - 1 ? '0.5px solid rgba(84, 84, 88, 0.65)' : 'none',
                  borderRadius: 8,
                  padding: '0 8px',
                  margin: '0 -8px',
                }}
                onClick={() => playSong(song.id, featuredIds)}
              >
                <MusicArtwork
                  src={song.artworkUrl}
                  alt={song.title}
                  iconSize={16}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 6,
                    flexShrink: 0,
                    marginRight: 12,
                    objectFit: 'cover',
                  }}
                />
                <div className="flex-1 text-left" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {song.title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'rgba(235, 235, 245, 0.6)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {song.artist}
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

/* ── Shared sub-components ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="flex items-center justify-between" style={{ paddingInline: 20, marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
          {title}
        </h2>
        <button style={{ fontSize: 15, color: MUSIC_RED }}>查看全部</button>
      </div>
      {children}
    </div>
  );
}

function HorizontalScroll({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 overflow-x-auto"
      style={{
        paddingInline: 20,
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
      }}
    >
      {children}
    </div>
  );
}

function SongCard({
  title,
  subtitle,
  artworkUrl,
  onClick,
}: {
  title: string;
  subtitle: string;
  artworkUrl: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className="shrink-0 text-left"
      style={{ width: 170, scrollSnapAlign: 'start' }}
      onClick={onClick}
    >
      <MusicArtwork
        src={artworkUrl}
        alt={title}
        iconSize={36}
        style={{
          width: 170,
          height: 170,
          borderRadius: 8,
          objectFit: 'cover',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      />
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#fff',
          marginTop: 6,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'rgba(235, 235, 245, 0.6)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {subtitle}
      </div>
    </motion.button>
  );
}
