import {
  startOfMonth,
  startOfWeek,
  addDays,
  startOfDay,
  endOfDay,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  getDay,
} from 'date-fns';

import type { CalendarEvent } from './calendarDataStore';

/** Chinese weekday headers, Sunday-first */
export const WEEKDAY_HEADERS = ['日', '一', '二', '三', '四', '五', '六'] as const;

/** Chinese weekday names for date display */
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

/** Preset event colors using CSS variables */
export const EVENT_COLORS = [
  'var(--color-systemBlue)',
  'var(--color-systemRed)',
  'var(--color-systemOrange)',
  'var(--color-systemPurple)',
  'var(--color-systemGreen)',
  'var(--color-systemTeal)',
  'var(--color-systemPink)',
] as const;

/**
 * Generate 42-cell month grid (6 rows x 7 cols, Sunday-first).
 * Includes overflow dates from previous/next month.
 */
export function generateMonthGrid(monthTimestamp: number): Date[] {
  const firstOfMonth = startOfMonth(monthTimestamp);
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 0 });
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

/** Check if a date belongs to the given month */
export function isCurrentMonth(date: Date, monthTimestamp: number): boolean {
  return isSameMonth(date, monthTimestamp);
}

export { isSameDay, isToday };

/** Format month title: "2026年4月" */
export function formatMonthTitle(date: Date | number): string {
  return format(date, 'yyyy年M月');
}

/** Format selected date header: "4月10日 周五" */
export function formatDateHeader(date: Date | number): string {
  const d = new Date(date);
  return `${format(d, 'M月d日')} ${WEEKDAY_NAMES[getDay(d)]}`;
}

/** Format event time range: "10:00 - 11:00" or "全天" */
export function formatEventTime(
  startTime: number,
  endTime: number,
  isAllDay: boolean,
): string {
  if (isAllDay) return '全天';
  return `${format(startTime, 'HH:mm')} - ${format(endTime, 'HH:mm')}`;
}

/**
 * Get events for a specific date, sorted: all-day first, then by startTime.
 */
export function getEventsForDate(
  events: CalendarEvent[],
  date: Date | number,
): CalendarEvent[] {
  const dayStart = startOfDay(date).getTime();
  const dayEnd = endOfDay(date).getTime();
  return events
    .filter((e) => e.startTime < dayEnd && e.endTime > dayStart)
    .sort((a, b) => {
      if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
      return a.startTime - b.startTime;
    });
}

/**
 * Build a Set of 'yyyy-MM-dd' date keys that have at least one event.
 */
export function getDatesWithEvents(events: CalendarEvent[]): Set<string> {
  const keys = new Set<string>();
  for (const event of events) {
    let current = startOfDay(event.startTime);
    const end = startOfDay(event.endTime);
    while (current <= end) {
      keys.add(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
  }
  return keys;
}

/** Round a date to the nearest 15-minute boundary (ceil) */
export function roundToQuarterHour(date: Date): Date {
  const ms = date.getTime();
  const quarter = 15 * 60 * 1000;
  return new Date(Math.ceil(ms / quarter) * quarter);
}

/** Get a date key string for comparison */
export function dateKey(date: Date | number): string {
  return format(date, 'yyyy-MM-dd');
}

// ── 中国法定节假日 ──────────────────────────────────────

/** Holiday ranges: [startMMDD, endMMDD, name] */
const CHINESE_HOLIDAYS_DATA: Record<number, [string, string, string][]> = {
  2025: [
    ['01-01', '01-01', '元旦'],
    ['01-28', '02-04', '春节'],
    ['04-04', '04-06', '清明节'],
    ['05-01', '05-05', '劳动节'],
    ['05-31', '06-02', '端午节'],
    ['10-01', '10-08', '国庆中秋'],
  ],
  2026: [
    ['01-01', '01-03', '元旦'],
    ['02-15', '02-21', '春节'],
    ['04-04', '04-06', '清明节'],
    ['05-01', '05-05', '劳动节'],
    ['06-19', '06-21', '端午节'],
    ['09-25', '09-27', '中秋节'],
    ['10-01', '10-07', '国庆节'],
  ],
  2027: [
    ['01-01', '01-03', '元旦'],
    ['02-06', '02-12', '春节'],
    ['04-04', '04-06', '清明节'],
    ['05-01', '05-03', '劳动节'],
    ['06-09', '06-11', '端午节'],
    ['09-15', '09-17', '中秋节'],
    ['10-01', '10-07', '国庆节'],
  ],
};

/** Expand a date range to individual date keys */
function expandDateRange(year: number, startMMDD: string, endMMDD: string): string[] {
  const start = new Date(`${year}-${startMMDD}T00:00:00`);
  const end = new Date(`${year}-${endMMDD}T00:00:00`);
  const keys: string[] = [];
  let current = start;
  while (current <= end) {
    keys.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }
  return keys;
}

/** Chinese public holiday rest days for a year. Returns Map<'yyyy-MM-dd', holidayName> */
export function getChineseHolidays(year: number): Map<string, string> {
  const holidays = new Map<string, string>();
  const data = CHINESE_HOLIDAYS_DATA[year];
  if (!data) return holidays;
  for (const [startMMDD, endMMDD, name] of data) {
    for (const key of expandDateRange(year, startMMDD, endMMDD)) {
      holidays.set(key, name);
    }
  }
  return holidays;
}

/** Generate holiday CalendarEvents for a given year */
export function getHolidayEventsForYear(year: number): CalendarEvent[] {
  const data = CHINESE_HOLIDAYS_DATA[year];
  if (!data) return [];
  return data.map(([startMMDD, endMMDD, name]) => {
    const startDate = new Date(`${year}-${startMMDD}T00:00:00`);
    const endDate = new Date(`${year}-${endMMDD}T23:59:59`);
    return {
      id: `holiday-${year}-${startMMDD}`,
      title: name,
      isAllDay: true,
      startTime: startOfDay(startDate).getTime(),
      endTime: endOfDay(endDate).getTime(),
      notes: '',
      color: 'var(--color-systemRed)',
      createdAt: 0,
      updatedAt: 0,
    };
  });
}
