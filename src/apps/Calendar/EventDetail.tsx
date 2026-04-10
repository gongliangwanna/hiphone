import { useMemo } from 'react';
import { format } from 'date-fns';
import { useCalendarDataStore } from './calendarDataStore';
import { useCalendarNavStore } from './calendarNavStore';
import { getHolidayEventsForYear } from './calendarUtils';

export function EventDetail() {
  const events = useCalendarDataStore((s) => s.events);
  const activeEventId = useCalendarNavStore((s) => s.activeEventId);
  const deleteEvent = useCalendarDataStore((s) => s.deleteEvent);
  const pop = useCalendarNavStore((s) => s.pop);

  const isHoliday = activeEventId?.startsWith('holiday-') ?? false;

  const event = useMemo(() => {
    const userEvent = events.find((e) => e.id === activeEventId);
    if (userEvent) return userEvent;
    // Look up holiday events by extracting year from ID: "holiday-2026-01-01"
    const match = activeEventId?.match(/^holiday-(\d{4})/);
    if (match) {
      const year = Number(match[1]);
      return getHolidayEventsForYear(year).find((e) => e.id === activeEventId);
    }
    return undefined;
  }, [events, activeEventId]);

  if (!event) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{ color: 'var(--color-secondaryLabel)', fontSize: 'var(--font-size-footnote)' }}
      >
        日程未找到
      </div>
    );
  }

  const handleDelete = () => {
    deleteEvent(event.id);
    pop();
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto" style={{ padding: '0 16px 24px' }}>
      {/* Event header card */}
      <div
        style={{
          marginTop: 12,
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
          padding: '16px',
          marginBottom: 12,
        }}
      >
        <div className="flex items-start gap-3">
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 4,
              backgroundColor: event.color,
              flexShrink: 0,
              marginTop: 4,
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--font-size-title3)',
                fontWeight: 600,
                color: 'var(--color-label)',
                lineHeight: 1.25,
                wordBreak: 'break-word',
              }}
            >
              {event.title}
            </h2>
          </div>
        </div>
      </div>

      {/* Time section */}
      <div
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
          marginBottom: 12,
        }}
      >
        {event.isAllDay ? (
          <div
            className="flex items-center justify-between"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
              padding: '12px 16px',
            }}
          >
            <span>全天</span>
            <span style={{ color: 'var(--color-secondaryLabel)' }}>
              {format(event.startTime, 'yyyy年M月d日')}
            </span>
          </div>
        ) : (
          <>
            <div
              className="flex items-center justify-between"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                padding: '12px 16px',
                borderBottom: '0.5px solid var(--color-separator)',
              }}
            >
              <span>开始</span>
              <span style={{ color: 'var(--color-secondaryLabel)' }}>
                {format(event.startTime, 'yyyy年M月d日  HH:mm')}
              </span>
            </div>
            <div
              className="flex items-center justify-between"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                padding: '12px 16px',
              }}
            >
              <span>结束</span>
              <span style={{ color: 'var(--color-secondaryLabel)' }}>
                {format(event.endTime, 'yyyy年M月d日  HH:mm')}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Notes section */}
      {event.notes && (
        <div
          style={{
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
            padding: '12px 16px',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}
          >
            {event.notes}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />

      {/* Delete button — hidden for holiday events */}
      {!isHoliday && (
        <button
          type="button"
          onClick={handleDelete}
          style={{
            padding: '14px 0',
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-systemRed)',
            textAlign: 'center',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            borderRadius: 'var(--radius-group)',
          }}
          data-testid="delete-event-btn"
        >
          删除日程
        </button>
      )}
    </div>
  );
}
