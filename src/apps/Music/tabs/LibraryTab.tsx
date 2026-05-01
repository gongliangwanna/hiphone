import { useMemo } from 'react';
import type { Song } from '../data';
import { useMusicDataStore } from '../musicDataStore';
import { ListMusic, User, Disc3, Music, Download, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import {
  AlbumCard,
  MUSIC_ACCENT,
  MUSIC_LABEL,
  MUSIC_PANEL,
  MUSIC_SECONDARY,
  MUSIC_SEPARATOR,
  MusicHeader,
  MusicPage,
  MusicSection,
} from '../musicUi';

interface CategoryItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const libraryCategories: CategoryItem[] = [
  { id: 'playlists', label: '播放列表', icon: <ListMusic size={22} color={MUSIC_ACCENT} /> },
  { id: 'artists', label: '艺人', icon: <User size={22} color={MUSIC_ACCENT} /> },
  { id: 'albums', label: '专辑', icon: <Disc3 size={22} color={MUSIC_ACCENT} /> },
  { id: 'songs', label: '歌曲', icon: <Music size={22} color={MUSIC_ACCENT} /> },
  { id: 'downloaded', label: '已下载', icon: <Download size={22} color={MUSIC_ACCENT} /> },
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
    <MusicPage testId="music-library-surface" seed="library">
      <MusicHeader title="资料库" eyebrow="本机音乐" />

      <div style={{ paddingInline: 20, marginBottom: 28 }}>
        <div
          style={{
            backgroundColor: MUSIC_PANEL,
            borderRadius: 18,
            overflow: 'hidden',
            border: `0.5px solid ${MUSIC_SEPARATOR}`,
          }}
        >
          {libraryCategories.map((cat, i) => (
            <motion.button
              whileTap={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              key={cat.id}
              className="flex w-full items-center"
              style={{
                height: 55,
                padding: '0 16px',
              }}
              onClick={() => {}}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  backgroundColor: 'rgba(255, 59, 73, 0.13)',
                  marginRight: 12,
                }}
              >
                {cat.icon}
              </span>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 650,
                  color: MUSIC_LABEL,
                  flex: 1,
                  textAlign: 'left',
                  borderBottom: i < libraryCategories.length - 1 ? `0.5px solid ${MUSIC_SEPARATOR}` : 'none',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {cat.label}
              </span>
              <ChevronRight size={16} color="rgba(235,235,245,0.34)" />
            </motion.button>
          ))}
        </div>
      </div>

      <MusicSection title="最近添加">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
            paddingInline: 20,
          }}
        >
          {albumSongs.map((song) => (
            <AlbumCard
              key={song.albumId}
              title={song.album}
              subtitle={song.artist}
              artworkUrl={song.artworkUrl}
              size={0}
              onClick={() => playSong(song.id, featuredIds)}
            />
          ))}
        </div>
        {albumSongs.length === 0 && (
          <div style={{ paddingInline: 20, color: MUSIC_SECONDARY, fontSize: 15 }}>
            暂无音乐
          </div>
        )}
      </MusicSection>
    </MusicPage>
  );
}
