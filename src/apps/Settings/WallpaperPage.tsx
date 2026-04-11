import { useSystemStore } from '@/platform/stores/systemStore';
import { wallpapers } from '@/shell/Springboard/apps.data';
import { List, ListSection } from '@/system';

export function WallpaperPage() {
  const wallpaperId = useSystemStore((s) => s.wallpaperId);
  const setWallpaper = useSystemStore((s) => s.setWallpaper);

  return (
    <div data-testid="wallpaper-page" className="h-full">
      <List>
        <ListSection title="选取新壁纸">
          <div
            style={{
              padding: 'var(--spacing-3)',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 'var(--spacing-3)',
            }}
          >
            {wallpapers.map((w) => {
              const isSelected = w.id === wallpaperId;
              return (
                <div
                  key={w.id}
                  data-testid={`wallpaper-thumb-${w.id}`}
                  onClick={() => setWallpaper(w.id)}
                  style={{
                    position: 'relative',
                    aspectRatio: '9 / 16',
                    borderRadius: 'var(--radius-chip)',
                    backgroundImage: `url(${w.src})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    cursor: 'pointer',
                    overflow: 'hidden',
                  }}
                >
                  {isSelected && (
                    <div
                      data-testid="wallpaper-check"
                      style={{
                        position: 'absolute',
                        bottom: 8,
                        right: 8,
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-systemBlue)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2 7L5.5 10.5L12 4"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ListSection>
      </List>
    </div>
  );
}
