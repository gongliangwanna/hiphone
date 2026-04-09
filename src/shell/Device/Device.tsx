import { useRef, useCallback, useEffect, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { StatusBar } from '../StatusBar/StatusBar';
import { AssistiveTouch } from '../AssistiveTouch/AssistiveTouch';
import { Springboard } from '../Springboard/Springboard';
import { LockScreen } from '../LockScreen/LockScreen';
import { AppHost } from '../AppHost/AppHost';
import { ControlCenter } from '../ControlCenter/ControlCenter';
import { AppSwitcher } from '../AppSwitcher/AppSwitcher';
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
  const viewportProfile = useViewportProfile();
  const metrics = getSpringboardMetrics(viewportProfile.sizeTier);
  const perfSnapshot = usePerformanceMonitor(perfEnabled);

  const overlay = useUIStateStore((s) => s.overlay);
  const openOverlay = useUIStateStore((s) => s.openOverlay);
  const closeOverlay = useUIStateStore((s) => s.closeOverlay);
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const recentApps = useAppRuntimeStore((s) => s.recentApps);
  const presentationMode = useAppRuntimeStore((s) => s.presentationMode);

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
    const eased = easeOutQuad(progress);
    const blur = MAX_BLUR * (1 - eased);
    const brightness = 1 + 0.08 * eased;
    el.style.transition = 'none';
    el.style.filter = `blur(${blur.toFixed(1)}px) brightness(${brightness.toFixed(3)})`;
  }, [disableDesktopFilter]);

  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;

    if (disableDesktopFilter) {
      el.style.transition = 'none';
      el.style.filter = 'none';
      return;
    }

    if (isLocked) {
      el.style.transition = 'none';
      el.style.filter = `blur(${MAX_BLUR}px) brightness(1)`;
    } else if (presentationMode === 'switcher') {
      // Blur + dim the springboard when app switcher is visible
      el.style.transition = 'filter 250ms ease-out';
      el.style.filter = 'blur(18px) brightness(0.6)';
    } else {
      el.style.transition = 'filter 300ms ease-out';
      el.style.filter = 'none';
    }
  }, [disableDesktopFilter, isLocked, presentationMode]);

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
    '--app-safe-bottom': 'max(12px, calc(var(--safe-bottom) + 8px))',
    '--lock-actions-bottom': 'max(24px, calc(var(--safe-bottom) + 12px))',
    '--springboard-top-padding': `${metrics.springboardTopPadding}px`,
    width: `${viewportProfile.width}px`,
    height: `${viewportProfile.height}px`,
    minHeight: viewportProfile.shellMode === 'fullscreen' ? `${viewportProfile.height}px` : undefined,
    maxWidth: viewportProfile.shellMode === 'fullscreen' ? 'none' : undefined,
    maxHeight: viewportProfile.shellMode === 'fullscreen' ? 'none' : undefined,
    borderRadius: 0,
  };

  return (
    <div
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
            style={{ backgroundImage: `url(${wallpaper.src})` }}
            data-testid="wallpaper"
            data-perf-layer="wallpaper"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${wallpaper.src})`,
              filter: disableDesktopFilter
                ? 'none'
                : 'blur(24px) brightness(0.78) saturate(1.2)',
              opacity: showSwitcherBg ? 1 : 0,
              transition: 'opacity 0.25s ease-out',
              transform: 'scale(1.12)',
              zIndex: 1,
            }}
            data-perf-layer="wallpaper-gesture-overlay"
          />
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
