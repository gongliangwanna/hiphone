import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import { uid } from '@/platform/utils/uid';
import { startOfDay, startOfMonth, setHours } from 'date-fns';

export interface CalendarEvent {
  id: string;
  title: string;
  isAllDay: boolean;
  startTime: number;
  endTime: number;
  notes: string;
  color: string;
  createdAt: number;
  updatedAt: number;
}

interface CalendarDataState {
  events: CalendarEvent[];
  selectedDate: number;
  currentMonth: number;

  addEvent: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateEvent: (id: string, updates: Partial<Omit<CalendarEvent, 'id' | 'createdAt'>>) => void;
  deleteEvent: (id: string) => void;
  setSelectedDate: (timestamp: number) => void;
  setCurrentMonth: (timestamp: number) => void;
  goToToday: () => void;
}

function makeSeedEvent(): CalendarEvent {
  const today = new Date();
  const start = setHours(startOfDay(today), 10);
  const end = setHours(startOfDay(today), 11);
  return {
    id: 'welcome-event',
    title: '欢迎使用日历',
    isAllDay: false,
    startTime: start.getTime(),
    endTime: end.getTime(),
    notes: '这是一个示例事件。你可以点击 + 创建新的事件。',
    color: 'var(--color-systemBlue)',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

const now = Date.now();

export const useCalendarDataStore = create<CalendarDataState>()(
  persist(
    (set) => ({
      events: [makeSeedEvent()],
      selectedDate: startOfDay(now).getTime(),
      currentMonth: startOfMonth(now).getTime(),

      addEvent: (event) => {
        const id = uid();
        const timestamp = Date.now();
        set((state) => ({
          events: [
            ...state.events,
            { ...event, id, createdAt: timestamp, updatedAt: timestamp },
          ],
        }));
        return id;
      },

      updateEvent: (id, updates) => {
        set((state) => ({
          events: state.events.map((e) =>
            e.id === id ? { ...e, ...updates, updatedAt: Date.now() } : e,
          ),
        }));
      },

      deleteEvent: (id) => {
        set((state) => ({
          events: state.events.filter((e) => e.id !== id),
        }));
      },

      setSelectedDate: (timestamp) => {
        set({ selectedDate: startOfDay(timestamp).getTime() });
      },

      setCurrentMonth: (timestamp) => {
        set({ currentMonth: startOfMonth(timestamp).getTime() });
      },

      goToToday: () => {
        const today = Date.now();
        set({
          selectedDate: startOfDay(today).getTime(),
          currentMonth: startOfMonth(today).getTime(),
        });
      },
    }),
    {
      name: 'hiPhone-calendar',
      storage: idbStorage,
      partialize: (state) => ({ events: state.events }),
    },
  ),
);
