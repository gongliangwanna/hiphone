import { useMemo, useCallback } from 'react';
import {
  getHours,
  getMinutes,
  setHours,
  setMinutes,
  getYear,
  getMonth,
  getDate,
  setYear,
  setMonth,
  setDate,
  getDaysInMonth,
  startOfDay,
  addDays,
  format,
  getDay,
  isToday,
} from 'date-fns';
import { WheelPicker, type WheelPickerItem } from './WheelPicker';

type DateTimePickerMode = 'date' | 'time' | 'datetime';

interface DateTimePickerProps {
  /** Current date/time value */
  value: Date;
  /** Called when user finishes scrolling to a new value */
  onChange: (date: Date) => void;
  /** Picker mode */
  mode: DateTimePickerMode;
  /** Minutes interval (1, 5, 10, 15, 30). Default 1. */
  minuteInterval?: number;
}

const WEEKDAY_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

// ── Pre-computed item lists ────────────────────────────────────────

function makeHourItems(): WheelPickerItem[] {
  return Array.from({ length: 24 }, (_, i) => ({
    value: String(i),
    label: String(i),
  }));
}

function makeMinuteItems(interval: number): WheelPickerItem[] {
  const items: WheelPickerItem[] = [];
  for (let m = 0; m < 60; m += interval) {
    items.push({ value: String(m), label: String(m).padStart(2, '0') });
  }
  return items;
}

function makeYearItems(center: number): WheelPickerItem[] {
  const items: WheelPickerItem[] = [];
  for (let y = center - 10; y <= center + 10; y++) {
    items.push({ value: String(y), label: `${y}年` });
  }
  return items;
}

function makeMonthItems(): WheelPickerItem[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: String(i),
    label: `${i + 1}月`,
  }));
}

function makeDayItems(daysInMonth: number): WheelPickerItem[] {
  return Array.from({ length: daysInMonth }, (_, i) => ({
    value: String(i + 1),
    label: `${i + 1}日`,
  }));
}

/** Generate date-wheel items: ±180 days around today */
function makeDateItems(): WheelPickerItem[] {
  const base = startOfDay(new Date());
  const items: WheelPickerItem[] = [];
  for (let i = -180; i <= 180; i++) {
    const d = addDays(base, i);
    const key = format(d, 'yyyy-MM-dd');
    const dayLabel = isToday(d)
      ? '今天'
      : `${format(d, 'M月d日')} ${WEEKDAY_ZH[getDay(d)]}`;
    items.push({ value: key, label: dayLabel });
  }
  return items;
}

// Singleton caches (never change)
const HOUR_ITEMS = makeHourItems();
const MONTH_ITEMS = makeMonthItems();

// ── TimePicker ─────────────────────────────────────────────────────

function TimePicker({
  value,
  onChange,
  minuteInterval,
}: {
  value: Date;
  onChange: (d: Date) => void;
  minuteInterval: number;
}) {
  const minuteItems = useMemo(() => makeMinuteItems(minuteInterval), [minuteInterval]);
  const h = String(getHours(value));
  const m = String(Math.floor(getMinutes(value) / minuteInterval) * minuteInterval);

  const onHour = useCallback(
    (v: string) => onChange(setHours(value, Number(v))),
    [value, onChange],
  );
  const onMinute = useCallback(
    (v: string) => onChange(setMinutes(value, Number(v))),
    [value, onChange],
  );

  return (
    <div className="flex items-center justify-center" style={{ gap: 0 }}>
      <div style={{ flex: 1 }}>
        <WheelPicker items={HOUR_ITEMS} value={h} onChange={onHour} />
      </div>
      <span
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--color-label)',
          lineHeight: 1,
          width: 12,
          textAlign: 'center',
        }}
      >
        :
      </span>
      <div style={{ flex: 1 }}>
        <WheelPicker items={minuteItems} value={m} onChange={onMinute} />
      </div>
    </div>
  );
}

// ── DatePicker ─────────────────────────────────────────────────────

function DatePicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const y = getYear(value);
  const mo = getMonth(value);
  const d = getDate(value);

  const yearItems = useMemo(() => makeYearItems(getYear(new Date())), []);
  const dayCount = getDaysInMonth(value);
  const dayItems = useMemo(() => makeDayItems(dayCount), [dayCount]);

  const onYear = useCallback(
    (v: string) => {
      let next = setYear(value, Number(v));
      const maxD = getDaysInMonth(next);
      if (getDate(next) > maxD) next = setDate(next, maxD);
      onChange(next);
    },
    [value, onChange],
  );

  const onMonth = useCallback(
    (v: string) => {
      let next = setMonth(value, Number(v));
      const maxD = getDaysInMonth(next);
      if (getDate(next) > maxD) next = setDate(next, maxD);
      onChange(next);
    },
    [value, onChange],
  );

  const onDay = useCallback(
    (v: string) => onChange(setDate(value, Number(v))),
    [value, onChange],
  );

  return (
    <div className="flex items-center" style={{ gap: 0 }}>
      <div style={{ flex: 1.2 }}>
        <WheelPicker items={yearItems} value={String(y)} onChange={onYear} />
      </div>
      <div style={{ flex: 1 }}>
        <WheelPicker items={MONTH_ITEMS} value={String(mo)} onChange={onMonth} />
      </div>
      <div style={{ flex: 1 }}>
        <WheelPicker items={dayItems} value={String(d)} onChange={onDay} />
      </div>
    </div>
  );
}

// ── DateTimeCombo ──────────────────────────────────────────────────

function DateTimeCombo({
  value,
  onChange,
  minuteInterval,
}: {
  value: Date;
  onChange: (d: Date) => void;
  minuteInterval: number;
}) {
  const dateItems = useMemo(() => makeDateItems(), []);
  const minuteItems = useMemo(() => makeMinuteItems(minuteInterval), [minuteInterval]);
  const dateKey = format(value, 'yyyy-MM-dd');
  const h = String(getHours(value));
  const m = String(Math.floor(getMinutes(value) / minuteInterval) * minuteInterval);

  const onDate = useCallback(
    (v: string) => {
      const [yr, mo, dy] = v.split('-').map(Number) as [number, number, number];
      let next = new Date(value);
      next = setYear(next, yr);
      next = setMonth(next, mo - 1);
      next = setDate(next, dy);
      onChange(next);
    },
    [value, onChange],
  );

  const onHour = useCallback(
    (v: string) => onChange(setHours(value, Number(v))),
    [value, onChange],
  );
  const onMinute = useCallback(
    (v: string) => onChange(setMinutes(value, Number(v))),
    [value, onChange],
  );

  return (
    <div className="flex items-center" style={{ gap: 0 }}>
      <div style={{ flex: 1.6 }}>
        <WheelPicker
          items={dateItems}
          value={dateKey}
          onChange={onDate}
          visibleCount={7}
        />
      </div>
      <div style={{ flex: 0.7 }}>
        <WheelPicker items={HOUR_ITEMS} value={h} onChange={onHour} />
      </div>
      <span
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: 'var(--color-label)',
          width: 10,
          textAlign: 'center',
        }}
      >
        :
      </span>
      <div style={{ flex: 0.7 }}>
        <WheelPicker items={minuteItems} value={m} onChange={onMinute} />
      </div>
    </div>
  );
}

// ── Public API ──────────────────────────────────────────────────────

export function DateTimePicker({
  value,
  onChange,
  mode,
  minuteInterval = 1,
}: DateTimePickerProps) {
  return (
    <div data-testid="datetime-picker">
      {mode === 'time' && (
        <TimePicker value={value} onChange={onChange} minuteInterval={minuteInterval} />
      )}
      {mode === 'date' && <DatePicker value={value} onChange={onChange} />}
      {mode === 'datetime' && (
        <DateTimeCombo
          value={value}
          onChange={onChange}
          minuteInterval={minuteInterval}
        />
      )}
    </div>
  );
}
