/**
 * Build a device context string for injection into the AI prompt.
 *
 * Provides environmental context (time of day, weather) so the character
 * can naturally reference real-world conditions — e.g. "外面下雨了记得带伞".
 *
 * See docs/plan/2026-04-12-1630-m2-liveness.md
 */

import { useWeatherStore } from '@/apps/Weather/weatherStore';
import { getCondition } from '@/apps/Weather/weatherConfig';

// ---------------------------------------------------------------------------
// Time-of-day helper
// ---------------------------------------------------------------------------

function getTimeOfDay(hour: number): string {
  if (hour < 6) return '深夜';
  if (hour < 9) return '早上';
  if (hour < 12) return '上午';
  if (hour < 14) return '中午';
  if (hour < 18) return '下午';
  if (hour < 20) return '傍晚';
  return '晚上';
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Build a `[环境]` block from live stores.
 * Includes time of day and weather — natural conversation topics for a companion.
 */
export function buildDeviceContext(): string {
  const lines: string[] = [];

  const hour = new Date().getHours();
  lines.push(`时段：${getTimeOfDay(hour)}`);

  // Weather
  const weather = useWeatherStore.getState().data;
  if (weather) {
    const { temperature, weatherCode } = weather.current;
    const label = getCondition(weatherCode).label;
    lines.push(`当前天气：${temperature}° ${label}（${weather.location}）`);
  }

  return `[环境]\n${lines.join('\n')}`;
}
