import { useMemo } from 'react';
import type { Song } from '../data';
import { useMusicDataStore } from '../musicDataStore';
import { ListMusic, User, Disc3, Music, Download, ChevronRight } from 'lucide-react';

const MUSIC_RED = '#FC3C44';

interface CategoryItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const libraryCategories: CategoryItem[] = [
  { id: 'playlists', label: '播放列表', icon: <ListMusic size={22} color={MUSIC_RED} /> },
  { id: 'artists', label: '艺人', icon: <User size={22} color={MUSIC_RED} /> },
  { id: 'albums', label: '专辑', icon: <Disc3 size={22} color={MUSIC_RED} /> },
  { id: 'songs', label: '歌曲', icon: <Music size={22} color={MUSIC_RED} /> },
  { id: 'downloaded', label: '已下载', icon: <Download size={22} color={MUSIC_RED} /> },
];

export function LibraryTab() {
  const featuredIds = useMusicDataStore((s) => s.featuredIds);
  const songMap = useMusicDataStore((s) => s.songMap);
  const playSong = useMusicDataStore((s) => s.playSong);

  // Show unique albums from featured content
  const albumSongs = useMemo(() => {
    const seen = new Set<string>();
    return featuredIds
      .map((id) => songMap[id])
      .filter((s): s is Song => !!s)
      .filter((s) => {
        if (!s.albumId || seen.has(s.albumId)) return false;
        seen.add(s.albumId);
        return true;
      })
      .slice(0, 12);
  }, [featuredIds, songMap]);

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
            <span style={{ marginRight: 12 }}>{cat.icon}</span>
            <span style={{ fontSize: 20, color: '#fff', flex: 1, textAlign: 'left' }}>
              {cat.label}
            </span>
            <ChevronRight size={14} color="rgba(235,235,245,0.3)" />
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
          {albumSongs.map((song) => (
            <button
              key={song.albumId}
              className="text-left"
              onClick={() => playSong(song.id, featuredIds)}
            >
              <img
                src={song.artworkUrl}
                alt={song.album}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 8,
                  objectFit: 'cover',
                  backgroundColor: '#1c1c1e',
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
                {song.album}
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
                {song.artist}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
