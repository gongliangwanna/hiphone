import { useEffect, useMemo } from 'react';
import type { Song } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';
import { formatDuration } from '../data';
import { MusicArtwork } from '../MusicArtwork';
import { NavBar } from '@/system';
import { Play, Shuffle, Loader2 } from 'lucide-react';

const MUSIC_RED = '#FC3C44';

export function AlbumDetail() {
  const albumId = useMusicNavStore((s) => s.activeAlbumId);
  const popPage = useMusicNavStore((s) => s.popPage);
  const playSong = useMusicDataStore((s) => s.playSong);
  const fetchAlbum = useMusicDataStore((s) => s.fetchAlbum);
  const albumMap = useMusicDataStore((s) => s.albumMap);
  const albumSongIds = useMusicDataStore((s) => s.albumSongIds);
  const songMap = useMusicDataStore((s) => s.songMap);

  useEffect(() => {
    if (albumId) fetchAlbum(albumId);
  }, [albumId, fetchAlbum]);

  const album = albumId ? albumMap[albumId] : undefined;
  const songIds = albumId ? albumSongIds[albumId] : undefined;

  const albumSongs = useMemo(
    () => (songIds ?? []).map((id) => songMap[id]).filter((s): s is Song => !!s),
    [songIds, songMap],
  );

  // If album isn't fetched yet, try to get info from the first song that matches
  const fallbackSong = useMemo(() => {
    if (album || !albumId) return null;
    return Object.values(songMap).find((s) => s.albumId === albumId) ?? null;
  }, [album, albumId, songMap]);

  const displayTitle = album?.title ?? fallbackSong?.album ?? '';
  const displayArtist = album?.artist ?? fallbackSong?.artist ?? '';
  const displayArtwork = album?.artworkUrl ?? fallbackSong?.artworkUrl ?? '';
  const displayYear = album?.year;
  const displaySongIds = songIds ?? [];

  const isLoading = albumId != null && !songIds;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: '#000' }}>
      <NavBar title="" showBack onBack={popPage} backLabel="返回" />

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Album header */}
        <div className="flex flex-col items-center" style={{ padding: '12px 24px 20px' }}>
          <MusicArtwork
            src={displayArtwork}
            alt={displayTitle}
            iconSize={40}
            style={{
              width: 200,
              height: 200,
              borderRadius: 8,
              objectFit: 'cover',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
              marginBottom: 16,
            }}
          />
          <div
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: '#fff',
              textAlign: 'center',
            }}
          >
            {displayTitle}
          </div>
          <div
            style={{
              fontSize: 17,
              color: MUSIC_RED,
              textAlign: 'center',
              marginTop: 2,
            }}
          >
            {displayArtist}
          </div>
          {displayYear && (
            <div
              style={{
                fontSize: 13,
                color: 'rgba(235, 235, 245, 0.3)',
                marginTop: 4,
              }}
            >
              专辑 · {displayYear}
            </div>
          )}
        </div>

        {/* Play / Shuffle buttons */}
        <div className="flex gap-3" style={{ paddingInline: 20, marginBottom: 16 }}>
          <button
            className="flex flex-1 items-center justify-center gap-2"
            style={{
              height: 48,
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: MUSIC_RED,
              fontWeight: 600,
              fontSize: 16,
            }}
            onClick={() => {
              if (displaySongIds[0]) playSong(displaySongIds[0], displaySongIds);
            }}
          >
            <Play size={16} fill="currentColor" />
            播放
          </button>
          <button
            className="flex flex-1 items-center justify-center gap-2"
            style={{
              height: 48,
              borderRadius: 10,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              color: MUSIC_RED,
              fontWeight: 600,
              fontSize: 16,
            }}
            onClick={() => {
              const shuffled = [...displaySongIds].sort(() => Math.random() - 0.5);
              if (shuffled[0]) playSong(shuffled[0], shuffled);
            }}
          >
            <Shuffle size={16} />
            随机播放
          </button>
        </div>

        {/* Song list */}
        <div style={{ paddingInline: 20, paddingBottom: 120 }}>
          {isLoading ? (
            <div className="flex items-center justify-center" style={{ paddingTop: 30 }}>
              <Loader2 size={24} className="animate-spin" color="rgba(235,235,245,0.6)" />
            </div>
          ) : (
            albumSongs.map((song, i) => (
              <button
                key={song.id}
                className="flex w-full items-center"
                style={{
                  height: 52,
                  borderBottom:
                    i < albumSongs.length - 1
                      ? '0.5px solid rgba(84, 84, 88, 0.65)'
                      : 'none',
                }}
                onClick={() => playSong(song.id, displaySongIds)}
              >
                <span
                  style={{
                    width: 24,
                    fontSize: 15,
                    color: 'rgba(235, 235, 245, 0.4)',
                    textAlign: 'right',
                    flexShrink: 0,
                    marginRight: 12,
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 text-left" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 16,
                      color: '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {song.title}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 13,
                    color: 'rgba(235, 235, 245, 0.4)',
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                >
                  {formatDuration(song.duration)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
