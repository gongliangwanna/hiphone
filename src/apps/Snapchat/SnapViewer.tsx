import { useState } from 'react';
import { motion } from 'motion/react';
import { Heart, Send, X } from 'lucide-react';
import { useSnapchatNavStore } from './snapchatNavStore';
import { SEED_SNAPS, getUserById } from './data';

export function SnapViewer() {
  const viewingSnapId = useSnapchatNavStore((s) => s.viewingSnapId);
  const closeSnap = useSnapchatNavStore((s) => s.closeSnap);
  const [imgLoaded, setImgLoaded] = useState(false);

  const snap = SEED_SNAPS.find((s) => s.id === viewingSnapId);
  if (!snap) return null;

  const sender = getUserById(snap.senderId);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col"
      style={{ zIndex: 50, backgroundColor: '#000' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      data-testid="snap-viewer"
    >
      {/* Background image */}
      <img
        src={snap.imageUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.3s' }}
        onLoad={() => setImgLoaded(true)}
      />

      {/* Top bar */}
      <div
        className="relative z-10 flex shrink-0 items-center gap-2 px-3"
        style={{ height: 56, paddingTop: 4 }}
      >
        {sender && (
          <>
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: sender.avatarBg,
                fontSize: 18,
                border: '2px solid rgba(255,255,255,0.5)',
              }}
            >
              {sender.avatarEmoji}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {sender.displayName}
              </span>
              {snap.ctaButton && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Ad</span>
              )}
            </div>
          </>
        )}
        <button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={closeSnap}
          data-testid="snap-viewer-close"
        >
          <X size={24} strokeWidth={2} color="#fff" />
        </button>
      </div>

      {/* Overlay text */}
      {snap.overlayText && (
        <div className="relative z-10 flex flex-1 items-center justify-center px-6">
          <p
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: '#fff',
              textAlign: 'center',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {snap.overlayText}
          </p>
        </div>
      )}
      {!snap.overlayText && <div className="flex-1" />}

      {/* Bottom bar */}
      <div className="relative z-10 flex shrink-0 items-center justify-between px-4 pb-6 pt-3">
        <div className="flex-1" />

        {snap.ctaButton && (
          <button
            className="flex items-center justify-center"
            style={{
              height: 40,
              paddingLeft: 24,
              paddingRight: 24,
              borderRadius: 20,
              backgroundColor: '#fff',
              fontSize: 15,
              fontWeight: 600,
              color: '#000',
            }}
          >
            {snap.ctaButton}
          </button>
        )}

        <div className="flex flex-1 items-center justify-end gap-3">
          <button className="flex items-center justify-center" style={{ width: 44, height: 44 }}>
            <Heart size={26} strokeWidth={1.8} color="#fff" />
          </button>
          <button
            className="flex items-center justify-center"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: '#007AFF',
            }}
          >
            <Send size={20} strokeWidth={2} color="#fff" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
