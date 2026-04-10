import { useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { usePhotosStore } from './photosStore';
import { getPhotoById } from './photosData';

export function PhotoViewer() {
  const viewingPhotoId = usePhotosStore((s) => s.viewingPhotoId);
  const closePhoto = usePhotosStore((s) => s.closePhoto);

  return (
    <AnimatePresence>
      {viewingPhotoId !== null && (
        <PhotoViewerContent
          key={viewingPhotoId}
          photoId={viewingPhotoId}
          onClose={closePhoto}
        />
      )}
    </AnimatePresence>
  );
}

function PhotoViewerContent({
  photoId,
  onClose,
}: {
  photoId: number;
  onClose: () => void;
}) {
  const photo = getPhotoById(photoId);
  const dragYRef = useRef(0);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      // Dismiss if dragged down enough or with enough velocity
      if (info.offset.y > 100 || info.velocity.y > 300) {
        onClose();
      }
    },
    [onClose],
  );

  if (!photo) return null;

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ backgroundColor: '#000' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      data-testid="photo-viewer"
    >
      {/* Top bar: close button */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between"
        style={{
          paddingTop: 'var(--app-safe-top)',
          paddingInline: 16,
          height: 'calc(var(--app-safe-top) + 44px)',
        }}
      >
        <button
          onClick={onClose}
          className="flex items-center justify-center"
          style={{ minWidth: 44, minHeight: 44 }}
          data-testid="photo-viewer-close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Draggable photo */}
      <motion.div
        className="flex flex-1 items-center justify-center"
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.6}
        onDrag={(_, info) => {
          dragYRef.current = info.offset.y;
        }}
        onDragEnd={handleDragEnd}
        style={{ cursor: 'grab' }}
      >
        <motion.img
          src={photo.fullSize}
          alt=""
          className="w-full"
          style={{
            maxHeight: '80%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.25 }}
          draggable={false}
        />
      </motion.div>

      {/* Bottom bar: action buttons */}
      <div
        className="flex items-center justify-around"
        style={{
          height: 64,
          paddingInline: 40,
        }}
      >
        <ActionButton icon={<ShareIcon />} label="分享" onClick={() => {}} />
        <ActionButton icon={<HeartIcon />} label="收藏" onClick={() => {}} />
        <ActionButton icon={<DeleteIcon />} label="删除" onClick={() => {}} />
      </div>
    </motion.div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex flex-col items-center justify-center"
      style={{ minWidth: 44, minHeight: 44, gap: 4 }}
      onClick={onClick}
      aria-label={label}
    >
      {icon}
    </button>
  );
}

/* ── SF Symbol style action icons ── */

function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2v12"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 6l4-4 4 4"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 14v5a2 2 0 002 2h12a2 2 0 002-2v-5"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 21s-7-4.35-7-10A4.5 4.5 0 0112 7.5 4.5 4.5 0 0119 11c0 5.65-7 10-7 10z"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 6h18"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 6l1 14a2 2 0 002 2h8a2 2 0 002-2l1-14"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10 11v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 11v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
