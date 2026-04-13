import { useEffect, useState, useMemo } from 'react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { useIsPageActive } from './activePage';

interface ClockWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
  styleIndex?: number;
}

interface CityClock {
  label: string;
  timeZone: string;
}

const BEIJING: CityClock = { label: '北京', timeZone: 'Asia/Shanghai' };
const NEW_YORK: CityClock = { label: '纽约', timeZone: 'America/New_York' };
const LONDON: CityClock = { label: '伦敦', timeZone: 'Europe/London' };
const TOKYO: CityClock = { label: '东京', timeZone: 'Asia/Tokyo' };

const QUAD_CITIES: CityClock[] = [BEIJING, NEW_YORK, LONDON, TOKYO];
const DUAL_CITIES: CityClock[] = [BEIJING, NEW_YORK];

// ---------------------------------------------------------------------------
// Three unified color themes — shared across all sizes
// ---------------------------------------------------------------------------

interface ClockPalette {
  bg: string;
  face: string;
  faceBorder: string;
  tick: string;
  dot: string;
  hourHand: string;
  minuteHand: string;
  secondHand: string;
  number: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  glow: string;
  /** True for light backgrounds where text needs to be dark. */
  isLight: boolean;
}

/** Theme 0 — Dark: deep navy, clean white face, iOS red second hand. */
const PALETTE_DARK: ClockPalette = {
  bg: 'linear-gradient(160deg, #141420 0%, #1a1a2e 100%)',
  face: '#f0f0f5', faceBorder: 'rgba(0,0,0,0.06)',
  tick: '#444', dot: 'rgba(0,0,0,0.1)',
  hourHand: '#1c1c1e', minuteHand: '#2c2c2e', secondHand: '#ff3b30',
  number: '#444',
  textPrimary: 'rgba(255,255,255,0.92)', textSecondary: 'rgba(255,255,255,0.5)',
  accent: 'rgba(255,255,255,0.3)', glow: '',
  isLight: false,
};

/** Theme 1 — Ivory: warm cream, brown hands, rose-gold second hand. */
const PALETTE_IVORY: ClockPalette = {
  bg: 'linear-gradient(165deg, #faf7f2 0%, #f0ebe3 100%)',
  face: '#fffdf8', faceBorder: 'rgba(60,50,37,0.1)',
  tick: '#6b5d4f', dot: 'rgba(60,50,37,0.15)',
  hourHand: '#2c2218', minuteHand: '#3c3225', secondHand: '#c0795a',
  number: '#3c3225',
  textPrimary: '#2c2820', textSecondary: '#8a8078',
  accent: '#c0795a', glow: '',
  isLight: true,
};

/** Theme 2 — Slate: deep blue-gray, cool-toned face, sky-blue second hand. */
const PALETTE_SLATE: ClockPalette = {
  bg: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)',
  face: '#e8ecf4', faceBorder: 'rgba(0,0,0,0.08)',
  tick: '#475569', dot: 'rgba(71,85,105,0.25)',
  hourHand: '#1e293b', minuteHand: '#334155', secondHand: '#60a5fa',
  number: '#475569',
  textPrimary: 'rgba(255,255,255,0.95)', textSecondary: '#94a3b8',
  accent: '#60a5fa', glow: 'rgba(96,165,250,0.12)',
  isLight: false,
};

function getPalette(size: WidgetSize, styleIndex: number): ClockPalette {
  if (size === '2x2') {
    return [PALETTE_IVORY, PALETTE_DARK, PALETTE_SLATE][styleIndex] ?? PALETTE_IVORY;
  }
  return [PALETTE_DARK, PALETTE_IVORY, PALETTE_SLATE][styleIndex] ?? PALETTE_DARK;
}

/** Semi-transparent badge background — adapts to light/dark. */
function badgeBg(p: ClockPalette): string {
  return p.isLight ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

export function ClockWidget({
  size,
  variant,
  previewWidth,
  styleIndex = 0,
}: ClockWidgetProps) {
  const now = useLiveTime();
  const palette = getPalette(size, styleIndex);

  return (
    <WidgetShell
      size={size}
      variant={variant}
      previewWidth={previewWidth}
      testId="widget-clock"
    >
      <div
        className="h-full w-full"
        style={{
          padding: size === '2x2' ? 12 : size === '4x4' ? 10 : 16,
          background: palette.bg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {renderStyle(size, styleIndex, now, palette)}
      </div>
    </WidgetShell>
  );
}

function renderStyle(size: WidgetSize, styleIndex: number, now: Date, p: ClockPalette) {
  if (size === '2x2') {
    switch (styleIndex) {
      case 0: return <AnalogSmall city={BEIJING} now={now} palette={p} />;
      case 1: return <DigitalSmall city={BEIJING} now={now} palette={p} />;
      case 2: return <MinimalSmall city={BEIJING} now={now} palette={p} />;
    }
  }
  if (size === '4x2') {
    switch (styleIndex) {
      case 0: return <DigitalHeroLayout city={BEIJING} now={now} palette={p} />;
      case 1: return <DualCityLayout cities={DUAL_CITIES} now={now} palette={p} />;
      case 2: return <ClassicAnalogMedium city={BEIJING} now={now} palette={p} />;
    }
  }
  if (size === '4x4') {
    switch (styleIndex) {
      case 0: return <QuadClockLayout cities={QUAD_CITIES} now={now} palette={p} />;
      case 1: return <ClassicWatchLayout city={BEIJING} now={now} palette={p} />;
      case 2: return <DigitalFullLayout city={BEIJING} now={now} palette={p} />;
    }
  }
  return null;
}

// ===========================================================================
// 2x2 layouts
// ===========================================================================

/** Style 0 — Premium watch face on ivory. */
function AnalogSmall({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const dateLabel = useDateLabel(now, city.timeZone);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <SmallWatchFace parts={parts} diameter={112} />
      <div className="mt-1 flex items-center" style={{ gap: 5 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: palette.textPrimary, letterSpacing: '0.02em' }}>
          {city.label}
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color: palette.textSecondary }}>
          {dateLabel.monthDay}
        </span>
      </div>
    </div>
  );
}

/** Style 1 — Digital time on dark background. */
function DigitalSmall({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const dateLabel = useDateLabel(now, city.timeZone);
  const hh = parts.hours.toString().padStart(2, '0');
  const mm = parts.minutes.toString().padStart(2, '0');
  const ss = parts.seconds.toString().padStart(2, '0');
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex items-baseline" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 48, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.02em', color: palette.textPrimary }}>{hh}</span>
        <span style={{ fontSize: 48, fontWeight: 100, lineHeight: 1, color: 'rgba(255,255,255,0.2)', margin: '0 1px' }}>:</span>
        <span style={{ fontSize: 48, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.02em', color: palette.textPrimary }}>{mm}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 300, color: 'rgba(255,255,255,0.28)', fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 2 }}>{ss}</div>
      <div className="mt-2" style={{ fontSize: 10, fontWeight: 500, color: palette.textSecondary, letterSpacing: '0.02em' }}>
        {dateLabel.weekday} {dateLabel.monthDay}
      </div>
    </div>
  );
}

/** Style 2 — Minimal on slate. Single-line time, accent colon. */
function MinimalSmall({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const hh = parts.hours.toString().padStart(2, '0');
  const mm = parts.minutes.toString().padStart(2, '0');
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div className="flex items-center" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span style={{
          fontSize: 50, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.02em',
          color: palette.textPrimary, textShadow: palette.glow ? `0 0 24px ${palette.glow}` : 'none',
        }}>{hh}</span>
        <span style={{ fontSize: 50, fontWeight: 100, lineHeight: 1, color: palette.accent, margin: '0 2px', opacity: 0.6 }}>:</span>
        <span style={{
          fontSize: 50, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.02em',
          color: palette.textPrimary, textShadow: palette.glow ? `0 0 24px ${palette.glow}` : 'none',
        }}>{mm}</span>
      </div>
      <div className="mt-2.5 flex items-center" style={{ gap: 0 }}>
        <div style={{ width: 16, height: 1, background: `linear-gradient(90deg, transparent, ${palette.accent}55)`, borderRadius: 0.5 }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: palette.textSecondary, letterSpacing: '0.1em', padding: '0 6px' }}>
          {city.label}
        </span>
        <div style={{ width: 16, height: 1, background: `linear-gradient(90deg, ${palette.accent}55, transparent)`, borderRadius: 0.5 }} />
      </div>
    </div>
  );
}

// ===========================================================================
// 4x2 layouts
// ===========================================================================

/** Style 0 — Digital hero + small analog accent. */
function DigitalHeroLayout({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const dateLabel = useDateLabel(now, city.timeZone);
  const hh = parts.hours.toString().padStart(2, '0');
  const mm = parts.minutes.toString().padStart(2, '0');
  return (
    <div className="flex h-full w-full items-center" style={{ gap: 14 }}>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div style={{ padding: '2px 8px', borderRadius: 8, backgroundColor: badgeBg(palette), display: 'inline-flex', alignSelf: 'flex-start', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: palette.textPrimary, letterSpacing: '0.08em' }}>{city.label}</span>
        </div>
        <div className="flex items-baseline">
          <span style={{ fontSize: 52, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: palette.textPrimary }}>{hh}</span>
          <span style={{ fontSize: 52, fontWeight: 200, lineHeight: 1, color: palette.accent, margin: '0 1px' }}>:</span>
          <span style={{ fontSize: 52, fontWeight: 300, lineHeight: 1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: palette.textPrimary }}>{mm}</span>
        </div>
        <div className="mt-1.5 flex items-center" style={{ gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: palette.textSecondary }}>{dateLabel.weekday}</span>
          <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: palette.accent }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: palette.textSecondary }}>{dateLabel.monthDay}</span>
        </div>
      </div>
      <div className="flex flex-shrink-0 items-center">
        <AnalogClock parts={parts} diameter={80} palette={palette} />
      </div>
    </div>
  );
}

/** Style 1 — Dual city clocks side by side. */
function DualCityLayout({ cities, now, palette }: { cities: CityClock[]; now: Date; palette: ClockPalette }) {
  return (
    <div className="flex h-full w-full items-center justify-around">
      {cities.map((city) => (
        <DualCityFace key={city.timeZone} city={city} now={now} palette={palette} />
      ))}
    </div>
  );
}

function DualCityFace({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const hhmm = `${parts.hours.toString().padStart(2, '0')}:${parts.minutes.toString().padStart(2, '0')}`;
  return (
    <div className="flex flex-col items-center">
      <AnalogClock parts={parts} diameter={84} palette={palette} />
      <div className="mt-1.5 flex items-baseline" style={{ gap: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: palette.textPrimary }}>{city.label}</span>
        <span style={{ fontSize: 10, fontWeight: 500, color: palette.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{hhmm}</span>
      </div>
    </div>
  );
}

/** Style 2 — Large analog clock with date info. */
function ClassicAnalogMedium({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const dateLabel = useDateLabel(now, city.timeZone);
  return (
    <div className="flex h-full w-full items-center" style={{ gap: 18 }}>
      <div className="flex flex-shrink-0 items-center">
        <AnalogClock parts={parts} diameter={100} palette={palette} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div style={{ fontSize: 15, fontWeight: 700, color: palette.textPrimary, letterSpacing: '0.02em' }}>{city.label}</div>
        <div className="mt-1" style={{ fontSize: 12, fontWeight: 500, color: palette.textSecondary }}>{dateLabel.weekday}</div>
        <div className="mt-0.5" style={{ fontSize: 12, fontWeight: 500, color: palette.textSecondary }}>{dateLabel.monthDay}</div>
      </div>
    </div>
  );
}

// ===========================================================================
// 4x4 layouts
// ===========================================================================

/** Style 0 — World Clock: 4 clocks in cards. */
function QuadClockLayout({ cities, now, palette }: { cities: CityClock[]; now: Date; palette: ClockPalette }) {
  return (
    <div
      className="grid h-full w-full"
      style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 6 }}
    >
      {cities.map((city) => (
        <WorldCityCard key={city.timeZone} city={city} now={now} palette={palette} />
      ))}
    </div>
  );
}

function WorldCityCard({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const hhmm = `${parts.hours.toString().padStart(2, '0')}:${parts.minutes.toString().padStart(2, '0')}`;
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '6px 0 4px' }}
    >
      <AnalogClock parts={parts} diameter={100} palette={palette} />
      <div className="mt-1.5 flex flex-col items-center" style={{ gap: 1 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: palette.textPrimary, letterSpacing: '0.02em' }}>{city.label}</span>
        <span style={{ fontSize: 10, fontWeight: 500, color: palette.textSecondary, fontVariantNumeric: 'tabular-nums' }}>{hhmm}</span>
      </div>
    </div>
  );
}

/** Style 1 — Premium watch face on ivory. */
function ClassicWatchLayout({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const dateLabel = useDateLabel(now, city.timeZone);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center" style={{ gap: 14 }}>
      <WatchFace parts={parts} diameter={240} dayOfMonth={now.getDate()} />
      <div className="flex flex-col items-center" style={{ gap: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color: palette.textPrimary, letterSpacing: '0.02em' }}>{city.label}</span>
        <span style={{ fontSize: 13, fontWeight: 500, color: palette.textSecondary, letterSpacing: '0.02em' }}>{dateLabel.weekday} {dateLabel.monthDay}</span>
      </div>
    </div>
  );
}

/** Style 2 — Digital Full on slate. */
function DigitalFullLayout({ city, now, palette }: { city: CityClock; now: Date; palette: ClockPalette }) {
  const parts = useTimeParts(now, city.timeZone);
  const dateLabel = useDateLabel(now, city.timeZone);
  const hh = parts.hours.toString().padStart(2, '0');
  const mm = parts.minutes.toString().padStart(2, '0');
  const ss = parts.seconds.toString().padStart(2, '0');
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <div style={{ padding: '3px 12px', borderRadius: 10, backgroundColor: badgeBg(palette), marginBottom: 16 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: palette.textSecondary, letterSpacing: '0.12em' }}>{city.label}</span>
      </div>
      <div className="flex items-baseline" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 88, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.03em', color: palette.textPrimary, textShadow: palette.glow ? `0 0 40px ${palette.glow}` : 'none' }}>{hh}</span>
        <span style={{ fontSize: 88, fontWeight: 100, lineHeight: 1, color: 'rgba(255,255,255,0.2)', margin: '0 2px' }}>:</span>
        <span style={{ fontSize: 88, fontWeight: 200, lineHeight: 1, letterSpacing: '-0.03em', color: palette.textPrimary, textShadow: palette.glow ? `0 0 40px ${palette.glow}` : 'none' }}>{mm}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 300, color: palette.accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1, marginTop: 2 }}>{ss}</div>
      <div style={{ width: 40, height: 1, marginTop: 20, background: `linear-gradient(90deg, transparent, ${palette.accent}66, transparent)`, borderRadius: 0.5 }} />
      <div className="mt-3 flex items-center" style={{ gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 500, color: palette.textSecondary }}>{dateLabel.weekday}</span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', backgroundColor: `${palette.accent}66` }} />
        <span style={{ fontSize: 15, fontWeight: 500, color: palette.textSecondary }}>{dateLabel.monthDay}</span>
      </div>
    </div>
  );
}

// ===========================================================================
// SVG clock faces
// ===========================================================================

interface TimeParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Analog clock — adapts to palette for face, hands, and tick colors. */
function AnalogClock({ parts, diameter, palette }: { parts: TimeParts; diameter: number; palette: ClockPalette }) {
  const VB = 100;
  const C = VB / 2;
  const faceR = 45;

  const hourAngle = ((parts.hours % 12) + parts.minutes / 60) * 30;
  const minuteAngle = (parts.minutes + parts.seconds / 60) * 6;
  const secondAngle = parts.seconds * 6;

  const uid = useMemo(() => `clk-${Math.random().toString(36).slice(2, 8)}`, []);

  const markers = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = i * 30;
      const rad = (angle - 90) * (Math.PI / 180);
      const isQuarter = i % 3 === 0;
      const r = 42;
      return { angle, x: C + Math.cos(rad) * r, y: C + Math.sin(rad) * r, isQuarter };
    });
  }, []);

  return (
    <svg width={diameter} height={diameter} viewBox={`0 0 ${VB} ${VB}`} style={{ display: 'block' }}>
      <defs>
        <filter id={`${uid}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
          <feOffset dx="0" dy="0.8" result="shadow" />
          <feFlood floodColor={palette.hourHand} floodOpacity="0.2" />
          <feComposite in2="shadow" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={C} cy={C} r={faceR + 2} fill="none" stroke={palette.faceBorder} strokeWidth={1.5} />
      <circle cx={C} cy={C} r={faceR} fill={palette.face} />
      <circle cx={C} cy={C} r={faceR} fill="none" stroke={palette.faceBorder} strokeWidth={0.5} />

      {markers.map(({ angle, x, y, isQuarter }) =>
        isQuarter ? (
          <g key={angle}>
            {(() => {
              const rad = (angle - 90) * (Math.PI / 180);
              return (
                <line
                  x1={C + Math.cos(rad) * 38} y1={C + Math.sin(rad) * 38}
                  x2={C + Math.cos(rad) * 43} y2={C + Math.sin(rad) * 43}
                  stroke={palette.tick} strokeWidth={2} strokeLinecap="round"
                />
              );
            })()}
          </g>
        ) : (
          <circle key={angle} cx={x} cy={y} r={1.3} fill={palette.dot} />
        ),
      )}

      <g filter={`url(#${uid}-glow)`} transform={`rotate(${hourAngle} ${C} ${C})`}>
        <line x1={C} y1={C + 4} x2={C} y2={C - 22} stroke={palette.hourHand} strokeWidth={3.5} strokeLinecap="round" />
      </g>
      <g filter={`url(#${uid}-glow)`} transform={`rotate(${minuteAngle} ${C} ${C})`}>
        <line x1={C} y1={C + 5} x2={C} y2={C - 34} stroke={palette.minuteHand} strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <g transform={`rotate(${secondAngle} ${C} ${C})`}>
        <line x1={C} y1={C + 8} x2={C} y2={C - 38} stroke={palette.secondHand} strokeWidth={1} strokeLinecap="round" />
        <circle cx={C} cy={C + 5.5} r={1.8} fill={palette.secondHand} />
      </g>

      <circle cx={C} cy={C} r={3} fill={palette.minuteHand} />
      <circle cx={C} cy={C} r={1.5} fill={palette.face} />
      <circle cx={C} cy={C} r={0.8} fill={palette.secondHand} />
    </svg>
  );
}

/** Premium watch face — used by 4x4 style 1. */
function WatchFace({ parts, diameter, dayOfMonth }: { parts: TimeParts; diameter: number; dayOfMonth: number }) {
  const VB = 200;
  const C = 100;
  const faceR = 88;

  const hourAngle = ((parts.hours % 12) + parts.minutes / 60) * 30;
  const minuteAngle = (parts.minutes + parts.seconds / 60) * 6;
  const secondAngle = parts.seconds * 6;

  const uid = useMemo(() => `wf-${Math.random().toString(36).slice(2, 8)}`, []);

  const numbers = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      const angle = n * 30;
      const rad = (angle - 90) * (Math.PI / 180);
      const r = 72;
      return { n, x: C + Math.cos(rad) * r, y: C + Math.sin(rad) * r };
    });
  }, []);

  const hourBars = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = i * 30;
      const rad = (angle - 90) * (Math.PI / 180);
      return {
        x1: C + Math.cos(rad) * 80, y1: C + Math.sin(rad) * 80,
        x2: C + Math.cos(rad) * 86, y2: C + Math.sin(rad) * 86,
      };
    });
  }, []);

  const minuteDots = useMemo(() => {
    const dots: { x: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue;
      const angle = i * 6;
      const rad = (angle - 90) * (Math.PI / 180);
      const r = 83;
      dots.push({ x: C + Math.cos(rad) * r, y: C + Math.sin(rad) * r });
    }
    return dots;
  }, []);

  return (
    <svg width={diameter} height={diameter} viewBox={`0 0 ${VB} ${VB}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${uid}-face`} cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#fffef8" />
          <stop offset="100%" stopColor="#f5f0e6" />
        </radialGradient>
        <filter id={`${uid}-hand`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dx="0.4" dy="0.8" result="shadow" />
          <feFlood floodColor="#000" floodOpacity="0.18" />
          <feComposite in2="shadow" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <circle cx={C} cy={C} r={faceR + 3} fill="none" stroke="#c8b89c" strokeWidth={2} />
      <circle cx={C} cy={C} r={faceR + 1} fill="none" stroke="#b8a888" strokeWidth={0.5} />
      <circle cx={C} cy={C} r={faceR} fill={`url(#${uid}-face)`} />
      <circle cx={C} cy={C} r={85.5} fill="none" stroke="rgba(60,50,37,0.06)" strokeWidth={0.3} />

      {minuteDots.map(({ x, y }, i) => (
        <circle key={i} cx={x} cy={y} r={0.7} fill="rgba(60,50,37,0.18)" />
      ))}
      {hourBars.map(({ x1, y1, x2, y2 }, i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#3c3225" strokeWidth={2} strokeLinecap="round" />
      ))}
      {numbers.map(({ n, x, y }) => (
        <text
          key={n} x={x} y={y} textAnchor="middle" dominantBaseline="central"
          style={{ fontSize: 13, fontWeight: 600, fill: '#3c3225', fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif' }}
        >{n}</text>
      ))}

      <rect x={128} y={95} width={16} height={11} rx={2} fill="#fff" stroke="rgba(60,50,37,0.15)" strokeWidth={0.5} />
      <text x={136} y={101} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 7.5, fontWeight: 700, fill: '#2c2218', fontFamily: '-apple-system, "SF Pro Display", sans-serif' }}>{dayOfMonth}</text>

      <g filter={`url(#${uid}-hand)`} transform={`rotate(${hourAngle} ${C} ${C})`}>
        <polygon points={`${C - 3.2},${C + 6} ${C + 3.2},${C + 6} ${C + 1.2},${C - 42} ${C - 1.2},${C - 42}`} fill="#2c2218" stroke="#2c2218" strokeWidth={0.3} strokeLinejoin="round" />
      </g>
      <g filter={`url(#${uid}-hand)`} transform={`rotate(${minuteAngle} ${C} ${C})`}>
        <polygon points={`${C - 2.4},${C + 8} ${C + 2.4},${C + 8} ${C + 0.8},${C - 64} ${C - 0.8},${C - 64}`} fill="#2c2218" stroke="#2c2218" strokeWidth={0.3} strokeLinejoin="round" />
      </g>
      <g transform={`rotate(${secondAngle} ${C} ${C})`}>
        <line x1={C} y1={C + 18} x2={C} y2={C - 72} stroke="#c0795a" strokeWidth={0.8} strokeLinecap="round" />
        <circle cx={C} cy={C + 14} r={2.5} fill="#c0795a" />
      </g>

      <circle cx={C} cy={C} r={4.5} fill="#3c3225" />
      <circle cx={C} cy={C} r={2.8} fill="#c8b89c" />
      <circle cx={C} cy={C} r={1.2} fill="#c0795a" />
    </svg>
  );
}

/** Compact watch face for 2x2 — numbers at 12/3/6/9, dots for other hours. */
function SmallWatchFace({ parts, diameter }: { parts: TimeParts; diameter: number }) {
  const VB = 100;
  const C = 50;
  const faceR = 44;

  const hourAngle = ((parts.hours % 12) + parts.minutes / 60) * 30;
  const minuteAngle = (parts.minutes + parts.seconds / 60) * 6;
  const secondAngle = parts.seconds * 6;

  const uid = useMemo(() => `swf-${Math.random().toString(36).slice(2, 8)}`, []);

  const markers = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const n = i === 0 ? 12 : i;
      const angle = i * 30;
      const rad = (angle - 90) * (Math.PI / 180);
      const isQuarter = i % 3 === 0;
      return { n, angle, rad, isQuarter };
    });
  }, []);

  return (
    <svg width={diameter} height={diameter} viewBox={`0 0 ${VB} ${VB}`} style={{ display: 'block' }}>
      <defs>
        <radialGradient id={`${uid}-face`} cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#fffef8" />
          <stop offset="100%" stopColor="#f5f0e6" />
        </radialGradient>
        <filter id={`${uid}-hand`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" />
          <feOffset dx="0.3" dy="0.5" result="shadow" />
          <feFlood floodColor="#000" floodOpacity="0.15" />
          <feComposite in2="shadow" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Bezel */}
      <circle cx={C} cy={C} r={faceR + 2} fill="none" stroke="#c8b89c" strokeWidth={1.5} />
      <circle cx={C} cy={C} r={faceR + 0.5} fill="none" stroke="#b8a888" strokeWidth={0.3} />
      {/* Face */}
      <circle cx={C} cy={C} r={faceR} fill={`url(#${uid}-face)`} />
      <circle cx={C} cy={C} r={42.5} fill="none" stroke="rgba(60,50,37,0.05)" strokeWidth={0.3} />

      {/* Hour markers: numbers at 12/3/6/9, dots for the rest */}
      {markers.map(({ n, angle, rad, isQuarter }) => {
        if (isQuarter) {
          const r = 36;
          return (
            <text
              key={angle}
              x={C + Math.cos(rad) * r}
              y={C + Math.sin(rad) * r}
              textAnchor="middle"
              dominantBaseline="central"
              style={{ fontSize: 8, fontWeight: 700, fill: '#3c3225', fontFamily: '-apple-system, "SF Pro Display", "Helvetica Neue", sans-serif' }}
            >{n}</text>
          );
        }
        const dotR = 41;
        return <circle key={angle} cx={C + Math.cos(rad) * dotR} cy={C + Math.sin(rad) * dotR} r={1} fill="rgba(60,50,37,0.22)" />;
      })}

      {/* Hour bars at quarter positions */}
      {[0, 90, 180, 270].map((angle) => {
        const rad = (angle - 90) * (Math.PI / 180);
        return (
          <line
            key={angle}
            x1={C + Math.cos(rad) * 40} y1={C + Math.sin(rad) * 40}
            x2={C + Math.cos(rad) * 43} y2={C + Math.sin(rad) * 43}
            stroke="#3c3225" strokeWidth={1.2} strokeLinecap="round"
          />
        );
      })}

      {/* Hour hand — tapered polygon */}
      <g filter={`url(#${uid}-hand)`} transform={`rotate(${hourAngle} ${C} ${C})`}>
        <polygon
          points={`${C - 2},${C + 3} ${C + 2},${C + 3} ${C + 0.8},${C - 18} ${C - 0.8},${C - 18}`}
          fill="#2c2218" stroke="#2c2218" strokeWidth={0.2} strokeLinejoin="round"
        />
      </g>
      {/* Minute hand — tapered polygon */}
      <g filter={`url(#${uid}-hand)`} transform={`rotate(${minuteAngle} ${C} ${C})`}>
        <polygon
          points={`${C - 1.5},${C + 4} ${C + 1.5},${C + 4} ${C + 0.5},${C - 30} ${C - 0.5},${C - 30}`}
          fill="#2c2218" stroke="#2c2218" strokeWidth={0.2} strokeLinejoin="round"
        />
      </g>
      {/* Second hand — rose gold with counterweight */}
      <g transform={`rotate(${secondAngle} ${C} ${C})`}>
        <line x1={C} y1={C + 8} x2={C} y2={C - 34} stroke="#c0795a" strokeWidth={0.6} strokeLinecap="round" />
        <circle cx={C} cy={C + 6} r={1.5} fill="#c0795a" />
      </g>

      {/* Center cap — three layers */}
      <circle cx={C} cy={C} r={3} fill="#3c3225" />
      <circle cx={C} cy={C} r={1.8} fill="#c8b89c" />
      <circle cx={C} cy={C} r={0.8} fill="#c0795a" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function useLiveTime(): Date {
  const isActive = useIsPageActive();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);
  return now;
}

function useTimeParts(now: Date, timeZone: string): TimeParts {
  return useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
      const parts = fmt.formatToParts(now);
      const get = (type: string): number => {
        const p = parts.find((p) => p.type === type);
        return p ? parseInt(p.value, 10) : 0;
      };
      return { hours: get('hour'), minutes: get('minute'), seconds: get('second') };
    } catch {
      return { hours: now.getHours(), minutes: now.getMinutes(), seconds: now.getSeconds() };
    }
  }, [now, timeZone]);
}

const ZH_WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

interface DateLabel {
  weekday: string;
  monthDay: string;
}

function useDateLabel(now: Date, timeZone: string): DateLabel {
  return useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone, weekday: 'short', month: 'numeric', day: 'numeric', year: 'numeric',
      });
      const parts = fmt.formatToParts(now);
      const month = parts.find((p) => p.type === 'month')?.value ?? '';
      const day = parts.find((p) => p.type === 'day')?.value ?? '';
      const year = parts.find((p) => p.type === 'year')?.value ?? '';
      const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`;
      const weekdayIdx = new Date(iso).getDay();
      return { weekday: ZH_WEEKDAYS[weekdayIdx] ?? '—', monthDay: `${month}月${day}日` };
    } catch {
      return { weekday: ZH_WEEKDAYS[now.getDay()] ?? '—', monthDay: `${now.getMonth() + 1}月${now.getDate()}日` };
    }
  }, [now, timeZone]);
}
