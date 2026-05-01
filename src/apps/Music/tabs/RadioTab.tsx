import { useCallback, useMemo } from 'react';
import { stations } from '../data';
import { useMusicDataStore } from '../musicDataStore';
import { MusicArtwork } from '../MusicArtwork';
import { motion } from 'motion/react';
import { Radio, Signal, Play } from 'lucide-react';
import {
  MUSIC_ACCENT,
  MUSIC_LABEL,
  MUSIC_PANEL_STRONG,
  MUSIC_SECONDARY,
  MUSIC_SEPARATOR,
  MUSIC_TERTIARY,
  MusicHeader,
  MusicPage,
  MusicSection,
  glassStyle,
} from '../musicUi';

export function RadioTab() {
  const playSong = useMusicDataStore((s) => s.playSong);
  const featuredIds = useMusicDataStore((s) => s.featuredIds);
  const songMap = useMusicDataStore((s) => s.songMap);
  const searchFn = useMusicDataStore((s) => s.search);

  const playStation = useCallback(
    async (searchTerm: string) => {
      // Search for genre-specific songs and play the first result
      await searchFn(searchTerm);
      const { searchResultIds } = useMusicDataStore.getState();
      if (searchResultIds.length > 0) {
        playSong(searchResultIds[0]!, searchResultIds);
      }
    },
    [searchFn, playSong],
  );

  const playRandomFeatured = useCallback(() => {
    if (featuredIds.length === 0) return;
    const randomId = featuredIds[Math.floor(Math.random() * featuredIds.length)]!;
    playSong(randomId, featuredIds);
  }, [featuredIds, playSong]);

  const featuredStation = stations[0];

  // Show featured songs with artwork for station backgrounds
  const stationPreviewSongs = useMemo(() => {
    return featuredIds.slice(0, stations.length).map((id) => songMap[id]);
  }, [featuredIds, songMap]);

  return (
    <MusicPage testId="music-radio-surface" seed="radio">
      <MusicHeader title="广播" eyebrow="实时电台" />

      {featuredStation && (
        <div style={{ paddingInline: 20, marginBottom: 24 }}>
          <motion.button
            whileTap={{ scale: 0.975 }}
            className="w-full text-left"
            style={{
              ...glassStyle,
              borderRadius: 22,
              overflow: 'hidden',
              position: 'relative',
              height: 214,
              background:
                'radial-gradient(circle at 16% 14%, rgba(255,59,72,0.36) 0, transparent 44%), radial-gradient(circle at 90% 100%, rgba(255,204,0,0.18) 0, transparent 46%), linear-gradient(135deg, rgba(44,44,52,0.86), rgba(16,16,20,0.92))',
            }}
            onClick={playRandomFeatured}
          >
            <div
              className="absolute right-5 top-5 flex items-center gap-2"
              style={{ color: MUSIC_SECONDARY, fontSize: 13, fontWeight: 650 }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 5,
                  backgroundColor: '#34C759',
                  boxShadow: '0 0 12px rgba(52,199,89,0.75)',
                }}
              />
              直播
            </div>
            <Radio
              size={96}
              color="rgba(255,255,255,0.11)"
              style={{ position: 'absolute', right: 24, bottom: 26 }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                padding: 22,
              }}
            >
              <div className="flex items-center gap-2" style={{ color: MUSIC_ACCENT, fontSize: 13, fontWeight: 750 }}>
                <Signal size={16} />
                HiPhone Radio
              </div>
              <div style={{ fontSize: 31, fontWeight: 850, color: MUSIC_LABEL, marginTop: 8, lineHeight: 1.05 }}>
                {featuredStation.name}
              </div>
              <div style={{ fontSize: 15, color: MUSIC_SECONDARY, marginTop: 7 }}>
                {featuredStation.description}
              </div>
            </div>
          </motion.button>
        </div>
      )}

      <MusicSection title="电台" action={false}>
        <div className="flex flex-col" style={{ gap: 12, paddingInline: 20 }}>
          {stations.slice(1).map((station, i) => {
            const previewSong = stationPreviewSongs[i + 1];
            return (
              <motion.button
                whileTap={{ scale: 0.985 }}
                key={station.id}
                className="flex items-center text-left"
                style={{
                  minHeight: 86,
                  borderRadius: 18,
                  backgroundColor: MUSIC_PANEL_STRONG,
                  border: `0.5px solid ${MUSIC_SEPARATOR}`,
                  overflow: 'hidden',
                }}
                onClick={() => playStation(station.searchTerm)}
              >
                <div
                  style={{
                    width: 86,
                    height: 86,
                    background: station.gradient,
                    flexShrink: 0,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {previewSong?.artworkUrl && (
                    <MusicArtwork
                      src={previewSong.artworkUrl}
                      alt={previewSong.title ?? ''}
                      iconSize={24}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.64,
                      }}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(135deg, transparent, rgba(0,0,0,0.28))',
                    }}
                  />
                </div>
                <div style={{ padding: '0 16px', flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      color: MUSIC_LABEL,
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
                      color: MUSIC_SECONDARY,
                      marginTop: 2,
                    }}
                  >
                    {station.description}
                  </div>
                </div>
                <span
                  className="flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: MUSIC_TERTIARY,
                    marginRight: 12,
                    flexShrink: 0,
                  }}
                >
                  <Play size={15} fill="currentColor" />
                </span>
              </motion.button>
            );
          })}
        </div>
      </MusicSection>
    </MusicPage>
  );
}
