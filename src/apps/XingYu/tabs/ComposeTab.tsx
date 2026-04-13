import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ImagePlus } from 'lucide-react';
import { MOCK_GALLERY_IMAGES } from '../data';
import { useXYData } from '../xingYuDataStore';
import { useXYNav } from '../xingYuNavStore';
import { T, springs } from '../theme';

export function ComposeTab() {
  const addMoment = useXYData((s) => s.addMoment);
  const setTab = useXYNav((s) => s.setTab);

  const [text, setText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showGallery, setShowGallery] = useState(false);

  const canPublish = text.trim().length > 0;

  const handlePublish = () => {
    if (!canPublish) return;
    addMoment(text.trim(), selectedImage ?? undefined);
    setText('');
    setSelectedImage(null);
    setShowGallery(false);
    setTab('moments');
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: 52,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <div className="w-14" />
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>发动态</span>
        <motion.button
          onClick={handlePublish}
          whileTap={canPublish ? { scale: 0.9 } : undefined}
          className="rounded-full"
          style={{
            padding: '6px 16px',
            background: canPublish ? T.accentGrad : T.border,
            opacity: canPublish ? 1 : 0.5,
          }}
          disabled={!canPublish}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: canPublish ? T.textOnAccent : T.textMuted }}>
            发布
          </span>
        </motion.button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        <textarea
          className="w-full resize-none bg-transparent outline-none"
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: T.textPrimary,
            minHeight: 120,
          }}
          placeholder="分享你的心情..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />

        {/* Selected image preview */}
        {selectedImage && (
          <motion.div
            className="relative mt-3 overflow-hidden"
            style={{ borderRadius: T.r.lg, maxWidth: 200 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springs.gentle}
          >
            <img
              src={selectedImage}
              alt=""
              className="block w-full rounded-xl object-cover"
              style={{ maxHeight: 200 }}
            />
            <motion.button
              className="absolute top-2 right-2 flex items-center justify-center rounded-full"
              style={{
                width: 24,
                height: 24,
                backgroundColor: 'rgba(0,0,0,0.5)',
              }}
              onClick={() => setSelectedImage(null)}
              whileTap={{ scale: 0.85 }}
            >
              <X size={14} strokeWidth={2.5} color="#fff" />
            </motion.button>
          </motion.div>
        )}

        {/* Add image button */}
        {!selectedImage && (
          <motion.button
            className="mt-4 flex items-center gap-2 rounded-xl"
            style={{
              padding: '10px 16px',
              backgroundColor: T.card,
              border: `1px dashed ${T.border}`,
            }}
            onClick={() => setShowGallery((p) => !p)}
            whileTap={{ scale: 0.97 }}
          >
            <ImagePlus size={18} strokeWidth={1.6} color={T.accent} />
            <span style={{ fontSize: 13, color: T.textSecondary }}>添加图片</span>
          </motion.button>
        )}

        {/* Gallery */}
        <AnimatePresence>
          {showGallery && !selectedImage && (
            <motion.div
              className="mt-3 grid grid-cols-4 gap-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              {MOCK_GALLERY_IMAGES.slice(0, 12).map((url) => (
                <motion.button
                  key={url}
                  className="overflow-hidden"
                  style={{ borderRadius: T.r.sm, aspectRatio: '1' }}
                  onClick={() => {
                    setSelectedImage(url);
                    setShowGallery(false);
                  }}
                  whileTap={{ scale: 0.92 }}
                >
                  <img
                    src={url}
                    alt=""
                    className="block h-full w-full object-cover"
                    loading="lazy"
                  />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
