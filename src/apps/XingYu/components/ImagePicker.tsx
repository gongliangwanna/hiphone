import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_GALLERY_IMAGES } from '../data';
import { T } from '../theme';

interface ImagePickerProps {
  visible: boolean;
  onSelectImage: (url: string) => void;
  onClose: () => void;
}

export function ImagePicker({ visible, onSelectImage, onClose }: ImagePickerProps) {
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
              {MOCK_GALLERY_IMAGES.map((url) => (
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
      // 同样的 iOS Safari 坑: 在 pointerdown 里直接 onSelect, 不依赖 onClick
      onPointerDown={(e) => {
        e.preventDefault();
        onSelect(url);
      }}
      className="relative block w-full overflow-hidden transition-transform active:scale-95"
      style={{
        borderRadius: T.r.sm,
        backgroundColor: `${T.accent}08`,
        paddingBottom: '100%', // 1:1 aspect ratio via padding hack (reliable in mobile Safari)
        touchAction: 'manipulation',
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
