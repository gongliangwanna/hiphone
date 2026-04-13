/**
 * Weather data store — shared singleton that powers both the WeatherApp and
 * the WeatherWidget.
 *
 * # Why this exists
 *
 * Previously, `useWeatherData()` stored `data / loading / error` in local
 * `useState`. Every component that called the hook (app, widget) had its
 * own copy. This caused the "打开 app 才会更新" bug: the springboard
 * widget mounted once at startup, read a stale localStorage entry, and
 * then never refetched. Opening the app triggered a fresh pull into *its*
 * local state — the widget's copy was untouched until it re-mounted.
 *
 * The fix is a single Zustand store + a module-level poller:
 *
 *   - Every subscriber (widget, app, test utilities) reads from the same
 *     store, so one `refreshWeather()` call updates everything in the
 *     same React commit.
 *   - A `setInterval` tick checks every minute whether the cache is older
 *     than 15 minutes; if so, it triggers a refresh. The tick is gated on
 *     `document.visibilityState === 'visible'` so a hidden tab costs
 *     nothing.
 *   - Concurrent refresh calls are merged via an `inFlight` promise — two
 *     components mounting simultaneously don't fire two network requests.
 *   - Geolocation is only requested on the first refresh; cached coords
 *     are reused for subsequent polls so the browser doesn't re-prompt or
 *     re-wait for 5s on every tick.
 */

import { create } from 'zustand';
import type { WeatherData, CurrentWeather, HourlyForecast, DailyForecast } from './useWeatherData';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LAT = 39.9042;
const DEFAULT_LNG = 116.4074;

const CACHE_KEY = 'hiphone-weather-cache';
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const POLL_INTERVAL_MS = 60 * 1000; // check every minute

// ---------------------------------------------------------------------------
// localStorage cache
// ---------------------------------------------------------------------------

interface CachedEntry {
  data: WeatherData;
  timestamp: number;
  coords?: { lat: number; lng: number };
}

function readCacheEntry(): CachedEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedEntry;
  } catch {
    return null;
  }
}

function writeCacheEntry(entry: CachedEntry): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // quota exceeded / private mode — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface WeatherStoreState {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
  lastFetchedAt: number;
  coords: { lat: number; lng: number } | null;
}

const initialCacheEntry = typeof localStorage !== 'undefined' ? readCacheEntry() : null;

export const useWeatherStore = create<WeatherStoreState>(() => ({
  data: initialCacheEntry?.data ?? null,
  loading: initialCacheEntry?.data == null,
  error: null,
  lastFetchedAt: initialCacheEntry?.timestamp ?? 0,
  coords: initialCacheEntry?.coords ?? null,
}));

// ---------------------------------------------------------------------------
// Refresh logic
// ---------------------------------------------------------------------------

let inFlight: Promise<void> | null = null;

export interface RefreshOptions {
  /** Force a refetch even if cache is still fresh. */
  force?: boolean;
}

/**
 * Refresh the weather data.
 *
 * - If `force` is false and the last fetch is within TTL, this is a no-op.
 * - Concurrent calls share the same in-flight promise so we never fire two
 *   network requests at once.
 * - On success, the store + localStorage are both updated.
 * - On failure, `error` is set only if we had no previous data to show.
 */
export function refreshWeather(options: RefreshOptions = {}): Promise<void> {
  const { force = false } = options;
  const state = useWeatherStore.getState();

  if (!force && state.data && Date.now() - state.lastFetchedAt < CACHE_TTL_MS) {
    return Promise.resolve();
  }

  if (inFlight) return inFlight;

  useWeatherStore.setState({ loading: state.data == null });

  inFlight = (async () => {
    try {
      const { coords } = useWeatherStore.getState();
      const { lat, lng } = coords ?? (await resolveCoords());

      const [weather, location] = await Promise.all([
        fetchWeather(lat, lng),
        // Only reverse-geocode if we don't already have a location string.
        // Location names don't change often, so reusing the previous string
        // during a refresh is safer and cheaper than re-asking nominatim.
        useWeatherStore.getState().data?.location
          ? Promise.resolve(useWeatherStore.getState().data!.location)
          : reverseGeocode(lat, lng),
      ]);

      const freshData: WeatherData = { ...weather, location };
      const now = Date.now();

      useWeatherStore.setState({
        data: freshData,
        loading: false,
        error: null,
        lastFetchedAt: now,
        coords: { lat, lng },
      });

      writeCacheEntry({ data: freshData, timestamp: now, coords: { lat, lng } });
    } catch (err) {
      const prev = useWeatherStore.getState();
      useWeatherStore.setState({
        loading: false,
        // Only surface an error if we have nothing to show. If stale data
        // exists, the user keeps seeing it rather than an error wall.
        error: prev.data == null ? (err instanceof Error ? err.message : '加载失败') : null,
      });
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

// ---------------------------------------------------------------------------
// Geolocation (only called once per session, result cached in store)
// ---------------------------------------------------------------------------

async function resolveCoords(): Promise<{ lat: number; lng: number }> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  }
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 300_000,
      });
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return { lat: DEFAULT_LAT, lng: DEFAULT_LNG };
  }
}

// ---------------------------------------------------------------------------
// API fetching — port of the original useWeatherData.ts logic
// ---------------------------------------------------------------------------

async function fetchWeather(
  lat: number,
  lng: number,
): Promise<Omit<WeatherData, 'location'>> {
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

  const nowISO = new Date().toISOString().slice(0, 13);
  let curHourIdx = (d.hourly?.time as string[])?.findIndex((t: string) =>
    t.startsWith(nowISO),
  );
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

  const solarEvents: { time: string; type: 'sunrise' | 'sunset' }[] = [];
  for (let di = 0; di < Math.min(2, (d.daily.time as string[]).length); di++) {
    if (d.daily.sunrise[di]) solarEvents.push({ time: d.daily.sunrise[di], type: 'sunrise' });
    if (d.daily.sunset[di]) solarEvents.push({ time: d.daily.sunset[di], type: 'sunset' });
  }

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

function injectSolarEvents(
  hourly: HourlyForecast[],
  events: { time: string; type: 'sunrise' | 'sunset' }[],
): HourlyForecast[] {
  if (hourly.length === 0) return hourly;

  const startMs = new Date(hourly[0]!.time).getTime();
  const endMs = new Date(hourly[hourly.length - 1]!.time).getTime();
  const result: HourlyForecast[] = [];

  const validEvents = events
    .filter((e) => {
      const ms = new Date(e.time).getTime();
      return ms >= startMs && ms <= endMs;
    })
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  let eventIdx = 0;
  for (const h of hourly) {
    const hMs = new Date(h.time).getTime();
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
// Background poller
// ---------------------------------------------------------------------------

let pollerStarted = false;
let pollerTimer: ReturnType<typeof setInterval> | null = null;

function pollerTick(): void {
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    // Tab hidden — skip. We'll catch up on visibilitychange.
    return;
  }
  void refreshWeather();
}

/**
 * Starts the background poller. Idempotent — multiple calls (e.g. one per
 * widget mount) are collapsed to a single shared timer. Safe to call from
 * React effects without cleanup; the poller lives for the app session.
 */
export function startWeatherAutoRefresh(): void {
  if (pollerStarted) return;
  pollerStarted = true;

  // Kick off an immediate fetch if we have nothing or the cache is stale.
  void refreshWeather();

  if (typeof window === 'undefined') return;

  pollerTimer = setInterval(pollerTick, POLL_INTERVAL_MS);

  // When a hidden tab becomes visible, re-tick immediately — the timer may
  // have been throttled to >1min by the browser, and a stale widget at
  // that moment is exactly what we're trying to avoid.
  document.addEventListener('visibilitychange', pollerTick);
}

/** Test helper — lets tests reset the poller between runs. */
export function stopWeatherAutoRefresh(): void {
  if (pollerTimer) {
    clearInterval(pollerTimer);
    pollerTimer = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', pollerTick);
  }
  pollerStarted = false;
}

/** Test helper — reset store + poller + in-flight promise to a clean slate. */
export function __resetWeatherStoreForTests(): void {
  stopWeatherAutoRefresh();
  inFlight = null;
  useWeatherStore.setState({
    data: null,
    loading: false,
    error: null,
    lastFetchedAt: 0,
    coords: null,
  });
}
