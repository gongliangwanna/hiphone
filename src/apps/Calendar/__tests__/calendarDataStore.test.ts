import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarDataStore } from '../calendarDataStore';
import { startOfDay, startOfMonth } from 'date-fns';

function resetStore() {
  const now = Date.now();
  useCalendarDataStore.setState({
    events: [
      {
        id: 'e1',
        title: 'Morning Meeting',
        isAllDay: false,
        startTime: new Date('2026-04-10T09:00:00').getTime(),
        endTime: new Date('2026-04-10T10:00:00').getTime(),
        notes: 'Standup',
        color: 'var(--color-systemBlue)',
        createdAt: 1000,
        updatedAt: 1000,
      },
      {
        id: 'e2',
        title: 'Lunch',
        isAllDay: false,
        startTime: new Date('2026-04-10T12:00:00').getTime(),
        endTime: new Date('2026-04-10T13:00:00').getTime(),
        notes: '',
        color: 'var(--color-systemGreen)',
        createdAt: 2000,
        updatedAt: 2000,
      },
    ],
    selectedDate: startOfDay(now).getTime(),
    currentMonth: startOfMonth(now).getTime(),
  });
}

describe('calendarDataStore', () => {
  beforeEach(resetStore);

  it('addEvent creates event with generated id', () => {
    const id = useCalendarDataStore.getState().addEvent({
      title: 'New Event',
      isAllDay: false,
      startTime: Date.now(),
      endTime: Date.now() + 3600000,
      notes: '',
      color: 'var(--color-systemBlue)',
    });
    expect(id).toBeTruthy();
    const event = useCalendarDataStore.getState().events.find((e) => e.id === id);
    expect(event).toBeDefined();
    expect(event!.title).toBe('New Event');
    expect(event!.createdAt).toBeGreaterThan(0);
  });

  it('updateEvent modifies fields and bumps updatedAt', () => {
    useCalendarDataStore.getState().updateEvent('e1', { title: 'Updated' });
    const event = useCalendarDataStore.getState().events.find((e) => e.id === 'e1')!;
    expect(event.title).toBe('Updated');
    expect(event.updatedAt).toBeGreaterThan(1000);
  });

  it('deleteEvent removes the event', () => {
    useCalendarDataStore.getState().deleteEvent('e1');
    const events = useCalendarDataStore.getState().events;
    expect(events).toHaveLength(1);
    expect(events[0]!.id).toBe('e2');
  });

  it('setSelectedDate normalizes to start of day', () => {
    const ts = new Date('2026-05-15T14:30:00').getTime();
    useCalendarDataStore.getState().setSelectedDate(ts);
    expect(useCalendarDataStore.getState().selectedDate).toBe(
      startOfDay(ts).getTime(),
    );
  });

  it('setCurrentMonth normalizes to start of month', () => {
    const ts = new Date('2026-05-15T14:30:00').getTime();
    useCalendarDataStore.getState().setCurrentMonth(ts);
    expect(useCalendarDataStore.getState().currentMonth).toBe(
      startOfMonth(ts).getTime(),
    );
  });

  it('goToToday resets both selectedDate and currentMonth', () => {
    useCalendarDataStore.getState().setSelectedDate(new Date('2025-01-01').getTime());
    useCalendarDataStore.getState().setCurrentMonth(new Date('2025-01-01').getTime());
    useCalendarDataStore.getState().goToToday();
    const state = useCalendarDataStore.getState();
    const now = Date.now();
    expect(state.selectedDate).toBe(startOfDay(now).getTime());
    expect(state.currentMonth).toBe(startOfMonth(now).getTime());
  });
});
