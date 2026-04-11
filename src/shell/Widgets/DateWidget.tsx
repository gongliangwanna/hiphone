import { useMemo } from 'react';
import { format, isSameDay, isToday, startOfDay, addDays } from 'date-fns';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { useCalendarDataStore, type CalendarEvent } from '@/apps/Calendar/calendarDataStore';
import {
  generateMonthGrid,
  isCurrentMonth,
  formatEventTime,
  getDatesWithEvents,
  getEventsForDate,
} from '@/apps/Calendar/calendarUtils';

interface DateWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
}

const WEEKDAY_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * iOS Calendar widget — light card with red weekday header, big date number,
 * and live event data sourced from the Calendar app store.
 */
export function DateWidget({ size, variant, previewWidth }: DateWidgetProps) {
  const events = useCalendarDataStore((s) => s.events);
  const now = new Date();

  return (
    <WidgetShell size={size} variant={variant} previewWidth={previewWidth} testId="widget-date">
      <div
        className="flex h-full w-full flex-col"
        style={{
          padding: size === '2x2' ? 14 : 16,
          background: 'linear-gradient(180deg, #ffffff 0%, #f4f4f6 100%)',
          color: '#1c1c1e',
        }}
      >
        {size === '2x2' && <SmallLayout now={now} events={events} />}
        {size === '4x2' && <MediumLayout now={now} events={events} />}
        {size === '4x4' && <LargeLayout now={now} events={events} />}
      </div>
    </WidgetShell>
  );
}

// ---- Layouts --------------------------------------------------------------

function SmallLayout({ now, events }: { now: Date; events: CalendarEvent[] }) {
  const todayEvents = useMemo(() => getEventsForDate(events, now), [events, now]);
  const next = todayEvents[0];

  return (
    <div className="flex h-full w-full flex-col">
      <DateHeader now={now} />
      <div className="mt-auto" style={{ minHeight: 28 }}>
        {next ? (
          <NextEventLine event={next} compact />
        ) : (
          <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500 }}>
            今日无安排
          </div>
        )}
      </div>
    </div>
  );
}

function MediumLayout({ now, events }: { now: Date; events: CalendarEvent[] }) {
  const upcoming = useMemo(() => {
    // 今天 + 未来 2 天的事件，按起始时间排序，最多 3 条
    const today = startOfDay(now).getTime();
    const limit = startOfDay(addDays(now, 3)).getTime();
    return events
      .filter((e) => e.startTime >= today && e.startTime < limit)
      .sort((a, b) => a.startTime - b.startTime)
      .slice(0, 3);
  }, [events, now]);

  return (
    <div className="flex h-full w-full gap-3">
      <div className="flex flex-col" style={{ flex: '0 0 36%' }}>
        <DateHeader now={now} />
      </div>
      <div className="flex flex-1 flex-col justify-center" style={{ gap: 8 }}>
        {upcoming.length > 0 ? (
          upcoming.map((event) => (
            <UpcomingEventRow key={event.id} event={event} now={now} />
          ))
        ) : (
          <div style={{ fontSize: 12, color: '#8e8e93', fontWeight: 500 }}>
            未来三天没有安排
          </div>
        )}
      </div>
    </div>
  );
}

function LargeLayout({ now, events }: { now: Date; events: CalendarEvent[] }) {
  const todayEvents = useMemo(() => getEventsForDate(events, now), [events, now]);
  const datesWithEvents = useMemo(() => getDatesWithEvents(events), [events]);

  return (
    <div className="flex h-full w-full flex-col">
      <DateHeader now={now} compact />
      <div style={{ marginTop: 10, marginBottom: 8 }}>
        <MiniMonthGrid now={now} datesWithEvents={datesWithEvents} />
      </div>
      <div
        style={{
          height: 1,
          background: 'rgba(60, 60, 67, 0.12)',
          marginBottom: 6,
        }}
      />
      <div className="flex flex-1 flex-col" style={{ gap: 4, overflow: 'hidden' }}>
        {todayEvents.length > 0 ? (
          todayEvents
            .slice(0, 3)
            .map((event) => (
              <UpcomingEventRow key={event.id} event={event} now={now} />
            ))
        ) : (
          <div style={{ fontSize: 12, color: '#8e8e93', fontWeight: 500 }}>
            今日无安排
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Subcomponents --------------------------------------------------------

function DateHeader({ now, compact }: { now: Date; compact?: boolean }) {
  const day = now.getDate();
  const weekday = WEEKDAY_FULL[now.getDay()]!;
  return (
    <div>
      <div
        style={{
          fontSize: compact ? 12 : 13,
          fontWeight: 700,
          color: '#ff3b30',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {weekday}
      </div>
      <div
        style={{
          fontSize: compact ? 44 : 52,
          fontWeight: 700,
          lineHeight: 0.95,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          color: '#1c1c1e',
          marginTop: 2,
        }}
      >
        {day}
      </div>
    </div>
  );
}

function NextEventLine({ event, compact }: { event: CalendarEvent; compact?: boolean }) {
  return (
    <div className="flex items-start" style={{ gap: 6 }}>
      <div
        style={{
          width: 3,
          height: compact ? 24 : 28,
          borderRadius: 2,
          background: event.color || '#0a84ff',
          flexShrink: 0,
          marginTop: 1,
        }}
      />
      <div className="min-w-0">
        <div
          className="truncate"
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 600,
            color: '#1c1c1e',
            lineHeight: 1.2,
          }}
        >
          {event.title}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 10,
            color: '#8e8e93',
            marginTop: 1,
          }}
        >
          {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
        </div>
      </div>
    </div>
  );
}

function UpcomingEventRow({ event, now }: { event: CalendarEvent; now: Date }) {
  const eventDate = new Date(event.startTime);
  const isOnToday = isSameDay(eventDate, now);
  const dayLabel = isOnToday ? '今天' : format(eventDate, 'M月d日');
  return (
    <div className="flex items-center" style={{ gap: 8 }}>
      <div
        style={{
          width: 3,
          height: 24,
          borderRadius: 2,
          background: event.color || '#0a84ff',
          flexShrink: 0,
        }}
      />
      <div className="min-w-0 flex-1">
        <div
          className="truncate"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#1c1c1e',
            lineHeight: 1.2,
          }}
        >
          {event.title}
        </div>
        <div
          className="truncate"
          style={{
            fontSize: 10,
            color: '#8e8e93',
            marginTop: 1,
          }}
        >
          {dayLabel} · {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
        </div>
      </div>
    </div>
  );
}

function MiniMonthGrid({
  now,
  datesWithEvents,
}: {
  now: Date;
  datesWithEvents: Set<string>;
}) {
  const grid = useMemo(() => generateMonthGrid(now.getTime()), [now]);
  const headers = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0,
          marginBottom: 4,
        }}
      >
        {headers.map((h, i) => {
          const isWeekend = i === 0 || i === 6;
          return (
            <div
              key={h}
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: isWeekend ? '#ff3b30' : '#8e8e93',
                textAlign: 'center',
                letterSpacing: '0.02em',
              }}
            >
              {h}
            </div>
          );
        })}
      </div>
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0,
          rowGap: 2,
        }}
      >
        {grid.slice(0, 35).map((d, idx) => {
          const inMonth = isCurrentMonth(d, now.getTime());
          const today = isToday(d);
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const hasEvent = datesWithEvents.has(format(d, 'yyyy-MM-dd'));

          return (
            <div
              key={idx}
              className="flex flex-col items-center justify-center"
              style={{ height: 18, position: 'relative' }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: today ? '#ff3b30' : 'transparent',
                  fontSize: 10,
                  fontWeight: today ? 700 : 500,
                  color: today
                    ? '#ffffff'
                    : !inMonth
                      ? 'rgba(60,60,67,0.25)'
                      : isWeekend
                        ? '#ff3b30'
                        : '#1c1c1e',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {d.getDate()}
              </div>
              {hasEvent && !today && (
                <div
                  style={{
                    width: 3,
                    height: 3,
                    borderRadius: 2,
                    background: '#ff3b30',
                    position: 'absolute',
                    bottom: -1,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
