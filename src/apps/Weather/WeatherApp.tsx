import { type CSSProperties, type ReactNode, useRef } from 'react';
import { motion, useInView } from 'motion/react';
import { AppScreen, Material } from '@/system';
import { useWeatherData, type WeatherData, type HourlyForecast, type DailyForecast } from './useWeatherData';
import {
  getBackgroundGradient,
  getCondition,
  getIconKey,
  getTemperatureBarGradient,
  getDayName,
  formatShortHour,
  getWindDirectionLabel,
  getUVLevel,
  getUVAdvice,
  getVisibilityText,
  getPressureText,
  getFeelsLikeText,
  generateHourlySummary,
  getSunProgress,
  formatTime,
} from './weatherConfig';
import {
  WeatherIcon,
  IconUV,
  IconSunset,
  IconWind,
  IconDroplets,
  IconThermometer,
  IconDroplet,
  IconEye,
  IconGauge,
  IconCalendar,
} from './WeatherIcon';

// ---------------------------------------------------------------------------
// WeatherApp — Main Entry
// ---------------------------------------------------------------------------

export function WeatherApp() {
  const { data, loading, error } = useWeatherData();

  if (loading) {
    return (
      <AppScreen
        backgroundColor="transparent"
        style={{ background: 'linear-gradient(180deg, #4A90D9 0%, #1B6CB5 100%)' }}
      >
        <LoadingSkeleton />
      </AppScreen>
    );
  }

  if (error || !data) {
    return (
      <AppScreen
        backgroundColor="transparent"
        style={{ background: 'linear-gradient(180deg, #4A5568 0%, #2D3748 100%)' }}
      >
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <div style={{ color: 'white', fontSize: 17 }}>无法加载天气数据</div>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 15 }}>{error}</div>
        </div>
      </AppScreen>
    );
  }

  return <WeatherContent data={data} />;
}

// ---------------------------------------------------------------------------
// WeatherContent — scroll-collapse header + body
// ---------------------------------------------------------------------------

function WeatherContent({ data }: { data: WeatherData }) {
  const gradient = getBackgroundGradient(data.current.weatherCode, data.current.isDay);
  const condition = getCondition(data.current.weatherCode);
  const today = data.daily[0];

  return (
    <AppScreen backgroundColor="transparent" style={{ background: gradient }}>
      <div
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: 'var(--app-safe-bottom, 20px)',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}
      >
        {/* --- Header --- */}
        <div
          className="text-center"
          style={{ padding: '10px 0 18px', color: 'white' }}
        >
          <div style={{ fontSize: 34, fontWeight: 500, lineHeight: 1.15 }}>
            {data.location}
          </div>

          <div style={{ fontSize: 96, fontWeight: 200, lineHeight: 1, marginTop: 2 }}>
            <span>{data.current.temperature}</span>
            <span style={{ fontSize: 56, fontWeight: 300, verticalAlign: 'top', marginTop: 6, display: 'inline-block' }}>°</span>
          </div>

          <div style={{ fontSize: 20, fontWeight: 500, marginTop: 2 }}>
            {condition.label}
          </div>

          <div style={{ fontSize: 20, fontWeight: 500, marginTop: 2, opacity: 0.9 }}>
            最高{today?.tempMax}° 最低{today?.tempMin}°
          </div>
        </div>

        {/* --- Cards --- */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FadeInCard><HourlySection hourly={data.hourly} /></FadeInCard>
          <FadeInCard><DailySection daily={data.daily} currentTemp={data.current.temperature} /></FadeInCard>

          <div className="grid grid-cols-2" style={{ gap: 10 }}>
            <FadeInCard><UVModule uv={data.current.uvIndex} /></FadeInCard>
            <FadeInCard><SunsetModule daily={data.daily[0]} /></FadeInCard>
            <FadeInCard>
              <WindModule
                speed={data.current.windSpeed}
                direction={data.current.windDirection}
                gusts={data.current.windGusts}
              />
            </FadeInCard>
            <FadeInCard><PrecipModule daily={data.daily} /></FadeInCard>
            <FadeInCard>
              <FeelsLikeModule feelsLike={data.current.apparentTemperature} actual={data.current.temperature} />
            </FadeInCard>
            <FadeInCard>
              <HumidityModule humidity={data.current.humidity} dewPoint={data.current.dewPoint} />
            </FadeInCard>
            <FadeInCard><VisibilityModule visibility={data.current.visibility} /></FadeInCard>
            <FadeInCard><PressureModule pressure={data.current.pressure} /></FadeInCard>
          </div>
        </div>

        {/* --- Footer --- */}
        <div style={{ textAlign: 'center', padding: '28px 16px 12px', color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
          天气数据由 Open-Meteo 提供
        </div>
      </div>
    </AppScreen>
  );
}

// ---------------------------------------------------------------------------
// FadeInCard — Viewport-triggered fade + translate
// ---------------------------------------------------------------------------

function FadeInCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col" style={{ padding: '0 16px' }}>
      <div className="flex flex-col items-center" style={{ padding: '10px 0 24px', gap: 8 }}>
        <Shimmer width={120} height={28} />
        <Shimmer width={90} height={72} />
        <Shimmer width={80} height={20} />
        <Shimmer width={130} height={18} />
      </div>
      <Shimmer width="100%" height={150} radius={16} />
      <div style={{ height: 10 }} />
      <Shimmer width="100%" height={340} radius={16} />
      <div style={{ height: 10 }} />
      <div className="grid grid-cols-2" style={{ gap: 10 }}>
        <Shimmer width="100%" height={170} radius={16} />
        <Shimmer width="100%" height={170} radius={16} />
      </div>
    </div>
  );
}

function Shimmer({ width, height, radius = 10 }: { width: number | string; height: number; radius?: number }) {
  return (
    <div
      style={{
        width, height, borderRadius: radius,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          animation: 'wx-shimmer 1.5s infinite',
        }}
      />
      <style>{`@keyframes wx-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}`}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GlassCard
// ---------------------------------------------------------------------------

function GlassCard({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <Material
      variant="thin"
      className={`overflow-hidden rounded-2xl ${className ?? ''}`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        border: '0.5px solid rgba(255,255,255,0.12)',
        color: 'white',
        ...style,
      }}
    >
      {children}
    </Material>
  );
}

// ---------------------------------------------------------------------------
// Hourly Forecast — with sunrise/sunset inline
// ---------------------------------------------------------------------------

function HourlySection({ hourly }: { hourly: HourlyForecast[] }) {
  const summary = generateHourlySummary(hourly);

  return (
    <GlassCard>
      <div style={{ padding: '12px 16px 8px', fontSize: 14, fontWeight: 400, color: 'rgba(255,255,255,0.8)', lineHeight: 1.35 }}>
        {summary}
      </div>
      <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.25)', margin: '0 16px' }} />

      <div style={{ position: 'relative' }}>
        <div className="overflow-x-auto" style={{ padding: '14px 0 16px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <div className="flex" style={{ padding: '0 16px', gap: 20 }}>
            {hourly.map((h, i) => {
              const isSolar = !!h.solarEvent;
              const showPrecip = !isSolar && h.precipitationProbability > 0;
              const iconKey = isSolar ? h.solarEvent! : getIconKey(h.weatherCode, h.isDay);
              const label = isSolar
                ? (h.solarEvent === 'sunrise' ? '日出' : '日落')
                : (i === 0 ? '现在' : formatShortHour(h.time));

              return (
                <div
                  key={`${h.time}-${h.solarEvent ?? ''}`}
                  className="flex flex-col items-center"
                  style={{ minWidth: 44, flexShrink: 0 }}
                >
                  {/* Row 1: time label — fixed height */}
                  <div style={{ height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span
                      style={{
                        fontSize: isSolar ? 13 : 15,
                        fontWeight: i === 0 && !isSolar ? 600 : 500,
                        color: isSolar ? '#FFD700' : 'white',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {label}
                    </span>
                  </div>
                  {/* Row 2: precipitation — fixed height */}
                  <div style={{ height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                    {showPrecip && (
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#5AC8FA', lineHeight: 1 }}>
                        {h.precipitationProbability}%
                      </span>
                    )}
                  </div>
                  {/* Row 3: icon — fixed height */}
                  <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                    <WeatherIcon condition={iconKey} size={26} />
                  </div>
                  {/* Row 4: temperature or solar time — fixed height */}
                  <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                    {!isSolar ? (
                      <span style={{ fontSize: 18, fontWeight: 600, color: 'white' }}>{h.temperature}°</span>
                    ) : (
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                        {formatShortHour(h.time)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Edge fade masks */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 16, background: 'linear-gradient(90deg, rgba(0,0,0,0.15) 0%, transparent 100%)', pointerEvents: 'none', borderRadius: '16px 0 0 16px' }} />
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 24, background: 'linear-gradient(270deg, rgba(0,0,0,0.15) 0%, transparent 100%)', pointerEvents: 'none', borderRadius: '0 16px 16px 0' }} />
      </div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// 10-Day Forecast — iOS-accurate temperature bars
// ---------------------------------------------------------------------------

function DailySection({ daily, currentTemp }: { daily: DailyForecast[]; currentTemp: number }) {
  const allTemps = daily.flatMap((d) => [d.tempMin, d.tempMax]);
  const globalMin = Math.min(...allTemps);
  const globalMax = Math.max(...allTemps);
  const range = globalMax - globalMin || 1;

  return (
    <GlassCard>
      <div style={{ padding: '12px 16px 6px' }}>
        <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, textTransform: 'uppercase' }}>
          <IconCalendar size={13} />
          <span>10天预报</span>
        </div>
      </div>

      {daily.map((day, i) => {
        const leftPct = ((day.tempMin - globalMin) / range) * 100;
        const rightPct = ((globalMax - day.tempMax) / range) * 100;
        const barGradient = getTemperatureBarGradient(day.tempMin, day.tempMax);

        // Current temp dot (today only)
        const showDot = i === 0 && currentTemp >= day.tempMin && currentTemp <= day.tempMax;
        const dotPct = showDot ? ((currentTemp - globalMin) / range) * 100 : 0;

        return (
          <div key={day.date}>
            {i > 0 && <div style={{ borderTop: '0.5px solid rgba(255,255,255,0.15)', margin: '0 16px' }} />}
            <div className="flex items-center" style={{ padding: '10px 16px', gap: 8 }}>
              <span style={{ width: 44, fontSize: 17, fontWeight: i === 0 ? 600 : 500, color: 'white', flexShrink: 0 }}>
                {getDayName(day.date, i)}
              </span>
              <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                <WeatherIcon condition={getIconKey(day.weatherCode, true)} size={22} />
              </div>
              <span style={{ width: 32, textAlign: 'right', fontSize: 17, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
                {day.tempMin}°
              </span>

              {/* Temperature bar */}
              <div className="flex-1" style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.12)', position: 'relative', minWidth: 60 }}>
                <div style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: `${leftPct}%`, right: `${rightPct}%`,
                  borderRadius: 3,
                  background: barGradient,
                }} />
                {showDot && (
                  <div style={{
                    position: 'absolute', top: '50%', left: `${dotPct}%`,
                    width: 7, height: 7, borderRadius: '50%',
                    backgroundColor: 'white',
                    border: '1.5px solid rgba(0,0,0,0.12)',
                    transform: 'translate(-50%, -50%)',
                    boxShadow: '0 0 3px rgba(0,0,0,0.15)',
                  }} />
                )}
              </div>

              <span style={{ width: 32, textAlign: 'right', fontSize: 17, fontWeight: 500, color: 'white', flexShrink: 0 }}>
                {day.tempMax}°
              </span>
            </div>
          </div>
        );
      })}
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// Module Card Wrapper
// ---------------------------------------------------------------------------

function ModuleCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <GlassCard style={{ padding: '14px 16px', minHeight: 160, display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div className="flex items-center gap-1" style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: 6, flexShrink: 0 }}>
        {icon}
        <span>{title}</span>
      </div>
      <div className="flex flex-1 flex-col" style={{ minHeight: 0 }}>{children}</div>
    </GlassCard>
  );
}

// ---------------------------------------------------------------------------
// UV Index
// ---------------------------------------------------------------------------

function UVModule({ uv }: { uv: number }) {
  const level = getUVLevel(uv);
  const advice = getUVAdvice(uv);
  const barPct = Math.min(uv / 11, 1) * 100;

  return (
    <ModuleCard icon={<IconUV />} title="紫外线指数">
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>{Math.round(uv)}</div>
      <div style={{ fontSize: 20, fontWeight: 500, color: 'white', marginBottom: 10 }}>{level}</div>
      <div style={{ height: 5, borderRadius: 3, background: 'linear-gradient(90deg, #4CD964, #FFCC00, #FF9500, #FF3B30, #AF52DE)', position: 'relative', marginBottom: 10 }}>
        <div style={{
          position: 'absolute', top: -3, left: `${barPct}%`,
          width: 11, height: 11, borderRadius: '50%',
          backgroundColor: 'white', border: '1.5px solid rgba(0,0,0,0.12)',
          transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(0,0,0,0.2)',
        }} />
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 1.35, marginTop: 'auto' }}>{advice}</div>
    </ModuleCard>
  );
}

// ---------------------------------------------------------------------------
// Sunset / Sunrise — enhanced arc
// ---------------------------------------------------------------------------

function SunsetModule({ daily }: { daily: DailyForecast | undefined }) {
  if (!daily) return null;
  const progress = getSunProgress(daily.sunrise, daily.sunset);
  const isBeforeSunset = progress >= 0 && progress <= 1;

  return (
    <ModuleCard icon={<IconSunset />} title={isBeforeSunset ? '日落' : '日出'}>
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>
        {isBeforeSunset ? formatTime(daily.sunset) : formatTime(daily.sunrise)}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 0' }}>
        <SunArc progress={progress} />
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
        {isBeforeSunset ? `日出: ${formatTime(daily.sunrise)}` : `日落: ${formatTime(daily.sunset)}`}
      </div>
    </ModuleCard>
  );
}

function SunArc({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const sx = (1 - p) ** 2 * 5 + 2 * (1 - p) * p * 50 + p ** 2 * 95;
  const sy = (1 - p) ** 2 * 40 + 2 * (1 - p) * p * 2 + p ** 2 * 40;
  const show = progress >= 0 && progress <= 1;

  return (
    <svg viewBox="0 0 100 48" width="100%" height="100%" style={{ maxHeight: 50 }}>
      <defs>
        <linearGradient id="arc-g" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="100%" stopColor="#FF8C00" />
        </linearGradient>
        <filter id="sd-glow"><feGaussianBlur stdDeviation="2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <line x1="5" y1="40" x2="95" y2="40" stroke="rgba(255,255,255,0.2)" strokeWidth="0.6" />
      <path d="M 5,40 Q 50,2 95,40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" strokeDasharray="2.5 2" />
      {show && (
        <>
          <path d="M 5,40 Q 50,2 95,40" fill="none" stroke="url(#arc-g)" strokeWidth="1.5" strokeDasharray={`${p * 120} 200`} />
          <circle cx={sx} cy={sy} r="5" fill="#FFD700" filter="url(#sd-glow)" opacity={0.5} />
          <circle cx={sx} cy={sy} r="3.5" fill="#FFD700" />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Wind
// ---------------------------------------------------------------------------

function WindModule({ speed, direction, gusts }: { speed: number; direction: number; gusts: number }) {
  return (
    <ModuleCard icon={<IconWind />} title="风">
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0' }}>
        <WindCompass direction={direction} speed={speed} />
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
        {getWindDirectionLabel(direction)}风，阵风可达&thinsp;{gusts}&thinsp;公里/小时
      </div>
    </ModuleCard>
  );
}

function WindCompass({ direction, speed }: { direction: number; speed: number }) {
  const cx = 65, cy = 65, r = 50;
  const dirRad = ((direction - 90) * Math.PI) / 180;

  // Kite-shaped direction pointer on the ring
  const perpX = Math.cos(dirRad + Math.PI / 2);
  const perpY = Math.sin(dirRad + Math.PI / 2);
  const tipX = cx + Math.cos(dirRad) * r;
  const tipY = cy + Math.sin(dirRad) * r;
  const midR = r - 7;
  const halfW = 3.8;
  const mlX = cx + Math.cos(dirRad) * midR + perpX * halfW;
  const mlY = cy + Math.sin(dirRad) * midR + perpY * halfW;
  const mrX = cx + Math.cos(dirRad) * midR - perpX * halfW;
  const mrY = cy + Math.sin(dirRad) * midR - perpY * halfW;
  const tailR = r - 12;
  const tailX = cx + Math.cos(dirRad) * tailR;
  const tailY = cy + Math.sin(dirRad) * tailR;

  return (
    <svg viewBox="0 0 130 130" style={{ width: '100%', maxWidth: 140, aspectRatio: '1' }}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="0.8" />

      {/* Tick marks — 48 ticks every 7.5° */}
      {Array.from({ length: 48 }, (_, i) => {
        const deg = i * 7.5;
        const isCardinal = deg % 90 === 0;
        const isInter = !isCardinal && deg % 45 === 0;
        const a = ((deg - 90) * Math.PI) / 180;
        const len = isCardinal ? 5.5 : isInter ? 4 : 2;
        const opacity = isCardinal ? 0.45 : isInter ? 0.28 : 0.14;
        return (
          <line
            key={deg}
            x1={cx + Math.cos(a) * (r - len)} y1={cy + Math.sin(a) * (r - len)}
            x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r}
            stroke={`rgba(255,255,255,${opacity})`}
            strokeWidth={isCardinal ? 1.5 : 1}
            strokeLinecap="round"
          />
        );
      })}

      {/* Cardinal direction labels */}
      {([
        { l: 'N', deg: 0, bright: true },
        { l: 'E', deg: 90, bright: false },
        { l: 'S', deg: 180, bright: false },
        { l: 'W', deg: 270, bright: false },
      ] as const).map(({ l, deg, bright }) => {
        const a = ((deg - 90) * Math.PI) / 180;
        const lr = r - 13;
        return (
          <text
            key={l}
            x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr}
            fill={`rgba(255,255,255,${bright ? 0.7 : 0.35})`}
            fontSize="10" fontWeight={bright ? '600' : '500'}
            textAnchor="middle" dominantBaseline="central"
          >
            {l}
          </text>
        );
      })}

      {/* Direction pointer — kite shape on ring edge */}
      <polygon
        points={`${tipX},${tipY} ${mlX},${mlY} ${tailX},${tailY} ${mrX},${mrY}`}
        fill="white" opacity={0.95}
      />

      {/* Center speed readout */}
      <text
        x={cx} y={cy - 4} fill="white"
        fontSize="18" fontWeight="300" textAnchor="middle" dominantBaseline="central"
      >
        {speed}
      </text>
      <text
        x={cx} y={cy + 10} fill="rgba(255,255,255,0.5)"
        fontSize="7.5" fontWeight="500" textAnchor="middle" dominantBaseline="central"
        letterSpacing="0.3"
      >
        km/h
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Precipitation
// ---------------------------------------------------------------------------

function PrecipModule({ daily }: { daily: DailyForecast[] }) {
  const todayPrecip = daily[0]?.precipProbabilityMax ?? 0;

  return (
    <ModuleCard icon={<IconDroplets />} title="降水">
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>{todayPrecip}%</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 6, marginBottom: 10 }}>今天的降水概率</div>
      <div className="flex items-end justify-between" style={{ flex: 1, gap: 4, padding: '4px 0', minHeight: 40 }}>
        {daily.slice(0, 7).map((d, i) => (
          <div key={d.date} className="flex flex-1 flex-col items-center" style={{ gap: 2 }}>
            <div style={{
              width: '100%', maxWidth: 20,
              height: Math.max(4, (d.precipProbabilityMax / 100) * 40),
              borderRadius: 2,
              backgroundColor: d.precipProbabilityMax > 30 ? '#5AC8FA' : 'rgba(255,255,255,0.2)',
            }} />
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>{i === 0 ? '今' : getDayName(d.date, i).slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </ModuleCard>
  );
}

// ---------------------------------------------------------------------------
// Feels Like
// ---------------------------------------------------------------------------

function FeelsLikeModule({ feelsLike, actual }: { feelsLike: number; actual: number }) {
  return (
    <ModuleCard icon={<IconThermometer />} title="体感温度">
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>{feelsLike}°</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 1.35, marginBottom: 'auto' }}>
        {getFeelsLikeText(feelsLike, actual)}
      </div>
    </ModuleCard>
  );
}

// ---------------------------------------------------------------------------
// Humidity
// ---------------------------------------------------------------------------

function HumidityModule({ humidity, dewPoint }: { humidity: number; dewPoint: number }) {
  return (
    <ModuleCard icon={<IconDroplet />} title="湿度">
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>{humidity}%</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 1.35, marginBottom: 'auto' }}>
        露点温度为 {dewPoint}°。
      </div>
    </ModuleCard>
  );
}

// ---------------------------------------------------------------------------
// Visibility
// ---------------------------------------------------------------------------

function VisibilityModule({ visibility }: { visibility: number }) {
  return (
    <ModuleCard icon={<IconEye />} title="能见度">
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>
        {visibility.toFixed(1)}
        <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>公里</span>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 8, lineHeight: 1.35, marginBottom: 'auto' }}>
        {getVisibilityText(visibility)}
      </div>
    </ModuleCard>
  );
}

// ---------------------------------------------------------------------------
// Pressure — gradient gauge
// ---------------------------------------------------------------------------

function PressureModule({ pressure }: { pressure: number }) {
  const level = getPressureText(pressure);
  const minP = 960;
  const maxP = 1060;
  const pct = Math.max(0, Math.min(1, (pressure - minP) / (maxP - minP)));
  const angle = -90 + pct * 180;
  const nl = 22;
  const nx = 40 + Math.cos((angle * Math.PI) / 180) * nl;
  const ny = 45 + Math.sin((angle * Math.PI) / 180) * nl;

  return (
    <ModuleCard icon={<IconGauge />} title="气压">
      <div style={{ fontSize: 34, fontWeight: 300, color: 'white', lineHeight: 1.1 }}>
        {pressure}
        <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 4, color: 'rgba(255,255,255,0.7)' }}>百帕</span>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0' }}>
        <svg viewBox="0 0 80 52" width="80" height="52">
          <defs>
            <linearGradient id="gg" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5AC8FA" />
              <stop offset="50%" stopColor="#4CD964" />
              <stop offset="100%" stopColor="#FF9500" />
            </linearGradient>
          </defs>
          <path d="M 10,45 A 30,30 0 0,1 70,45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 10,45 A 30,30 0 0,1 70,45" fill="none" stroke="url(#gg)" strokeWidth="3.5" strokeLinecap="round" opacity={0.6} />
          <line x1="40" y1="45" x2={nx} y2={ny} stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="40" cy="45" r="2.5" fill="white" />
          <text x="8" y="52" fill="rgba(255,255,255,0.35)" fontSize="6">低</text>
          <text x="66" y="52" fill="rgba(255,255,255,0.35)" fontSize="6">高</text>
        </svg>
      </div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 'auto' }}>{level}</div>
    </ModuleCard>
  );
}
