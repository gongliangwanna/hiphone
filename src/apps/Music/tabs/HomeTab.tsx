import { albums, playlists, songs } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';

const MUSIC_RED = '#FC3C44';

export function HomeTab() {
  const pushPage = useMusicNavStore((s) => s.pushPage);
  const playSong = useMusicDataStore((s) => s.playSong);

  const heroAlbum = albums[0];

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: '#fff', margin: 0 }}>
          现在就听
        </h1>
      </div>

      {/* Hero Banner */}
      {heroAlbum && (
        <div style={{ paddingInline: 20, marginBottom: 24 }}>
          <button
            className="w-full text-left"
            onClick={() => pushPage('album-detail', { albumId: heroAlbum.id })}
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              background: heroAlbum.cover,
              aspectRatio: '16/9',
              position: 'relative',
            }}
          >
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
                精选专辑
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>
                {heroAlbum.title}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                {heroAlbum.artist}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Recently Played */}
      <Section title="最近播放">
        <HorizontalScroll>
          {albums.slice(0, 5).map((album) => (
            <AlbumCard
              key={album.id}
              title={album.title}
              subtitle={album.artist}
              cover={album.cover}
              onClick={() => pushPage('album-detail', { albumId: album.id })}
            />
          ))}
        </HorizontalScroll>
      </Section>

      {/* For You Mixes */}
      <Section title="专属推荐">
        <HorizontalScroll>
          {playlists.map((pl) => (
            <AlbumCard
              key={pl.id}
              title={pl.title}
              subtitle={pl.description}
              cover={pl.cover}
              onClick={() => {
                if (pl.songs[0]) playSong(pl.songs[0], pl.songs);
              }}
            />
          ))}
        </HorizontalScroll>
      </Section>

      {/* New Releases */}
      <Section title="新歌速递">
        <div style={{ paddingInline: 20, paddingBottom: 120 }}>
          {songs.slice(0, 8).map((song, i) => (
            <button
              key={song.id}
              className="flex w-full items-center"
              style={{
                height: 56,
                borderBottom: i < 7 ? '0.5px solid rgba(84, 84, 88, 0.65)' : 'none',
              }}
              onClick={() => playSong(song.id)}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 6,
                  background: song.cover,
                  flexShrink: 0,
                  marginRight: 12,
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
              <MoreIcon />
            </button>
          ))}
        </div>
      </Section>
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

function AlbumCard({
  title,
  subtitle,
  cover,
  onClick,
}: {
  title: string;
  subtitle: string;
  cover: string;
  onClick: () => void;
}) {
  return (
    <button
      className="shrink-0 text-left"
      style={{ width: 170, scrollSnapAlign: 'start' }}
      onClick={onClick}
    >
      <div
        style={{
          width: 170,
          height: 170,
          borderRadius: 8,
          background: cover,
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
    </button>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginLeft: 8 }}>
      <circle cx="12" cy="5" r="1.5" fill="rgba(235,235,245,0.3)" />
      <circle cx="12" cy="12" r="1.5" fill="rgba(235,235,245,0.3)" />
      <circle cx="12" cy="19" r="1.5" fill="rgba(235,235,245,0.3)" />
    </svg>
  );
}
