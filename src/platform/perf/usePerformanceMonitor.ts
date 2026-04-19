import { useEffect, useRef, useState } from 'react';
import { summarizeFrameDeltas, type FpsSample, type FrameStats } from './diagnostics';

export interface PerfSnapshot {
  frames: FrameStats;
  /**
   * Per-interval FPS history (oldest first). Each entry summarises the frame
   * deltas captured during a single ~750ms sampling window — distinct from
   * the rolling `frames.fps` (which averages the last ~2s).
   */
  history: FpsSample[];
}

/** Sampling cadence in ms — one history point per interval. */
const SAMPLE_INTERVAL_MS = 750;
/** ~45s of history at SAMPLE_INTERVAL_MS cadence. */
const HISTORY_SIZE = 60;
/** Rolling window for the top-line `fps` / `avgFrameMs` stats. */
const ROLLING_DELTA_CAP = 120;

const emptyFrameStats: FrameStats = {
  sampleCount: 0,
  fps: 0,
  avgFrameMs: 0,
  worstFrameMs: 0,
  slowFrames24: 0,
  slowFrames40: 0,
};

const emptySnapshot: PerfSnapshot = {
  frames: emptyFrameStats,
  history: [],
};

export function usePerformanceMonitor(enabled: boolean): PerfSnapshot {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(emptySnapshot);
  const rollingDeltasRef = useRef<number[]>([]);
  const intervalDeltasRef = useRef<number[]>([]);
  const historyRef = useRef<FpsSample[]>([]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setSnapshot(emptySnapshot);
      return;
    }

    rollingDeltasRef.current = [];
    intervalDeltasRef.current = [];
    historyRef.current = [];

    let rafId = 0;
    let lastTime = performance.now();
    let intervalId = 0;

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      if (delta > 0) {
        rollingDeltasRef.current.push(delta);
        intervalDeltasRef.current.push(delta);
        if (rollingDeltasRef.current.length > ROLLING_DELTA_CAP) {
          rollingDeltasRef.current = rollingDeltasRef.current.slice(-ROLLING_DELTA_CAP);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const updateSnapshot = () => {
      const intervalStats = summarizeFrameDeltas(intervalDeltasRef.current);
      if (intervalStats.sampleCount > 0) {
        historyRef.current.push({
          fps: intervalStats.fps,
          worstFrameMs: intervalStats.worstFrameMs,
        });
        if (historyRef.current.length > HISTORY_SIZE) {
          historyRef.current.shift();
        }
        intervalDeltasRef.current.length = 0;
      }

      setSnapshot({
        frames: summarizeFrameDeltas(rollingDeltasRef.current),
        history: historyRef.current.slice(),
      });
    };

    rafId = window.requestAnimationFrame(tick);
    intervalId = window.setInterval(updateSnapshot, SAMPLE_INTERVAL_MS);
    updateSnapshot();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  return snapshot;
}

export { HISTORY_SIZE as PERF_HISTORY_SIZE };
