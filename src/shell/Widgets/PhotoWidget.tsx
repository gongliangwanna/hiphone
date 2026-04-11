import { useMemo } from 'react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { allPhotos } from '@/apps/Photos/photosData';
import { useIsPageActive } from './activePage';

interface PhotoWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
}

/**
 * Picks a stable "featured" photo based on today's date so the widget
 * does not thrash on re-render but rotates daily.
 */
function pickPhoto(): { src: string; caption: string; album: string } | null {
  if (allPhotos.length === 0) return null;
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const photo = allPhotos[day % allPhotos.length]!;
  const date = photo.date;
  const caption = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  // photosData entries don't carry an album label, so use a Memories-style line.
  const album = '回忆';
  return { src: photo.fullSize, caption, album };
}

/**
 * iOS Photos memories widget — featured photo with subtle Ken Burns slow zoom
 * + iOS-style overlay caption (small overline + larger date).
 */
export function PhotoWidget({ size, variant, previewWidth }: PhotoWidgetProps) {
  const pick = useMemo(pickPhoto, []);
  const isActive = useIsPageActive();

  return (
    <WidgetShell size={size} variant={variant} previewWidth={previewWidth} testId="widget-photo">
      <div
        className="relative h-full w-full"
        style={{ backgroundColor: '#0a0a0a', overflow: 'hidden' }}
      >
        {pick ? (
          <img
            src={pick.src}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transformOrigin: 'center center',
              animation: 'kenBurns 14s ease-in-out infinite alternate',
              // Pause the GPU keyframe on offscreen pages so the compositor
              // doesn't waste cycles animating something the user can't see.
              animationPlayState: isActive ? 'running' : 'paused',
              willChange: isActive ? 'transform' : 'auto',
            }}
          />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            无照片
          </div>
        )}

        {pick && (
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              padding: size === '2x2' ? '12px 14px' : '16px 18px',
              background:
                'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0) 100%)',
              color: 'white',
            }}
          >
            <div
              style={{
                fontSize: size === '2x2' ? 9 : 10,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.78)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {pick.album}
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: size === '2x2' ? 12 : size === '4x2' ? 14 : 16,
                fontWeight: 600,
                color: 'white',
                letterSpacing: '-0.01em',
              }}
            >
              {pick.caption}
            </div>
          </div>
        )}

        {/* Ken Burns keyframes — scoped via a style tag so we don't pollute
            the global stylesheet. The transform-only animation runs on the
            GPU compositor (no layout thrash). */}
        <style>{`
          @keyframes kenBurns {
            0%   { transform: scale(1.04) translate(0%, 0%); }
            100% { transform: scale(1.14) translate(-2%, -2%); }
          }
          @media (prefers-reduced-motion: reduce) {
            [data-testid="widget-photo"] img { animation: none !important; }
          }
        `}</style>
      </div>
    </WidgetShell>
  );
}
