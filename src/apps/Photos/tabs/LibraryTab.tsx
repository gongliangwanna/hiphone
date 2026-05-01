import { useMemo, useRef, useState, useCallback } from 'react';
import { ImagePlus } from 'lucide-react';
import { getPhotoSections } from '../photosData';
import { usePhotosStore } from '../photosStore';

export function LibraryTab() {
  const photos = usePhotosStore((s) => s.photos);
  const openPhoto = usePhotosStore((s) => s.openPhoto);
  const addPhotosFromFiles = usePhotosStore((s) => s.addPhotosFromFiles);
  const sections = useMemo(() => getPhotoSections(photos), [photos]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? []);
      event.currentTarget.value = '';
      if (files.length === 0) return;

      setIsImporting(true);
      setUploadError(null);
      try {
        const imported = await addPhotosFromFiles(files);
        if (imported.length === 0) {
          setUploadError('请选择图片文件');
        }
      } catch {
        setUploadError('图片导入失败');
      } finally {
        setIsImporting(false);
      }
    },
    [addPhotosFromFiles],
  );

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ WebkitOverflowScrolling: 'touch' }}
      data-testid="photos-library"
    >
      {/* Large Title */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '8px 20px 4px', gap: 12 }}
      >
        <h1 style={{ fontSize: 34, fontWeight: 700, color: 'var(--color-label)', margin: 0 }}>
          照片
        </h1>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
          data-testid="photos-upload-input"
        />
        <button
          type="button"
          className="flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            color: 'var(--color-systemBlue)',
            backgroundColor: 'var(--color-tertiarySystemFill)',
            opacity: isImporting ? 0.6 : 1,
          }}
          onClick={handleUploadClick}
          disabled={isImporting}
          aria-label="上传照片"
          title="上传照片"
          data-testid="photos-upload-button"
        >
          <ImagePlus size={20} strokeWidth={2.2} />
        </button>
      </div>

      {uploadError && (
        <div
          style={{
            padding: '0 20px 8px',
            fontSize: 13,
            color: 'var(--color-systemRed)',
          }}
          role="alert"
        >
          {uploadError}
        </div>
      )}

      {/* Photo sections grouped by month */}
      {sections.length > 0 ? (
        sections.map((section) => (
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
        ))
      ) : (
        <div
          className="flex flex-col items-center justify-center"
          style={{ minHeight: 360, padding: '0 32px', gap: 14 }}
          data-testid="photos-empty-state"
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              backgroundColor: 'var(--color-tertiarySystemFill)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            <ImagePlus size={30} strokeWidth={1.8} />
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: 'var(--color-label)',
            }}
          >
            暂无照片
          </div>
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isImporting}
            style={{
              minHeight: 36,
              padding: '0 18px',
              borderRadius: 18,
              color: '#fff',
              backgroundColor: 'var(--color-systemBlue)',
              fontSize: 15,
              fontWeight: 600,
              opacity: isImporting ? 0.6 : 1,
            }}
          >
            上传照片
          </button>
        </div>
      )}

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
