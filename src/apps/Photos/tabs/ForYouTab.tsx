import { useMemo } from 'react';
import { allPhotos } from '../photosData';
import { usePhotosStore } from '../photosStore';

export function ForYouTab() {
  const openPhoto = usePhotosStore((s) => s.openPhoto);

  const featured = useMemo(() => allPhotos.slice(0, 6), []);
  const memories = useMemo(() => allPhotos.slice(10, 16), []);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
      data-testid="photos-foryou"
    >
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-label)', margin: 0 }}>
          为你推荐
        </h1>
      </div>

      {/* Featured Photos section */}
      <Section title="精选照片">
        <div
          className="flex gap-3 overflow-x-auto"
          style={{
            paddingInline: 20,
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {featured.map((photo) => (
            <button
              key={photo.id}
              className="shrink-0"
              style={{
                width: 200,
                height: 200,
                borderRadius: 12,
                overflow: 'hidden',
              }}
              onClick={() => openPhoto(photo.id)}
            >
              <img
                src={photo.thumbnail}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      </Section>

      {/* Memories section */}
      <Section title="回忆">
        <div
          className="flex gap-3 overflow-x-auto"
          style={{
            paddingInline: 20,
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {memories.map((photo) => (
            <button
              key={photo.id}
              className="shrink-0"
              style={{
                width: 160,
                height: 220,
                borderRadius: 12,
                overflow: 'hidden',
                position: 'relative',
              }}
              onClick={() => openPhoto(photo.id)}
            >
              <img
                src={photo.thumbnail}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
              />
              <div
                className="absolute bottom-0 left-0 right-0"
                style={{
                  padding: '24px 10px 10px',
                  background: 'linear-gradient(transparent, rgba(0,0,0,0.5))',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                  回忆
                </div>
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Sharing Suggestions placeholder */}
      <Section title="共享建议">
        <div
          className="flex items-center justify-center"
          style={{
            margin: '0 20px',
            height: 120,
            borderRadius: 12,
            backgroundColor: 'var(--color-tertiarySystemFill)',
          }}
        >
          <span style={{ fontSize: 15, color: 'var(--color-secondaryLabel)' }}>
            暂无共享建议
          </span>
        </div>
      </Section>

      <div style={{ height: 20 }} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ paddingInline: 20, marginBottom: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-label)', margin: 0 }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}
