import { useEffect, useState, useMemo } from 'react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { useIsPageActive } from './activePage';

interface ClockWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
}

interface CityClock {
  label: string;
  timeZone: string;
}

const BEIJING: CityClock = { label: '北京', timeZone: 'Asia/Shanghai' };
const NEW_YORK: CityClock = { label: '纽约', timeZone: 'America/New_York' };
const LONDON: CityClock = { label: '伦敦', timeZone: 'Europe/London' };
const TOKYO: CityClock = { label: '东京', timeZone: 'Asia/Tokyo' };

export function ClockWidget({ size, variant, previewWidth }: ClockWidgetProps) {
  const now = useLiveTime();

  const cities: CityClock[] =
    size === '2x2' ? [BEIJING] :
    size === '4x2' ? [BEIJING, NEW_YORK] :
                     [BEIJING, NEW_YORK, LONDON, TOKYO];

  return (
    <WidgetShell size={size} variant={variant} previewWidth={previewWidth} testId="widget-clock">
      <div
        className="flex h-full w-full"
        style={{
          padding: size === '2x2' ? 14 : 16,
          background: 'linear-gradient(160deg, #1d1d27 0%, #0a0a14 100%)',
        }}
      >
        {size === '2x2' && (
          <SingleClockLayout city={cities[0]!} now={now} />
        )}
        {size === '4x2' && (
          <DualClockLayout cities={cities} now={now} />
        )}
        {size === '4x4' && (
          <QuadClockLayout cities={cities} now={now} />
        )}
      </div>
    </WidgetShell>
  );
}

// ---- Layouts ---------------------------------------------------------------

function SingleClockLayout({ city, now }: { city: CityClock; now: Date }) {
  const parts = useTimeParts(now, city.timeZone);
  return (
    <div className="flex h-full w-full flex-col items-center justify-center">
      <AnalogClock parts={parts} diameter={108} />
      <div
        className="mt-2"
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.78)',
          letterSpacing: '0.04em',
        }}
      >
        {city.label}
      </div>
    </div>
  );
}

function DualClockLayout({ cities, now }: { cities: CityClock[]; now: Date }) {
  return (
    <div className="flex h-full w-full items-center justify-around">
      {cities.map((city) => (
        <CityFace key={city.timeZone} city={city} now={now} diameter={104} />
      ))}
    </div>
  );
}

function QuadClockLayout({ cities, now }: { cities: CityClock[]; now: Date }) {
  return (
    <div
      className="grid h-full w-full"
      style={{
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 8,
      }}
    >
      {cities.map((city) => (
        <CityFace key={city.timeZone} city={city} now={now} diameter={92} />
      ))}
    </div>
  );
}

function CityFace({
  city,
  now,
  diameter,
}: {
  city: CityClock;
  now: Date;
  diameter: number;
}) {
  const parts = useTimeParts(now, city.timeZone);
  return (
    <div className="flex flex-col items-center justify-center">
      <AnalogClock parts={parts} diameter={diameter} />
      <div
        className="mt-1.5"
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.78)',
          letterSpacing: '0.04em',
        }}
      >
        {city.label}
      </div>
    </div>
  );
}

// ---- SVG analog clock face ------------------------------------------------

interface TimeParts {
  hours: number; // 0-23
  minutes: number;
  seconds: number;
}

function AnalogClock({ parts, diameter }: { parts: TimeParts; diameter: number }) {
  // We render at a fixed viewBox so the strokes scale crisply to any size.
  const VB = 100;
  const C = VB / 2;
  const r = 47;

  const hourAngle = ((parts.hours % 12) + parts.minutes / 60) * 30;
  const minuteAngle = (parts.minutes + parts.seconds / 60) * 6;
  const secondAngle = parts.seconds * 6;

  // 12 hour ticks. Long for 12/3/6/9, short otherwise.
  const ticks = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const angle = i * 30;
      const isMajor = i % 3 === 0;
      const inner = isMajor ? 38 : 41;
      const outer = 45;
      return { angle, inner, outer, isMajor };
    });
  }, []);

  return (
    <svg
      width={diameter}
      height={diameter}
      viewBox={`0 0 ${VB} ${VB}`}
      style={{ display: 'block' }}
    >
      {/* Face */}
      <circle cx={C} cy={C} r={r} fill="#fafafa" />
      <circle
        cx={C}
        cy={C}
        r={r}
        fill="none"
        stroke="rgba(0,0,0,0.08)"
        strokeWidth={0.6}
      />

      {/* Ticks */}
      <g
        stroke="#1c1c1e"
        strokeLinecap="round"
      >
        {ticks.map(({ angle, inner, outer, isMajor }) => {
          const rad = (angle - 90) * (Math.PI / 180);
          const x1 = C + Math.cos(rad) * inner;
          const y1 = C + Math.sin(rad) * inner;
          const x2 = C + Math.cos(rad) * outer;
          const y2 = C + Math.sin(rad) * outer;
          return (
            <line
              key={angle}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              strokeWidth={isMajor ? 1.6 : 0.8}
            />
          );
        })}
      </g>

      {/* Hour hand */}
      <line
        x1={C}
        y1={C + 4}
        x2={C}
        y2={C - 24}
        stroke="#1c1c1e"
        strokeWidth={3}
        strokeLinecap="round"
        transform={`rotate(${hourAngle} ${C} ${C})`}
      />

      {/* Minute hand */}
      <line
        x1={C}
        y1={C + 6}
        x2={C}
        y2={C - 36}
        stroke="#1c1c1e"
        strokeWidth={2}
        strokeLinecap="round"
        transform={`rotate(${minuteAngle} ${C} ${C})`}
      />

      {/* Second hand (red — iconic Apple Clock) */}
      <line
        x1={C}
        y1={C + 8}
        x2={C}
        y2={C - 40}
        stroke="#ff3b30"
        strokeWidth={1.2}
        strokeLinecap="round"
        transform={`rotate(${secondAngle} ${C} ${C})`}
      />

      {/* Center pin */}
      <circle cx={C} cy={C} r={1.6} fill="#1c1c1e" />
      <circle cx={C} cy={C} r={0.8} fill="#ff3b30" />
    </svg>
  );
}

// ---- Helpers --------------------------------------------------------------

/**
 * Re-renders every second so the second hand sweeps. Pauses entirely on
 * offscreen pages — see ActivePageContext for the rationale. When the page
 * becomes active again, the effect re-runs and we immediately call
 * `setNow(new Date())` so the clock snaps to the correct time within one
 * paint, no visible "frozen" frame.
 */
function useLiveTime(): Date {
  const isActive = useIsPageActive();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isActive) return;
    // Snap to current wall-clock the moment we (re-)activate so the user
    // never sees a stale frozen value after switching pages.
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [isActive]);
  return now;
}

/**
 * Convert a Date into the wall-clock parts at a specific IANA timezone.
 * Uses Intl.DateTimeFormat with hourCycle h23 for stable parsing.
 */
function useTimeParts(now: Date, timeZone: string): TimeParts {
  return useMemo(() => {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      const parts = fmt.formatToParts(now);
      const get = (type: string): number => {
        const p = parts.find((p) => p.type === type);
        return p ? parseInt(p.value, 10) : 0;
      };
      return { hours: get('hour'), minutes: get('minute'), seconds: get('second') };
    } catch {
      return {
        hours: now.getHours(),
        minutes: now.getMinutes(),
        seconds: now.getSeconds(),
      };
    }
  }, [now, timeZone]);
}
