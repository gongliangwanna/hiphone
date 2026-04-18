import { useRef } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { Material } from '@/system/Material';
import { spring } from '@/platform/design-tokens/motion';
import { useBannerStore } from './bannerStore';

const APP_ICON_FALLBACK =
  '/resource/icons/ios-system/tips.jpg';

/**
 * iOS-style banner notification.
 *
 * Slides in from above the status bar, renders a Liquid Glass Material
 * capsule with: app icon (28px rounded square) + title (semibold
 * subhead) + subtitle (footnote). Tap fires onTap and dismisses; swipe
 * upward (≥30 px) dismisses early.
 */
export function Banner() {
  const current = useBannerStore((s) => s.current);
  const dismiss = useBannerStore((s) => s.dismiss);

  const startYRef = useRef<number>(0);

  const handlePanStart = (_: unknown, info: PanInfo): void => {
    startYRef.current = info.point.y;
  };

  const handlePanEnd = (_: unknown, info: PanInfo): void => {
    const deltaY = info.point.y - startYRef.current;
    // Upward swipe (negative deltaY) > 30px or fast flick → dismiss
    if (deltaY < -30 || info.velocity.y < -300) {
      dismiss();
    }
  };

  const handleTap = (): void => {
    if (!current) return;
    current.onTap?.();
    dismiss();
  };

  return (
    <AnimatePresence>
      {current && (
        <div
          key={`banner-wrapper-${current.id}`}
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          style={{
            top: 'calc(var(--status-bar-height) + 8px)',
            zIndex: 32,
          }}
        >
          <motion.div
            key={`banner-${current.id}`}
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ type: 'spring', ...spring.snappy }}
            drag="y"
            dragConstraints={{ top: -40, bottom: 8 }}
            dragElastic={0.3}
            onPanStart={handlePanStart}
            onPanEnd={handlePanEnd}
            className="pointer-events-auto"
            style={{
              width: 'calc(100% - 16px)',
              maxWidth: 380,
              cursor: 'pointer',
              touchAction: 'pan-y',
            }}
            data-testid="banner"
          >
            <Material
              variant="thick"
              className="flex items-start overflow-hidden"
              style={{
                borderRadius: 20,
                padding: '10px 14px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
              }}
              onClick={handleTap}
            >
              {/* App icon */}
              <div
                className="flex-shrink-0 overflow-hidden"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'rgba(0,0,0,0.06)',
                  marginRight: 10,
                }}
              >
                <img
                  src={current.appIcon || APP_ICON_FALLBACK}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = APP_ICON_FALLBACK;
                  }}
                />
              </div>

              {/* Text column */}
              <div
                className="min-w-0 flex-1"
                style={{ paddingTop: 1 }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <div
                    className="truncate"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--color-label)',
                      letterSpacing: '-0.01em',
                    }}
                    data-testid="banner-title"
                  >
                    {current.appName || current.title}
                  </div>
                  <div
                    className="flex-shrink-0"
                    style={{
                      fontSize: 11,
                      color: 'var(--color-secondaryLabel)',
                    }}
                  >
                    现在
                  </div>
                </div>

                {current.appName ? (
                  <div
                    className="truncate"
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'var(--color-label)',
                      marginTop: 1,
                      letterSpacing: '-0.01em',
                    }}
                    data-testid="banner-subtitle-primary"
                  >
                    {current.title}
                  </div>
                ) : null}

                {current.subtitle ? (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-secondaryLabel)',
                      marginTop: 1,
                      lineHeight: 1.3,
                      overflow: 'hidden',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                    data-testid="banner-subtitle"
                  >
                    {current.subtitle}
                  </div>
                ) : null}
              </div>
            </Material>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
