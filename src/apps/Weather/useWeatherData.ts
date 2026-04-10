import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  pressure: number;
  uvIndex: number;
  isDay: boolean;
  dewPoint: number;
  visibility: number; // km
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationProbability: number;
  isDay: boolean;
  /** When set, this slot represents a sunrise/sunset event instead of weather */
  solarEvent?: 'sunrise' | 'sunset';
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  sunrise: string;
  sunset: string;
  uvIndexMax: number;
  precipProbabilityMax: number;
}

export interface WeatherData {
  location: string;
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
}

// ---------------------------------------------------------------------------
// Default coordinates (Beijing)
// ---------------------------------------------------------------------------

const DEFAULT_LAT = 39.9042;
const DEFAULT_LNG = 116.4074;

// ---------------------------------------------------------------------------
// localStorage Cache (15-minute TTL)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'hiphone-weather-cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

interface CachedWeather {
  data: WeatherData;
  timestamp: number;
}

function readCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedWeather = JSON.parse(raw);
    return cached.data;
  } catch {
    return null;
  }
}

function isCacheFresh(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cached: CachedWeather = JSON.parse(raw);
    return Date.now() - cached.timestamp < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function writeCache(data: WeatherData): void {
  try {
    const entry: CachedWeather = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // silently ignore
  }
}

// ---------------------------------------------------------------------------
// API Fetching
// ---------------------------------------------------------------------------

async function fetchWeather(lat: number, lng: number): Promise<Omit<WeatherData, 'location'>> {
  const currentVars = [
    'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
    'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
    'surface_pressure', 'is_day',
  ].join(',');

  const hourlyVars = [
    'temperature_2m', 'weather_code', 'precipitation_probability', 'is_day',
    'dew_point_2m', 'visibility', 'uv_index',
  ].join(',');

  const dailyVars = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min',
    'sunrise', 'sunset', 'uv_index_max', 'precipitation_probability_max',
  ].join(',');

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=${currentVars}&hourly=${hourlyVars}&daily=${dailyVars}&timezone=auto&forecast_days=10`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather API: ${res.status}`);
  const d = await res.json();

  // Extract current-hour index from hourly data for fields not in "current"
  const nowISO = new Date().toISOString().slice(0, 13);
  let curHourIdx = (d.hourly?.time as string[])?.findIndex((t: string) => t.startsWith(nowISO));
  if (curHourIdx < 0) curHourIdx = 0;

  const current: CurrentWeather = {
    temperature: Math.round(d.current.temperature_2m),
    apparentTemperature: Math.round(d.current.apparent_temperature),
    humidity: Math.round(d.current.relative_humidity_2m),
    weatherCode: d.current.weather_code,
    windSpeed: Math.round(d.current.wind_speed_10m),
    windDirection: Math.round(d.current.wind_direction_10m),
    windGusts: Math.round(d.current.wind_gusts_10m),
    pressure: Math.round(d.current.surface_pressure),
    isDay: d.current.is_day === 1,
    uvIndex: Math.round((d.hourly.uv_index?.[curHourIdx] ?? 0) * 10) / 10,
    dewPoint: Math.round(d.hourly.dew_point_2m?.[curHourIdx] ?? 0),
    visibility: Math.round((d.hourly.visibility?.[curHourIdx] ?? 10000) / 100) / 10,
  };

  // Build hourly array with sunrise/sunset events injected
  const rawHourly: HourlyForecast[] = [];
  for (let i = curHourIdx; i < curHourIdx + 25 && i < d.hourly.time.length; i++) {
    rawHourly.push({
      time: d.hourly.time[i],
      temperature: Math.round(d.hourly.temperature_2m[i]),
      weatherCode: d.hourly.weather_code[i],
      precipitationProbability: d.hourly.precipitation_probability[i] ?? 0,
      isDay: d.hourly.is_day[i] === 1,
    });
  }

  // Collect sunrise/sunset times for today and tomorrow
  const solarEvents: { time: string; type: 'sunrise' | 'sunset' }[] = [];
  for (let di = 0; di < Math.min(2, (d.daily.time as string[]).length); di++) {
    if (d.daily.sunrise[di]) solarEvents.push({ time: d.daily.sunrise[di], type: 'sunrise' });
    if (d.daily.sunset[di]) solarEvents.push({ time: d.daily.sunset[di], type: 'sunset' });
  }

  // Inject solar events into the hourly array at the correct positions
  const hourly = injectSolarEvents(rawHourly, solarEvents);

  const daily: DailyForecast[] = (d.daily.time as string[]).map((_: string, i: number) => ({
    date: d.daily.time[i],
    weatherCode: d.daily.weather_code[i],
    tempMax: Math.round(d.daily.temperature_2m_max[i]),
    tempMin: Math.round(d.daily.temperature_2m_min[i]),
    sunrise: d.daily.sunrise[i],
    sunset: d.daily.sunset[i],
    uvIndexMax: Math.round(d.daily.uv_index_max[i] * 10) / 10,
    precipProbabilityMax: Math.round(d.daily.precipitation_probability_max[i] ?? 0),
  }));

  return { current, hourly, daily };
}

/** Insert sunrise/sunset markers into the hourly timeline at chronological positions. */
function injectSolarEvents(
  hourly: HourlyForecast[],
  events: { time: string; type: 'sunrise' | 'sunset' }[],
): HourlyForecast[] {
  if (hourly.length === 0) return hourly;

  const startMs = new Date(hourly[0]!.time).getTime();
  const endMs = new Date(hourly[hourly.length - 1]!.time).getTime();
  const result: HourlyForecast[] = [];

  // Filter events within hourly range
  const validEvents = events
    .filter((e) => {
      const ms = new Date(e.time).getTime();
      return ms >= startMs && ms <= endMs;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  let eventIdx = 0;
  for (const h of hourly) {
    const hMs = new Date(h.time).getTime();
    // Insert any solar events that fall before this hour
    while (eventIdx < validEvents.length) {
      const eMs = new Date(validEvents[eventIdx]!.time).getTime();
      if (eMs <= hMs) {
        result.push({
          time: validEvents[eventIdx]!.time,
          temperature: h.temperature,
          weatherCode: h.weatherCode,
          precipitationProbability: 0,
          isDay: validEvents[eventIdx]!.type === 'sunrise',
          solarEvent: validEvents[eventIdx]!.type,
        });
        eventIdx++;
      } else {
        break;
      }
    }
    result.push(h);
  }

  return result;
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=zh&zoom=10`,
      { headers: { 'User-Agent': 'hiPhone-Weather/1.0' } },
    );
    if (!res.ok) return '我的位置';
    const data = await res.json();
    const addr = data.address;
    return addr?.city || addr?.town || addr?.county || addr?.state || '我的位置';
  } catch {
    return '我的位置';
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

export function useWeatherData() {
  const [data, setData] = useState<WeatherData | null>(() => readCache());
  const [loading, setLoading] = useState(() => readCache() === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isCacheFresh() && data) return;

    let cancelled = false;

    (async () => {
      let lat = DEFAULT_LAT;
      let lng = DEFAULT_LNG;

      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            maximumAge: 300_000,
          });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Fallback to Beijing
      }

      try {
        const [weather, location] = await Promise.all([
          fetchWeather(lat, lng),
          reverseGeocode(lat, lng),
        ]);
        if (!cancelled) {
          const freshData = { ...weather, location };
          setData(freshData);
          setLoading(false);
          writeCache(freshData);
        }
      } catch (err) {
        if (!cancelled) {
          if (!data) {
            setError(err instanceof Error ? err.message : '加载失败');
          }
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error };
}
