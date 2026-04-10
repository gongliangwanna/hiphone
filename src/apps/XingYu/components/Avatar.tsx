import { useState } from 'react';
import { motion } from 'motion/react';
import { T } from '../theme';

interface AvatarProps {
  src: string;
  size?: number;
  ringIndex?: number;
  online?: boolean;
  unread?: number;
}

export function Avatar({ src, size = 48, ringIndex = 0, online, unread }: AvatarProps) {
  const [loaded, setLoaded] = useState(false);
  const ringGrad = T.rings[ringIndex % T.rings.length];
  const ring = 2;
  const gap = 1.5;
  const outer = size + (ring + gap) * 2;

  return (
    <div className="relative shrink-0" style={{ width: outer, height: outer }}>
      {/* Gradient ring */}
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: ringGrad }}
      />
      {/* White gap */}
      <div
        className="absolute rounded-full"
        style={{ inset: ring, backgroundColor: T.card }}
      />
      {/* Photo */}
      <div
        className="absolute overflow-hidden rounded-full"
        style={{ inset: ring + gap }}
      >
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          style={{ opacity: loaded ? 1 : 0, transition: 'opacity 0.25s' }}
          loading="lazy"
          onLoad={() => setLoaded(true)}
        />
        {/* Fallback bg while loading */}
        {!loaded && (
          <div className="absolute inset-0" style={{ background: T.accentGrad, opacity: 0.2 }} />
        )}
      </div>

      {/* Online indicator */}
      {online && (
        <motion.div
          className="absolute rounded-full"
          style={{
            width: Math.max(10, size * 0.2),
            height: Math.max(10, size * 0.2),
            bottom: 0,
            right: 0,
            backgroundColor: T.online,
            border: `2px solid ${T.card}`,
          }}
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Unread badge */}
      {unread != null && unread > 0 && (
        <motion.div
          className="absolute flex items-center justify-center rounded-full"
          style={{
            minWidth: 18,
            height: 18,
            top: -2,
            right: -2,
            background: T.accentGrad,
            padding: '0 5px',
          }}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          <span style={{ fontSize: 10, fontWeight: 700, color: T.textOnAccent }}>
            {unread > 99 ? '99+' : unread}
          </span>
        </motion.div>
      )}
    </div>
  );
}
