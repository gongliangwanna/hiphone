import { useRef, useState, useCallback, useEffect, useLayoutEffect, type CSSProperties } from 'react';
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

  // iOS Safari keyboard handling — pragmatic non-intervention strategy.
  //
  // The history (everything below has been tried in this codebase and
  // produced visible bugs the user has reported):
  //   • Shrink `device-root.height` to `visualViewport.height` — looks
  //     correct in theory, but iOS auto-scrolls `vv.offsetTop` to bring
  //     the focused input into view BEFORE our resize handler runs.
  //     After we shrink, the input reflows to vv's top while iOS still
  //     has `vv.offsetTop ≈ 394`. The visible region is then
  //     `body[394..864]` — input (76px) followed by ~374px of empty
  //     `#root` background (because `#root` has `min-height: 100dvh`
  //     from `index.html` + `src/styles/global.css`, so it stays 844px
  //     while the device inside shrinks to 470). Symptom: chat input
  //     pinned to the top of the visible area, header missing, big
  //     black space below to the keyboard. **This is the exact bug
  //     the user has hit twice in a row.**
  //   • Pin `<body>` with `position: fixed` + JS height — same root
  //     bug, plus the CSS `min-height: 100dvh` silently clobbers the JS
  //     height unless we ALSO inline `min-height: 0` on html/body/#root,
  //     which introduced its own race conditions across iOS versions.
  //   • Counter-transform `device-root` by `-vv.offsetTop` — 1-frame
  //     lag produces visible jitter on every keyboard animation step,
  //     and iOS 26 has a documented `vv.offsetTop` regression
  //     (https://developer.apple.com/forums/thread/800125).
  //
  // What we do INSTEAD: don't touch dimensions in response to the
  // keyboard at all. Let iOS scroll the visual viewport natively to
  // bring the focused input above the keyboard — exactly the same
  // behavior as Telegram Web, WhatsApp Web, Twitter mobile, etc. The
  // chat header scrolls out of view while the keyboard is open; that's
  // the standard iOS web tradeoff and it's *correct* layout, even if
  // it's not as polished as a native app.
  //
  // We still track `keyboardOpen` off `visualViewport` so the
  // `--app-safe-bottom` CSS var can collapse when the keyboard occupies
  // the home-indicator area, but we *do not* use it to mutate any
  // element's height.
  const profileWidthRef = useRef(viewportProfile.width);
  const profileHeightRef = useRef(viewportProfile.height);
  const shellModeRef = useRef(viewportProfile.shellMode);
  profileWidthRef.current = viewportProfile.width;
  profileHeightRef.current = viewportProfile.height;
  shellModeRef.current = viewportProfile.shellMode;

  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const applyGeometry = useCallback(() => {
    const el = deviceRef.current;
    if (!el) return;
    const profileHeight = profileHeightRef.current;
    const profileWidth = profileWidthRef.current;
    const isFullscreen = shellModeRef.current === 'fullscreen';

    // Always use the React profile dimensions. NEVER cap by vv.height —
    // see the comment block above.
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

  // Keyboard height tracking + `--keyboard-height` CSS var.
  //
  // We track this for two reasons:
  //   1. The `--app-safe-bottom` CSS var collapses when the keyboard is
  //      occupying the home-indicator area (no need for safe-area clearance).
  //   2. ChatDetail (and any other "input pinned to bottom" UI) reads
  //      `--keyboard-height` and applies `transform: translateY(calc(-1 *
  //      var(--keyboard-height)))` to the input bar, plus a matching
  //      `padding-bottom` on the messages scroll area. This is what keeps
  //      the chat header visible when the keyboard is up: by visually
  //      hoisting the input above the keyboard ourselves, iOS sees that
  //      `getBoundingClientRect()` of the focused input is already inside
  //      the visual viewport and *does not* auto-scroll vv to bring it
  //      into view (the auto-scroll is what was hiding the header).
  //
  // The hard part is the FIRST keyboard open. iOS evaluates "is this
  // input visible?" between `focusin` and the first `vv.resize`. If we
  // wait for `vv.resize` to set `--keyboard-height`, iOS has already
  // auto-scrolled by then. Workaround: cache the last observed keyboard
  // height in localStorage, and on `focusin` *immediately* set
  // `--keyboard-height` to the cached value (a reasonable estimate for
  // first-time users). This gives the input transform a head start so
  // iOS sees the focused input already in vv. We then refine the value
  // when `vv.resize` fires with the actual height.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const vv = window.visualViewport;
    if (!vv) return;

    const KB_CACHE_KEY = 'hiphone:kbHeight';
    let cachedKb = (() => {
      try {
        const v = parseInt(localStorage.getItem(KB_CACHE_KEY) ?? '300', 10);
        return Number.isFinite(v) && v >= 150 && v <= 500 ? v : 300;
      } catch {
        return 300;
      }
    })();

    const setKbVar = (h: number) => {
      const el = deviceRef.current;
      if (!el) return;
      el.style.setProperty('--keyboard-height', `${h}px`);
    };

    const isTextInput = (el: EventTarget | null): el is HTMLElement => {
      if (!el || !(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT') {
        const type = (el as HTMLInputElement).type;
        return type !== 'button' && type !== 'submit' && type !== 'checkbox' && type !== 'radio' && type !== 'file';
      }
      return tag === 'TEXTAREA' || el.isContentEditable;
    };

    const onFocusIn = (e: FocusEvent) => {
      if (!isTextInput(e.target)) return;
      // Pre-shrink with the cached estimate so iOS auto-scroll doesn't
      // get a chance to fire on the first vv.resize.
      setKbVar(cachedKb);
      setKeyboardOpen(true);
    };

    const onFocusOut = () => {
      setKbVar(0);
      setKeyboardOpen(false);
    };

    const onVvResize = () => {
      const profileHeight = profileHeightRef.current;
      const innerH = window.innerHeight;
      const kb = Math.max(0, innerH - vv.height);
      if (kb > 100) {
        // Real keyboard
        setKbVar(kb);
        cachedKb = kb;
        try {
          localStorage.setItem(KB_CACHE_KEY, String(kb));
        } catch {
          /* ignore quota errors */
        }
        setKeyboardOpen(true);
      } else {
        // No keyboard (or just URL-bar shrink — still show safe-area)
        setKbVar(0);
        const open = vv.height > 0 && vv.height < profileHeight - 100;
        setKeyboardOpen(open);
      }
    };

    onVvResize();
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('focusout', onFocusOut);
    vv.addEventListener('resize', onVvResize);

    return () => {
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('focusout', onFocusOut);
      vv.removeEventListener('resize', onVvResize);
    };
  }, []);

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

  const showSwitcherBg = presentationMode === 'switcher';

  useEffect(() => {
    if (isLocked) {
      closeOverlay();
      return;
    }

    if (overlay === 'control-center' && (activeAppId || presentationMode !== 'foreground')) {
      closeOverlay();
    }
  }, [activeAppId, closeOverlay, isLocked, overlay, presentationMode]);

  const wallpaper = wallpapers.find((w) => w.id === wallpaperId) ?? wallpapers[0]!;

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
    } else if (appCoversScreen) {
      // App is opening / fully open — scale down + dim Springboard behind it
      el.style.visibility = 'visible';
      el.style.transition = 'filter 450ms ease-out, transform 450ms ease-out, opacity 450ms ease-out';
      el.style.filter = 'none';
      el.style.transform = 'scale(0.96)';
      el.style.opacity = '0.7';
    } else if (appDismissing) {
      // App is closing — animate Springboard back to normal
      el.style.visibility = 'visible';
      el.style.transition = 'filter 350ms ease-out, transform 350ms ease-out, opacity 350ms ease-out';
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
  }, [disableDesktopFilter, isLocked, presentationMode, appCoversScreen, appDismissing]);

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
    '--safe-bottom': 'env(safe-area-inset-bottom, 0px)',
    '--safe-left': 'env(safe-area-inset-left, 0px)',
    '--shell-side-padding': `${metrics.sidePadding}px`,
    '--status-top-padding': 'max(12px, calc(var(--safe-top) + 6px))',
    '--status-bar-height': 'calc(var(--status-top-padding) + 36px)',
    '--app-safe-top': 'var(--status-bar-height)',
    // When the keyboard is up, hide the bottom safe-area inset; the input's
    // own padding + the keyboard itself now own that space.
    '--app-safe-bottom': keyboardOpen
      ? '8px'
      : 'max(12px, calc(var(--safe-bottom) + 8px))',
    // Initial value for the keyboard-height var. Updated imperatively by
    // the focusin/focusout/vv.resize listeners above so the assignment
    // bypasses React's batching during iOS keyboard animation.
    '--keyboard-height': '0px',
    '--lock-actions-bottom': 'max(24px, calc(var(--safe-bottom) + 12px))',
    '--springboard-top-padding': `${metrics.springboardTopPadding}px`,
    // NOTE: width / height / minHeight / maxHeight / maxWidth / transform are
    // applied imperatively by `applyGeometry()` to bypass React batching
    // during iOS keyboard animation — DO NOT add them here, otherwise React
    // re-renders will fight the imperative updates and reintroduce the
    // brief black flash on focus.
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
