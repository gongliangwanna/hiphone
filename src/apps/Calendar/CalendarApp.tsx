import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
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
  const formValid = useCalendarNavStore((s) => s.formValid);
  const push = useCalendarNavStore((s) => s.push);
  const pop = useCalendarNavStore((s) => s.pop);
  const reset = useCalendarNavStore((s) => s.reset);
  const setPendingSave = useCalendarNavStore((s) => s.setPendingSave);
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

  // ── MonthView: custom header (no NavBar) ──
  const monthHeader = (
    <div
      className="flex items-center justify-between"
      style={{ padding: '4px 20px 10px' }}
    >
      <div className="flex items-baseline" style={{ gap: 2 }}>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-label)',
            letterSpacing: -0.3,
          }}
        >
          {format(currentMonth, 'M月')}
        </span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-quaternaryLabel)',
            marginLeft: 4,
          }}
        >
          {format(currentMonth, 'yyyy')}
        </span>
      </div>
      <div className="flex items-center" style={{ gap: 16 }}>
        <button
          onClick={goToToday}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-systemRed)',
            minHeight: 44,
          }}
          data-testid="today-btn"
        >
          今天
        </button>
        <button
          onClick={() => push('event-form')}
          className="flex items-center justify-center"
          style={{
            color: 'var(--color-systemRed)',
            minWidth: 44,
            minHeight: 44,
          }}
          data-testid="add-event-btn"
        >
          <Plus size={22} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );

  // ── EventDetail: NavBar with text "编辑" button ──
  const detailHeader = (
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
                icon: (
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 400,
                      color: 'var(--color-systemRed)',
                    }}
                  >
                    编辑
                  </span>
                ),
                onClick: () => {
                  if (activeEventId) push('event-form', { eventId: activeEventId, editing: true });
                },
                testId: 'edit-event-btn',
              },
            ]
      }
    />
  );

  // ── EventForm: NavBar with text "添加"/"完成" button ──
  const formHeader = (
    <NavBar
      title={editingEventId ? '编辑事件' : '新建事件'}
      showBack
      onBack={handleBack}
      backLabel="取消"
      rightButtons={[
        {
          icon: (
            <span
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--color-systemRed)',
                opacity: formValid ? 1 : 0.3,
              }}
            >
              {editingEventId ? '完成' : '添加'}
            </span>
          ),
          onClick: () => {
            if (formValid) setPendingSave(true);
          },
          testId: 'save-event-btn',
        },
      ]}
    />
  );

  const header =
    currentPage === 'month'
      ? monthHeader
      : currentPage === 'event-detail'
        ? detailHeader
        : formHeader;

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
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <PageComponent />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}
