import { useMemo } from 'react';
import { getAlbums } from '../photosData';
import { usePhotosStore } from '../photosStore';

export function AlbumsTab() {
  const photos = usePhotosStore((s) => s.photos);
  const albums = useMemo(() => getAlbums(photos), [photos]);

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
      data-testid="photos-albums"
    >
      {/* Large Title */}
      <div style={{ padding: '8px 20px 12px' }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-label)', margin: 0 }}>
          相簿
        </h1>
      </div>

      {/* "我的相簿" section */}
      <div style={{ paddingInline: 20, marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-label)',
            margin: '0 0 12px 0',
          }}
        >
          我的相簿
        </h2>

        {/* 2-column album grid */}
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              name={album.name}
              count={album.photoIds.length}
              coverUrl={album.coverUrl}
            />
          ))}
        </div>
      </div>

      {/* "媒体类型" section */}
      <div style={{ paddingInline: 20, marginBottom: 24 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--color-label)',
            margin: '0 0 12px 0',
          }}
        >
          媒体类型
        </h2>

        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          <MediaTypeCard name="视频" icon={<VideoIcon />} count={0} />
          <MediaTypeCard name="实况照片" icon={<LivePhotoIcon />} count={0} />
          <MediaTypeCard name="全景照片" icon={<PanoIcon />} count={0} />
          <MediaTypeCard name="延时摄影" icon={<TimelapseIcon />} count={0} />
        </div>
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}

function AlbumCard({
  name,
  count,
  coverUrl,
}: {
  name: string;
  count: number;
  coverUrl: string | null;
}) {
  return (
    <div data-testid={`album-${name}`}>
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: 'var(--color-tertiarySystemFill)',
        }}
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: 'var(--color-secondaryLabel)', fontSize: 13 }}
          >
            暂无照片
          </div>
        )}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--color-label)',
          marginTop: 6,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-secondaryLabel)',
        }}
      >
        {count}
      </div>
    </div>
  );
}

function MediaTypeCard({
  name,
  icon,
  count,
}: {
  name: string;
  icon: React.ReactNode;
  count: number;
}) {
  return (
    <div>
      <div
        className="flex items-center justify-center"
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 8,
          backgroundColor: 'var(--color-tertiarySystemFill)',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: 'var(--color-label)',
          marginTop: 6,
        }}
      >
        {name}
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-secondaryLabel)',
        }}
      >
        {count}
      </div>
    </div>
  );
}

/* ── SF Symbol style media type icons ── */

function VideoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect
        x="2" y="5" width="14" height="14" rx="2"
        stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M16 10l5-3v10l-5-3"
        stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

function LivePhotoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="9" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeDasharray="2 3" />
    </svg>
  );
}

function PanoIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <rect
        x="2" y="6" width="20" height="12" rx="2"
        stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
      <path
        d="M8 6v12M16 6v12"
        stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round"
      />
    </svg>
  );
}

function TimelapseIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="var(--color-secondaryLabel)" strokeWidth="1.6" />
      <path
        d="M12 7v5l3 3"
        stroke="var(--color-secondaryLabel)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
