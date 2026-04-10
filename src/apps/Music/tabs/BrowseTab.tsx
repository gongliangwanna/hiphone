import { categories, playlists, albums } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';

export function BrowseTab() {
  const pushPage = useMusicNavStore((s) => s.pushPage);
  const playSong = useMusicDataStore((s) => s.playSong);

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: '#fff', margin: 0 }}>
          浏览
        </h1>
      </div>

      {/* Featured Playlists */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, paddingInline: 20, marginBottom: 12 }}>
          编辑精选
        </h2>
        <div
          className="flex gap-3 overflow-x-auto"
          style={{
            paddingInline: 20,
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
          }}
        >
          {playlists.map((pl) => (
            <button
              key={pl.id}
              className="shrink-0 text-left"
              style={{ width: 200, scrollSnapAlign: 'start' }}
              onClick={() => {
                if (pl.songs[0]) playSong(pl.songs[0], pl.songs);
              }}
            >
              <div
                style={{
                  width: 200,
                  height: 200,
                  borderRadius: 8,
                  background: pl.cover,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '28px 10px 10px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>
                    {pl.title}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                    {pl.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Hot Albums */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, paddingInline: 20, marginBottom: 12 }}>
          热门专辑
        </h2>
        <div
          className="flex gap-3 overflow-x-auto"
          style={{
            paddingInline: 20,
            scrollSnapType: 'x mandatory',
            scrollbarWidth: 'none',
          }}
        >
          {albums.slice(0, 6).map((album) => (
            <button
              key={album.id}
              className="shrink-0 text-left"
              style={{ width: 160, scrollSnapAlign: 'start' }}
              onClick={() => pushPage('album-detail', { albumId: album.id })}
            >
              <div
                style={{
                  width: 160,
                  height: 160,
                  borderRadius: 8,
                  background: album.cover,
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
                {album.title}
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
                {album.artist}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Categories Grid */}
      <div style={{ paddingInline: 20, paddingBottom: 120 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 12 }}>
          按类别浏览
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12,
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              style={{
                height: 56,
                borderRadius: 8,
                background: `linear-gradient(135deg, ${cat.gradient[0]}, ${cat.gradient[1]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
