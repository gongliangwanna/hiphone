import React, { useEffect, useState } from 'react';
import { Sparkles, Moon } from 'lucide-react';

/**
 * Fullscreen / edge-to-edge demo app.
 *
 * Manifest opts into `edgeToEdge: true` + `statusBarStyle: 'light'`
 * so the app background paints behind the status bar and the time /
 * battery / wifi glyphs render in white over the top.
 */
export default function ImmersiveApp() {
  const [now, setNow] = useState<string>(formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setNow(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className="relative flex h-full w-full flex-col overflow-hidden"
      style={{
        background:
          'linear-gradient(160deg, #1B1247 0%, #4932B8 45%, #B74C96 82%, #F26A9D 100%)',
      }}
    >
      {/* Soft blurred glow behind the content — purely decorative */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 260,
          height: 260,
          borderRadius: '50%',
          top: 30,
          left: -60,
          background:
            'radial-gradient(circle, rgba(255,222,133,0.45) 0%, rgba(255,222,133,0) 70%)',
          filter: 'blur(2px)',
        }}
      />

      {/* Top hint zone — deliberately placed under the status bar to
          prove content IS rendering behind the system clock/battery */}
      <div
        className="flex items-center gap-1.5"
        style={{
          paddingTop: 10,
          paddingLeft: 16,
          color: 'rgba(255,255,255,0.85)',
          fontSize: 11,
          letterSpacing: '0.04em',
        }}
      >
        <Sparkles size={12} strokeWidth={2} color="rgba(255,255,255,0.85)" />
        <span>INLINE 内容位于状态栏背后 ↑</span>
      </div>

      {/* Hero block */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <Moon size={44} strokeWidth={1.3} color="#FFDE85" />
        <div
          className="mt-3 font-bold tracking-tight"
          style={{
            fontSize: 40,
            color: '#fff',
            letterSpacing: '-0.02em',
            textShadow: '0 2px 16px rgba(0,0,0,0.35)',
          }}
        >
          {now}
        </div>
        <div
          className="mt-2"
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.02em',
          }}
        >
          沉浸模式 · edge-to-edge
        </div>
      </div>

      {/* Bottom chip cluster demonstrating the extended canvas */}
      <div
        className="flex justify-center gap-2"
        style={{
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 22px)',
        }}
      >
        {['manifest.edgeToEdge', 'statusBarStyle: light'].map((label) => (
          <div
            key={label}
            style={{
              fontSize: 11,
              padding: '6px 10px',
              borderRadius: 999,
              color: 'rgba(255,255,255,0.9)',
              backgroundColor: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(d: Date): string {
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}
