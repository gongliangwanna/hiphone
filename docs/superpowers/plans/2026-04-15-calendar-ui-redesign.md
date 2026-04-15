# Calendar UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the Calendar app's three views (MonthView, EventDetail, EventForm) to match iOS Calendar visual quality — typography-driven, inset grouped cards, multi-color event dots, unified "事件" terminology.

**Architecture:** Pure visual refactor. Store additions limited to `calendarNavStore` (save coordination between NavBar and EventForm). No data model changes. Each task modifies one file and is independently testable.

**Tech Stack:** React, Zustand, Tailwind CSS, date-fns, lucide-react, Framer Motion (existing)

**Spec:** `docs/superpowers/specs/2026-04-15-calendar-ui-redesign.md`

---

## File Structure

| File | Responsibility | Change Type |
|------|---------------|-------------|
| `src/apps/Calendar/calendarNavStore.ts` | Nav stack + save coordination | Add `pendingSave`, `formValid` fields |
| `src/apps/Calendar/CalendarApp.tsx` | Router + NavBar config | Replace NavBars, add custom MonthView header |
| `src/apps/Calendar/MonthView.tsx` | Month grid + event list | Full restyle |
| `src/apps/Calendar/EventDetail.tsx` | Event detail view | Full restyle |
| `src/apps/Calendar/EventForm.tsx` | Event create/edit form | Full restyle, remove save button |
| `src/apps/Calendar/__tests__/CalendarApp.test.tsx` | Integration tests | Update for changed testIds / markup |

---

### Task 1: Add save coordination to calendarNavStore

**Files:**
- Modify: `src/apps/Calendar/calendarNavStore.ts`
- Test: `src/apps/Calendar/__tests__/calendarNavStore.test.ts` (new)

- [ ] **Step 1: Write failing test for new store fields**

Create `src/apps/Calendar/__tests__/calendarNavStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useCalendarNavStore } from '../calendarNavStore';

function resetStore() {
  useCalendarNavStore.setState({
    stack: ['month'],
    activeEventId: null,
    editingEventId: null,
    pendingSave: false,
    formValid: false,
  });
}

describe('calendarNavStore save coordination', () => {
  beforeEach(resetStore);

  it('pendingSave defaults to false', () => {
    expect(useCalendarNavStore.getState().pendingSave).toBe(false);
  });

  it('formValid defaults to false', () => {
    expect(useCalendarNavStore.getState().formValid).toBe(false);
  });

  it('setPendingSave updates flag', () => {
    useCalendarNavStore.getState().setPendingSave(true);
    expect(useCalendarNavStore.getState().pendingSave).toBe(true);
    useCalendarNavStore.getState().setPendingSave(false);
    expect(useCalendarNavStore.getState().pendingSave).toBe(false);
  });

  it('setFormValid updates flag', () => {
    useCalendarNavStore.getState().setFormValid(true);
    expect(useCalendarNavStore.getState().formValid).toBe(true);
  });

  it('reset clears pendingSave and formValid', () => {
    useCalendarNavStore.getState().setPendingSave(true);
    useCalendarNavStore.getState().setFormValid(true);
    useCalendarNavStore.getState().reset();
    expect(useCalendarNavStore.getState().pendingSave).toBe(false);
    expect(useCalendarNavStore.getState().formValid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/__tests__/calendarNavStore.test.ts`

Expected: FAIL — `pendingSave`, `formValid`, `setPendingSave`, `setFormValid` not found in store state.

- [ ] **Step 3: Add pendingSave and formValid to calendarNavStore**

Replace the full content of `src/apps/Calendar/calendarNavStore.ts`:

```ts
import { create } from 'zustand';

interface CalendarNavState {
  stack: string[];
  activeEventId: string | null;
  editingEventId: string | null;
  /** CalendarApp sets true → EventForm consumes and calls handleSave */
  pendingSave: boolean;
  /** EventForm updates → CalendarApp reads for NavBar button disabled state */
  formValid: boolean;

  push: (page: string, opts?: { eventId?: string; editing?: boolean }) => void;
  pop: () => void;
  reset: () => void;
  setPendingSave: (v: boolean) => void;
  setFormValid: (v: boolean) => void;
}

export const useCalendarNavStore = create<CalendarNavState>()((set) => ({
  stack: ['month'],
  activeEventId: null,
  editingEventId: null,
  pendingSave: false,
  formValid: false,

  push: (page, opts) =>
    set((state) => ({
      stack: [...state.stack, page],
      activeEventId: opts?.eventId ?? null,
      editingEventId: opts?.editing ? (opts.eventId ?? null) : null,
    })),

  pop: () =>
    set((state) => ({
      stack: state.stack.length > 1 ? state.stack.slice(0, -1) : state.stack,
      activeEventId: null,
      editingEventId: null,
      pendingSave: false,
      formValid: false,
    })),

  reset: () =>
    set({
      stack: ['month'],
      activeEventId: null,
      editingEventId: null,
      pendingSave: false,
      formValid: false,
    }),

  setPendingSave: (v) => set({ pendingSave: v }),
  setFormValid: (v) => set({ formValid: v }),
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/__tests__/calendarNavStore.test.ts`

Expected: all 5 tests PASS.

- [ ] **Step 5: Run all Calendar tests to check no regressions**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/`

Expected: all existing tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
git add src/apps/Calendar/calendarNavStore.ts src/apps/Calendar/__tests__/calendarNavStore.test.ts
git commit -m "feat(calendar): add save coordination fields to calendarNavStore"
```

---

### Task 2: Restyle CalendarApp shell (NavBar configs + terminology)

**Files:**
- Modify: `src/apps/Calendar/CalendarApp.tsx`
- Modify: `src/apps/Calendar/__tests__/CalendarApp.test.tsx`

This task updates the CalendarApp router to:
1. Replace MonthView's NavBar with a custom header (month/year split typography + today/add buttons)
2. Change EventDetail NavBar: right button from icon to red text "编辑"
3. Change EventForm NavBar: title "新建事件"/"编辑事件", right button text "添加"/"完成" with save coordination
4. Replace all hand-drawn SVG icons with lucide-react
5. Unify terminology to "事件"

- [ ] **Step 1: Update CalendarApp.test.tsx for new structure**

The test references `today-btn`, `add-event-btn`, `month-prev`, `month-next`. After this task:
- `today-btn` and `add-event-btn` move from NavBar to MonthView's custom header → they'll still be in DOM, but rendered by MonthView instead of CalendarApp. The tests for these button clicks should still pass.
- `month-prev` and `month-next` move to the custom header area in MonthView (next task handles this).

Update `src/apps/Calendar/__tests__/CalendarApp.test.tsx`:

```ts
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
```

Changes: removed `month-prev`/`month-next` assertion (they move inside MonthView in Task 3 and won't be visible until that task runs — we re-add that test in Task 3), renamed `测试日程` → `测试事件`.

- [ ] **Step 2: Rewrite CalendarApp.tsx**

Replace the full content of `src/apps/Calendar/CalendarApp.tsx`:

```tsx
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
            <div className="min-h-0 flex-1 overflow-hidden">
              <PageComponent />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}
```

Key changes:
- MonthView gets a custom header div instead of NavBar (month/year split, red "今天" text, Plus icon from lucide)
- EventDetail right button: text `编辑` in red instead of pencil SVG icon
- EventForm right button: text `添加`/`完成` in red, with `formValid` opacity control, triggers `setPendingSave`
- EventForm title: `新建事件` / `编辑事件` (unified terminology)
- Removed all hand-drawn SVG icon components (`TodayIcon`, `PlusIcon`, `EditIcon`)
- `formatMonthTitle` import removed — replaced with inline `format(currentMonth, 'M月')` and `format(currentMonth, 'yyyy')`

- [ ] **Step 3: Run tests**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/__tests__/CalendarApp.test.tsx`

Expected: all 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
git add src/apps/Calendar/CalendarApp.tsx src/apps/Calendar/__tests__/CalendarApp.test.tsx
git commit -m "feat(calendar): restyle CalendarApp shell with custom header and text NavBar buttons"
```

---

### Task 3: Restyle MonthView

**Files:**
- Modify: `src/apps/Calendar/MonthView.tsx`

This task fully restyles MonthView:
1. Calendar grid: 48px cells, 17px font, multi-color event dots, out-of-month Sunday color
2. Month navigation arrows next to header
3. Lower half: grouped background, flat event rows with 3px color bars
4. Terminology: "没有事件"
5. Replace hand-drawn SVGs with lucide-react

- [ ] **Step 1: Rewrite MonthView.tsx**

Replace the full content of `src/apps/Calendar/MonthView.tsx`:

```tsx
import { useMemo, useRef, useCallback } from 'react';
import { format, addMonths, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCalendarDataStore } from './calendarDataStore';
import { useCalendarNavStore } from './calendarNavStore';
import {
  generateMonthGrid,
  isCurrentMonth,
  isSameDay,
  isToday,
  formatDateHeader,
  formatEventTime,
  getEventsForDate,
  getDatesWithEvents,
  dateKey,
  getChineseHolidays,
  getHolidayEventsForYear,
  WEEKDAY_HEADERS,
} from './calendarUtils';

const SWIPE_THRESHOLD = 50;

/** Build a map of dateKey → color[] for multi-color dots */
function buildColorDotsMap(
  events: { startTime: number; endTime: number; color: string; isAllDay: boolean }[],
  holidays: Map<string, string>,
): Map<string, string[]> {
  const map = new Map<string, Set<string>>();

  for (const event of events) {
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    let current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (current <= endDay) {
      const key = format(current, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, new Set());
      map.get(key)!.add(event.color);
      current = new Date(current.getTime() + 86400000);
    }
  }

  // Holiday events get systemRed
  for (const key of holidays.keys()) {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add('var(--color-systemRed)');
  }

  const result = new Map<string, string[]>();
  for (const [key, colors] of map) {
    result.set(key, Array.from(colors).slice(0, 3));
  }
  return result;
}

export function MonthView() {
  const events = useCalendarDataStore((s) => s.events);
  const selectedDate = useCalendarDataStore((s) => s.selectedDate);
  const currentMonth = useCalendarDataStore((s) => s.currentMonth);
  const setSelectedDate = useCalendarDataStore((s) => s.setSelectedDate);
  const setCurrentMonth = useCalendarDataStore((s) => s.setCurrentMonth);
  const push = useCalendarNavStore((s) => s.push);

  const grid = useMemo(() => generateMonthGrid(currentMonth), [currentMonth]);

  const holidays = useMemo(() => {
    const year = new Date(currentMonth).getFullYear();
    const map = new Map<string, string>();
    for (const y of [year - 1, year, year + 1]) {
      for (const [k, v] of getChineseHolidays(y)) {
        map.set(k, v);
      }
    }
    return map;
  }, [currentMonth]);

  const colorDots = useMemo(
    () => buildColorDotsMap(events, holidays),
    [events, holidays],
  );

  const allEventsWithHolidays = useMemo(() => {
    const year = new Date(selectedDate).getFullYear();
    return [...events, ...getHolidayEventsForYear(year)];
  }, [events, selectedDate]);

  const dayEvents = useMemo(
    () => getEventsForDate(allEventsWithHolidays, selectedDate),
    [allEventsWithHolidays, selectedDate],
  );

  const touchStartXRef = useRef(0);

  const navigateMonth = useCallback(
    (delta: number) => {
      setCurrentMonth(addMonths(currentMonth, delta).getTime());
    },
    [currentMonth, setCurrentMonth],
  );

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]!.clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0]!.clientX - touchStartXRef.current;
      if (dx < -SWIPE_THRESHOLD) navigateMonth(1);
      else if (dx > SWIPE_THRESHOLD) navigateMonth(-1);
    },
    [navigateMonth],
  );

  const handleDateTap = (date: Date) => {
    setSelectedDate(date.getTime());
    if (!isCurrentMonth(date, currentMonth)) {
      setCurrentMonth(date.getTime());
    }
  };

  const selectedWeekday = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][
    getDay(new Date(selectedDate))
  ];
  const isTodaySelected = isToday(new Date(selectedDate));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Month nav arrows ── */}
      <div
        className="flex items-center"
        style={{ padding: '6px 20px 0', gap: 20 }}
      >
        <button
          onClick={() => navigateMonth(-1)}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, color: 'var(--color-tertiaryLabel)' }}
          data-testid="month-prev"
        >
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>
        <button
          onClick={() => navigateMonth(1)}
          className="flex items-center justify-center"
          style={{ width: 28, height: 28, color: 'var(--color-tertiaryLabel)' }}
          data-testid="month-next"
        >
          <ChevronRight size={18} strokeWidth={1.8} />
        </button>
      </div>

      {/* ── Weekday header ── */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '12px 16px 6px',
        }}
      >
        {WEEKDAY_HEADERS.map((d, i) => (
          <div
            key={d}
            className="text-center"
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: i === 0 ? 'rgba(255,59,48,0.35)' : 'var(--color-secondaryLabel)',
              opacity: i === 0 ? 1 : 0.5,
              lineHeight: '18px',
              textTransform: 'uppercase',
              letterSpacing: 0.2,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* ── Separator ── */}
      <div
        style={{
          height: 0.5,
          background: 'var(--color-separator)',
          margin: '0 20px',
        }}
      />

      {/* ── Month grid ── */}
      <div
        style={{ height: 6 * 48, overflow: 'hidden' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(7, 1fr)',
            padding: '4px 16px 8px',
          }}
          data-testid="month-grid"
        >
          {grid.map((date) => {
            const isInMonth = isCurrentMonth(date, currentMonth);
            const today = isToday(date);
            const selected = isSameDay(date, selectedDate);
            const key = dateKey(date);
            const dots = colorDots.get(key);
            const isSunday = date.getDay() === 0;

            let numberColor: string;
            if (today) {
              numberColor = '#fff';
            } else if (!isInMonth && isSunday) {
              numberColor = 'rgba(255,59,48,0.12)';
            } else if (!isInMonth) {
              numberColor = 'rgba(0,0,0,0.10)';
            } else if (isSunday) {
              numberColor = 'var(--color-systemRed)';
            } else {
              numberColor = 'var(--color-label)';
            }

            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => handleDateTap(date)}
                className="flex flex-col items-center justify-center"
                style={{ height: 48, position: 'relative' }}
                data-testid={`date-${format(date, 'yyyy-MM-dd')}`}
              >
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    backgroundColor: today
                      ? 'var(--color-systemRed)'
                      : selected && !today
                        ? 'rgba(0,0,0,0.04)'
                        : 'transparent',
                  }}
                >
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: today ? 600 : selected ? 500 : 400,
                      color: numberColor,
                      letterSpacing: -0.2,
                    }}
                  >
                    {format(date, 'd')}
                  </span>
                </div>

                {/* Holiday "休" label */}
                {holidays.has(key) && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      right: 4,
                      fontSize: 7,
                      fontWeight: 700,
                      color: 'rgba(52,199,89,0.7)',
                      lineHeight: 1,
                    }}
                  >
                    休
                  </span>
                )}

                {/* Multi-color event dots */}
                {dots && !today && (
                  <div
                    className="flex"
                    style={{ gap: 3, height: 4, marginTop: 2 }}
                  >
                    {dots.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          backgroundColor: c,
                        }}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Lower half: event list ── */}
      <div
        className="flex flex-1 flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      >
        {/* Date label */}
        <div className="flex items-baseline" style={{ padding: '16px 20px 10px' }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-label)',
            }}
          >
            {format(selectedDate, 'M月d日')}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 400,
              color: 'var(--color-tertiaryLabel)',
              marginLeft: 6,
            }}
          >
            {selectedWeekday}
            {isTodaySelected && ' · 今天'}
          </span>
        </div>

        {/* Event list */}
        <div className="flex-1 overflow-auto" style={{ paddingBottom: 80 }}>
          {dayEvents.length === 0 ? (
            <div
              className="flex items-center justify-center"
              style={{
                height: 80,
                color: 'var(--color-secondaryLabel)',
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              没有事件
            </div>
          ) : (
            dayEvents.map((event, i) => (
              <button
                key={event.id}
                type="button"
                className="flex w-full items-center"
                style={{
                  padding: '0 20px',
                  minHeight: 58,
                  cursor: 'pointer',
                }}
                onClick={() => push('event-detail', { eventId: event.id })}
                data-testid={`event-row-${event.id}`}
              >
                {/* Color bar */}
                <div
                  style={{
                    width: 3,
                    height: 34,
                    borderRadius: 2,
                    backgroundColor: event.color,
                    flexShrink: 0,
                    marginRight: 14,
                  }}
                />
                {/* Body */}
                <div
                  className="flex min-w-0 flex-1 flex-col"
                  style={{
                    padding: '14px 0',
                    borderBottom:
                      i < dayEvents.length - 1
                        ? '0.5px solid rgba(0,0,0,0.06)'
                        : 'none',
                  }}
                >
                  <span
                    className="truncate"
                    style={{
                      fontSize: 16,
                      fontWeight: 500,
                      color: 'var(--color-label)',
                      letterSpacing: -0.1,
                      lineHeight: 1.3,
                    }}
                  >
                    {event.title}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: 'var(--color-tertiaryLabel)',
                      marginTop: 2,
                      lineHeight: 1.3,
                    }}
                  >
                    {formatEventTime(event.startTime, event.endTime, event.isAllDay)}
                  </span>
                </div>
                {/* Chevron */}
                <ChevronRight
                  size={14}
                  strokeWidth={1.8}
                  style={{
                    color: 'rgba(0,0,0,0.12)',
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

Key changes:
- Month nav arrows moved to top of MonthView (below the custom header rendered by CalendarApp)
- Weekday row: Sunday faded red, others with 0.5 opacity
- Separator between weekday row and grid
- Date cells: 48px height, 17px font, multi-color dots via `buildColorDotsMap`
- Out-of-month Sunday: `rgba(255,59,48,0.12)`
- Lower half: `systemGroupedBackground` background, date label with weekday + "今天", flat event rows with 3px color bars, chevron icons from lucide-react
- Empty state: "没有事件"
- Removed all hand-drawn SVG icon components

- [ ] **Step 2: Run tests**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
git add src/apps/Calendar/MonthView.tsx
git commit -m "feat(calendar): restyle MonthView with multi-color dots, grouped event list"
```

---

### Task 4: Restyle EventDetail

**Files:**
- Modify: `src/apps/Calendar/EventDetail.tsx`

Full restyle: grouped background, card-based layout, color bar alongside title, icon rows for reminder/repeat, notes card with label, "删除事件" text.

- [ ] **Step 1: Rewrite EventDetail.tsx**

Replace the full content of `src/apps/Calendar/EventDetail.tsx`:

```tsx
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
          display: 'flex',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 4,
            borderRadius: 2,
            backgroundColor: event.color,
            flexShrink: 0,
            alignSelf: 'stretch',
          }}
        />
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
```

Key changes:
- Page background: `systemGroupedBackground`
- Card-based layout with `secondarySystemGroupedBackground` + `radius-group`
- Title card: 4px full-height color bar + 22px bold title + 14px gray time with weekday
- Reminder/Repeat card: lucide icons in colored rounded-square containers, static "无"
- Notes card: uppercase "备注" label + body text
- Delete card: "删除事件" (unified terminology)
- "日程未找到" → "事件未找到"

- [ ] **Step 2: Run tests**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/__tests__/CalendarApp.test.tsx`

Expected: all tests PASS (the test that clicks into event detail and checks for "测试备注" should still work).

- [ ] **Step 3: Commit**

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
git add src/apps/Calendar/EventDetail.tsx
git commit -m "feat(calendar): restyle EventDetail with grouped cards, color bar, icon rows"
```

---

### Task 5: Restyle EventForm + save coordination

**Files:**
- Modify: `src/apps/Calendar/EventForm.tsx`

Full restyle + save button removal (action moves to NavBar via `pendingSave`):
1. Grouped card layout with `systemGroupedBackground` background
2. Add reminder/repeat display rows
3. Resize color dots to 20px with ring indicator (remove checkmark)
4. Remove standalone save button, watch `pendingSave` from store
5. Expose `formValid` to store
6. Notes card with uppercase label
7. Placeholder: "添加备注…"

- [ ] **Step 1: Rewrite EventForm.tsx**

Replace the full content of `src/apps/Calendar/EventForm.tsx`:

```tsx
import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, addHours, startOfDay, addDays } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Repeat2, ChevronRight } from 'lucide-react';
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
  const pendingSave = useCalendarNavStore((s) => s.pendingSave);
  const setPendingSave = useCalendarNavStore((s) => s.setPendingSave);
  const setFormValid = useCalendarNavStore((s) => s.setFormValid);
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

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => titleRef.current?.focus(), 400);
    return () => clearTimeout(timer);
  }, []);

  const canSave = title.trim().length > 0 && (isAllDay || endTime > startTime);

  // Expose form validity to NavBar
  useEffect(() => {
    setFormValid(canSave);
  }, [canSave, setFormValid]);

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

  // Watch pendingSave from NavBar
  useEffect(() => {
    if (pendingSave) {
      setPendingSave(false);
      handleSave();
    }
  }, [pendingSave, setPendingSave, handleSave]);

  const pickerMode = isAllDay ? 'date' : 'datetime';

  return (
    <div
      className="flex flex-1 flex-col overflow-auto"
      style={{
        backgroundColor: 'var(--color-systemGroupedBackground)',
        paddingBottom: 80,
      }}
    >
      {/* ── Title input card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '16px 16px 0',
          padding: '0 16px',
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

      {/* ── Time settings card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '10px 16px 0',
          overflow: 'hidden',
        }}
      >
        {/* All-day toggle */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '10px 16px',
            borderBottom: '0.5px solid var(--color-separator)',
          }}
        >
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 56 }}>
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
              backgroundColor: isAllDay ? 'var(--color-systemGreen)' : 'rgba(120,120,128,0.16)',
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
                boxShadow: '0 1px 3px rgba(0,0,0,0.15), 0 0 0 0.5px rgba(0,0,0,0.04)',
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
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 56 }}>
            开始
          </span>
          <span
            style={{
              fontSize: 16,
              color: openPicker === 'start' ? 'var(--color-systemRed)' : 'var(--color-systemBlue)',
              backgroundColor:
                openPicker === 'start' ? 'rgba(255,59,48,0.12)' : 'transparent',
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
          <span style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)', width: 56 }}>
            结束
          </span>
          <span
            style={{
              fontSize: 16,
              color: openPicker === 'end' ? 'var(--color-systemRed)' : 'var(--color-systemBlue)',
              backgroundColor:
                openPicker === 'end' ? 'rgba(255,59,48,0.12)' : 'transparent',
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

      {/* ── Reminder & Repeat card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '10px 16px 0',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center"
          style={{ padding: '12px 16px', minHeight: 44 }}
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
        <div
          style={{
            height: 0.5,
            backgroundColor: 'var(--color-separator)',
            marginLeft: 56,
          }}
        />
        <div
          className="flex items-center"
          style={{ padding: '12px 16px', minHeight: 44 }}
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

      {/* ── Color picker card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '10px 16px 0',
          overflow: 'hidden',
        }}
      >
        <div
          className="flex items-center"
          style={{ padding: '0 16px', minHeight: 44 }}
        >
          <span style={{ fontSize: 16, color: 'var(--color-label)' }}>
            颜色
          </span>
          <div style={{ flex: 1 }} />
          <div className="flex" style={{ gap: 10 }}>
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  backgroundColor: c,
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: 3,
                  opacity: color === c ? 1 : 0.65,
                  transition: 'opacity 0.15s',
                }}
                data-testid={`color-${c}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Notes card ── */}
      <div
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          borderRadius: 'var(--radius-group)',
          margin: '10px 16px 0',
          padding: '12px 16px',
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
        <textarea
          placeholder="添加备注…"
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

      {/* No standalone save button — action is in NavBar "添加"/"完成" */}
    </div>
  );
}
```

Key changes:
- Page background: `systemGroupedBackground`
- All sections wrapped in white cards with `radius-group`
- Time values: blue (`systemBlue`) when not active, red highlight when picker open
- Toggle background: `rgba(120,120,128,0.16)` (iOS standard) instead of `var(--color-systemFill)`
- Added Reminder/Repeat card (display-only, same style as EventDetail)
- Color dots: 20px, ring outline on selected (no checkmark), unselected at 0.65 opacity
- Notes card: uppercase "备注" label, placeholder "添加备注…"
- Removed standalone save button
- Added `useEffect` for `pendingSave` → calls `handleSave()` when NavBar triggers save
- Added `useEffect` for `canSave` → updates `setFormValid` for NavBar disabled state

- [ ] **Step 2: Run all Calendar tests**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
git add src/apps/Calendar/EventForm.tsx
git commit -m "feat(calendar): restyle EventForm with grouped cards, move save to NavBar"
```

---

### Task 6: Update seed data terminology

**Files:**
- Modify: `src/apps/Calendar/calendarDataStore.ts`

The seed event text uses "日程". Update to "事件" for consistency.

- [ ] **Step 1: Update seed event text**

In `src/apps/Calendar/calendarDataStore.ts`, change the `makeSeedEvent` function at lines 32-47:

Replace:
```ts
    title: '欢迎使用日历',
```
with:
```ts
    title: '欢迎使用日历',
```

Replace:
```ts
    notes: '这是一个示例日程。你可以点击 + 创建新的日程。',
```
with:
```ts
    notes: '这是一个示例事件。你可以点击 + 创建新的事件。',
```

- [ ] **Step 2: Run tests**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/`

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
cd /Users/wanqilin/WorkSpace/ai/hiPhone
git add src/apps/Calendar/calendarDataStore.ts
git commit -m "fix(calendar): unify terminology to 事件 in seed data"
```

---

### Task 7: Visual verification

**Files:** None (manual testing)

- [ ] **Step 1: Start dev server**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vite dev`

- [ ] **Step 2: Open Calendar app and verify MonthView**

Check:
- Custom header shows month/year split (e.g., "4月 2026") with year grayed out
- "今天" button in red, "+" icon in red
- Weekday row: Sunday faded red, others lighter
- Date grid: 48px cells, today = red circle, selected = light gray
- Multi-color event dots below dates
- Holiday "休" labels visible
- Month navigation arrows (‹ ›) work
- Swipe month change works
- Lower half: gray background, date label with "星期X · 今天", flat event rows with color bars

- [ ] **Step 3: Verify EventDetail**

Click an event to open detail:
- Gray grouped background
- Title card with full-height color bar, bold title, gray time with weekday
- Reminder/Repeat card with orange bell icon and gray repeat icon, both showing "无"
- Notes card with uppercase "备注" label
- "删除事件" in red at bottom
- NavBar: "‹ 日历" back, "编辑" text in red on right

- [ ] **Step 4: Verify EventForm**

Click "+" to create new event:
- NavBar: "取消" back, "新建事件" title, "添加" in red (disabled/light when no title)
- Title input card
- Time settings card with toggle, blue time values
- Reminder/Repeat card (display-only)
- Color picker with 20px dots, ring on selected
- Notes card with "备注" label and "添加备注…" placeholder
- No standalone save button
- Type a title → "添加" becomes fully opaque → click "添加" → event saved

Click "编辑" from detail:
- NavBar shows "编辑事件" title, "完成" button on right
- Existing data pre-filled

- [ ] **Step 5: Run full test suite**

Run: `cd /Users/wanqilin/WorkSpace/ai/hiPhone && npx vitest run src/apps/Calendar/`

Expected: all tests PASS.

- [ ] **Step 6: Final commit if any fixups needed**

If visual testing revealed issues, fix them and commit each fix separately.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-15-calendar-ui-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?