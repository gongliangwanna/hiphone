import { useRef, useCallback } from 'react';
import { StatusBar } from '../StatusBar/StatusBar';
import { HomeIndicator } from '../HomeIndicator/HomeIndicator';
import { Springboard } from '../Springboard/Springboard';
import { LockScreen } from '../LockScreen/LockScreen';
import { wallpapers } from '../Springboard/apps.data';
import { useSystemStore } from '@/platform/stores/systemStore';

const MAX_BLUR = 14;

/** Ease-out quad: fast start, gentle end — feels more physical */
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
    if (!desktopRef.current) return;
    // Non-linear: small drag → quick blur reduction, feels responsive
    const eased = easeOutQuad(progress);
    const blur = MAX_BLUR * (1 - eased);
    const brightness = 1 + 0.15 * eased; // slight brightness boost as it clears
    desktopRef.current.style.filter = `blur(${blur.toFixed(1)}px) brightness(${brightness.toFixed(3)})`;
  }, []);

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
        style={{ filter: isLocked ? `blur(${MAX_BLUR}px) brightness(1)` : 'blur(0px) brightness(1.15)' }}
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
