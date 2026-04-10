import { stations } from '../data';
import { useMusicDataStore } from '../musicDataStore';
import { songs } from '../data';

export function RadioTab() {
  const playSong = useMusicDataStore((s) => s.playSong);

  const playRandomSong = () => {
    if (songs.length === 0) return;
    const randomSong = songs[Math.floor(Math.random() * songs.length)]!;
    playSong(randomSong.id);
  };

  const featuredStation = stations[0];

  return (
    <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: '#fff', margin: 0 }}>
          广播
        </h1>
      </div>

      {/* Featured Station */}
      {featuredStation && (
        <div style={{ paddingInline: 20, marginBottom: 24 }}>
          <button
            className="w-full text-left"
            style={{
              borderRadius: 12,
              overflow: 'hidden',
              background: `linear-gradient(135deg, ${featuredStation.color}, ${featuredStation.color}88)`,
              position: 'relative',
              height: 200,
            }}
            onClick={playRandomSong}
          >
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: 20,
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                直播
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>
                {featuredStation.name}
              </div>
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }}>
                {featuredStation.description}
              </div>
            </div>
            <div
              style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: '#34C759',
                boxShadow: '0 0 6px #34C759',
              }}
            />
          </button>
        </div>
      )}

      {/* Station List */}
      <div style={{ paddingInline: 20, paddingBottom: 120 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 12 }}>
          电台
        </h2>
        <div className="flex flex-col gap-3">
          {stations.slice(1).map((station) => (
            <button
              key={station.id}
              className="flex items-center text-left"
              style={{
                height: 80,
                borderRadius: 12,
                backgroundColor: 'rgba(28, 28, 30, 0.8)',
                overflow: 'hidden',
              }}
              onClick={playRandomSong}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  background: station.cover,
                  flexShrink: 0,
                }}
              />
              <div style={{ padding: '0 16px', flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 600,
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {station.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: 'rgba(235, 235, 245, 0.6)',
                    marginTop: 2,
                  }}
                >
                  {station.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
