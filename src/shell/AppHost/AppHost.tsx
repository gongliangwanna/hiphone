import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScene } from '@/apps/AppScene';
import { spring } from '@/platform/design-tokens/motion';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useViewportProfile } from '@/shell/Device/useViewportProfile';
import { getDeviceCornerRadius } from '@/shell/Device/viewportProfile';

const SWITCHER_SCALE = 0.66; // Match CARD_WIDTH_RATIO in AppSwitcher

/** Reference layout width — must match the 390 in SwitcherAppContent.
 *  Both AppHost and cards render AppScene at this width so the layout
 *  (text wrapping, spacing) is identical during the switcher transition. */
const APP_REF_WIDTH = 390;

/** Must match --radius-icon in tokens.css (fixed 18px for all size tiers). */
const ICON_BORDER_RADIUS = 18;

// ---------------------------------------------------------------------------
// Shape-morph geometry
// ---------------------------------------------------------------------------
// The close animation morphs a full-screen rectangle into a square icon.
// We use `clipPath: inset(top 0 bottom 0 round R)` to progressively crop
// the top and bottom edges, combined with `scale` for the overall shrink.
//
// At the end state the element is scaled to `iconWidth / vpWidth`.
// Visual dimensions:  vpWidth × scale = iconWidth  (correct width)
//                     vpHeight × scale = iconWidth × (vpHeight/vpWidth)  (too tall)
// To make it square we clip `(vpHeight - vpWidth) / 2` from top AND bottom
// in element-space (pre-transform).  After scale the visible area is:
//   width  = vpWidth × scale  = iconWidth
//   height = (vpHeight - 2·inset) × scale = vpWidth × scale = iconWidth  ✓
//
// The clipPath round radius is in element-space; the visual radius equals
// R_element × scale, so R_element = iconRadius / scale.
// ---------------------------------------------------------------------------

export function AppHost() {
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const appOrigin = useAppRuntimeStore((s) => s.appOrigin);
  const switcherCardOrigin = useAppRuntimeStore((s) => s.switcherCardOrigin);
  const switcherCardViewport = useAppRuntimeStore((s) => s.switcherCardViewport);
  const dismissedAppId = useAppRuntimeStore((s) => s.dismissedAppId);
  const dismissReason = useAppRuntimeStore((s) => s.dismissReason);
  const transitionSource = useAppRuntimeStore((s) => s.transitionSource);
  const presentationMode = useAppRuntimeStore((s) => s.presentationMode);
  const switcherEnterAnimating = useAppRuntimeStore((s) => s.switcherEnterAnimating);
  const finishSwitcherEnter = useAppRuntimeStore((s) => s.finishSwitcherEnter);
  const switcherDismissing = useAppRuntimeStore((s) => s.switcherDismissing);
  const finishSwitcherDismiss = useAppRuntimeStore((s) => s.finishSwitcherDismiss);
  const clearDismissedApp = useAppRuntimeStore((s) => s.clearDismissedApp);
  const viewportProfile = useViewportProfile();
  const deviceCornerRadius = getDeviceCornerRadius(viewportProfile.sizeTier);
  const vpWidth = viewportProfile.width;
  const vpHeight = viewportProfile.height;
  const prevOriginRef = useRef(appOrigin);

  if (appOrigin) {
    prevOriginRef.current = appOrigin;
  }

  const origin = prevOriginRef.current;
  const inSwitcher = presentationMode === 'switcher';

  // Blur any focused element (e.g. search input) when entering the switcher
  // so the keyboard dismisses and inputs don't flash.
  useEffect(() => {
    if (inSwitcher) {
      (document.activeElement as HTMLElement | null)?.blur?.();
    }
  }, [inSwitcher]);

  // --- Enter animation (icon / card → full screen) ---
  const morphFromCard =
    transitionSource === 'switcher' && switcherCardOrigin && switcherCardViewport;

  const initialAnimation = morphFromCard
    ? {
        opacity: 1,
        scale: switcherCardOrigin!.width / switcherCardViewport!.width,
        x:
          switcherCardOrigin!.x +
          switcherCardOrigin!.width / 2 -
          switcherCardViewport!.width / 2,
        y:
          switcherCardOrigin!.y +
          switcherCardOrigin!.height / 2 -
          switcherCardViewport!.height / 2,
      }
    : transitionSource === 'icon' && origin
    ? {
        opacity: 0.7,
        scale: origin.width / vpWidth,
        x: origin.x - vpWidth / 2 + origin.width / 2,
        y: origin.y - vpHeight / 2 + origin.height / 2,
      }
    : {
        opacity: 0,
        scale: transitionSource === 'switcher' ? SWITCHER_SCALE : 0.96,
        x: 0,
        y: transitionSource === 'switcher' ? 5.5 : 0,
      };

  // Transition depends on direction: softer spring when shrinking into the
  // switcher, snappy launch spring when expanding to fullscreen.
  const enterTransition = switcherDismissing
    ? { type: 'spring' as const, ...spring.criticalDamped }
    : inSwitcher
      ? { type: 'spring' as const, ...spring.criticalDamped }
      : { type: 'spring' as const, ...spring.appLaunch };

  // Card body center sits above the card+label center by half the label
  // height (mt-2.5 10px + 20px icon/text row = 30px → offset 15px).
  const switcherVerticalOffset = -15;

  // --- Home exit: shape-morph (rectangle → square icon) ---
  const isHomeExitToIcon = dismissReason === 'home' && !!origin;

  const finalScale = origin ? origin.width / vpWidth : 0;
  const verticalInset = Math.max(0, (vpHeight - vpWidth) / 2);
  const finalClipRadius = finalScale > 0 ? ICON_BORDER_RADIUS / finalScale : 0;
  const iconCenterX = origin ? origin.x - vpWidth / 2 + origin.width / 2 : 0;
  const iconCenterY = origin ? origin.y - vpHeight / 2 + origin.height / 2 : 0;

  const homeExitTransition = { type: 'spring' as const, ...spring.appClose };
  const fallbackExitTransition = { type: 'spring' as const, ...spring.criticalDamped };

  return (
    <AnimatePresence>
      {/* ---- Foreground app ---- */}
      {activeAppId && (
        <motion.div
          key={`foreground-app-${activeAppId}`}
          className="absolute inset-0 overflow-hidden"
          style={{
            zIndex: 18,
            // Only round corners when shrinking into the switcher. At fullscreen
            // the device shell clips the content, so no borderRadius needed.
            borderRadius: inSwitcher ? deviceCornerRadius : 0,
            ...(inSwitcher && !switcherEnterAnimating && !switcherDismissing
              ? { visibility: 'hidden' as const, pointerEvents: 'none' as const }
              : inSwitcher
                ? { pointerEvents: 'none' as const }
                : {}),
          }}
          data-testid="app-host"
          data-perf-layer="app-host"
          initial={initialAnimation}
          animate={
            switcherDismissing
              ? {
                  opacity: 0,
                  scale: SWITCHER_SCALE,
                  x: 0,
                  y: -(vpHeight),
                }
              : inSwitcher
                ? {
                    opacity: 1,
                    scale: SWITCHER_SCALE,
                    x: 0,
                    y: switcherVerticalOffset,
                  }
                : {
                    opacity: 1,
                    scale: 1,
                    x: 0,
                    y: 0,
                  }
          }
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={enterTransition}
          onAnimationComplete={() => {
            if (switcherDismissing) {
              finishSwitcherDismiss();
            } else if (inSwitcher && switcherEnterAnimating) {
              finishSwitcherEnter();
            }
          }}
        >
          <FixedAppContent appId={activeAppId} vpWidth={vpWidth} vpHeight={vpHeight} />
        </motion.div>
      )}

      {/* ---- Dismissed: home exit → shape-morph to icon ---- */}
      {dismissedAppId && !activeAppId && isHomeExitToIcon && (
        <motion.div
          key={`dismissed-home-${dismissedAppId}`}
          className="absolute inset-0"
          style={{ zIndex: 18, pointerEvents: 'none' }}
          initial={{
            clipPath: `inset(0px 0px 0px 0px round ${deviceCornerRadius}px)`,
            scale: 1,
            x: 0,
            y: 0,
          }}
          animate={{
            clipPath: `inset(${verticalInset}px 0px ${verticalInset}px 0px round ${finalClipRadius}px)`,
            scale: finalScale,
            x: iconCenterX,
            y: iconCenterY,
          }}
          transition={homeExitTransition}
          onAnimationComplete={() => {
            prevOriginRef.current = null;
            clearDismissedApp();
          }}
        >
          <motion.div
            className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeIn' }}
          >
            <FixedAppContent appId={dismissedAppId} vpWidth={vpWidth} vpHeight={vpHeight} />
          </motion.div>
        </motion.div>
      )}

      {/* ---- Dismissed: fallback (no icon origin) ---- */}
      {dismissedAppId && !activeAppId && !isHomeExitToIcon && (
        <motion.div
          key={`dismissed-fallback-${dismissedAppId}`}
          className="absolute inset-0 overflow-hidden"
          style={{ zIndex: 18 }}
          initial={{
            borderRadius: deviceCornerRadius,
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
          }}
          animate={{
            borderRadius: deviceCornerRadius,
            opacity: 0,
            scale: 0.3,
            x: 0,
            y: 0,
          }}
          transition={fallbackExitTransition}
          onAnimationComplete={() => {
            prevOriginRef.current = null;
            clearDismissedApp();
          }}
        >
          <FixedAppContent appId={dismissedAppId} vpWidth={vpWidth} vpHeight={vpHeight} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Fixed-size app wrapper — renders AppScene at APP_REF_WIDTH (390px) and
// scales up to fill the viewport. This matches SwitcherAppContent's rendering
// so the switcher transition is a pure "screenshot zoom" with zero layout shift.
// ---------------------------------------------------------------------------

function FixedAppContent({
  appId,
  vpWidth,
  vpHeight,
}: {
  appId: string;
  vpWidth: number;
  vpHeight: number;
}) {
  const refScale = vpWidth / APP_REF_WIDTH;
  const refHeight = Math.ceil(vpHeight / refScale);
  return (
    <div className="absolute inset-0 overflow-hidden" data-testid="app-gesture-scene">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: APP_REF_WIDTH,
          height: refHeight,
          transform: `scale(${refScale})`,
        }}
      >
        <AppScene appId={appId} />
      </div>
    </div>
  );
}
