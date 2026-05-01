import { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { usePhotosStore } from '@/apps/Photos/photosStore';
import { T } from '../theme';

const MAX_SIZE = 1200;
const JPEG_QUALITY = 0.8;

/** Compress an image file to a data URL (max 1200px, JPEG 0.8 quality) */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_SIZE || height > MAX_SIZE) {
          const scale = MAX_SIZE / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface ImagePickerProps {
  visible: boolean;
  onSelectImage: (url: string) => void;
  onClose: () => void;
}

export function ImagePicker({ visible, onSelectImage, onClose }: ImagePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const photos = usePhotosStore((s) => s.photos);
  const galleryImages = photos.slice(0, 24).map((photo) => photo.thumbnail);

  const handleLocalFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await compressImage(file);
        onSelectImage(dataUrl);
      } catch {
        // silently ignore corrupt files
      }
      // reset so the same file can be re-selected
      e.target.value = '';
    },
    [onSelectImage],
  );

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 280, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden"
          style={{ backgroundColor: T.bg, borderTop: `0.5px solid ${T.separator}` }}
        >
          {/* Hidden file input */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLocalFile}
          />

          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: `0.5px solid ${T.separator}` }}
          >
            <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>相册</span>
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                onClose();
              }}
              className="transition-transform active:scale-90"
              style={{
                fontSize: 13,
                color: T.accent,
                fontWeight: 500,
                padding: '4px 8px',
                touchAction: 'manipulation',
              }}
            >
              关闭
            </button>
          </div>

          {/* Grid — 4 columns, square tiles via padding-bottom hack to avoid aspect-ratio quirks on mobile Safari */}
          <div
            className="scrollbar-hide overflow-y-auto p-3"
            style={{
              maxHeight: 240,
              paddingBottom: 'max(12px, calc(var(--safe-bottom, 0px) + 12px))',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 6,
              }}
            >
              {/* Local file upload button */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex w-full items-center justify-center transition-transform active:scale-95"
                style={{
                  borderRadius: T.r.sm,
                  backgroundColor: `${T.accent}12`,
                  border: `1.5px dashed ${T.accent}40`,
                  paddingBottom: '100%',
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Plus size={28} strokeWidth={1.8} color={T.accent} />
                </div>
              </button>

              {galleryImages.map((url) => (
                <ImageThumb key={url} url={url} onSelect={onSelectImage} />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ImageThumb({
  url,
  onSelect,
}: {
  url: string;
  onSelect: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => onSelect(url)}
      className="relative block w-full overflow-hidden transition-transform active:scale-95"
      style={{
        borderRadius: T.r.sm,
        backgroundColor: `${T.accent}08`,
        paddingBottom: '100%', // 1:1 aspect ratio via padding hack (reliable in mobile Safari)
      }}
    >
      <img
        src={url}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </button>
  );
}
