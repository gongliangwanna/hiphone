# Calendar App UI Redesign

## Goal

Redesign the Calendar app's three views (MonthView, EventDetail, EventForm) to match iOS Calendar's visual quality — restrained, typography-driven, with precise spacing and clear visual hierarchy. No functional changes to data or navigation logic.

## Scope

**In scope:** Visual and layout changes only — styling, spacing, typography, color usage, icon treatment, terminology unification.

**Out of scope:** Data model changes, new features (reminders, repeat, location), navigation flow changes, store refactoring, test changes (unless existing tests break from markup changes).

## Design Language

All three views share a unified design language:

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `var(--color-systemGroupedBackground)` / `#f2f2f7` | All page backgrounds (MonthView lower half, EventDetail, EventForm) |
| Card background | `var(--color-secondarySystemGroupedBackground)` / `#fff` | Inset grouped cards |
| Card radius | `var(--radius-group)` / `12px` | All grouped cards |
| Card margin | `0 16px` horizontal | Consistent side margins |
| Card gap | `10px` vertical between cards | Consistent card spacing |
| Separator | `0.5px solid var(--color-separator)` | Between rows within a card |
| Row height | `min-height: 44px` | Touch target compliance |
| Primary text | `var(--color-label)` / `#000` | Titles, labels |
| Secondary text | `var(--color-secondaryLabel)` | Subtitles, meta info |
| Tertiary text | `var(--color-tertiaryLabel)` | Placeholders, chevrons |
| Accent color | `var(--color-systemRed)` / `#ff3b30` | Today indicator, nav actions, delete |
| Tappable value | `var(--color-systemBlue)` / `#007aff` | Editable time values in form |
| Icons | `lucide-react` | All icons, no hand-drawn SVGs |

### Terminology

Unify all user-facing text to use **"事件"** (event), never "日程" (schedule):
- "新建事件" (not "新建日程")
- "编辑事件" (not "编辑日程")  
- "删除事件" (not "删除日程")
- "没有事件" (not "没有日程")
- "添加日程" button text → "添加"

## View 1: MonthView (月视图)

### Header Area

Current: NavBar with month title + Today/Add buttons.

Redesign: Replace NavBar with custom header for more control over typography.

```
┌─────────────────────────────────────┐
│  4月  2026              今天   +    │  ← 22px bold month, 22px bold gray year
│                                     │     "今天" 14px semibold red, "+" 22px red
└─────────────────────────────────────┘
```

- Month title: `font-size: 22px`, `font-weight: 700`, `color: var(--color-label)`
- Year: `font-size: 22px`, `font-weight: 700`, `color: var(--color-quaternaryLabel)` (very light)
- "今天" button: `font-size: 14px`, `font-weight: 600`, `color: var(--color-systemRed)`
- "+" button: `font-size: 22px`, `font-weight: 300`, `color: var(--color-systemRed)`
- Padding: `4px 20px 10px`

### Calendar Grid (Upper Half)

Background: `#fff` (white, as current).

**Weekday row:**
- `font-size: 11px`, `font-weight: 600`, `text-transform: uppercase`
- Sunday: `color: rgba(255,59,48,0.35)` (faded red)
- Other days: `color: var(--color-secondaryLabel)` with `opacity: 0.5`
- Padding: `12px 16px 6px`

**Date cells:**
- Cell height: `48px` (increased from 44px for breathing room)
- Date number: `font-size: 17px` (increased from 16px)
- Today: red filled circle (`var(--color-systemRed)` background, white text, `font-weight: 600`)
- Selected (not today): `background: rgba(0,0,0,0.04)`, `font-weight: 500`
- Out-of-month: `color: rgba(0,0,0,0.10)` (very faded)
- Out-of-month Sunday: `color: rgba(255,59,48,0.12)`

**Event dots:**
- Show actual event colors (multi-dot per day), not single red dot
- Dot size: `4px` diameter, `gap: 3px`, max 3 dots visible
- Position: below date number, `margin-top: 2px`
- Hidden when date is today (dots obscured by red circle)
- Implementation: build a `Map<dateKey, Set<color>>` from events to get per-day color dots

**Holiday "休" label:**
- Position: `absolute top-right` of cell
- `font-size: 7px`, `font-weight: 700`, `color: rgba(52,199,89,0.7)` (green)

**Month navigation:**
- Remove current bottom arrow nav (`‹ 3月 ... 5月 ›`)
- Keep swipe gesture for month change (already implemented)
- Add subtle `‹` / `›` arrow buttons near the header area for non-touch navigation

### Separator

Between grid and lower section:
- `height: 0.5px`, `background: var(--color-separator)`, `margin: 0 20px`

### Lower Half (Event List)

Background: `var(--color-systemGroupedBackground)` (`#f2f2f7`).

**Date label:**
```
┌─────────────────────────────────────┐
│  4月15日  星期三 · 今天              │
└─────────────────────────────────────┘
```
- Date: `font-size: 14px`, `font-weight: 600`, `color: var(--color-label)`
- Weekday/today: `font-size: 13px`, `font-weight: 400`, `color: var(--color-tertiaryLabel)`, `margin-left: 6px`
- Padding: `16px 20px 10px`

**Event rows** (flat list, no card wrapping):
```
┌─────────────────────────────────────┐
│ ▎ 产品评审会                      › │
│ ▎ 10:00 – 11:30                     │
├─────────────────────────────────────┤
│ ▎ 团队午餐                        › │
│ ▎ 12:00 – 13:00                     │
└─────────────────────────────────────┘
```
- Color bar: `width: 3px`, `height: 34px`, `border-radius: 2px`, `margin-right: 14px`
- Title: `font-size: 16px`, `font-weight: 500`, `color: var(--color-label)`
- Time: `font-size: 13px`, `color: var(--color-tertiaryLabel)`, `margin-top: 2px`
- Chevron: `color: rgba(0,0,0,0.12)`, `font-size: 14px`
- Row padding: `0 20px`, `min-height: 58px`
- Separator: bottom border on `.ev-body` (not full width), `0.5px solid rgba(0,0,0,0.06)`
- Last row: no bottom border
- Active state: `background: rgba(0,0,0,0.02)` on press

**Empty state:**
- "没有事件" centered, `font-size: 15px`, `font-weight: 500`, `color: var(--color-secondaryLabel)`, `padding: 40px`

## View 2: EventDetail (事件详情)

Page background: `var(--color-systemGroupedBackground)`.

NavBar: Keep current system NavBar — back label "日历", right action text "编辑" (using NavBar rightButtons with text, not icon).

### Title Card

```
┌──────────────────────────────────────┐
│ ▎ 产品评审会                         │  ← 4px color bar full height, 22px bold title
│ ▎ 2026年4月15日 星期三               │  ← 14px gray time
│ ▎ 10:00 – 11:30                      │
└──────────────────────────────────────┘
```

- White card, `border-radius: var(--radius-group)`, `margin: 16px 16px 0`
- Layout: `flex row`, `gap: 14px`, `padding: 16px`
- Color bar: `width: 4px`, `border-radius: 2px`, `align-self: stretch`, color from event
- Title: `font-size: 22px`, `font-weight: 700`, `color: var(--color-label)`, `line-height: 1.2`
- Time: `font-size: 14px`, `color: var(--color-secondaryLabel)`, `line-height: 1.5`
- All-day events show: date only, no time range

### Settings Card (Reminder / Repeat)

```
┌──────────────────────────────────────┐
│ [bell]  提醒                   无  › │
│ [repeat] 重复                  无  › │
└──────────────────────────────────────┘
```

- White card, `margin: 10px 16px 0`
- Icon: `lucide-react` icons (`Bell`, `Repeat`) rendered inside colored rounded-square containers
  - Container: `width: 28px`, `height: 28px`, `border-radius: 6px`
  - Bell icon: `background: var(--color-systemOrange)`, icon `size={14}` `color="#fff"`
  - Repeat icon: `background: #8e8e93` (system gray), icon `size={14}` `color="#fff"`
- Label: `font-size: 16px`, `color: var(--color-label)`, `flex: 1`
- Value: `font-size: 15px`, `color: var(--color-tertiaryLabel)`
- Chevron: `›`, `color: rgba(0,0,0,0.15)`
- Row padding: `12px 16px`, `min-height: 44px`
- Separator between rows: `0.5px solid var(--color-separator)`

**Note:** Reminder and Repeat are display-only in this phase. They show static values ("提前15分钟" or "无" for reminder; "无" for repeat). The actual reminder/repeat functionality is out of scope for this redesign.

### Notes Card

```
┌──────────────────────────────────────┐
│ 备注                                 │  ← 12px uppercase label
│ Q2 产品路线图评审，需要准备...         │  ← 15px body text
└──────────────────────────────────────┘
```

- White card, `margin: 10px 16px 0`, `padding: 14px 16px`
- Label: `font-size: 12px`, `font-weight: 600`, `color: var(--color-secondaryLabel)`, `text-transform: uppercase`, `letter-spacing: 0.5px`
- Body: `font-size: 15px`, `color: var(--color-label)` at `opacity: 0.7`, `line-height: 1.55`
- Only shown when `event.notes` is non-empty

### Delete Card

```
┌──────────────────────────────────────┐
│              删除事件                 │  ← red centered text
└──────────────────────────────────────┘
```

- White card, `margin: 10px 16px 0`
- Text: `font-size: 17px`, `color: var(--color-systemRed)`, `text-align: center`, `padding: 13px 16px`
- Hidden for holiday events (existing behavior, keep as-is)

## View 3: EventForm (新建/编辑事件)

Page background: `var(--color-systemGroupedBackground)`.

NavBar: System NavBar with:
- Back label: "取消" (no chevron arrow — this is a modal-style action)
- Title: "新建事件" or "编辑事件"
- Right action: text "添加" (new) or "完成" (editing), `color: var(--color-systemRed)`, disabled state at `opacity: 0.3`

### Title Input Card

```
┌──────────────────────────────────────┐
│ 标题                                 │  ← input with placeholder
└──────────────────────────────────────┘
```

- White card, `margin: 16px 16px 0`
- Input: `font-size: var(--font-size-body)`, placeholder "标题", `padding: 14px 16px`
- Keep existing auto-focus with 400ms delay

### Time Settings Card

```
┌──────────────────────────────────────┐
│ 全天                          [off]  │
│ 开始              4月15日 周三 10:00  │  ← blue tappable value
│ 结束              4月15日 周三 11:00  │  ← blue tappable value
└──────────────────────────────────────┘
```

- White card, `margin: 10px 16px 0`
- Label: `font-size: var(--font-size-body)`, `width: 56px`
- Toggle: iOS-style, `51x31px` (keep existing implementation)
- Time values: `font-size: 16px`, `color: var(--color-systemBlue)` (indicates tappable)
- Active picker state: value highlights with `color: var(--color-systemRed)`, `background: rgba(255,59,48,0.12)`, `padding: 4px 10px`, `border-radius: 6px` (keep existing behavior)
- Inline DateTimePicker: keep existing expand/collapse animation

### Reminder & Repeat Card

```
┌──────────────────────────────────────┐
│ [bell]  提醒                   无  › │
│ [repeat] 重复                  无  › │
└──────────────────────────────────────┘
```

- Same icon treatment as EventDetail (colored rounded-square containers with lucide icons)
- Value: `font-size: 15px`, `color: var(--color-tertiaryLabel)`
- These are display-only placeholders — tapping does nothing in this phase

### Color Picker Card

```
┌──────────────────────────────────────┐
│ 颜色                  ● ● ● ● ● ● ● │
└──────────────────────────────────────┘
```

- White card, `margin: 10px 16px 0`
- Label: `font-size: 16px`, left-aligned
- Dots: `20px` diameter, `gap: 10px`, right-aligned in the row
- Selected dot: outer ring via `outline: 2px solid` at `opacity: 0.35`, `outline-offset: 3px`
- Colors: 7 preset colors from `EVENT_COLORS` (existing, using CSS variables)
- Remove checkmark icon inside selected dot — ring indicator is sufficient

### Notes Card

```
┌──────────────────────────────────────┐
│ 备注                                 │  ← 12px uppercase label
│ 添加备注…                            │  ← placeholder or textarea
└──────────────────────────────────────┘
```

- White card, `margin: 10px 16px 0`
- Label: `font-size: 12px`, `font-weight: 600`, `color: var(--color-secondaryLabel)`, `text-transform: uppercase`
- Textarea: existing implementation, `min-height: 72px`
- Placeholder: "添加备注…"

### Save Button

Remove the standalone save button at the bottom. Saving is done via the NavBar "添加"/"完成" action (iOS convention). The existing `handleSave` logic is triggered by the NavBar right button instead.

## Files Changed

| File | Change |
|------|--------|
| `CalendarApp.tsx` | Update NavBar config: titles "新建事件"/"编辑事件", right button text "添加"/"完成", remove icon-based right buttons for detail/form views, add custom header for MonthView, replace hand-drawn SVG icons with lucide-react imports |
| `MonthView.tsx` | Restyle header (month/year split), increase cell height to 48px, multi-color event dots, restyle lower half with grouped background + flat event rows, update empty state text, replace hand-drawn SVG icons with lucide-react |
| `EventDetail.tsx` | Full restyling: grouped background, card-based layout, color bar alongside title, icon rows for reminder/repeat (display-only), notes card with label, delete button text "删除事件", replace color dot with full-height color bar |
| `EventForm.tsx` | Restyle to grouped cards, add reminder/repeat display rows, resize color dots to 20px with ring indicator (remove checkmark), remove standalone save button (action moves to NavBar), add notes label, update button text "添加日程" → handled by NavBar |
| `calendarUtils.ts` | No changes needed |
| `calendarDataStore.ts` | No changes needed |
| `calendarNavStore.ts` | Add `pendingSave`, `formValid`, `setPendingSave`, `setFormValid` for NavBar ↔ EventForm save coordination |

## Implementation Notes

### Icon migration
All hand-drawn SVG icon components (`ChevronLeftIcon`, `ChevronRightIcon`, `ChevronRightSmallIcon`, `TodayIcon`, `PlusIcon`, `EditIcon`) must be replaced with `lucide-react` equivalents (`ChevronLeft`, `ChevronRight`, `Plus`, `Pencil`, `Bell`, `Repeat2`).

### Per-view backgrounds
`AppScreen backgroundColor` should stay as `var(--color-systemBackground)` (white). Each view sets its own background:
- MonthView: white upper half (grid area), `var(--color-systemGroupedBackground)` lower half (event list)
- EventDetail: `var(--color-systemGroupedBackground)` full page
- EventForm: `var(--color-systemGroupedBackground)` full page

### NavBar text buttons
NavBar's `rightButtons[].icon` accepts `ReactNode`, so text buttons work by passing `<span>编辑</span>` as the icon. No NavBar component changes needed.

### NavBar tint color
The system NavBar uses `var(--color-systemBlue)` for back buttons and right buttons. The calendar design uses `var(--color-systemRed)` as its accent. Two options:
1. **Wrap right buttons with inline red color override** — pass `<span style={{ color: 'var(--color-systemRed)' }}>编辑</span>` as the icon. This is the simpler approach and doesn't require NavBar changes.
2. The back button color (`‹ 日历`) stays blue per system convention — this is acceptable and consistent with iOS behavior where the back button matches the parent's tint.

**Decision: Use option 1.** Override right button color inline. Back button stays systemBlue.

### Save action in EventForm
Currently EventForm has a standalone save button with `handleSave` defined inside the component. The redesign removes this button and moves the action to NavBar (rendered in CalendarApp.tsx).

**Solution:** Add a `pendingSave` flag to `calendarNavStore`:
- CalendarApp renders NavBar with "添加"/"完成" right button → on click, sets `pendingSave = true`
- EventForm watches `pendingSave` via `useEffect` → when true, calls `handleSave()` and resets the flag
- The right button is disabled when `canSave` is false — this requires EventForm to expose its validity state. Add a `formValid` boolean to `calendarNavStore` that EventForm updates whenever `canSave` changes.

Store additions to `calendarNavStore`:
```ts
pendingSave: boolean;       // CalendarApp sets true, EventForm consumes
formValid: boolean;         // EventForm updates, CalendarApp reads for button disabled state
setPendingSave: (v: boolean) => void;
setFormValid: (v: boolean) => void;
```

### Reminder/Repeat display values
The data model has no reminder/repeat fields. Both EventDetail and EventForm show static "无" for both fields. The EventDetail mockup showed "提前15分钟" as a visual example, but in implementation all events show "无" since the feature doesn't exist yet.
