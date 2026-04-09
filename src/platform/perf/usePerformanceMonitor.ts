import { useEffect, useRef, useState } from 'react';
import {
  summarizeActiveLayers,
  summarizeFrameDeltas,
  summarizeResourceEntries,
  type FrameStats,
  type LayerCount,
  type RankedResource,
} from './diagnostics';

export interface PerfSnapshot {
  frames: FrameStats;
  recentFrameMs: number[];
  longTaskCount: number;
  longestLongTaskMs: number;
  topResources: RankedResource[];
  activeLayers: LayerCount[];
  activeBackdropCount: number;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
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
  recentFrameMs: [],
  longTaskCount: 0,
  longestLongTaskMs: 0,
  topResources: [],
  activeLayers: [],
  activeBackdropCount: 0,
  viewportWidth: 0,
  viewportHeight: 0,
  dpr: 1,
  hardwareConcurrency: null,
  deviceMemory: null,
};

function readViewportSize() {
  const viewport = window.visualViewport;
  return {
    width: Math.round(viewport?.width ?? window.innerWidth),
    height: Math.round(viewport?.height ?? window.innerHeight),
  };
}

function readActiveLayers() {
  const names = Array.from(document.querySelectorAll<HTMLElement>('[data-perf-layer]'))
    .flatMap((element) => {
      const layerName = element.dataset.perfLayer;
      const active = element.dataset.perfActive;

      if (!layerName || active === 'false') {
        return [];
      }

      return [layerName];
    });

  return summarizeActiveLayers(names);
}

export function usePerformanceMonitor(enabled: boolean): PerfSnapshot {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(emptySnapshot);
  const frameDeltasRef = useRef<number[]>([]);
  const longTasksRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setSnapshot(emptySnapshot);
      return;
    }

    frameDeltasRef.current = [];
    longTasksRef.current = [];

    let rafId = 0;
    let lastTime = performance.now();
    let intervalId = 0;
    let observer: PerformanceObserver | null = null;

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
      const resources = typeof performance.getEntriesByType === 'function'
        ? (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
        : [];
      const viewport = readViewportSize();
      const nav = navigator as Navigator & { deviceMemory?: number };
      const longTasks = longTasksRef.current;

      setSnapshot({
        frames: summarizeFrameDeltas(frameDeltasRef.current),
        recentFrameMs: frameDeltasRef.current.slice(-48).map((delta) => Math.round(delta * 10) / 10),
        longTaskCount: longTasks.length,
        longestLongTaskMs: longTasks.length > 0 ? Math.round(Math.max(...longTasks) * 10) / 10 : 0,
        topResources: summarizeResourceEntries(resources),
        activeLayers: readActiveLayers(),
        activeBackdropCount: document.querySelectorAll('[data-perf-backdrop-active="true"]').length,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        dpr: Math.round((window.devicePixelRatio || 1) * 10) / 10,
        hardwareConcurrency: navigator.hardwareConcurrency ?? null,
        deviceMemory: nav.deviceMemory ?? null,
      });
    };

    rafId = window.requestAnimationFrame(tick);
    intervalId = window.setInterval(updateSnapshot, 750);
    updateSnapshot();

    if ('PerformanceObserver' in window) {
      try {
        observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType !== 'longtask') continue;

            longTasksRef.current.push(entry.duration);
            if (longTasksRef.current.length > 20) {
              longTasksRef.current = longTasksRef.current.slice(-20);
            }
          }
        });
        observer.observe({ entryTypes: ['longtask'] });
      } catch {
        observer = null;
      }
    }

    window.addEventListener('resize', updateSnapshot);
    window.visualViewport?.addEventListener('resize', updateSnapshot);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearInterval(intervalId);
      observer?.disconnect();
      window.removeEventListener('resize', updateSnapshot);
      window.visualViewport?.removeEventListener('resize', updateSnapshot);
    };
  }, [enabled]);

  return snapshot;
}
