import { getAlbumById, getAlbumSongs, formatDuration } from '../data';
import { useMusicNavStore } from '../musicStore';
import { useMusicDataStore } from '../musicDataStore';
import { NavBar } from '@/system';

const MUSIC_RED = '#FC3C44';

export function AlbumDetail() {
  const albumId = useMusicNavStore((s) => s.activeAlbumId);
  const popPage = useMusicNavStore((s) => s.popPage);
  const playSong = useMusicDataStore((s) => s.playSong);

  const album = albumId ? getAlbumById(albumId) : undefined;
  const albumSongs = albumId ? getAlbumSongs(albumId) : [];

  if (!album) return null;

  const songIds = albumSongs.map((s) => s.id);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: '#000' }}>
      <NavBar title="" showBack onBack={popPage} backLabel="返回" />

      <div className="min-h-0 flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {/* Album header */}
        <div className="flex flex-col items-center" style={{ padding: '12px 24px 20px' }}>
          <div
            style={{
              width: 200,
              height: 200,
              borderRadius: 8,
              background: album.cover,
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
            {album.title}
          </div>
          <div
            style={{
              fontSize: 17,
              color: MUSIC_RED,
              textAlign: 'center',
              marginTop: 2,
            }}
          >
            {album.artist}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(235, 235, 245, 0.3)',
              marginTop: 4,
            }}
          >
            专辑 · {album.year}
          </div>
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
              if (songIds[0]) playSong(songIds[0], songIds);
            }}
          >
            <PlaySmallIcon />
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
              const shuffled = [...songIds].sort(() => Math.random() - 0.5);
              if (shuffled[0]) playSong(shuffled[0], shuffled);
            }}
          >
            <ShuffleSmallIcon />
            随机播放
          </button>
        </div>

        {/* Song list */}
        <div style={{ paddingInline: 20, paddingBottom: 120 }}>
          {albumSongs.map((song, i) => (
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
              onClick={() => playSong(song.id, songIds)}
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
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaySmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M6 4l14 8-14 8V4z" fill="currentColor" />
    </svg>
  );
}

function ShuffleSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M16 3h5v5M4 20l17-17M21 16v5h-5M15 15l6 6M4 4l5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
