import { useMemo, useRef, useCallback } from 'react';
import { format, addMonths } from 'date-fns';
import { useCalendarDataStore } from './calendarDataStore';
import { useCalendarNavStore } from './calendarNavStore';
import {
  generateMonthGrid,
  isCurrentMonth,
  isSameDay,
  isToday,
  formatDateHeader,
  formatEventTime,
  getEventsForDate,
  getDatesWithEvents,
  dateKey,
  getChineseHolidays,
  getHolidayEventsForYear,
  WEEKDAY_HEADERS,
} from './calendarUtils';

/** Swipe threshold to trigger month change */
const SWIPE_THRESHOLD = 50;

export function MonthView() {
  const events = useCalendarDataStore((s) => s.events);
  const selectedDate = useCalendarDataStore((s) => s.selectedDate);
  const currentMonth = useCalendarDataStore((s) => s.currentMonth);
  const setSelectedDate = useCalendarDataStore((s) => s.setSelectedDate);
  const setCurrentMonth = useCalendarDataStore((s) => s.setCurrentMonth);
  const push = useCalendarNavStore((s) => s.push);

  const grid = useMemo(() => generateMonthGrid(currentMonth), [currentMonth]);

  // Holidays for displayed months (cover year boundaries)
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

  const eventDates = useMemo(() => {
    const dates = getDatesWithEvents(events);
    for (const key of holidays.keys()) {
      dates.add(key);
    }
    return dates;
  }, [events, holidays]);

  // Merge user events with holiday events for selected date
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Weekday header */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '6px 12px 4px',
        }}
      >
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className="text-center"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: i === 0 ? 'var(--color-systemRed)' : 'var(--color-secondaryLabel)',
              lineHeight: '18px',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Month grid with touch swipe */}
      <div
        style={{ height: 6 * 44, overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            padding: '0 12px',
          }}
          data-testid="month-grid"
        >
            {grid.map((date) => {
              const isInMonth = isCurrentMonth(date, currentMonth);
              const today = isToday(date);
              const selected = isSameDay(date, selectedDate);
              const hasEvents = eventDates.has(dateKey(date));

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleDateTap(date)}
                  className="flex flex-col items-center justify-center"
                  style={{ height: 44, position: 'relative' }}
                  data-testid={`date-${format(date, 'yyyy-MM-dd')}`}
                >
                  <div
                    className="flex items-center justify-center"
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      backgroundColor: today
                        ? 'var(--color-systemRed)'
                        : selected
                          ? 'var(--color-tertiarySystemFill)'
                          : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 16,
                        fontWeight: today || selected ? 600 : 400,
                        color: today
                          ? '#fff'
                          : isInMonth
                            ? 'var(--color-label)'
                            : 'var(--color-quaternaryLabel)',
                      }}
                    >
                      {format(date, 'd')}
                    </span>
                  </div>
                  {/* Holiday "休" label */}
                  {holidays.has(dateKey(date)) && (
                    <span
                      style={{
                        position: 'absolute',
                        top: 1,
                        right: 0,
                        fontSize: 8,
                        fontWeight: 700,
                        color: 'var(--color-systemGreen)',
                        lineHeight: 1,
                      }}
                    >
                      休
                    </span>
                  )}
                  {/* Event dot — hidden for today */}
                  {hasEvents && !today && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-systemRed)',
                        position: 'absolute',
                        bottom: 3,
                      }}
                    />
                  )}
                </button>
              );
            })}
        </div>
      </div>

      {/* Month nav arrows */}
      <div
        className="flex items-center justify-between"
        style={{
          padding: '6px 12px 2px',
          borderTop: '0.5px solid var(--color-separator)',
        }}
      >
        <button
          onClick={() => navigateMonth(-1)}
          className="flex items-center justify-center"
          style={{
            width: 44,
            height: 32,
            color: 'var(--color-systemRed)',
          }}
          data-testid="month-prev"
        >
          <ChevronLeftIcon />
          <span style={{ fontSize: 13, marginLeft: 2 }}>
            {format(addMonths(currentMonth, -1), 'M月')}
          </span>
        </button>

        <span
          style={{
            fontSize: 'var(--font-size-subhead)',
            fontWeight: 600,
            color: 'var(--color-label)',
          }}
        >
          {formatDateHeader(selectedDate)}
        </span>

        <button
          onClick={() => navigateMonth(1)}
          className="flex items-center justify-center"
          style={{
            width: 44,
            height: 32,
            color: 'var(--color-systemRed)',
          }}
          data-testid="month-next"
        >
          <span style={{ fontSize: 13, marginRight: 2 }}>
            {format(addMonths(currentMonth, 1), 'M月')}
          </span>
          <ChevronRightIcon />
        </button>
      </div>

      {/* Event list for selected date */}
      <div className="flex-1 overflow-auto" style={{ padding: '8px 16px 20px' }}>
        {dayEvents.length === 0 ? (
          <div
            className="flex items-center justify-center"
            style={{
              height: 80,
              color: 'var(--color-secondaryLabel)',
              fontSize: 'var(--font-size-footnote)',
            }}
          >
            没有日程
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 8 }}>
            {dayEvents.map((event) => (
              <button
                key={event.id}
                type="button"
                className="flex w-full items-start text-left"
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  backgroundColor: 'var(--color-tertiarySystemBackground)',
                }}
                onClick={() => push('event-detail', { eventId: event.id })}
                data-testid={`event-row-${event.id}`}
              >
                <div
                  style={{
                    width: 4,
                    alignSelf: 'stretch',
                    borderRadius: 2,
                    backgroundColor: event.color,
                    marginRight: 10,
                    flexShrink: 0,
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="truncate"
                    style={{
                      fontSize: 'var(--font-size-subhead)',
                      fontWeight: 600,
                      color: 'var(--color-label)',
                      lineHeight: 1.3,
                    }}
                  >
                    {event.title}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-caption1)',
                      color: 'var(--color-secondaryLabel)',
                      marginTop: 2,
                    }}
                  >
                    {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
                  </span>
                </div>
                <ChevronRightSmallIcon />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** SF Symbol: chevron.left */
function ChevronLeftIcon() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path
        d="M6 1L1 6l5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SF Symbol: chevron.right */
function ChevronRightIcon() {
  return (
    <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
      <path
        d="M1 1l5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Small chevron for event row disclosure */
function ChevronRightSmallIcon() {
  return (
    <svg
      width="7"
      height="12"
      viewBox="0 0 7 12"
      fill="none"
      style={{ alignSelf: 'center', marginLeft: 4, flexShrink: 0 }}
    >
      <path
        d="M1 1l5 5-5 5"
        stroke="var(--color-tertiaryLabel)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
