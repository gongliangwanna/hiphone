import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, addHours, startOfDay, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useCalendarDataStore } from './calendarDataStore';
import { useCalendarNavStore } from './calendarNavStore';
import { roundToQuarterHour, EVENT_COLORS } from './calendarUtils';
import { DateTimePicker } from '@/system';

type OpenPicker = 'none' | 'start' | 'end';

export function EventForm() {
  const events = useCalendarDataStore((s) => s.events);
  const selectedDate = useCalendarDataStore((s) => s.selectedDate);
  const addEvent = useCalendarDataStore((s) => s.addEvent);
  const updateEvent = useCalendarDataStore((s) => s.updateEvent);
  const editingEventId = useCalendarNavStore((s) => s.editingEventId);
  const pop = useCalendarNavStore((s) => s.pop);

  const existing = useMemo(
    () => (editingEventId ? events.find((e) => e.id === editingEventId) : null),
    [events, editingEventId],
  );

  const defaultStart = useMemo(() => {
    if (existing) return existing.startTime;
    const now = new Date();
    const base = roundToQuarterHour(now);
    const selected = startOfDay(selectedDate);
    const today = startOfDay(now);
    if (selected.getTime() !== today.getTime()) {
      return new Date(selected.getTime() + (base.getTime() - today.getTime())).getTime();
    }
    return base.getTime();
  }, [existing, selectedDate]);

  const defaultEnd = useMemo(
    () => (existing ? existing.endTime : addHours(defaultStart, 1).getTime()),
    [existing, defaultStart],
  );

  const [title, setTitle] = useState(existing?.title ?? '');
  const [isAllDay, setIsAllDay] = useState(existing?.isAllDay ?? false);
  const [startTime, setStartTime] = useState(defaultStart);
  const [endTime, setEndTime] = useState(defaultEnd);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [color, setColor] = useState(existing?.color ?? EVENT_COLORS[0]);
  const [openPicker, setOpenPicker] = useState<OpenPicker>('none');

  // Delay focus to avoid animation stutter during slide-in
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const canSave = title.trim().length > 0 && (isAllDay || endTime > startTime);

  const togglePicker = (which: 'start' | 'end') => {
    setOpenPicker((prev) => (prev === which ? 'none' : which));
  };

  const handleStartChange = useCallback(
    (d: Date) => {
      const ts = d.getTime();
      setStartTime(ts);
      if (ts >= endTime) setEndTime(addHours(ts, 1).getTime());
    },
    [endTime],
  );

  const handleEndChange = useCallback((d: Date) => {
    setEndTime(d.getTime());
  }, []);

  const handleSave = useCallback(() => {
    if (!canSave) return;
    const payload = {
      title: title.trim(),
      isAllDay,
      startTime: isAllDay ? startOfDay(startTime).getTime() : startTime,
      endTime: isAllDay ? addDays(startOfDay(endTime), 1).getTime() : endTime,
      notes: notes.trim(),
      color,
    };
    if (editingEventId) {
      updateEvent(editingEventId, payload);
    } else {
      addEvent(payload);
    }
    pop();
  }, [canSave, title, isAllDay, startTime, endTime, notes, color, editingEventId, addEvent, updateEvent, pop]);

  const pickerMode = isAllDay ? 'date' : 'datetime';

  return (
    <div className="flex flex-1 flex-col overflow-auto" style={{ padding: '0 16px 24px' }}>
      {/* Title input */}
      <div
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
          padding: '0 16px',
          marginTop: 12,
          marginBottom: 12,
        }}
      >
        <input
          type="text"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-label)',
            padding: '14px 0',
          }}
          data-testid="event-title-input"
          ref={titleRef}
        />
      </div>

      {/* All-day toggle + time pickers group */}
      <div
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
          marginBottom: 12,
          overflow: 'hidden',
        }}
      >
        {/* All-day toggle row */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--color-separator)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
            全天
          </span>
          <button
            type="button"
            onClick={() => {
              setIsAllDay(!isAllDay);
              setOpenPicker('none');
            }}
            style={{
              width: 51,
              height: 31,
              borderRadius: 16,
              backgroundColor: isAllDay ? 'var(--color-systemGreen)' : 'var(--color-systemFill)',
              position: 'relative',
              transition: 'background-color 0.2s',
              flexShrink: 0,
            }}
            data-testid="all-day-toggle"
          >
            <div
              style={{
                width: 27,
                height: 27,
                borderRadius: '50%',
                backgroundColor: '#fff',
                position: 'absolute',
                top: 2,
                left: isAllDay ? 22 : 2,
                transition: 'left 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            />
          </button>
        </div>

        {/* Start time row */}
        <button
          type="button"
          className="flex w-full items-center justify-between"
          style={{
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--color-separator)',
          }}
          onClick={() => togglePicker('start')}
          data-testid="start-time-row"
        >
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
            开始
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-subhead)',
              color: openPicker === 'start' ? 'var(--color-systemRed)' : 'var(--color-label)',
              backgroundColor:
                openPicker === 'start' ? 'rgba(255,59,48,0.12)' : 'var(--color-tertiarySystemFill)',
              padding: '4px 10px',
              borderRadius: 6,
              transition: 'color 0.15s, background-color 0.15s',
            }}
          >
            {isAllDay
              ? format(startTime, 'yyyy年M月d日')
              : format(startTime, 'M月d日  HH:mm')}
          </span>
        </button>

        {/* Inline start picker */}
        <AnimatePresence>
          {openPicker === 'start' && (
            <motion.div
              key="start-picker"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              style={{
                overflow: 'hidden',
                borderBottom: '0.5px solid var(--color-separator)',
              }}
            >
              <div style={{ padding: '4px 0' }}>
                <DateTimePicker
                  value={new Date(startTime)}
                  onChange={handleStartChange}
                  mode={pickerMode}
                  minuteInterval={5}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* End time row */}
        <button
          type="button"
          className="flex w-full items-center justify-between"
          style={{ padding: '10px 16px' }}
          onClick={() => togglePicker('end')}
          data-testid="end-time-row"
        >
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
            结束
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-subhead)',
              color: openPicker === 'end' ? 'var(--color-systemRed)' : 'var(--color-label)',
              backgroundColor:
                openPicker === 'end' ? 'rgba(255,59,48,0.12)' : 'var(--color-tertiarySystemFill)',
              padding: '4px 10px',
              borderRadius: 6,
              transition: 'color 0.15s, background-color 0.15s',
            }}
          >
            {isAllDay
              ? format(endTime, 'yyyy年M月d日')
              : format(endTime, 'M月d日  HH:mm')}
          </span>
        </button>

        {/* Inline end picker */}
        <AnimatePresence>
          {openPicker === 'end' && (
            <motion.div
              key="end-picker"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '4px 0' }}>
                <DateTimePicker
                  value={new Date(endTime)}
                  onChange={handleEndChange}
                  mode={pickerMode}
                  minuteInterval={5}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notes */}
      <div
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
          padding: '12px 16px',
          marginBottom: 12,
        }}
      >
        <textarea
          placeholder="备注"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-label)',
            minHeight: 72,
            resize: 'none',
            lineHeight: 1.5,
          }}
          data-testid="event-notes-input"
        />
      </div>

      {/* Color picker */}
      <div
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
          padding: '12px 16px',
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 'var(--font-size-caption1)',
            color: 'var(--color-secondaryLabel)',
            marginBottom: 10,
            fontWeight: 500,
          }}
        >
          颜色
        </div>
        <div className="flex gap-3">
          {EVENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="flex items-center justify-center"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: c,
                outline: color === c ? '2px solid var(--color-systemBlue)' : 'none',
                outlineOffset: 2,
              }}
              data-testid={`color-${c}`}
            >
              {color === c && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7l3 3 5-5"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        style={{
          padding: '14px 0',
          fontSize: 'var(--font-size-body)',
          fontWeight: 600,
          color: '#fff',
          textAlign: 'center',
          backgroundColor: canSave ? 'var(--color-systemBlue)' : 'var(--color-systemFill)',
          borderRadius: 'var(--radius-group)',
          opacity: canSave ? 1 : 0.5,
          transition: 'opacity 0.15s',
        }}
        data-testid="save-event-btn"
      >
        {editingEventId ? '保存' : '添加日程'}
      </button>
    </div>
  );
}
