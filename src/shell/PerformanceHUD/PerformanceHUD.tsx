import { useRef, useState } from 'react';
import type { PerfSnapshot } from '@/platform/perf/usePerformanceMonitor';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

interface PerformanceHUDProps {
  snapshot: PerfSnapshot;
}

function getFpsColor(fps: number) {
  if (fps >= 50) return '#34c759';
  if (fps >= 30) return '#ff9f0a';
  return '#ff3b30';
}

export function PerformanceHUD({ snapshot }: PerformanceHUDProps) {
  const [expanded, setExpanded] = useState(false);
  const setEnabled = usePerfDebugStore((state) => state.setEnabled);

  const dragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    dragging: boolean;
  } | null>(null);
  const [position, setPosition] = useState({ x: 8, y: 60 });
  const ballRef = useRef<HTMLDivElement>(null);

  const fps = snapshot.frames.fps;
  const fpsColor = getFpsColor(fps);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
      dragging: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.dragging && Math.abs(dx) + Math.abs(dy) > 5) {
      drag.dragging = true;
    }
    if (drag.dragging) {
      setPosition({ x: drag.originX + dx, y: drag.originY + dy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    const drag = dragRef.current;
    if (drag && !drag.dragging) {
      setExpanded((prev) => !prev);
    }
    dragRef.current = null;
  };

  return (
    <div
      className="fixed z-[9999]"
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
      data-testid="perf-hud"
    >
      {/* Floating ball */}
      <div
        ref={ballRef}
        className="flex h-11 w-11 cursor-pointer select-none items-center justify-center rounded-full shadow-lg"
        style={{
          background: `radial-gradient(circle at 35% 35%, ${fpsColor}cc, ${fpsColor}88)`,
          border: `1.5px solid ${fpsColor}`,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        data-testid="perf-ball"
      >
        <span className="text-xs font-bold text-white drop-shadow-sm">
          {fps > 0 ? Math.round(fps) : '--'}
        </span>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="mt-1.5 w-40 rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-2xl"
          data-testid="perf-panel"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
              Frame Stats
            </span>
            <button
              type="button"
              className="text-[10px] text-white/40 active:text-white/70"
              onClick={() => setEnabled(false)}
              data-testid="perf-close"
            >
              关闭
            </button>
          </div>
          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span className="text-white/60">FPS</span>
              <span style={{ color: fpsColor }}>{fps}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">avg</span>
              <span>{snapshot.frames.avgFrameMs}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">worst</span>
              <span>{snapshot.frames.worstFrameMs}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">slow 24+</span>
              <span>{snapshot.frames.slowFrames24}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/60">slow 40+</span>
              <span>{snapshot.frames.slowFrames40}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
