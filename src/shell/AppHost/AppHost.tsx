import { useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScene } from '@/apps/AppScene';
import { spring } from '@/platform/design-tokens/motion';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useViewportProfile } from '@/shell/Device/useViewportProfile';
import { getDeviceCornerRadius } from '@/shell/Device/viewportProfile';

const SWITCHER_SCALE = 0.66; // Match CARD_WIDTH_RATIO in AppSwitcher

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
  const viewportHeight = viewportProfile.height;
  const prevOriginRef = useRef(appOrigin);

  if (appOrigin) {
    prevOriginRef.current = appOrigin;
  }

  const origin = prevOriginRef.current;

  // P2b — when the user taps a switcher card, we have a precise device-root
  // rect and viewport size. The AppHost is a full-bleed layer (absolute
  // inset-0 inside device-root) whose unscaled size matches `viewport`.
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
        opacity: 0.85,
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
        borderRadius: 100,
        opacity: 0,
        scale: origin.width / 390,
        x: origin.x - 390 / 2 + origin.width / 2,
        y: origin.y - 844 / 2 + origin.height / 2,
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

  // P2d — select exit animation by intent:
  //   • dismissReason === 'card' → user swiped the last card up in
  //     switcher; fly out the top of the screen.
  //   • otherwise → home exit, drop down to the springboard.
  const exitAnimation =
    dismissReason === 'card'
      ? {
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: deviceCornerRadius,
          opacity: 0,
          scale: 0.6,
          x: 0,
          y: -(viewportHeight + 100),
        }
      : {
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          borderRadius: deviceCornerRadius,
          opacity: 0,
          scale: 0.3,
          x: 0,
          y: viewportHeight,
        };

  const exitTransition = {
    type: 'spring' as const,
    ...spring.criticalDamped,
  };

  return (
    <AnimatePresence
      onExitComplete={() => {
        prevOriginRef.current = null;
      }}
    >
      {activeAppId && presentationMode !== 'switcher' && (
        <motion.div
          key="foreground-app-host"
          className="absolute inset-0 overflow-hidden"
          style={{ zIndex: 18 }}
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
          exit={exitAnimation}
          transition={exitTransition}
        >
          <div className="h-full" data-testid="app-gesture-scene">
            <AppScene appId={activeAppId} />
          </div>
        </motion.div>
      )}

      {dismissedAppId && !activeAppId && (
        <motion.div
          key={`dismissed-app-${dismissedAppId}`}
          className="absolute inset-0 overflow-hidden"
          style={{ zIndex: 18 }}
          initial={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: deviceCornerRadius,
            opacity: 1,
            scale: 0.85,
            x: 0,
            y: 0,
          }}
          animate={exitAnimation}
          transition={exitTransition}
          onAnimationComplete={() => {
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
