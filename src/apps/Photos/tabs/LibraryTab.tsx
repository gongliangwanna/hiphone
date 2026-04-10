import { useMemo, useState, useCallback } from 'react';
import { getPhotoSections } from '../photosData';
import { usePhotosStore } from '../photosStore';

export function LibraryTab() {
  const openPhoto = usePhotosStore((s) => s.openPhoto);
  const sections = useMemo(() => getPhotoSections(), []);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
      data-testid="photos-library"
    >
      {/* Large Title */}
      <div style={{ padding: '8px 20px 4px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-label)', margin: 0 }}>
          照片
        </h1>
      </div>

      {/* Photo sections grouped by month */}
      {sections.map((section) => (
        <div key={section.key}>
          {/* Sticky month header */}
          <div
            className="sticky top-0 z-10"
            style={{
              padding: '12px 20px 6px',
              fontSize: 20,
              fontWeight: 700,
              color: 'var(--color-label)',
              backgroundColor: 'var(--color-systemBackground)',
            }}
          >
            {section.label}
          </div>

          {/* 3-column photo grid with 1px gap */}
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              padding: '0 1px',
            }}
          >
            {section.photos.map((photo) => (
              <PhotoGridItem
                key={photo.id}
                photoId={photo.id}
                thumbnailUrl={photo.thumbnail}
                onTap={openPhoto}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Bottom spacing for tab bar */}
      <div style={{ height: 20 }} />
    </div>
  );
}

/** Individual photo cell in the grid — memoized to avoid re-renders during scroll */
function PhotoGridItem({
  photoId,
  thumbnailUrl,
  onTap,
}: {
  photoId: number;
  thumbnailUrl: string;
  onTap: (id: number) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  const handleClick = useCallback(() => {
    onTap(photoId);
  }, [onTap, photoId]);

  return (
    <button
      className="relative block w-full"
      style={{ aspectRatio: '1', overflow: 'hidden' }}
      onClick={handleClick}
      data-testid={`photo-cell-${photoId}`}
    >
      {/* Placeholder */}
      {!loaded && (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: 'var(--color-tertiarySystemFill)' }}
        />
      )}
      <img
        src={thumbnailUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        loading="lazy"
        onLoad={() => setLoaded(true)}
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
      />
    </button>
  );
}
