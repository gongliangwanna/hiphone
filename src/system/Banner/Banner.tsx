import { useRef } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'motion/react';
import { Material } from '@/system/Material';
import { spring } from '@/platform/design-tokens/motion';
import { appRegistry } from '@/platform/appRegistry';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useBannerStore } from './bannerStore';

const APP_ICON_FALLBACK =
  '/resource/icons/ios-system/tips.jpg';

/**
 * iOS-style banner notification.
 *
 * Slides in from above the status bar, renders a Liquid Glass Material
 * rounded-rect with: app icon (36px rounded square) + bold source-app
 * name + title. Tap returns the user to the source app (APNs-style:
 * banner tap → open posting app) and dismisses. Swipe up (≥30 px) or
 * upward flick dismisses early.
 *
 * Animation: `spring.criticalDamped` on entry (confident drop, no
 * overshoot); explicit 220 ms cubic-bezier ease-in on exit so the banner
 * gets out of the way faster than it came in — matches iOS banner feel.
 *
 * Surface uses the Liquid Glass <Material variant="thick"> — iOS banners
 * are translucent frosted glass. We do NOT animate opacity (was the
 * cause of the earlier "see through during drop" regression); only
 * y-translation. Width stretches with the viewport via
 * `calc(100% - 16px)` so the 8 px side inset matches iOS behavior
 * across all device profiles.
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
    const target = current.sourceAppId;
    // Silently skip navigation if the source app was uninstalled since
    // the banner was queued — no crash, no secondary toast.
    if (target && appRegistry.has(target)) {
      useAppRuntimeStore.getState().openApp(target, null);
    }
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
            initial={{ y: -120 }}
            animate={{ y: 0 }}
            exit={{
              y: -120,
              transition: { duration: 0.22, ease: [0.4, 0, 1, 1] },
            }}
            transition={{ type: 'spring', ...spring.criticalDamped }}
            drag="y"
            dragConstraints={{ top: -40, bottom: 8 }}
            dragElastic={0.3}
            onPanStart={handlePanStart}
            onPanEnd={handlePanEnd}
            className="pointer-events-auto"
            style={{
              width: 'calc(100% - 16px)',
              cursor: 'pointer',
              touchAction: 'pan-y',
            }}
            data-testid="banner"
          >
            <Material
              variant="thick"
              className="flex items-center overflow-hidden"
              style={{
                borderRadius: 18,
                padding: '10px 14px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
              }}
              onClick={handleTap}
            >
              {/* App icon — 32×32; anchors text vertical alignment. Corner
                  radius 10 keeps the same ~30 % ratio as home-screen icons
                  (--radius-icon 18 on 54–64 px), so the banner icon reads
                  as a scaled-down home icon rather than a generic thumb. */}
              <div
                className="flex-shrink-0 overflow-hidden"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
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

              {/* Text column — top-aligned with icon; two compact lines. */}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div
                    className="truncate"
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      lineHeight: 1.2,
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
                      lineHeight: 1.2,
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
                      fontSize: 11,
                      fontWeight: 400,
                      lineHeight: 1.25,
                      color: 'var(--color-label)',
                      marginTop: 1,
                      letterSpacing: '-0.01em',
                    }}
                    data-testid="banner-message"
                  >
                    {current.title}
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
