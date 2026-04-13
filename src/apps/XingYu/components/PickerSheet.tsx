import { useRef } from 'react';
import { motion } from 'motion/react';
import { Upload, Check } from 'lucide-react';
import { T } from '../theme';

export function PickerSheet({
  title,
  images,
  currentImage,
  onSelect,
  onClose,
  isAvatar,
}: {
  title: string;
  images: string[];
  currentImage: string;
  onSelect: (url: string) => void;
  onClose: () => void;
  isAvatar?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelect(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/* 面板 */}
      <motion.div
        className="mt-auto flex flex-col"
        style={{
          backgroundColor: T.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '70%',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* 拖拽指示条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: T.separator }} />
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 pb-3">
          <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>{title}</span>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            style={{ fontSize: 14, color: T.accent, fontWeight: 600 }}
          >
            完成
          </motion.button>
        </div>

        {/* 图片网格 */}
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5 pb-8">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: isAvatar ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)',
              gap: 10,
            }}
          >
            {/* 上传按钮 */}
            <motion.button
              className="flex flex-col items-center justify-center"
              style={{
                aspectRatio: isAvatar ? '1' : '4/3',
                borderRadius: isAvatar ? '50%' : 10,
                border: `1.5px dashed ${T.border}`,
                backgroundColor: T.card,
              }}
              onClick={() => fileRef.current?.click()}
              whileTap={{ scale: 0.93 }}
            >
              <Upload size={20} color={T.textMuted} strokeWidth={2} />
              <span style={{ fontSize: 10, color: T.textMuted, marginTop: 4 }}>上传</span>
            </motion.button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />

            {/* 预设图片 */}
            {images.map((url) => {
              const isActive = currentImage === url;
              return (
                <motion.button
                  key={url}
                  className="relative overflow-hidden"
                  style={{
                    aspectRatio: isAvatar ? '1' : '4/3',
                    borderRadius: isAvatar ? '50%' : 10,
                    boxShadow: isActive ? `0 0 0 3px ${T.accent}` : 'none',
                  }}
                  onClick={() => onSelect(url)}
                  whileTap={{ scale: 0.93 }}
                >
                  <img
                    src={url}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    style={{ borderRadius: isAvatar ? '50%' : 10 }}
                  />
                  {isActive && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        borderRadius: isAvatar ? '50%' : 10,
                      }}
                    >
                      <Check size={22} strokeWidth={3} color="#fff" />
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
