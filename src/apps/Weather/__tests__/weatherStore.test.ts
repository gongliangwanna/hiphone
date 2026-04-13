import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  useWeatherStore,
  refreshWeather,
  __resetWeatherStoreForTests,
} from '../weatherStore';

// Minimal fake open-meteo response — just enough fields for the fetcher to
// map into our WeatherData shape without blowing up.
function makeFakeOpenMeteoResponse() {
  return {
    current: {
      temperature_2m: 18,
      relative_humidity_2m: 55,
      apparent_temperature: 17,
      weather_code: 1,
      wind_speed_10m: 5,
      wind_direction_10m: 180,
      wind_gusts_10m: 8,
      surface_pressure: 1013,
      is_day: 1,
    },
    hourly: {
      time: ['2026-04-11T10:00', '2026-04-11T11:00', '2026-04-11T12:00'],
      temperature_2m: [18, 19, 20],
      weather_code: [1, 1, 2],
      precipitation_probability: [0, 0, 10],
      is_day: [1, 1, 1],
      dew_point_2m: [8, 8, 9],
      visibility: [10000, 10000, 10000],
      uv_index: [3, 4, 5],
    },
    daily: {
      time: ['2026-04-11'],
      weather_code: [1],
      temperature_2m_max: [22],
      temperature_2m_min: [12],
      sunrise: ['2026-04-11T05:45'],
      sunset: ['2026-04-11T18:30'],
      uv_index_max: [6],
      precipitation_probability_max: [10],
    },
  };
}

function makeFetchSpy(
  responseBody: unknown,
  options: { delayMs?: number; locationName?: string } = {},
) {
  return vi.fn((url: string) => {
    const isNominatim = url.includes('nominatim');
    const body = isNominatim
      ? { address: { city: options.locationName ?? '北京' } }
      : responseBody;

    return new Promise<Response>((resolve) => {
      const doResolve = () =>
        resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(body),
        } as Response);
      if (options.delayMs != null) {
        setTimeout(doResolve, options.delayMs);
      } else {
        doResolve();
      }
    });
  });
}

describe('weatherStore', () => {
  beforeEach(() => {
    __resetWeatherStoreForTests();
    localStorage.clear();
    // Skip real geolocation — the store will fall back to Beijing coords
    // when navigator.geolocation is undefined.
    // @ts-expect-error — deliberately nuking the API for this test suite.
    globalThis.navigator.geolocation = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refreshWeather() populates data and flips loading to false', async () => {
    const spy = makeFetchSpy(makeFakeOpenMeteoResponse());
    vi.stubGlobal('fetch', spy);

    await refreshWeather({ force: true });

    const state = useWeatherStore.getState();
    expect(state.loading).toBe(false);
    expect(state.data).not.toBeNull();
    expect(state.data!.current.temperature).toBe(18);
    expect(state.data!.current.weatherCode).toBe(1);
    expect(state.data!.daily[0]!.tempMax).toBe(22);
    expect(state.error).toBeNull();
    expect(state.lastFetchedAt).toBeGreaterThan(0);
  });

  it('concurrent refresh() calls share a single in-flight fetch', async () => {
    // Delay the fetch response long enough for two overlapping refreshes to
    // land on the same in-flight promise.
    const spy = makeFetchSpy(makeFakeOpenMeteoResponse(), { delayMs: 20 });
    vi.stubGlobal('fetch', spy);

    const p1 = refreshWeather({ force: true });
    const p2 = refreshWeather({ force: true });
    await Promise.all([p1, p2]);

    // Open-Meteo + nominatim = 2 network calls per *real* refresh.
    // Two concurrent refreshes would fire 4 times; merged = 2.
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('respects the 15-minute cache unless force=true', async () => {
    const spy = makeFetchSpy(makeFakeOpenMeteoResponse());
    vi.stubGlobal('fetch', spy);

    await refreshWeather({ force: true });
    expect(spy.mock.calls.length).toBeGreaterThan(0);
    const callCountAfterFirst = spy.mock.calls.length;

    // Non-forced refresh within TTL → no-op.
    await refreshWeather();
    expect(spy.mock.calls.length).toBe(callCountAfterFirst);

    // Force=true → refetches.
    await refreshWeather({ force: true });
    expect(spy.mock.calls.length).toBeGreaterThan(callCountAfterFirst);
  });

  it('on fetch failure with no prior data, sets error', async () => {
    const spy = vi.fn(() => Promise.reject(new Error('Network down')));
    vi.stubGlobal('fetch', spy);

    await refreshWeather({ force: true });

    const state = useWeatherStore.getState();
    expect(state.loading).toBe(false);
    expect(state.data).toBeNull();
    expect(state.error).toBe('Network down');
  });

  it('on fetch failure with existing data, keeps stale data and clears error', async () => {
    // First successful fetch.
    vi.stubGlobal('fetch', makeFetchSpy(makeFakeOpenMeteoResponse()));
    await refreshWeather({ force: true });
    const firstData = useWeatherStore.getState().data;
    expect(firstData).not.toBeNull();

    // Second fetch fails.
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('blip'))));
    await refreshWeather({ force: true });

    const state = useWeatherStore.getState();
    expect(state.data).toBe(firstData); // still the last-known-good snapshot
    expect(state.error).toBeNull();      // no user-facing error
    expect(state.loading).toBe(false);
  });

  it('persists data to localStorage on successful refresh', async () => {
    vi.stubGlobal('fetch', makeFetchSpy(makeFakeOpenMeteoResponse()));
    await refreshWeather({ force: true });

    const raw = localStorage.getItem('hiphone-weather-cache');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.data.current.temperature).toBe(18);
    expect(parsed.timestamp).toBeGreaterThan(0);
  });
});
