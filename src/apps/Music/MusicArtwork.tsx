import { useState, useCallback, useRef, useEffect } from 'react';
import { Music } from 'lucide-react';

/**
 * Gradient palette for placeholder backgrounds.
 * Deterministic: same alt text → same gradient.
 */
const GRADIENTS: [string, string][] = [
  ['#FC3C44', '#FF6B81'],
  ['#5856D6', '#AF52DE'],
  ['#007AFF', '#5AC8FA'],
  ['#34C759', '#30D158'],
  ['#FF9500', '#FFCC00'],
  ['#FF2D55', '#FF6482'],
  ['#5856D6', '#007AFF'],
  ['#00C7BE', '#34C759'],
  ['#8E8E93', '#636366'],
  ['#A2845E', '#D4A76A'],
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 800;

interface MusicArtworkProps {
  src: string;
  alt?: string;
  style?: React.CSSProperties;
  className?: string;
  /** Icon size inside placeholder (scales with image size) */
  iconSize?: number;
}

/**
 * Artwork image with automatic retry + gradient placeholder on failure.
 * - Retries up to 2× (alternating NetEase CDN hosts for p1→p2→p3)
 * - Falls back to a deterministic gradient + music note icon
 */
export function MusicArtwork({
  src,
  alt = '',
  style,
  className,
  iconSize = 24,
}: MusicArtworkProps) {
  const [failed, setFailed] = useState(!src);
  const retryRef = useRef(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset when src changes (e.g. new song selected)
  useEffect(() => {
    retryRef.current = 0;
    setFailed(!src);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [src]);

  const handleError = useCallback(() => {
    if (retryRef.current < MAX_RETRIES && src) {
      retryRef.current++;
      const attempt = retryRef.current;
      timerRef.current = setTimeout(() => {
        const img = imgRef.current;
        if (!img) return;

        let retrySrc: string;
        if (src.includes('p1.music.126.net')) {
          // NetEase has p1–p4 CDN mirrors
          retrySrc = src.replace('p1.music.126.net', `p${attempt + 1}.music.126.net`);
        } else {
          // Generic: cache-bust query param
          const sep = src.includes('?') ? '&' : '?';
          retrySrc = `${src}${sep}_r=${attempt}`;
        }
        img.src = retrySrc;
      }, RETRY_DELAY);
    } else {
      setFailed(true);
    }
  }, [src]);

  if (failed) {
    const idx = hashStr(alt) % GRADIENTS.length;
    const [c1, c2] = GRADIENTS[idx]!;
    return (
      <div
        className={className}
        style={{
          ...style,
          background: `linear-gradient(135deg, ${c1}, ${c2})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Music size={iconSize} color="rgba(255,255,255,0.5)" />
      </div>
    );
  }

  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={handleError}
    />
  );
}
