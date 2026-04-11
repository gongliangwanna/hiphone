import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloudy,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  type LucideIcon,
} from 'lucide-react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import {
  useWeatherData,
  type HourlyForecast,
  type DailyForecast,
} from '@/apps/Weather/useWeatherData';

interface WeatherWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
}

interface WeatherDescriptor {
  label: string;
  Icon: LucideIcon;
}

/**
 * Open-Meteo WMO weather code → label + day/night-aware lucide icon.
 */
function describeWeather(code: number, isDay: boolean): WeatherDescriptor {
  if (code === 0) return { label: '晴', Icon: isDay ? Sun : Moon };
  if (code <= 2) return { label: '多云', Icon: isDay ? CloudSun : CloudMoon };
  if (code === 3) return { label: '阴', Icon: Cloudy };
  if (code >= 45 && code <= 48) return { label: '雾', Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: '小雨', Icon: CloudDrizzle };
  if (code >= 61 && code <= 67) return { label: '雨', Icon: CloudRain };
  if (code >= 71 && code <= 77) return { label: '雪', Icon: CloudSnow };
  if (code >= 80 && code <= 82) return { label: '阵雨', Icon: CloudRain };
  if (code === 85 || code === 86) return { label: '阵雪', Icon: CloudSnow };
  if (code >= 95) return { label: '雷阵雨', Icon: CloudLightning };
  return { label: '晴', Icon: isDay ? Sun : Moon };
}

/**
 * Map a weather code + day/night flag to a 2-stop linear gradient.
 * Mirrors iOS Weather widget conventions: dynamic mood matching the sky.
 */
function weatherGradient(code: number, isDay: boolean): string {
  // Night variants always darker / cooler
  if (!isDay) {
    if (code === 0 || code <= 2) return 'linear-gradient(170deg, #1a2150 0%, #050a24 100%)';
    if (code === 3) return 'linear-gradient(170deg, #2a3045 0%, #0e1224 100%)';
    if (code >= 51 && code <= 67) return 'linear-gradient(170deg, #1f2840 0%, #060a18 100%)';
    if (code >= 80 && code <= 82) return 'linear-gradient(170deg, #232a3a 0%, #060a14 100%)';
    if (code >= 71 && code <= 77) return 'linear-gradient(170deg, #36405c 0%, #0c1226 100%)';
    if (code >= 95) return 'linear-gradient(170deg, #2b1f3c 0%, #060410 100%)';
    return 'linear-gradient(170deg, #1a2150 0%, #050a24 100%)';
  }
  // Day variants
  if (code === 0) return 'linear-gradient(170deg, #f6c463 0%, #2c8be0 80%)';
  if (code <= 2) return 'linear-gradient(170deg, #6cb8e8 0%, #1f56a8 100%)';
  if (code === 3) return 'linear-gradient(170deg, #7d8ca0 0%, #2e3a52 100%)';
  if (code >= 45 && code <= 48) return 'linear-gradient(170deg, #b3c4d2 0%, #5a6d80 100%)';
  if (code >= 51 && code <= 67) return 'linear-gradient(170deg, #4a667a 0%, #1a2638 100%)';
  if (code >= 80 && code <= 82) return 'linear-gradient(170deg, #3d5266 0%, #15202e 100%)';
  if (code >= 71 && code <= 77) return 'linear-gradient(170deg, #c8d8e6 0%, #4f6378 100%)';
  if (code >= 95) return 'linear-gradient(170deg, #3a3148 0%, #0a0612 100%)';
  return 'linear-gradient(170deg, #6cb8e8 0%, #1f56a8 100%)';
}

export function WeatherWidget({ size, variant, previewWidth }: WeatherWidgetProps) {
  const { data, loading } = useWeatherData();

  const location = data?.location ?? '北京';
  const temperature = data?.current.temperature;
  const apparent = data?.current.apparentTemperature;
  const isDay = data?.current.isDay ?? true;
  const code = data?.current.weatherCode ?? 0;
  const tempMin = data?.daily?.[0]?.tempMin;
  const tempMax = data?.daily?.[0]?.tempMax;
  const desc = describeWeather(code, isDay);
  const gradient = weatherGradient(code, isDay);

  const hourly = (data?.hourly ?? []).slice(0, size === '4x4' ? 5 : 4);
  const daily = (data?.daily ?? []).slice(0, 5);

  return (
    <WidgetShell size={size} variant={variant} previewWidth={previewWidth} testId="widget-weather">
      <div
        className="flex h-full w-full flex-col"
        style={{
          padding: size === '2x2' ? 14 : 16,
          background: gradient,
          color: 'white',
        }}
      >
        {size === '2x2' && (
          <SmallWeather
            location={location}
            temperature={temperature}
            tempMin={tempMin}
            tempMax={tempMax}
            desc={desc}
            loading={loading}
          />
        )}
        {size === '4x2' && (
          <MediumWeather
            location={location}
            temperature={temperature}
            tempMin={tempMin}
            tempMax={tempMax}
            desc={desc}
            hourly={hourly}
            loading={loading}
          />
        )}
        {size === '4x4' && (
          <LargeWeather
            location={location}
            temperature={temperature}
            apparent={apparent}
            tempMin={tempMin}
            tempMax={tempMax}
            desc={desc}
            hourly={hourly}
            daily={daily}
            loading={loading}
          />
        )}
      </div>
    </WidgetShell>
  );
}

// ---- Layouts --------------------------------------------------------------

interface CommonProps {
  location: string;
  temperature?: number;
  tempMin?: number;
  tempMax?: number;
  desc: WeatherDescriptor;
  loading: boolean;
}

function SmallWeather({
  location,
  temperature,
  tempMin,
  tempMax,
  desc,
  loading,
}: CommonProps) {
  const { Icon, label } = desc;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-start justify-between">
        <div
          className="truncate"
          style={{
            fontSize: 13,
            fontWeight: 600,
            maxWidth: '60%',
            color: 'rgba(255,255,255,0.95)',
          }}
        >
          {location}
        </div>
        <Icon size={28} strokeWidth={1.8} color="rgba(255,255,255,0.95)" />
      </div>
      <div className="mt-auto">
        <div
          style={{
            fontSize: 44,
            fontWeight: 200,
            lineHeight: 1,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {loading || temperature == null ? '—' : `${Math.round(temperature)}°`}
        </div>
        <div
          className="mt-1 flex items-center"
          style={{
            fontSize: 11,
            color: 'rgba(255,255,255,0.85)',
            gap: 6,
          }}
        >
          <span>{label}</span>
          {tempMin != null && tempMax != null && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              H:{Math.round(tempMax)}° L:{Math.round(tempMin)}°
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function MediumWeather({
  location,
  temperature,
  tempMin,
  tempMax,
  desc,
  hourly,
  loading,
}: CommonProps & { hourly: HourlyForecast[] }) {
  const { Icon, label } = desc;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div
            className="truncate"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              maxWidth: 160,
            }}
          >
            {location}
          </div>
          <div
            style={{
              fontSize: 50,
              fontWeight: 200,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              marginTop: 4,
            }}
          >
            {loading || temperature == null ? '—' : `${Math.round(temperature)}°`}
          </div>
        </div>
        <div className="flex flex-col items-end" style={{ gap: 4 }}>
          <Icon size={36} strokeWidth={1.8} color="rgba(255,255,255,0.95)" />
          <div
            style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 500,
            }}
          >
            {label}
          </div>
          {tempMin != null && tempMax != null && (
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.75)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              H:{Math.round(tempMax)}° L:{Math.round(tempMin)}°
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.18)',
          marginTop: 'auto',
          marginBottom: 8,
        }}
      />

      <HourlyStrip hourly={hourly} maxItems={4} />
    </div>
  );
}

function LargeWeather({
  location,
  temperature,
  apparent,
  tempMin,
  tempMax,
  desc,
  hourly,
  daily,
  loading,
}: CommonProps & {
  apparent?: number;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}) {
  const { Icon, label } = desc;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div
            className="truncate"
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: 'rgba(255,255,255,0.95)',
              maxWidth: 200,
            }}
          >
            {location}
          </div>
          <div
            style={{
              fontSize: 72,
              fontWeight: 200,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              fontVariantNumeric: 'tabular-nums',
              marginTop: 6,
            }}
          >
            {loading || temperature == null ? '—' : `${Math.round(temperature)}°`}
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.85)',
              marginTop: 2,
            }}
          >
            {label}
            {apparent != null && (
              <>
                {'  ·  '}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                  体感 {Math.round(apparent)}°
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end" style={{ gap: 4 }}>
          <Icon size={56} strokeWidth={1.6} color="rgba(255,255,255,0.95)" />
          {tempMin != null && tempMax != null && (
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.85)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              H:{Math.round(tempMax)}° L:{Math.round(tempMin)}°
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.18)',
          marginTop: 12,
          marginBottom: 8,
        }}
      />

      <HourlyStrip hourly={hourly} maxItems={5} />

      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.18)',
          marginTop: 8,
          marginBottom: 8,
        }}
      />

      <DailyStrip daily={daily} />
    </div>
  );
}

// ---- Subcomponents --------------------------------------------------------

function HourlyStrip({
  hourly,
  maxItems,
}: {
  hourly: HourlyForecast[];
  maxItems: number;
}) {
  if (hourly.length === 0) {
    // Render placeholder slots so the layout stays stable while loading
    return (
      <div className="flex items-center justify-between">
        {Array.from({ length: maxItems }).map((_, i) => (
          <div key={i} style={{ width: 32, height: 56 }} />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between">
      {hourly.slice(0, maxItems).map((h, i) => {
        const { Icon } = describeWeather(h.weatherCode, h.isDay);
        const date = new Date(h.time);
        const label =
          i === 0 ? '现在' : date.getHours().toString().padStart(2, '0');
        return (
          <div key={h.time} className="flex flex-col items-center" style={{ gap: 4 }}>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.85)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {label}
            </div>
            <Icon size={20} strokeWidth={1.8} color="rgba(255,255,255,0.95)" />
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'white',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(h.temperature)}°
            </div>
          </div>
        );
      })}
    </div>
  );
}

const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

function DailyStrip({ daily }: { daily: DailyForecast[] }) {
  if (daily.length === 0) {
    return <div style={{ height: 60 }} />;
  }

  // Compute global min/max for the bar normalization
  const allLows = daily.map((d) => d.tempMin);
  const allHighs = daily.map((d) => d.tempMax);
  const globalMin = Math.min(...allLows);
  const globalMax = Math.max(...allHighs);
  const range = Math.max(1, globalMax - globalMin);

  return (
    <div className="flex flex-1 flex-col" style={{ gap: 4 }}>
      {daily.map((d, i) => {
        const date = new Date(d.date);
        const isFirst = i === 0;
        const label = isFirst ? '今天' : `周${WEEKDAY_SHORT[date.getDay()]}`;
        const { Icon } = describeWeather(d.weatherCode, true);
        const left = ((d.tempMin - globalMin) / range) * 100;
        const right = 100 - ((d.tempMax - globalMin) / range) * 100;
        return (
          <div key={d.date} className="flex items-center" style={{ gap: 8 }}>
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.95)',
                fontWeight: isFirst ? 600 : 500,
                width: 32,
              }}
            >
              {label}
            </div>
            <Icon size={18} strokeWidth={1.8} color="rgba(255,255,255,0.95)" />
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.75)',
                width: 22,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(d.tempMin)}°
            </div>
            <div
              className="flex-1"
              style={{
                position: 'relative',
                height: 4,
                background: 'rgba(255,255,255,0.18)',
                borderRadius: 2,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${left}%`,
                  right: `${right}%`,
                  background:
                    'linear-gradient(90deg, #5ac8fa 0%, #ffd60a 60%, #ff9500 100%)',
                  borderRadius: 2,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'white',
                fontWeight: 600,
                width: 22,
                textAlign: 'left',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(d.tempMax)}°
            </div>
          </div>
        );
      })}
    </div>
  );
}
