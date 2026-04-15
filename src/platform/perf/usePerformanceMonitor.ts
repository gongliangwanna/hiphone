import { useEffect, useRef, useState } from 'react';
import { summarizeFrameDeltas, type FrameStats } from './diagnostics';

export interface PerfSnapshot {
  frames: FrameStats;
}

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
};

export function usePerformanceMonitor(enabled: boolean): PerfSnapshot {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(emptySnapshot);
  const frameDeltasRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setSnapshot(emptySnapshot);
      return;
    }

    frameDeltasRef.current = [];

    let rafId = 0;
    let lastTime = performance.now();
    let intervalId = 0;

    const tick = (now: number) => {
      const delta = now - lastTime;
      lastTime = now;

      if (delta > 0) {
        frameDeltasRef.current.push(delta);
        if (frameDeltasRef.current.length > 120) {
          frameDeltasRef.current = frameDeltasRef.current.slice(-120);
        }
      }

      rafId = window.requestAnimationFrame(tick);
    };

    const updateSnapshot = () => {
      setSnapshot({
        frames: summarizeFrameDeltas(frameDeltasRef.current),
      });
    };

    rafId = window.requestAnimationFrame(tick);
    intervalId = window.setInterval(updateSnapshot, 750);
    updateSnapshot();

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
    };
  }, [enabled]);

  return snapshot;
}
