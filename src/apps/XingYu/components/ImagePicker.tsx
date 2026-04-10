import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MOCK_GALLERY_IMAGES } from '../data';
import { T, springs } from '../theme';

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
          animate={{ height: 260, opacity: 1 }}
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
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.9 }}
              style={{ fontSize: 13, color: T.accent, fontWeight: 500 }}
            >
              关闭
            </motion.button>
          </div>

          {/* Grid */}
          <div className="scrollbar-hide grid grid-cols-4 gap-1.5 overflow-y-auto p-3" style={{ maxHeight: 220 }}>
            {MOCK_GALLERY_IMAGES.map((url, i) => (
              <ImageThumb key={url} url={url} index={i} onSelect={onSelectImage} />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ImageThumb({
  url,
  index,
  onSelect,
}: {
  url: string;
  index: number;
  onSelect: (url: string) => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.button
      className="relative overflow-hidden"
      style={{
        borderRadius: T.r.sm,
        aspectRatio: '1',
        backgroundColor: `${T.accent}08`,
      }}
      onClick={() => onSelect(url)}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02, ...springs.gentle }}
      whileTap={{ scale: 0.92 }}
    >
      <img
        src={url}
        alt=""
        className="block h-full w-full object-cover"
        style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.3s' }}
        loading="lazy"
        onLoad={() => setLoaded(true)}
      />
    </motion.button>
  );
}
