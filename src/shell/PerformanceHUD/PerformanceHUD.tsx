import { useState } from 'react';
import { formatPerfSnapshotForClipboard } from '@/platform/perf/diagnostics';
import type { PerfSnapshot } from '@/platform/perf/usePerformanceMonitor';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

interface PerformanceHUDProps {
  snapshot: PerfSnapshot;
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-[11px] text-white">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function buildFrameChartPoints(deltas: number[]) {
  if (deltas.length === 0) return '';

  return deltas
    .map((delta, index) => {
      const fps = Math.max(0, Math.min(60, 1000 / Math.max(delta, 1)));
      const x = deltas.length === 1 ? 50 : (index / (deltas.length - 1)) * 100;
      const y = 100 - (fps / 60) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

function FrameChart({ deltas }: { deltas: number[] }) {
  if (deltas.length === 0) {
    return (
      <div
        className="mt-2 flex h-18 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[10px] text-white/45"
        data-testid="perf-frame-chart-empty"
      >
        等待帧样本...
      </div>
    );
  }

  const points = buildFrameChartPoints(deltas);

  return (
    <div
      className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2"
      data-testid="perf-frame-chart"
    >
      <div className="mb-2 flex items-center justify-between text-[10px] text-white/45">
        <span>实时帧率图</span>
        <span>最近 {deltas.length} 帧</span>
      </div>
      <svg viewBox="0 0 100 100" className="h-18 w-full overflow-visible">
        {[60, 40, 24].map((fps) => {
          const y = 100 - (fps / 60) * 100;
          return (
            <line
              key={fps}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="rgba(255,255,255,0.14)"
              strokeDasharray="3 4"
              strokeWidth="0.6"
            />
          );
        })}
        <polyline
          fill="none"
          points={points}
          stroke="rgba(255,255,255,0.9)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[10px] text-white/45">
        <span>60fps</span>
        <span>40fps</span>
        <span>24fps</span>
      </div>
    </div>
  );
}

export function PerformanceHUD({ snapshot }: PerformanceHUDProps) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const disableWallpaper = usePerfDebugStore((state) => state.disableWallpaper);
  const disableDesktopFilter = usePerfDebugStore((state) => state.disableDesktopFilter);
  const reduceTransparency = usePerfDebugStore((state) => state.reduceTransparency);
  const hideIconImages = usePerfDebugStore((state) => state.hideIconImages);
  const setEnabled = usePerfDebugStore((state) => state.setEnabled);
  const setDisableWallpaper = usePerfDebugStore((state) => state.setDisableWallpaper);
  const setDisableDesktopFilter = usePerfDebugStore((state) => state.setDisableDesktopFilter);
  const setReduceTransparency = usePerfDebugStore((state) => state.setReduceTransparency);
  const setHideIconImages = usePerfDebugStore((state) => state.setHideIconImages);

  const handleCopy = async () => {
    const text = formatPerfSnapshotForClipboard(snapshot, {
      disableWallpaper,
      disableDesktopFilter,
      reduceTransparency,
      hideIconImages,
    });

    const resetStatus = () => {
      window.setTimeout(() => {
        setCopyStatus('idle');
      }, 1500);
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', 'true');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(textarea);

        if (!copied) {
          throw new Error('copy failed');
        }
      }

      setCopyStatus('copied');
      resetStatus();
    } catch {
      setCopyStatus('failed');
      resetStatus();
    }
  };

  return (
    <aside
      className="absolute right-2 top-2 z-50 flex max-h-[60%] w-[280px] flex-col overflow-hidden rounded-xl border border-white/10 bg-black/85 text-white shadow-2xl"
      style={{ pointerEvents: 'auto', touchAction: 'auto' }}
      data-testid="perf-hud"
    >
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-3"
        data-testid="perf-hud-header"
      >
        <div>
          <div className="text-xs font-semibold">Performance HUD</div>
          <div className="text-[10px] text-white/60">手机端排查模式</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 text-[10px]"
            onClick={handleCopy}
            data-testid="perf-copy-button"
          >
            {copyStatus === 'copied'
              ? '已复制'
              : copyStatus === 'failed'
                ? '复制失败'
                : '复制'}
          </button>
          <button
            type="button"
            className="rounded-md border border-white/15 px-2 py-1 text-[10px]"
            onClick={() => setEnabled(false)}
          >
            关闭
          </button>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-auto px-3 py-3"
        data-testid="perf-hud-body"
      >
        <div className="space-y-3 text-[11px] leading-5">
          <section>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Frame</div>
            <div>fps: {snapshot.frames.fps}</div>
            <div>avg: {snapshot.frames.avgFrameMs}ms</div>
            <div>worst: {snapshot.frames.worstFrameMs}ms</div>
            <div>slow 24+: {snapshot.frames.slowFrames24}</div>
            <div>slow 40+: {snapshot.frames.slowFrames40}</div>
            <FrameChart deltas={snapshot.recentFrameMs} />
          </section>

          <section>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Main Thread</div>
            <div>long tasks: {snapshot.longTaskCount}</div>
            <div>longest: {snapshot.longestLongTaskMs}ms</div>
          </section>

          <section>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Environment</div>
            <div>
              viewport: {snapshot.viewportWidth} × {snapshot.viewportHeight}
            </div>
            <div>dpr: {snapshot.dpr}</div>
            <div>cores: {snapshot.hardwareConcurrency ?? '-'}</div>
            <div>memory: {snapshot.deviceMemory ?? '-'}</div>
          </section>

          <section>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Layers</div>
            <div>active backdrops: {snapshot.activeBackdropCount}</div>
            {snapshot.activeLayers.length === 0 ? (
              <div className="text-white/55">none</div>
            ) : (
              <ul className="space-y-1 text-white/85">
                {snapshot.activeLayers.map((layer) => (
                  <li key={layer.name}>
                    {layer.name} × {layer.count}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-1 text-[10px] uppercase tracking-[0.14em] text-white/45">Top Resources</div>
            {snapshot.topResources.length === 0 ? (
              <div className="text-white/55">none</div>
            ) : (
              <ul className="space-y-1 text-white/85">
                {snapshot.topResources.map((resource) => (
                  <li key={`${resource.initiatorType}-${resource.label}`}>
                    <div>{resource.label}</div>
                    <div className="text-[10px] text-white/55">
                      {resource.initiatorType} · {Math.round(resource.sizeBytes / 102.4) / 10}KB · {resource.durationMs}ms
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/45">Isolation</div>
            <ToggleRow
              label="关闭壁纸"
              checked={disableWallpaper}
              onChange={setDisableWallpaper}
            />
            <ToggleRow
              label="关闭桌面 blur"
              checked={disableDesktopFilter}
              onChange={setDisableDesktopFilter}
            />
            <ToggleRow
              label="降级毛玻璃"
              checked={reduceTransparency}
              onChange={setReduceTransparency}
            />
            <ToggleRow
              label="隐藏图标图片"
              checked={hideIconImages}
              onChange={setHideIconImages}
            />
          </section>
        </div>
      </div>
    </aside>
  );
}
