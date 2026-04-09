import { useState, useRef } from 'react';
import { LockTime } from './LockTime';
import { shouldCommitUnlock } from '@/platform/gesture/thresholds';
import { computeVelocity, type VelocitySample } from '@/platform/gesture/velocity';
import { Solar } from 'lunar-javascript';

interface LockScreenProps {
  onUnlock: () => void;
  visible: boolean;
  wallpaper: string;
  onDragProgress?: (progress: number) => void;
}

export function LockScreen({ onUnlock, visible, wallpaper, onDragProgress }: LockScreenProps) {
  const [dragOffset, setDragOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragRef = useRef({ startX: 0, startY: 0, startTime: 0 });
  const samplesRef = useRef<VelocitySample[]>([]);

  // Immediately unmount when not visible and not mid-animation
  if (!visible && !animating) return null;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!visible) return;
    isDraggingRef.current = true;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startTime: Date.now() };
    samplesRef.current = [{ time: Date.now(), x: e.clientX, y: e.clientY }];
    setDragOffset(0);
    setAnimating(false);
    onDragProgress?.(0);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dy = e.clientY - dragRef.current.startY;
    if (dy > 0) { setDragOffset(0); onDragProgress?.(0); return; }

    samplesRef.current.push({ time: Date.now(), x: e.clientX, y: e.clientY });
    if (samplesRef.current.length > 10) samplesRef.current = samplesRef.current.slice(-10);

    setDragOffset(dy);
    const containerHeight = containerRef.current?.offsetHeight || 800;
    onDragProgress?.(Math.min(1, Math.abs(dy) / containerHeight));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    samplesRef.current.push({ time: Date.now(), x: e.clientX, y: e.clientY });
    const vel = computeVelocity(samplesRef.current);
    const containerHeight = containerRef.current?.offsetHeight || 800;
    const dy = e.clientY - dragRef.current.startY;
    const committed = shouldCommitUnlock(dy, vel.vy, containerHeight);

    if (committed) {
      setAnimating(true);
      setDragOffset(-containerHeight);
      onDragProgress?.(1);
      setTimeout(() => {
        onUnlock();
        setAnimating(false);
      }, 350);
    } else {
      setAnimating(true);
      setDragOffset(0);
      onDragProgress?.(0);
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-20"
      data-testid="lock-screen"
      style={{ touchAction: 'pan-x' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="flex h-full flex-col"
        style={{
          transform: `translateY(${dragOffset}px)`,
          transition: animating ? 'transform 350ms cubic-bezier(0.2, 0.9, 0.3, 1)' : 'none',
        }}
      >
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: wallpaper ? `url(${wallpaper})` : 'none' }}
          data-perf-layer="lockscreen-wallpaper"
          data-perf-active={String(Boolean(wallpaper))}
        />
        <div className="absolute inset-0 bg-black/10" />

        <div className="relative z-10 flex h-full flex-col">
          {/* Top bar */}
          <div
            className="flex items-center justify-between"
            style={{
              height: 'calc(var(--status-top-padding) + 42px)',
              paddingTop: 'var(--status-top-padding)',
              paddingInline: 'var(--shell-side-padding)',
            }}
          >
            <span className="text-[15px] font-normal text-white">中国电信</span>
            <StatusIcons />
          </div>

          {/* Time group — positioned in upper area */}
          <div style={{ marginTop: '6vh' }}>
            {/* Large time */}
            <LockTime />

            {/* Date line 1: 公历 */}
            <div className="text-center" style={{ marginTop: 6 }}>
              <span
                className="text-[18px] font-normal text-white/80"
                style={{ letterSpacing: '0.02em' }}
                data-testid="lock-date"
              >
                {formatSolarDate(new Date())}
              </span>
            </div>

            {/* Date line 2: 农历 */}
            <div className="text-center" style={{ marginTop: 2 }}>
              <span className="text-[15px] font-normal text-white/60">
                {formatLunarDate(new Date())}
              </span>
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom action buttons */}
          <div
            className="flex items-end justify-between"
            style={{
              paddingInline: 'calc(var(--shell-side-padding) + 24px)',
              paddingBottom: 'var(--lock-actions-bottom)',
            }}
          >
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/15">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M9 21h6v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z" />
              </svg>
            </div>
            <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-white/15">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                <path d="M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4z" />
                <path d="M9 2L7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" />
              </svg>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function StatusIcons() {
  return (
    <div className="flex items-center gap-1.5 text-white">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
        <rect x="0" y="9" width="3" height="3" rx="0.5" />
        <rect x="5" y="6" width="3" height="6" rx="0.5" />
        <rect x="10" y="3" width="3" height="9" rx="0.5" />
        <rect x="15" y="0" width="3" height="12" rx="0.5" />
      </svg>
      <svg width="16" height="12" viewBox="0 0 16 12" fill="currentColor">
        <path d="M8 10.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
        <path d="M4.93 9.07a4.48 4.48 0 016.14 0l-1.06 1.06a2.98 2.98 0 00-4.02 0L4.93 9.07z" />
        <path d="M2.81 6.94a7.48 7.48 0 0110.38 0l-1.06 1.06a5.98 5.98 0 00-8.26 0L2.81 6.94z" />
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13" fill="currentColor">
        <rect x="0.5" y="0.5" width="23" height="12" rx="2.5" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.4" />
        <rect x="2" y="2" width="20" height="9" rx="1.5" fill="currentColor" />
        <path d="M25 4.5v4a2 2 0 000-4z" opacity="0.4" />
      </svg>
    </div>
  );
}

/** "4月8日 周三" */
function formatSolarDate(date: Date): string {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = weekdays[date.getDay()];
  return `${m}月${d}日 ${w}`;
}

/** "丙午年二月廿一" */
function formatLunarDate(date: Date): string {
  try {
    const solar = Solar.fromDate(date);
    const lunar = solar.getLunar();
    return `${lunar.getYearInGanZhi()}年${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`;
  } catch {
    return '';
  }
}
