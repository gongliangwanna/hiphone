import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarApp } from '../CalendarApp';
import { useCalendarNavStore } from '../calendarNavStore';
import { useCalendarDataStore } from '../calendarDataStore';
import { startOfDay, startOfMonth, format } from 'date-fns';

// Mock appRuntimeStore
vi.mock('@/platform/stores/appRuntimeStore', () => {
  const goHome = vi.fn();
  return {
    useAppRuntimeStore: (sel: (s: Record<string, unknown>) => unknown) =>
      sel({ goHome, activeAppId: 'calendar' }),
    wasAppKilled: vi.fn(() => false),
    clearAppKilled: vi.fn(),
  };
});

function resetStores() {
  const now = Date.now();
  useCalendarNavStore.setState({
    stack: ['month'],
    activeEventId: null,
    editingEventId: null,
    pendingSave: false,
    formValid: false,
  });
  useCalendarDataStore.setState({
    events: [
      {
        id: 'test-event',
        title: '测试事件',
        isAllDay: false,
        startTime: new Date(
          `${format(now, 'yyyy-MM-dd')}T10:00:00`,
        ).getTime(),
        endTime: new Date(
          `${format(now, 'yyyy-MM-dd')}T11:00:00`,
        ).getTime(),
        notes: '测试备注',
        color: 'var(--color-systemBlue)',
        createdAt: 1000,
        updatedAt: 1000,
      },
    ],
    selectedDate: startOfDay(now).getTime(),
    currentMonth: startOfMonth(now).getTime(),
  });
}

describe('CalendarApp', () => {
  beforeEach(resetStores);

  it('renders month view with calendar grid', () => {
    render(<CalendarApp />);
    expect(screen.getByTestId('calendar-app')).toBeInTheDocument();
    expect(screen.getByTestId('month-grid')).toBeInTheDocument();
  });

  it('shows weekday headers', () => {
    render(<CalendarApp />);
    expect(screen.getByText('日')).toBeInTheDocument();
    expect(screen.getByText('一')).toBeInTheDocument();
    expect(screen.getByText('六')).toBeInTheDocument();
  });

  it('shows today button and add button', () => {
    render(<CalendarApp />);
    expect(screen.getByTestId('today-btn')).toBeInTheDocument();
    expect(screen.getByTestId('add-event-btn')).toBeInTheDocument();
  });

  it('shows event for today', () => {
    render(<CalendarApp />);
    expect(screen.getByText('测试事件')).toBeInTheDocument();
  });

  it('navigates to event form when + is clicked', () => {
    render(<CalendarApp />);
    fireEvent.click(screen.getByTestId('add-event-btn'));
    expect(screen.getByTestId('event-title-input')).toBeInTheDocument();
  });

  it('navigates to event detail when event row is clicked', () => {
    render(<CalendarApp />);
    fireEvent.click(screen.getByTestId('event-row-test-event'));
    expect(screen.getByText('测试备注')).toBeInTheDocument();
  });
});
