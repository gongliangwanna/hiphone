import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useCalendarNavStore } from './calendarNavStore';
import { useCalendarDataStore } from './calendarDataStore';
import {
  useAppRuntimeStore,
  wasAppKilled,
  clearAppKilled,
} from '@/platform/stores/appRuntimeStore';
import { AppScreen, NavBar } from '@/system';
import { MonthView } from './MonthView';
import { EventDetail } from './EventDetail';
import { EventForm } from './EventForm';
import { formatMonthTitle } from './calendarUtils';

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  month: MonthView,
  'event-detail': EventDetail,
  'event-form': EventForm,
};

const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function CalendarApp() {
  const stack = useCalendarNavStore((s) => s.stack);
  const activeEventId = useCalendarNavStore((s) => s.activeEventId);
  const editingEventId = useCalendarNavStore((s) => s.editingEventId);
  const push = useCalendarNavStore((s) => s.push);
  const pop = useCalendarNavStore((s) => s.pop);
  const reset = useCalendarNavStore((s) => s.reset);
  const goHome = useAppRuntimeStore((s) => s.goHome);
  const currentMonth = useCalendarDataStore((s) => s.currentMonth);
  const goToToday = useCalendarDataStore((s) => s.goToToday);
  const prevLengthRef = useRef(stack.length);

  useEffect(() => {
    if (wasAppKilled('calendar')) {
      reset();
      clearAppKilled('calendar');
    }
  }, [reset]);

  const currentPage = stack[stack.length - 1] ?? 'month';

  const direction = stack.length > prevLengthRef.current ? 1 : -1;
  useEffect(() => {
    prevLengthRef.current = stack.length;
  }, [stack.length]);

  const handleBack = useCallback(() => {
    if (stack.length <= 1) {
      reset();
      goHome();
    } else {
      pop();
    }
  }, [stack.length, reset, goHome, pop]);

  const PageComponent = PAGE_COMPONENTS[currentPage] ?? MonthView;

  const header =
    currentPage === 'month' ? (
      <NavBar
        title={formatMonthTitle(currentMonth)}
        rightButtons={[
          {
            icon: <TodayIcon />,
            onClick: goToToday,
            testId: 'today-btn',
          },
          {
            icon: <PlusIcon />,
            onClick: () => push('event-form'),
            testId: 'add-event-btn',
          },
        ]}
      />
    ) : currentPage === 'event-detail' ? (
      <NavBar
        title=""
        showBack
        onBack={handleBack}
        backLabel="日历"
        rightButtons={
          activeEventId?.startsWith('holiday-')
            ? []
            : [
                {
                  icon: <EditIcon />,
                  onClick: () => {
                    if (activeEventId) push('event-form', { eventId: activeEventId, editing: true });
                  },
                  testId: 'edit-event-btn',
                },
              ]
        }
      />
    ) : (
      <NavBar
        title={editingEventId ? '编辑日程' : '新建日程'}
        showBack
        onBack={handleBack}
        backLabel="取消"
      />
    );

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <div
        className="relative flex-1 overflow-hidden"
        data-testid="calendar-app"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={currentPage + (currentPage === 'event-form' ? editingEventId : '')}
            className="absolute inset-0 flex min-h-0 flex-col"
            style={{
              backgroundColor: 'var(--color-systemBackground)',
              willChange: 'transform',
            }}
            initial={{ x: `${direction * 100}%` }}
            animate={{ x: '0%' }}
            exit={{ x: `${direction * -30}%` }}
            transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
          >
            {header}
            <div className="min-h-0 flex-1 overflow-hidden">
              <PageComponent />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}

/** SF Symbol: calendar.badge.clock — simplified "今" text icon */
function TodayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <text
        x="10"
        y="14.5"
        fill="currentColor"
        fontSize="14"
        fontWeight="600"
        textAnchor="middle"
      >
        今
      </text>
    </svg>
  );
}

/** SF Symbol: plus */
function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 3v14M3 10h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: pencil */
function EditIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M13.5 3.5l3 3L7 16H4v-3l9.5-9.5z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
