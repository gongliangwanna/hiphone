import { useMemo, useRef } from 'react';
import { format, isSameDay, isToday, startOfDay, addDays } from 'date-fns';
import { motion } from 'motion/react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useCalendarNavStore } from '@/apps/Calendar/calendarNavStore';
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

  const shellRef = useRef<HTMLDivElement>(null);
  const openApp = useAppRuntimeStore((s) => s.openApp);
  const push = useCalendarNavStore((s) => s.push);

  const handleOpenCalendarApp = () => {
    if (variant === 'drawer') return;
    if (useSpringboardLayoutStore.getState().isEditMode) return;
    const el = shellRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deviceRoot = el.closest('[data-testid="device-root"]') as HTMLElement | null;
    const deviceRect = deviceRoot?.getBoundingClientRect();
    openApp('calendar', {
      x: rect.left - (deviceRect?.left ?? 0),
      y: rect.top - (deviceRect?.top ?? 0),
      width: rect.width,
      height: rect.height,
    });
  };

  const handleEventClick = (eventId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (variant === 'drawer') return;
    if (useSpringboardLayoutStore.getState().isEditMode) return;
    
    // push to event detail and then open app
    push('event-detail', { eventId });
    handleOpenCalendarApp();
  };

  const interactive = variant !== 'drawer' && !useSpringboardLayoutStore.getState().isEditMode;

  return (
    <WidgetShell 
      ref={shellRef} 
      size={size} 
      variant={variant} 
      previewWidth={previewWidth} 
      testId="widget-date"
      onClick={handleOpenCalendarApp}
    >
      <div
        className="flex h-full w-full flex-col"
        style={{
          padding: size === '2x2' ? 14 : 16,
          background: '#ffffff', // Crisp white background for iOS widget
          color: '#1c1c1e',
        }}
      >
        {size === '2x2' && <SmallLayout now={now} events={events} onEventClick={handleEventClick} interactive={interactive} />}
        {size === '4x2' && <MediumLayout now={now} events={events} onEventClick={handleEventClick} interactive={interactive} />}
        {size === '4x4' && <LargeLayout now={now} events={events} onEventClick={handleEventClick} interactive={interactive} />}
      </div>
    </WidgetShell>
  );
}

// ---- Layouts --------------------------------------------------------------

interface LayoutProps {
  now: Date;
  events: CalendarEvent[];
  onEventClick: (id: string, e: React.MouseEvent) => void;
  interactive: boolean;
}

function SmallLayout({ now, events, onEventClick, interactive }: LayoutProps) {
  const todayEvents = useMemo(() => getEventsForDate(events, now), [events, now]);
  const next = todayEvents[0];

  return (
    <div className="flex h-full w-full flex-col">
      <DateHeader now={now} />
      <div className="mt-auto" style={{ minHeight: 28 }}>
        {next ? (
          <NextEventLine 
            event={next} 
            compact 
            onClick={(e) => onEventClick(next.id, e)} 
            interactive={interactive} 
          />
        ) : (
          <div style={{ fontSize: 11, color: '#8e8e93', fontWeight: 500 }}>
            今日无安排
          </div>
        )}
      </div>
    </div>
  );
}

function MediumLayout({ now, events, onEventClick, interactive }: LayoutProps) {
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
            <UpcomingEventRow 
              key={event.id} 
              event={event} 
              now={now} 
              onClick={(e) => onEventClick(event.id, e)} 
              interactive={interactive} 
            />
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

function LargeLayout({ now, events, onEventClick, interactive }: LayoutProps) {
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
              <UpcomingEventRow 
                key={event.id} 
                event={event} 
                now={now} 
                onClick={(e) => onEventClick(event.id, e)} 
                interactive={interactive} 
              />
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

interface NextEventProps {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

function NextEventLine({ event, compact, onClick, interactive }: NextEventProps) {
  const content = (
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

  if (interactive && onClick) {
    return (
      <motion.div
        whileTap={{ scale: 0.96, opacity: 0.7 }}
        onClick={onClick}
        style={{ cursor: 'pointer', margin: '-4px', padding: '4px', borderRadius: '8px' }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

interface EventRowProps {
  event: CalendarEvent;
  now: Date;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

function UpcomingEventRow({ event, now, onClick, interactive }: EventRowProps) {
  const eventDate = new Date(event.startTime);
  const isOnToday = isSameDay(eventDate, now);
  const dayLabel = isOnToday ? '今天' : format(eventDate, 'M月d日');
  
  const content = (
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

  if (interactive && onClick) {
    return (
      <motion.div
        whileTap={{ scale: 0.96, opacity: 0.7 }}
        onClick={onClick}
        style={{ cursor: 'pointer', margin: '-4px', padding: '4px', borderRadius: '8px' }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
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
