import { useMemo, useRef, useCallback } from 'react';
import { format, addMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarDataStore } from './calendarDataStore';
import { useCalendarNavStore } from './calendarNavStore';
import {
  generateMonthGrid,
  isCurrentMonth,
  isSameDay,
  isToday,
  formatEventTime,
  getEventsForDate,
  dateKey,
  getChineseHolidays,
  getHolidayEventsForYear,
  WEEKDAY_HEADERS,
} from './calendarUtils';

const SWIPE_THRESHOLD = 50;

/** Build a map of dateKey → color[] for multi-color dots */
function buildColorDotsMap(
  events: { startTime: number; endTime: number; color: string; isAllDay: boolean }[],
  holidays: Map<string, string>,
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const event of events) {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (current <= endDay) {
      const key = format(current, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(event.color);
      current = new Date(current.getTime() + 86400000);
    }
  }

  // Holiday events get systemRed
  for (const key of holidays.keys()) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add('var(--color-systemRed)');
  }

  const result = new Map<string, string[]>();
  for (const [key, colors] of map) {
    result.set(key, Array.from(colors).slice(0, 3));
  }
  return result;
}

export function MonthView() {
  const events = useCalendarDataStore((s) => s.events);
  const selectedDate = useCalendarDataStore((s) => s.selectedDate);
  const currentMonth = useCalendarDataStore((s) => s.currentMonth);
  const setSelectedDate = useCalendarDataStore((s) => s.setSelectedDate);
  const setCurrentMonth = useCalendarDataStore((s) => s.setCurrentMonth);
  const push = useCalendarNavStore((s) => s.push);

  const grid = useMemo(() => generateMonthGrid(currentMonth), [currentMonth]);

  const holidays = useMemo(() => {
    const year = new Date(currentMonth).getFullYear();
    const map = new Map<string, string>();
    for (const y of [year - 1, year, year + 1]) {
      for (const [k, v] of getChineseHolidays(y)) {
        map.set(k, v);
      }
    }
    return map;
  }, [currentMonth]);

  const colorDots = useMemo(
    () => buildColorDotsMap(events, holidays),
    [events, holidays],
  );

  const allEventsWithHolidays = useMemo(() => {
    const year = new Date(selectedDate).getFullYear();
    return [...events, ...getHolidayEventsForYear(year)];
  }, [events, selectedDate]);

  const dayEvents = useMemo(
    () => getEventsForDate(allEventsWithHolidays, selectedDate),
    [allEventsWithHolidays, selectedDate],
  );

  const touchStartXRef = useRef(0);

  const navigateMonth = useCallback(
    (delta: number) => {
      setCurrentMonth(addMonths(currentMonth, delta).getTime());
    },
    [currentMonth, setCurrentMonth],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]!.clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - touchStartXRef.current;
      if (dx < -SWIPE_THRESHOLD) navigateMonth(1);
      else if (dx > SWIPE_THRESHOLD) navigateMonth(-1);
    },
    [navigateMonth],
  );

  const handleDateTap = (date: Date) => {
    setSelectedDate(date.getTime());
    if (!isCurrentMonth(date, currentMonth)) {
      setCurrentMonth(date.getTime());
    }
  };

  const selectedWeekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][
    getDay(new Date(selectedDate))
  ];
  const isTodaySelected = isToday(new Date(selectedDate));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Month nav arrows ── */}
      <div
        className="flex items-center"
        style={{ padding: '6px 20px 0', gap: 20 }}
      >
        <button
          onClick={() => navigateMonth(-1)}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, color: 'var(--color-tertiaryLabel)' }}
          data-testid="month-prev"
        >
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <button
          onClick={() => navigateMonth(1)}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, color: 'var(--color-tertiaryLabel)' }}
          data-testid="month-next"
        >
          <ChevronRight size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Weekday header ── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '12px 16px 6px',
        }}
      >
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className="text-center"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: i === 0 ? 'rgba(255,59,48,0.35)' : 'var(--color-secondaryLabel)',
              opacity: i === 0 ? 1 : 0.5,
              lineHeight: '18px',
              textTransform: 'uppercase',
              letterSpacing: 0.2,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Separator ── */}
      <div
        style={{
          height: 0.5,
          background: 'var(--color-separator)',
          margin: '0 20px',
        }}
      />

      {/* ── Month grid ── */}
      <div
        style={{ height: 6 * 48, overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            padding: '4px 16px 8px',
          }}
          data-testid="month-grid"
        >
          {grid.map((date) => {
            const isInMonth = isCurrentMonth(date, currentMonth);
            const today = isToday(date);
            const selected = isSameDay(date, selectedDate);
            const key = dateKey(date);
            const dots = colorDots.get(key);
            const isSunday = date.getDay() === 0;

            let numberColor: string;
            if (today) {
              numberColor = '#fff';
            } else if (!isInMonth && isSunday) {
              numberColor = 'rgba(255,59,48,0.12)';
            } else if (!isInMonth) {
              numberColor = 'rgba(0,0,0,0.10)';
            } else if (isSunday) {
              numberColor = 'var(--color-systemRed)';
            } else {
              numberColor = 'var(--color-label)';
            }

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleDateTap(date)}
                className="flex flex-col items-center justify-center"
                style={{ height: 48, position: 'relative' }}
                data-testid={`date-${format(date, 'yyyy-MM-dd')}`}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: today
                      ? 'var(--color-systemRed)'
                      : selected && !today
                        ? 'rgba(0,0,0,0.04)'
                        : 'transparent',
                  }}
                >
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: today ? 600 : selected ? 500 : 400,
                      color: numberColor,
                      letterSpacing: -0.2,
                    }}
                  >
                    {format(date, 'd')}
                  </span>
                </div>

                {/* Holiday "休" label */}
                {holidays.has(key) && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 4,
                      fontSize: 7,
                      fontWeight: 700,
                      color: 'rgba(52,199,89,0.7)',
                      lineHeight: 1,
                    }}
                  >
                    休
                  </span>
                )}

                {/* Multi-color event dots */}
                {dots && !today && (
                  <div
                    className="flex"
                    style={{ gap: 3, height: 4, marginTop: 2 }}
                  >
                    {dots.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          backgroundColor: c,
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lower half: event list ── */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      >
        {/* Date label */}
        <div className="flex items-baseline" style={{ padding: '16px 20px 10px' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-label)',
            }}
          >
            {format(selectedDate, 'M月d日')}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--color-tertiaryLabel)',
              marginLeft: 6,
            }}
          >
            {selectedWeekday}
            {isTodaySelected && ' · 今天'}
          </span>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-auto" style={{ paddingBottom: 80 }}>
          {dayEvents.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{
                height: 80,
                color: 'var(--color-secondaryLabel)',
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              没有事件
            </div>
          ) : (
            dayEvents.map((event, i) => (
              <button
                key={event.id}
                type="button"
                className="flex w-full items-center"
                style={{
                  padding: '0 20px',
                  minHeight: 58,
                  cursor: 'pointer',
                }}
                onClick={() => push('event-detail', { eventId: event.id })}
                data-testid={`event-row-${event.id}`}
              >
                {/* Color bar */}
                <div
                  style={{
                    width: 3,
                    height: 34,
                    borderRadius: 2,
                    backgroundColor: event.color,
                    flexShrink: 0,
                    marginRight: 14,
                  }}
                />
                {/* Body */}
                <div
                  className="flex min-w-0 flex-1 flex-col"
                  style={{
                    padding: '14px 0',
                    borderBottom:
                      i < dayEvents.length - 1
                        ? '0.5px solid rgba(0,0,0,0.06)'
                        : 'none',
                  }}
                >
                  <span
                    className="truncate"
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'var(--color-label)',
                      letterSpacing: -0.1,
                      lineHeight: 1.3,
                    }}
                  >
                    {event.title}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-tertiaryLabel)',
                      marginTop: 2,
                      lineHeight: 1.3,
                    }}
                  >
                    {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
                  </span>
                </div>
                {/* Chevron */}
                <ChevronRight
                  size={14}
                  strokeWidth={1.8}
                  style={{
                    color: 'rgba(0,0,0,0.12)',
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
