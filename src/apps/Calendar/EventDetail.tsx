import { useMemo } from 'react';
import { format, getDay } from 'date-fns';
import { Bell, Repeat2, ChevronRight } from 'lucide-react';
import { useCalendarDataStore } from './calendarDataStore';
import { useCalendarNavStore } from './calendarNavStore';
import { getHolidayEventsForYear } from './calendarUtils';

const WEEKDAY_NAMES = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

export function EventDetail() {
  const events = useCalendarDataStore((s) => s.events);
  const activeEventId = useCalendarNavStore((s) => s.activeEventId);
  const deleteEvent = useCalendarDataStore((s) => s.deleteEvent);
  const pop = useCalendarNavStore((s) => s.pop);

  const isHoliday = activeEventId?.startsWith('holiday-') ?? false;

  const event = useMemo(() => {
    const userEvent = events.find((e) => e.id === activeEventId);
    if (userEvent) return userEvent;
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
        style={{
          color: 'var(--color-secondaryLabel)',
          fontSize: 15,
        }}
      >
        事件未找到
      </div>
    );
  }

  const handleDelete = () => {
    deleteEvent(event.id);
    pop();
  };

  const startDate = new Date(event.startTime);
  const weekday = WEEKDAY_NAMES[getDay(startDate)];

  return (
    <div
      className="flex flex-1 flex-col overflow-auto"
      style={{
        backgroundColor: 'var(--color-systemGroupedBackground)',
        paddingBottom: 80,
      }}
    >
      {/* ── Title card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '16px 16px 0',
          padding: 16,
        }}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-label)',
              letterSpacing: -0.3,
              lineHeight: 1.2,
              wordBreak: 'break-word',
              marginBottom: 6,
            }}
          >
            {event.title}
          </h2>
          <div
            style={{
              fontSize: 14,
              color: 'var(--color-secondaryLabel)',
              lineHeight: 1.5,
            }}
          >
            {event.isAllDay ? (
              <span>{format(event.startTime, 'yyyy年M月d日')} {weekday}</span>
            ) : (
              <>
                <div>
                  {format(event.startTime, 'yyyy年M月d日')} {weekday}
                </div>
                <div>
                  {format(event.startTime, 'HH:mm')} – {format(event.endTime, 'HH:mm')}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Reminder / Repeat card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '10px 16px 0',
          overflow: 'hidden',
        }}
      >
        {/* Reminder row */}
        <div
          className="flex items-center"
          style={{
            padding: '12px 16px',
            minHeight: 44,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: 'var(--color-systemOrange)',
              marginRight: 12,
              flexShrink: 0,
            }}
          >
            <Bell size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 16, color: 'var(--color-label)', flex: 1 }}>
            提醒
          </span>
          <span style={{ fontSize: 15, color: 'var(--color-tertiaryLabel)' }}>
            无
          </span>
          <ChevronRight
            size={14}
            strokeWidth={1.8}
            style={{ color: 'rgba(0,0,0,0.15)', marginLeft: 6 }}
          />
        </div>

        {/* Separator */}
        <div
          style={{
            height: 0.5,
            backgroundColor: 'var(--color-separator)',
            marginLeft: 56,
          }}
        />

        {/* Repeat row */}
        <div
          className="flex items-center"
          style={{
            padding: '12px 16px',
            minHeight: 44,
          }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              backgroundColor: '#8e8e93',
              marginRight: 12,
              flexShrink: 0,
            }}
          >
            <Repeat2 size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{ fontSize: 16, color: 'var(--color-label)', flex: 1 }}>
            重复
          </span>
          <span style={{ fontSize: 15, color: 'var(--color-tertiaryLabel)' }}>
            无
          </span>
          <ChevronRight
            size={14}
            strokeWidth={1.8}
            style={{ color: 'rgba(0,0,0,0.15)', marginLeft: 6 }}
          />
        </div>
      </div>

      {/* ── Notes card ── */}
      {event.notes && (
        <div
          style={{
            backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
            borderRadius: 'var(--radius-group)',
            margin: '10px 16px 0',
            padding: '14px 16px',
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-secondaryLabel)',
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              marginBottom: 6,
            }}
          >
            备注
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-label)',
              opacity: 0.7,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {event.notes}
          </div>
        </div>
      )}

      {/* ── Delete card ── */}
      {!isHoliday && (
        <div
          style={{
            backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
            borderRadius: 'var(--radius-group)',
            margin: '10px 16px 0',
            overflow: 'hidden',
          }}
        >
          <button
            type="button"
            onClick={handleDelete}
            className="w-full"
            style={{
              padding: '13px 16px',
              fontSize: 17,
              color: 'var(--color-systemRed)',
              textAlign: 'center',
            }}
            data-testid="delete-event-btn"
          >
            删除事件
          </button>
        </div>
      )}
    </div>
  );
}
