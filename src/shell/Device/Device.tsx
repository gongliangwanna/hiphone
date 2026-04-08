import { useRef, useCallback, useEffect } from 'react';
import { StatusBar } from '../StatusBar/StatusBar';
import { HomeIndicator } from '../HomeIndicator/HomeIndicator';
import { Springboard } from '../Springboard/Springboard';
import { LockScreen } from '../LockScreen/LockScreen';
import { wallpapers } from '../Springboard/apps.data';
import { useSystemStore } from '@/platform/stores/systemStore';

const MAX_BLUR = 14;

function easeOutQuad(t: number): number {
  return t * (2 - t);
}

export function Device() {
  const isLocked = useSystemStore((s) => s.isLocked);
  const wallpaperId = useSystemStore((s) => s.wallpaperId);
  const unlock = useSystemStore((s) => s.unlock);
  const desktopRef = useRef<HTMLDivElement>(null);

  const wallpaper = wallpapers.find((w) => w.id === wallpaperId) ?? wallpapers[0]!;

  const handleDragProgress = useCallback((progress: number) => {
    const el = desktopRef.current;
    if (!el) return;
    const eased = easeOutQuad(progress);
    const blur = MAX_BLUR * (1 - eased);
    const brightness = 1 + 0.08 * eased;
    // Direct DOM write — synchronous, no re-render, follows finger at 60fps
    el.style.transition = 'none';
    el.style.filter = `blur(${blur.toFixed(1)}px) brightness(${brightness.toFixed(3)})`;
  }, []);

  // When lock state changes, apply the right filter
  useEffect(() => {
    const el = desktopRef.current;
    if (!el) return;

    if (isLocked) {
      // Reset to locked state immediately
      el.style.transition = 'none';
      el.style.filter = `blur(${MAX_BLUR}px) brightness(1)`;
    } else {
      // Just unlocked — smoothly clear remaining blur
      el.style.transition = 'filter 300ms ease-out';
      el.style.filter = 'none';
    }
  }, [isLocked]);

  return (
    <div
      className="device-root relative mx-auto flex flex-col overflow-hidden bg-black"
      style={{
        width: '100vw',
        height: '100vh',
        maxWidth: 393,
        maxHeight: 'min(100vh, calc(100vw * 2.164))',
      }}
    >
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${wallpaper.src})` }}
        data-testid="wallpaper"
      />

      <div
        ref={desktopRef}
        className="relative z-10 flex h-full flex-col"
        style={{ filter: `blur(${MAX_BLUR}px) brightness(1)` }}
      >
        <StatusBar />
        <div className="flex-1 overflow-hidden">
          <Springboard />
        </div>
        <HomeIndicator />
      </div>

      <LockScreen
        onUnlock={unlock}
        visible={isLocked}
        wallpaper={wallpaper.src}
        onDragProgress={handleDragProgress}
      />
    </div>
  );
}
