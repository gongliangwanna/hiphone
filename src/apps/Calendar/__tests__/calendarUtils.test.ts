import { describe, it, expect } from 'vitest';
import {
  generateMonthGrid,
  isCurrentMonth,
  formatMonthTitle,
  formatDateHeader,
  formatEventTime,
  getEventsForDate,
  getDatesWithEvents,
  roundToQuarterHour,
  dateKey,
} from '../calendarUtils';
import type { CalendarEvent } from '../calendarDataStore';

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'e1',
    title: 'Test',
    isAllDay: false,
    startTime: new Date('2026-04-10T10:00:00').getTime(),
    endTime: new Date('2026-04-10T11:00:00').getTime(),
    notes: '',
    color: 'var(--color-systemBlue)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('generateMonthGrid', () => {
  it('returns 42 dates', () => {
    const grid = generateMonthGrid(new Date('2026-04-01').getTime());
    expect(grid).toHaveLength(42);
  });

  it('starts on Sunday', () => {
    const grid = generateMonthGrid(new Date('2026-04-01').getTime());
    expect(grid[0]!.getDay()).toBe(0); // Sunday
  });

  it('includes dates from previous and next month', () => {
    // April 2026 starts on Wednesday
    const grid = generateMonthGrid(new Date('2026-04-01').getTime());
    // First few days should be from March
    expect(grid[0]!.getMonth()).toBe(2); // March = 2
    // Last days should be from May
    expect(grid[41]!.getMonth()).toBe(4); // May = 4
  });

  it('handles month starting on Sunday', () => {
    // March 2026 starts on Sunday
    const grid = generateMonthGrid(new Date('2026-03-01').getTime());
    expect(grid[0]!.getDate()).toBe(1);
    expect(grid[0]!.getMonth()).toBe(2);
  });
});

describe('isCurrentMonth', () => {
  it('returns true for dates in the same month', () => {
    const date = new Date('2026-04-15');
    expect(isCurrentMonth(date, new Date('2026-04-01').getTime())).toBe(true);
  });

  it('returns false for dates in different months', () => {
    const date = new Date('2026-03-31');
    expect(isCurrentMonth(date, new Date('2026-04-01').getTime())).toBe(false);
  });
});

describe('formatMonthTitle', () => {
  it('formats as yyyy年M月', () => {
    expect(formatMonthTitle(new Date('2026-04-01'))).toBe('2026年4月');
    expect(formatMonthTitle(new Date('2026-12-15'))).toBe('2026年12月');
  });
});

describe('formatDateHeader', () => {
  it('formats with weekday', () => {
    const result = formatDateHeader(new Date('2026-04-10'));
    expect(result).toBe('4月10日 周五');
  });
});

describe('formatEventTime', () => {
  it('returns "全天" for all-day events', () => {
    expect(formatEventTime(0, 0, true)).toBe('全天');
  });

  it('formats time range for timed events', () => {
    const start = new Date('2026-04-10T10:00:00').getTime();
    const end = new Date('2026-04-10T11:30:00').getTime();
    expect(formatEventTime(start, end, false)).toBe('10:00 - 11:30');
  });
});

describe('getEventsForDate', () => {
  it('returns events on the given date', () => {
    const event = makeEvent();
    const result = getEventsForDate([event], new Date('2026-04-10'));
    expect(result).toHaveLength(1);
  });

  it('excludes events on other dates', () => {
    const event = makeEvent();
    const result = getEventsForDate([event], new Date('2026-04-11'));
    expect(result).toHaveLength(0);
  });

  it('includes events spanning midnight', () => {
    const event = makeEvent({
      startTime: new Date('2026-04-10T23:00:00').getTime(),
      endTime: new Date('2026-04-11T01:00:00').getTime(),
    });
    expect(getEventsForDate([event], new Date('2026-04-10'))).toHaveLength(1);
    expect(getEventsForDate([event], new Date('2026-04-11'))).toHaveLength(1);
  });

  it('sorts all-day events first, then by start time', () => {
    const allDay = makeEvent({ id: 'ad', isAllDay: true, startTime: new Date('2026-04-10T00:00:00').getTime(), endTime: new Date('2026-04-11T00:00:00').getTime() });
    const early = makeEvent({ id: 'early', startTime: new Date('2026-04-10T08:00:00').getTime(), endTime: new Date('2026-04-10T09:00:00').getTime() });
    const late = makeEvent({ id: 'late', startTime: new Date('2026-04-10T14:00:00').getTime(), endTime: new Date('2026-04-10T15:00:00').getTime() });
    const result = getEventsForDate([late, early, allDay], new Date('2026-04-10'));
    expect(result.map((e) => e.id)).toEqual(['ad', 'early', 'late']);
  });
});

describe('getDatesWithEvents', () => {
  it('returns date keys for single-day event', () => {
    const event = makeEvent();
    const keys = getDatesWithEvents([event]);
    expect(keys.has('2026-04-10')).toBe(true);
    expect(keys.size).toBe(1);
  });

  it('returns multiple keys for multi-day event', () => {
    const event = makeEvent({
      startTime: new Date('2026-04-10T10:00:00').getTime(),
      endTime: new Date('2026-04-12T10:00:00').getTime(),
    });
    const keys = getDatesWithEvents([event]);
    expect(keys.has('2026-04-10')).toBe(true);
    expect(keys.has('2026-04-11')).toBe(true);
    expect(keys.has('2026-04-12')).toBe(true);
  });
});

describe('roundToQuarterHour', () => {
  it('rounds up to next quarter', () => {
    const d = new Date('2026-04-10T10:07:00');
    const result = roundToQuarterHour(d);
    expect(result.getMinutes()).toBe(15);
  });

  it('keeps exact quarter unchanged', () => {
    const d = new Date('2026-04-10T10:30:00');
    const result = roundToQuarterHour(d);
    expect(result.getMinutes()).toBe(30);
  });
});

describe('dateKey', () => {
  it('formats as yyyy-MM-dd', () => {
    expect(dateKey(new Date('2026-04-10'))).toBe('2026-04-10');
  });
});
