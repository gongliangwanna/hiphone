import { useMemo, useRef, useState } from 'react';
import type { PerfSnapshot } from '@/platform/perf/usePerformanceMonitor';
import type { FpsSample } from '@/platform/perf/diagnostics';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

interface PerformanceHUDProps {
  snapshot: PerfSnapshot;
}

function getFpsColor(fps: number) {
  if (fps >= 50) return '#34c759';
  if (fps >= 30) return '#ff9f0a';
  return '#ff3b30';
}

/** Sparkline plotting one FPS value per sampling window (oldest → newest). */
function FpsSparkline({
  history,
  strokeColor,
}: {
  history: FpsSample[];
  strokeColor: string;
}) {
  const W = 200;
  const H = 80;

  // Y-axis ceil tracks the actual max FPS observed in the window (120Hz
  // ProMotion devices show 80-120; 60Hz caps around 60). Falls back to 60
  // when history is empty so the grid has something to render.
  const ceil = useMemo(() => {
    const max = history.reduce((m, s) => Math.max(m, s.fps), 0);
    return max > 0 ? max : 60;
  }, [history]);

  const { linePath, areaPath } = useMemo(() => {
    if (history.length === 0) return { linePath: '', areaPath: '' };
    const n = history.length;
    // Keep the x-axis "scroll" consistent: always divide by (HISTORY_SIZE-1)
    // so a half-filled buffer renders on the left half of the chart instead
    // of stretching to fill. Prevents visual jitter on cold start.
    const stepX = W / Math.max(n - 1, 1);
    const coords = history.map((s, i) => {
      const clamped = Math.max(0, s.fps);
      const x = i * stepX;
      const y = H - (clamped / ceil) * H;
      return { x, y };
    });
    const line = coords
      .map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
    const area = `${line} L${coords[coords.length - 1]!.x.toFixed(1)} ${H} L${coords[0]!.x.toFixed(1)} ${H} Z`;
    return { linePath: line, areaPath: area };
  }, [history, ceil]);

  const gradientId = 'perf-fps-gradient';
  const thirtyY = H - (30 / ceil) * H;
  const sixtyY = ceil >= 60 ? H - (60 / ceil) * H : null;

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      data-testid="perf-sparkline"
      role="img"
      aria-label={`FPS 历史曲线，最近 ${history.length} 个采样`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Top ceil line (actual max observed, or 60 if empty). */}
      <line
        x1={0}
        y1={0.5}
        x2={W}
        y2={0.5}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={1}
      />
      {/* 60fps reference — only drawn when ceil > 60 so it's distinct from the top. */}
      {sixtyY !== null && sixtyY > 2 && (
        <line
          x1={0}
          y1={sixtyY}
          x2={W}
          y2={sixtyY}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={1}
        />
      )}
      {/* 30fps danger line. */}
      <line
        x1={0}
        y1={thirtyY}
        x2={W}
        y2={thirtyY}
        stroke="rgba(255,255,255,0.18)"
        strokeWidth={1}
        strokeDasharray="3 3"
      />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
      {/* Labels: current ceil at top, optional 60 marker, 30 danger line. */}
      <text x={2} y={9} fill="rgba(255,255,255,0.45)" fontSize={9}>
        {Math.round(ceil)}
      </text>
      {sixtyY !== null && sixtyY > 10 && (
        <text x={2} y={sixtyY - 2} fill="rgba(255,255,255,0.3)" fontSize={8}>
          60
        </text>
      )}
      <text x={2} y={thirtyY - 2} fill="rgba(255,255,255,0.35)" fontSize={8}>
        30
      </text>
    </svg>
  );
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
          className="mt-1.5 w-56 rounded-xl border border-white/15 bg-black/85 px-3 py-2.5 text-[11px] leading-relaxed text-white shadow-2xl"
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
          <div className="mb-2 overflow-hidden rounded-md border border-white/5 bg-white/[0.03]">
            <FpsSparkline history={snapshot.history} strokeColor={fpsColor} />
          </div>
          <div className="mb-2 flex justify-between text-[9px] uppercase tracking-wider text-white/35">
            <span>~45s window</span>
            <span>{snapshot.history.length} pts</span>
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
