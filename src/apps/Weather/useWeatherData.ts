import { useEffect } from 'react';
import { useWeatherStore, startWeatherAutoRefresh } from './weatherStore';

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
// React hook
//
// Now a thin selector over `useWeatherStore`. Every subscriber shares the
// same state, and the first mount kicks off the background poller (idempotent
// — subsequent mounts are no-ops). See `weatherStore.ts` for the rationale.
// ---------------------------------------------------------------------------

export function useWeatherData(): {
  data: WeatherData | null;
  loading: boolean;
  error: string | null;
} {
  const data = useWeatherStore((s) => s.data);
  const loading = useWeatherStore((s) => s.loading);
  const error = useWeatherStore((s) => s.error);

  useEffect(() => {
    startWeatherAutoRefresh();
  }, []);

  return { data, loading, error };
}
