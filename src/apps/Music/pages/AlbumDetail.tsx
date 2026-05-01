import { useEffect, useMemo } from 'react';
import type { Song } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';
import { MusicArtwork } from '../MusicArtwork';
import { Play, Shuffle, Loader2, ChevronLeft } from 'lucide-react';
import {
  MUSIC_ACCENT,
  MUSIC_LABEL,
  MUSIC_SECONDARY,
  MUSIC_SEPARATOR,
  MUSIC_TERTIARY,
  RowGroup,
  SongRow,
  createMusicBackdrop,
  glassStyle,
} from '../musicUi';

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
    <div className="relative flex h-full flex-col overflow-hidden" style={{ background: createMusicBackdrop(displayTitle) }}>
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,8,11,0.42), rgba(5,5,7,0.96))' }} />

      <div
        className="relative flex items-center justify-center"
        style={{
          height: 48,
          borderBottom: `0.5px solid ${MUSIC_SEPARATOR}`,
          backgroundColor: 'rgba(10,10,14,0.42)',
          backdropFilter: 'blur(14px) saturate(150%)',
          WebkitBackdropFilter: 'blur(14px) saturate(150%)',
        }}
      >
        <button
          className="absolute left-2 flex items-center"
          style={{
            minWidth: 44,
            minHeight: 44,
            color: MUSIC_ACCENT,
            fontSize: 17,
            fontWeight: 600,
          }}
          onClick={popPage}
        >
          <ChevronLeft size={26} strokeWidth={2.5} />
          返回
        </button>
        <div style={{ color: MUSIC_LABEL, fontSize: 17, fontWeight: 700 }}>专辑</div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex flex-col items-center" style={{ padding: '24px 24px 24px' }}>
          <MusicArtwork
            src={displayArtwork}
            alt={displayTitle}
            iconSize={40}
            style={{
              width: 216,
              height: 216,
              borderRadius: 18,
              objectFit: 'cover',
              boxShadow: '0 28px 58px rgba(0, 0, 0, 0.52), 0 0 0 0.5px rgba(255,255,255,0.1)',
              marginBottom: 18,
            }}
          />
          <div
            style={{
              fontSize: 25,
              fontWeight: 820,
              color: MUSIC_LABEL,
              textAlign: 'center',
              lineHeight: 1.12,
              maxWidth: '100%',
            }}
          >
            {displayTitle}
          </div>
          <div
            style={{
              fontSize: 17,
              color: MUSIC_ACCENT,
              fontWeight: 650,
              textAlign: 'center',
              marginTop: 5,
            }}
          >
            {displayArtist}
          </div>
          {displayYear && (
            <div
              style={{
                fontSize: 13,
                color: MUSIC_TERTIARY,
                marginTop: 4,
              }}
            >
              专辑 · {displayYear}
            </div>
          )}
        </div>

        <div className="flex gap-3" style={{ paddingInline: 20, marginBottom: 16 }}>
          <button
            className="flex flex-1 items-center justify-center gap-2"
            style={{
              ...glassStyle,
              height: 48,
              borderRadius: 14,
              color: MUSIC_ACCENT,
              fontWeight: 750,
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
              ...glassStyle,
              height: 48,
              borderRadius: 14,
              color: MUSIC_ACCENT,
              fontWeight: 750,
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

        <div style={{ paddingBottom: 158 }}>
          {isLoading ? (
            <div className="flex items-center justify-center" style={{ paddingTop: 30 }}>
              <Loader2 size={24} className="animate-spin" color={MUSIC_SECONDARY} />
            </div>
          ) : (
            <RowGroup>
              {albumSongs.map((song) => (
                <SongRow
                  key={song.id}
                  song={song}
                  queue={displaySongIds}
                  showDuration
                  onClick={() => playSong(song.id, displaySongIds)}
                />
              ))}
            </RowGroup>
          )}
        </div>
      </div>
    </div>
  );
}
