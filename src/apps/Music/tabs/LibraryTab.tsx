import { albums } from '../data';
import { useMusicNavStore } from '../musicStore';

const MUSIC_RED = '#FC3C44';

interface CategoryItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const libraryCategories: CategoryItem[] = [
  { id: 'playlists', label: '播放列表', icon: <PlaylistIcon /> },
  { id: 'artists', label: '艺人', icon: <ArtistIcon /> },
  { id: 'albums', label: '专辑', icon: <AlbumIcon /> },
  { id: 'songs', label: '歌曲', icon: <SongIcon /> },
  { id: 'downloaded', label: '已下载', icon: <DownloadIcon /> },
];

export function LibraryTab() {
  const pushPage = useMusicNavStore((s) => s.pushPage);
  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: '#fff', margin: 0 }}>
          资料库
        </h1>
      </div>

      {/* Category List */}
      <div style={{ paddingInline: 20 }}>
        {libraryCategories.map((cat, i) => (
          <button
            key={cat.id}
            className="flex w-full items-center"
            style={{
              height: 48,
              borderBottom:
                i < libraryCategories.length - 1
                  ? '0.5px solid rgba(84, 84, 88, 0.65)'
                  : 'none',
            }}
            onClick={() => {}}
          >
            <span style={{ color: MUSIC_RED, marginRight: 12 }}>{cat.icon}</span>
            <span style={{ fontSize: 20, color: '#fff', flex: 1, textAlign: 'left' }}>
              {cat.label}
            </span>
            <ChevronRight />
          </button>
        ))}
      </div>

      {/* Recently Added */}
      <div style={{ padding: '24px 20px 8px' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
            最近添加
          </h2>
          <button style={{ fontSize: 15, color: MUSIC_RED }}>查看全部</button>
        </div>

        {/* 2-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            paddingBottom: 120,
          }}
        >
          {albums.map((album) => (
            <button
              key={album.id}
              className="text-left"
              onClick={() => pushPage('album-detail', { albumId: album.id })}
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1',
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
    </div>
  );
}

/* ── Category Icons (SF Symbol stroke style, ~22px) ── */

function PlaylistIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h12M4 10h12M4 14h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M21 16V6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ArtistIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AlbumIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SongIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 3v12M12 15l-4-4M12 15l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
      <path d="M1 1l6 6-6 6" stroke="rgba(235,235,245,0.3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
