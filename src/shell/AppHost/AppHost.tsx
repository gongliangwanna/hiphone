import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScene } from '@/apps/AppScene';
import { spring } from '@/platform/design-tokens/motion';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useViewportProfile } from '@/shell/Device/useViewportProfile';
import { getDeviceCornerRadius } from '@/shell/Device/viewportProfile';

const SWITCHER_SCALE = 0.66; // Match CARD_WIDTH_RATIO in AppSwitcher

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

  // --- Enter animation (icon / card → full screen) ---
  const morphFromCard =
    transitionSource === 'switcher' && switcherCardOrigin && switcherCardViewport;

  const initialAnimation = morphFromCard
    ? {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: deviceCornerRadius,
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
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: ICON_BORDER_RADIUS,
        opacity: 0.7,
        scale: origin.width / vpWidth,
        x: origin.x - vpWidth / 2 + origin.width / 2,
        y: origin.y - vpHeight / 2 + origin.height / 2,
      }
    : {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        borderRadius: transitionSource === 'switcher' ? deviceCornerRadius : 0,
        opacity: 0,
        scale: transitionSource === 'switcher' ? SWITCHER_SCALE : 0.96,
        x: 0,
        y: transitionSource === 'switcher' ? 5.5 : 0,
      };

  const enterTransition = { type: 'spring' as const, ...spring.appLaunch };

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
            ...(inSwitcher
              ? { visibility: 'hidden' as const, pointerEvents: 'none' as const }
              : {}),
          }}
          data-testid="app-host"
          data-perf-layer="app-host"
          initial={initialAnimation}
          animate={{
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: 0,
            opacity: 1,
            scale: 1,
            x: 0,
            y: 0,
          }}
          exit={{ opacity: 0, transition: { duration: 0 } }}
          transition={enterTransition}
        >
          <div className="h-full" data-testid="app-gesture-scene">
            <AppScene appId={activeAppId} />
          </div>
        </motion.div>
      )}

      {/* ---- Dismissed: home exit → shape-morph to icon ---- */}
      {/* Only the app screenshot shrinks + fades. The real Springboard icon
          is always visible underneath. When the screenshot becomes fully
          transparent and the morph reaches icon size, the real icon shows
          through naturally — no swap, no flash, one icon. */}
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
            className="h-full"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeIn' }}
          >
            <AppScene appId={dismissedAppId} />
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
            y: vpHeight,
          }}
          transition={fallbackExitTransition}
          onAnimationComplete={() => {
            prevOriginRef.current = null;
            clearDismissedApp();
          }}
        >
          <div className="h-full">
            <AppScene appId={dismissedAppId} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
