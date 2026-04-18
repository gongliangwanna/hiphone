import { useState, useRef, useCallback, useEffect, useLayoutEffect, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StatusBar } from '../StatusBar/StatusBar';
import { AssistiveTouch } from '../AssistiveTouch/AssistiveTouch';
import { Springboard } from '../Springboard/Springboard';
import { LockScreen } from '../LockScreen/LockScreen';
import { AppHost } from '../AppHost/AppHost';
import { ControlCenter } from '../ControlCenter/ControlCenter';
import { AppSwitcher } from '../AppSwitcher/AppSwitcher';
import { WidgetDrawer } from '../WidgetDrawer/WidgetDrawer';
import { PerformanceHUD } from '../PerformanceHUD/PerformanceHUD';
import { Toast } from '@/system/Toast/Toast';
import { Banner } from '@/system/Banner/Banner';
import { PhoneOwnerBanner } from '../PhoneOwnerBanner/PhoneOwnerBanner';
import {
  PERF_DEBUG_STORAGE_KEY,
  parsePerfDebugStorage,
  resolvePerfDebugPrefs,
  serializePerfDebugStorage,
} from '@/platform/perf/diagnostics';
import { usePerformanceMonitor } from '@/platform/perf/usePerformanceMonitor';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';
import { wallpapers } from '../Springboard/apps.data';
import { useSystemStore } from '@/platform/stores/systemStore';
import { useUIStateStore } from '@/platform/stores/uiStateStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { getSpringboardMetrics } from './viewportProfile';
import { useViewportProfile } from './useViewportProfile';

const MAX_BLUR = 14;

type ShellStyle = CSSProperties & Record<`--${string}`, string>;

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

function StatusBarPlaceholder() {
  return (
    <div
      style={{
        height: 'var(--status-bar-height)',
        flexShrink: 0,
      }}
    />
  );
}

export function Device() {
  const isLocked = useSystemStore((s) => s.isLocked);
  const wallpaperId = useSystemStore((s) => s.wallpaperId);
  const customWallpapers = useSystemStore((s) => s.customWallpapers);
  const unlock = useSystemStore((s) => s.unlock);
  const perfEnabled = usePerfDebugStore((s) => s.enabled);
  const disableWallpaper = usePerfDebugStore((s) => s.disableWallpaper);
  const disableDesktopFilter = usePerfDebugStore((s) => s.disableDesktopFilter);
  const reduceTransparency = usePerfDebugStore((s) => s.reduceTransparency);
  const hideIconImages = usePerfDebugStore((s) => s.hideIconImages);
  const hydratePerfDebug = usePerfDebugStore((s) => s.hydrate);
  const desktopRef = useRef<HTMLDivElement>(null);
  const deviceRef = useRef<HTMLDivElement>(null);

  const viewportProfile = useViewportProfile();

  // iOS Safari keyboard handling: **intentionally none**. We accept iOS's
  // default `scrollToRevealFocusedElement` — tapping an input lets iOS
  // auto-scroll the visual viewport so the focus is visible, exactly
  // like every other iOS web app. Six prior rounds of avoidance (see
  // docs/plan/2026-04-11-1546-chat-keyboard-fix.md +
  // docs/plan/2026-04-11-1823-keyboard-counter-scroll.md) were
  // explicitly reverted — do NOT add `--keyboard-height`, `keyboardOpen`,
  // `visualViewport` listeners, or imperative transforms here without
  // first writing a new plan that explains why this time is different.
  // See docs/plan/2026-04-11-1849-revert-keyboard-optimizations.md.
  const profileWidthRef = useRef(viewportProfile.width);
  const profileHeightRef = useRef(viewportProfile.height);
  const shellModeRef = useRef(viewportProfile.shellMode);
  profileWidthRef.current = viewportProfile.width;
  profileHeightRef.current = viewportProfile.height;
  shellModeRef.current = viewportProfile.shellMode;

  const applyGeometry = useCallback(() => {
    const el = deviceRef.current;
    if (!el) return;
    const profileHeight = profileHeightRef.current;
    const profileWidth = profileWidthRef.current;
    const isFullscreen = shellModeRef.current === 'fullscreen';

    // Always use the React profile dimensions. Never cap by vv.height —
    // the coarse-pointer stable height in useViewportProfile already
    // freezes profileHeight across keyboard-induced shrinks, so the
    // shell stays at its pre-keyboard size when iOS opens the keyboard.
    el.style.width = `${profileWidth}px`;
    el.style.height = `${profileHeight}px`;
    if (isFullscreen) {
      el.style.minHeight = `${profileHeight}px`;
      el.style.maxHeight = `${profileHeight}px`;
      el.style.maxWidth = 'none';
    } else {
      el.style.minHeight = '';
      el.style.maxHeight = '';
      el.style.maxWidth = '';
    }
  }, []);

  // Re-apply whenever the React-tracked viewport profile changes (resize,
  // orientation change). useLayoutEffect runs synchronously before paint
  // so the first frame is always correct.
  useLayoutEffect(() => {
    applyGeometry();
  }, [
    applyGeometry,
    viewportProfile.width,
    viewportProfile.height,
    viewportProfile.shellMode,
  ]);

  const metrics = getSpringboardMetrics(viewportProfile.sizeTier);
  const perfSnapshot = usePerformanceMonitor(perfEnabled);

  const overlay = useUIStateStore((s) => s.overlay);
  const openOverlay = useUIStateStore((s) => s.openOverlay);
  const closeOverlay = useUIStateStore((s) => s.closeOverlay);
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const dismissedAppId = useAppRuntimeStore((s) => s.dismissedAppId);
  const recentApps = useAppRuntimeStore((s) => s.recentApps);
  const presentationMode = useAppRuntimeStore((s) => s.presentationMode);
  const isWidgetDrawerOpen = useSpringboardLayoutStore((s) => s.isWidgetDrawerOpen);

  const showCC =
    overlay === 'control-center' &&
    !isLocked &&
    !activeAppId &&
    presentationMode === 'foreground';
  const showSwitcher =
    !isLocked &&
    recentApps.length > 0 &&
    presentationMode === 'switcher';

  const switcherBgActive = presentationMode === 'switcher';
  // Fade out the blur background when transitioning from switcher to foreground
  // instead of instantly unmounting it.
  //
  // CRITICAL: the fading toggle MUST happen synchronously during render (React's
  // "setState during render" pattern), NOT in a useEffect. An effect runs after
  // paint, which leaves one frame where showSwitcherBg is false — the blur bg
  // unmounts, the DOM element is removed, and when it remounts the CSS transition
  // has no previous opacity to animate from, causing an instant opacity jump.
  const [switcherBgFading, setSwitcherBgFading] = useState(false);
  const prevSwitcherBgRef = useRef(switcherBgActive);
  if (prevSwitcherBgRef.current && !switcherBgActive && !switcherBgFading && activeAppId) {
    // Only keep the blur alive when activating an app (AppHost needs time to
    // expand). Going home (activeAppId=null) removes the blur immediately.
    setSwitcherBgFading(true);
  }
  if (switcherBgActive && switcherBgFading) {
    setSwitcherBgFading(false);
  }
  prevSwitcherBgRef.current = switcherBgActive;

  // Clean up fading state after the CSS animation completes
  useEffect(() => {
    if (!switcherBgFading) return;
    // 250ms CSS transition-delay + 300ms opacity fade + buffer
    const timer = setTimeout(() => setSwitcherBgFading(false), 600);
    return () => clearTimeout(timer);
  }, [switcherBgFading]);

  const showSwitcherBg = switcherBgActive || switcherBgFading;

  useEffect(() => {
    if (isLocked) {
      closeOverlay();
      return;
    }

    if (overlay === 'control-center' && (activeAppId || presentationMode !== 'foreground')) {
      closeOverlay();
    }
  }, [activeAppId, closeOverlay, isLocked, overlay, presentationMode]);

  const wallpaper =
    customWallpapers.find((w) => w.id === wallpaperId) ??
    wallpapers.find((w) => w.id === wallpaperId) ??
    wallpapers[0]!;

  const handleDragProgress = useCallback((progress: number) => {
    const el = desktopRef.current;
    if (!el) return;
    if (disableDesktopFilter) {
      el.style.transition = 'none';
      el.style.filter = 'none';
      return;
    }
    // Show Springboard when user starts dragging the lock screen up
    if (progress > 0) {
      el.style.visibility = 'visible';
    }
    const eased = easeOutQuad(progress);
    const blur = MAX_BLUR * (1 - eased);
    const brightness = 1 + 0.08 * eased;
    el.style.transition = 'none';
    el.style.filter = `blur(${blur.toFixed(1)}px) brightness(${brightness.toFixed(3)})`;
  }, [disableDesktopFilter]);

  // App is fully covering the screen — Springboard should be scaled down + dimmed
  const appCoversScreen = !!activeAppId && presentationMode === 'foreground';
  // App is being dismissed — Springboard should animate back to normal
  const appDismissing = !!dismissedAppId && !activeAppId;

  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;

    if (disableDesktopFilter) {
      el.style.transition = 'none';
      el.style.filter = 'none';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.visibility = 'visible';
      return;
    }

    if (isLocked) {
      el.style.transition = 'none';
      el.style.filter = `blur(${MAX_BLUR}px) brightness(1)`;
      el.style.transform = '';
      el.style.opacity = '';
      el.style.visibility = 'hidden';
    } else if (presentationMode === 'switcher') {
      // Blur + dim the springboard when app switcher is visible
      el.style.transition = 'filter 250ms ease-out, transform 250ms ease-out, opacity 250ms ease-out';
      el.style.filter = 'blur(18px) brightness(0.6)';
      el.style.transform = '';
      el.style.opacity = '';
      el.style.visibility = 'hidden';
    } else if (switcherBgFading && appCoversScreen) {
      // Exiting switcher into an app — keep desktop hidden until the blur
      // backdrop fades and AppHost expand covers the screen. When going
      // home (appCoversScreen=false), skip this so the Dock is visible.
      el.style.visibility = 'hidden';
    } else if (appCoversScreen) {
      // App is opening / fully open — scale down + dim Springboard behind it
      el.style.visibility = 'visible';
      el.style.transition = 'filter 450ms ease-out, transform 450ms ease-out, opacity 450ms ease-out';
      el.style.filter = 'none';
      el.style.transform = 'scale(0.96)';
      el.style.opacity = '0.7';
    } else if (appDismissing) {
      // App close: AppHost's shape-morph starts with clipPath inset(0) fully
      // covering the screen, so snapping desktop back to 1.0/opacity 1 is
      // invisible to the user. Transitioning (as we used to with a 350ms
      // ease-out) produced a perceptible scale-out-from-center on the icons
      // — edge icons drifted ~3px before the AppHost clipPath exposed them,
      // reading as a faint left-to-right shimmer across the home screen.
      el.style.visibility = 'visible';
      el.style.transition = 'none';
      el.style.filter = 'none';
      el.style.transform = 'scale(1)';
      el.style.opacity = '1';
    } else {
      el.style.transition = 'filter 300ms ease-out, transform 300ms ease-out, opacity 300ms ease-out';
      el.style.filter = 'none';
      el.style.transform = 'scale(1)';
      el.style.opacity = '1';
      el.style.visibility = 'visible';
    }
  }, [disableDesktopFilter, isLocked, presentationMode, appCoversScreen, appDismissing, switcherBgFading]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const persisted = parsePerfDebugStorage(window.localStorage.getItem(PERF_DEBUG_STORAGE_KEY));
    hydratePerfDebug(resolvePerfDebugPrefs(window.location.search, persisted));
  }, [hydratePerfDebug]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    window.localStorage.setItem(
      PERF_DEBUG_STORAGE_KEY,
      serializePerfDebugStorage({
        enabled: perfEnabled,
        disableWallpaper,
        disableDesktopFilter,
        reduceTransparency,
        hideIconImages,
      }),
    );
  }, [
    disableDesktopFilter,
    disableWallpaper,
    hideIconImages,
    perfEnabled,
    reduceTransparency,
  ]);

  const rootStyle: ShellStyle = {
    '--safe-top': 'env(safe-area-inset-top, 0px)',
    '--safe-right': 'env(safe-area-inset-right, 0px)',
    // Fullscreen mode: the hiPhone IS the phone, so the OS-level home
    // indicator safe area should not push content up — the simulator
    // handles its own bottom chrome (Dock, tab bars). Without this,
    // adding a PWA manifest causes Safari to inflate safe-area-inset-bottom
    // and leave a visible black gap at the bottom of the screen.
    '--safe-bottom': viewportProfile.shellMode === 'fullscreen'
      ? '0px'
      : 'env(safe-area-inset-bottom, 0px)',
    '--safe-left': 'env(safe-area-inset-left, 0px)',
    '--shell-side-padding': `${metrics.sidePadding}px`,
    '--status-top-padding': 'max(12px, calc(var(--safe-top) + 6px))',
    '--status-bar-height': 'calc(var(--status-top-padding) + 36px)',
    '--app-safe-top': 'var(--status-bar-height)',
    '--app-safe-bottom': 'max(12px, calc(var(--safe-bottom) + 8px))',
    '--lock-actions-bottom': 'max(24px, calc(var(--safe-bottom) + 12px))',
    '--springboard-top-padding': `${metrics.springboardTopPadding}px`,
    // NOTE: width / height / minHeight / maxHeight / maxWidth are
    // applied imperatively by `applyGeometry()` — DO NOT add them here,
    // otherwise React re-renders will fight the imperative updates.
    transformOrigin: '0 0',
    borderRadius: 0,
  };

  return (
    <div
      ref={deviceRef}
      className="device-root relative mx-auto flex flex-col overflow-hidden bg-black"
      style={rootStyle}
      data-testid="device-root"
      data-shell-mode={viewportProfile.shellMode}
      data-size-tier={viewportProfile.sizeTier}
    >
      {!disableWallpaper ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${wallpaper.src})`,
              // Promote the wallpaper to its own compositor layer so the
              // springboard track sliding above it never forces a re-raster
              // of the (large) wallpaper bitmap. Without translateZ here,
              // some Chromium versions kept the wallpaper in the parent
              // raster region, causing visible repaints during swipe.
              transform: 'translateZ(0)',
              willChange: 'transform',
            }}
            data-testid="wallpaper"
            data-perf-layer="wallpaper"
          />
          {/*
            App-switcher background blur. Earlier this layer was always
            mounted with `opacity: 0`, but `filter: blur(24px)` is *not*
            free at opacity 0 — Chromium still keeps the layer prepared.
            We now mount it only when the switcher is on screen so it
            doesn't pay the cost during normal swipes.
          */}
          {showSwitcherBg ? (
            <div
              className="pointer-events-none absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${wallpaper.src})`,
                filter: disableDesktopFilter
                  ? 'none'
                  : 'blur(24px) brightness(0.78) saturate(1.2)',
                transform: 'scale(1.12) translateZ(0)',
                willChange: 'transform',
                zIndex: 1,
                opacity: switcherBgFading ? 0 : 1,
                // 250ms delay lets AppHost expand cover the screen before blur fades
                transition: switcherBgFading ? 'opacity 300ms ease-out 250ms' : undefined,
              }}
              data-perf-layer="wallpaper-gesture-overlay"
            />
          ) : null}
        </>
      ) : null}

      <div
        ref={desktopRef}
        className="relative z-10 flex h-full flex-col"
        style={{ filter: disableDesktopFilter ? 'none' : `blur(${MAX_BLUR}px) brightness(1)` }}
        data-perf-layer="desktop-filter"
        data-perf-active={String(!disableDesktopFilter && isLocked)}
      >
        <StatusBarPlaceholder />
        <div className="flex-1 overflow-hidden">
          <Springboard
            sizeTier={viewportProfile.sizeTier}
            viewportWidth={viewportProfile.width}
          />
        </div>
      </div>

      <LockScreen
        onUnlock={unlock}
        visible={isLocked}
        wallpaper={disableWallpaper ? '' : wallpaper.src}
        onDragProgress={handleDragProgress}
      />

      {showSwitcher && <AppSwitcher />}

      <AppHost />

      <AnimatePresence>
        {showCC && (
          <motion.div
            key="control-center"
            initial={{ y: '-100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 28, mass: 1 }}
            style={{ position: 'absolute', inset: 0, zIndex: 22 }}
          >
            <ControlCenter visible onClose={closeOverlay} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{isWidgetDrawerOpen && <WidgetDrawer key="widget-drawer" />}</AnimatePresence>

      <AssistiveTouch />

      <StatusBar />
      <PhoneOwnerBanner />
      <Banner />
      <Toast />

      {!isLocked && !activeAppId && presentationMode === 'foreground' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            zIndex: 26,
            width: 120,
            height: 'calc(var(--status-bar-height) + 20px)',
            cursor: 'pointer',
            touchAction: 'none',
          }}
          onClick={() => openOverlay('control-center')}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            event.currentTarget.dataset.startY = event.clientY.toString();
            event.currentTarget.dataset.dragged = 'false';
          }}
          onPointerMove={(event) => {
            const startY = parseFloat(event.currentTarget.dataset.startY || '0');
            if (event.clientY - startY > 10) {
              event.currentTarget.dataset.dragged = 'true';
            }
          }}
          onPointerUp={(event) => {
            event.currentTarget.releasePointerCapture(event.pointerId);
            const startY = parseFloat(event.currentTarget.dataset.startY || '0');
            if (event.currentTarget.dataset.dragged === 'true' && event.clientY - startY > 30) {
              openOverlay('control-center');
            }
          }}
          data-testid="cc-trigger"
        />
      )}
      {perfEnabled ? <PerformanceHUD snapshot={perfSnapshot} /> : null}
    </div>
  );
}
