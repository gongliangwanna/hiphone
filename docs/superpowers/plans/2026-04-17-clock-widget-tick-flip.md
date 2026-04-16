# Clock Widget — Tick-Border + Flip Clock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new clock widget styles — Tick-Border (2×2) and Flip Clock (4×2) — each with 3 palettes (Mono / Paper / Navy), as additive entries in the registry. Existing 9 variants and all sizes unchanged.

**Architecture:** New styles are appended to `widgetCatalog.clock.styles['2x2']` and `['4x2']` at indices 3–5. `ClockWidget.renderStyle()` switch gets a new `default` branch per size that dispatches `styleIndex − 3` into a new `NEW_PALETTES` array to render `TickBorder2x2` / `FlipClock4x2`. All new components live in-file at the bottom of `ClockWidget.tsx`. The Flip Clock uses a two-phase `rotateX` CSS animation driven by a `useEffect([value])` that mounts transient flap nodes and removes them with `setTimeout`.

**Tech Stack:** React 18, TypeScript, Tailwind (for spacing/flex only — animations in inline styles), Vitest + React Testing Library. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-17-clock-widget-redesign.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/shell/Widgets/registry.tsx` | Modify | Append 3 tick-border + 3 flip-clock style entries |
| `src/shell/Widgets/ClockWidget.tsx` | Modify (append) | Add `NEW_PALETTES`, `TickBorder2x2`, `FlipClock4x2`, `FlipCard`; extend switch |
| `src/shell/Widgets/__tests__/widgets.test.tsx` | Modify | Add tests: tick-border renders for styleIndex 3/4/5, flip renders, flip animates |
| `src/shell/WidgetDrawer/__tests__/WidgetDrawer.test.tsx` | No change | Existing `style-0/style-2` assertions still valid |

---

## Task 1: Registry — append 6 new style entries

**Files:**
- Modify: `src/shell/Widgets/registry.tsx:45-60`
- Test: `src/shell/Widgets/__tests__/widgets.test.tsx` (append new `describe` block)

- [ ] **Step 1.1: Write the failing test**

Append at the bottom of `src/shell/Widgets/__tests__/widgets.test.tsx`:

```tsx
import { getStyleCount } from '../registry';

describe('clock registry — additive tick-border + flip-clock', () => {
  it('2x2 has 6 styles (3 existing + 3 tick-border palettes)', () => {
    expect(getStyleCount('clock', '2x2')).toBe(6);
  });

  it('4x2 has 6 styles (3 existing + 3 flip-clock palettes)', () => {
    expect(getStyleCount('clock', '4x2')).toBe(6);
  });

  it('4x4 remains at 3 styles (unchanged)', () => {
    expect(getStyleCount('clock', '4x4')).toBe(3);
  });

  it('2x2 new styles are labelled 刻度·黑 / 刻度·白 / 刻度·蓝', () => {
    const entry = widgetCatalog.find((e) => e.kind === 'clock')!;
    const styles = entry.styles!['2x2']!;
    expect(styles[3]!.label).toBe('刻度·黑');
    expect(styles[4]!.label).toBe('刻度·白');
    expect(styles[5]!.label).toBe('刻度·蓝');
  });

  it('4x2 new styles are labelled 翻页·黑 / 翻页·米 / 翻页·蓝', () => {
    const entry = widgetCatalog.find((e) => e.kind === 'clock')!;
    const styles = entry.styles!['4x2']!;
    expect(styles[3]!.label).toBe('翻页·黑');
    expect(styles[4]!.label).toBe('翻页·米');
    expect(styles[5]!.label).toBe('翻页·蓝');
  });
});
```

- [ ] **Step 1.2: Run test to verify failure**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "additive tick-border"`
Expected: 5 tests FAIL. `getStyleCount('clock', '2x2')` returns 3, not 6.

- [ ] **Step 1.3: Extend `styles['2x2']` in registry**

In `src/shell/Widgets/registry.tsx`, replace lines 46–50 with:

```ts
      '2x2': [
        { id: 'analog', label: '经典' },
        { id: 'digital', label: '数字' },
        { id: 'minimal', label: '简约' },
        { id: 'tick-mono',  label: '刻度·黑' },
        { id: 'tick-paper', label: '刻度·白' },
        { id: 'tick-navy',  label: '刻度·蓝' },
      ],
```

- [ ] **Step 1.4: Extend `styles['4x2']` in registry**

In the same file, replace lines 51–55 with:

```ts
      '4x2': [
        { id: 'digital-hero', label: '数字' },
        { id: 'dual-city',    label: '双城' },
        { id: 'classic',      label: '经典' },
        { id: 'flip-mono',    label: '翻页·黑' },
        { id: 'flip-paper',   label: '翻页·米' },
        { id: 'flip-navy',    label: '翻页·蓝' },
      ],
```

Do NOT touch `'4x4'`.

- [ ] **Step 1.5: Run registry tests to verify pass**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "additive tick-border"`
Expected: 5 tests PASS.

- [ ] **Step 1.6: Run full widget+drawer test suite — confirm zero regression**

Run: `pnpm vitest run src/shell/Widgets src/shell/WidgetDrawer`
Expected: ALL pass. (The drawer test `defaults to the clock gallery...` only asserts `style-0` presence, which still holds.)

- [ ] **Step 1.7: Commit**

```bash
git add src/shell/Widgets/registry.tsx src/shell/Widgets/__tests__/widgets.test.tsx
git commit -m "$(cat <<'EOF'
feat(widgets): register 6 new clock styles (tick-border × 3, flip-clock × 3)

Appended to styles['2x2'] at indices 3-5 and styles['4x2'] at indices 3-5.
Existing styles untouched; 4x4 unchanged.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Shared palette table + render dispatch fallback

**Files:**
- Modify: `src/shell/Widgets/ClockWidget.tsx` (append below line 154, which is the end of `renderStyle`)

This task just adds the `NEW_PALETTES` constant and a stub component so the registry entries render *something* — we will flesh out the real visuals in Tasks 3 and 4. This intermediate step lets us verify the dispatch wiring in isolation.

- [ ] **Step 2.1: Write the failing test**

Append to the existing `describe('widget components render at every size', ...)` test — no, actually add a new describe:

```tsx
describe('clock renders for new styleIndex values', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T14:32:00+08:00'));
  });

  for (const styleIndex of [3, 4, 5]) {
    it(`2x2 styleIndex=${styleIndex} renders widget-clock root`, () => {
      render(<ClockWidget size="2x2" styleIndex={styleIndex} />);
      expect(screen.getByTestId('widget-clock')).toBeInTheDocument();
    });

    it(`4x2 styleIndex=${styleIndex} renders widget-clock root`, () => {
      render(<ClockWidget size="4x2" styleIndex={styleIndex} />);
      expect(screen.getByTestId('widget-clock')).toBeInTheDocument();
    });
  }
});
```

Also add the import at the top of the test file if not already present:

```tsx
import { ClockWidget } from '../ClockWidget';
```

- [ ] **Step 2.2: Run test to verify failure**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "new styleIndex"`
Expected: 6 tests PASS or FAIL — PASS because `WidgetShell` renders `widget-clock` regardless of what `renderStyle` returns (which is `null` for unknown index). That's fine — the tests pass trivially but exist as guard rails. Leave them.

Actually — let's assert on content that proves the new code path ran. Strengthen the assertions so they actually fail now:

Replace the body of each `it(...)` with:

```tsx
it(`2x2 styleIndex=${styleIndex} renders tick-border marker`, () => {
  const { container } = render(<ClockWidget size="2x2" styleIndex={styleIndex} />);
  expect(container.querySelector('[data-clock-variant="tick"]')).not.toBeNull();
});

it(`4x2 styleIndex=${styleIndex} renders flip-clock marker`, () => {
  const { container } = render(<ClockWidget size="4x2" styleIndex={styleIndex} />);
  expect(container.querySelector('[data-clock-variant="flip"]')).not.toBeNull();
});
```

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "new styleIndex"`
Expected: 6 tests FAIL — `data-clock-variant` attribute not in DOM.

- [ ] **Step 2.3: Add `NEW_PALETTES` + stub components in `ClockWidget.tsx`**

Append at the end of `src/shell/Widgets/ClockWidget.tsx` (after the `useDateLabel` function, line 743):

```tsx
// ===========================================================================
// Tick-Border (2x2) + Flip Clock (4x2) — palette table
// ===========================================================================

interface NewStylePalette {
  /** Background: solid color or linear-gradient CSS string */
  bg: string;
  /** Primary digit / city / time text */
  fg: string;
  /** Tick marks (2x2) / hinge line (4x2) color */
  accent: string;
  /** Flip card top half gradient stops [from, to] */
  cardTop: [string, string];
  /** Flip card bottom half gradient stops [from, to] */
  cardBot: [string, string];
  /** Muted label color (city, timezone) */
  muted: string;
}

const NEW_PALETTES: NewStylePalette[] = [
  // 0 — Mono (pure black ground + cool gray card gradient)
  {
    bg:      '#000',
    fg:      '#f5f5f7',
    accent:  'rgba(255,255,255,0.35)',
    cardTop: ['#2a2a2c', '#1c1c1e'],
    cardBot: ['#181819', '#0f0f10'],
    muted:   'rgba(255,255,255,0.55)',
  },
  // 1 — Paper (warm cream ground + ivory card gradient)
  {
    bg:      '#e6dcc9',
    fg:      '#2a241a',
    accent:  'rgba(90,65,35,0.35)',
    cardTop: ['#fbf6e9', '#f2ead4'],
    cardBot: ['#eee4c9', '#e0d4b5'],
    muted:   'rgba(42,36,26,0.6)',
  },
  // 2 — Navy (deep blue-black ground + navy card gradient)
  {
    bg:      'linear-gradient(165deg, #0f1a2e 0%, #0a1426 100%)',
    fg:      '#f0e9d4',
    accent:  'rgba(240,229,212,0.35)',
    cardTop: ['#1e2d48', '#162540'],
    cardBot: ['#112038', '#0a172d'],
    muted:   'rgba(240,233,212,0.6)',
  },
];

function TickBorder2x2({ palette: _palette, now: _now }: { palette: NewStylePalette; now: Date }) {
  return <div data-clock-variant="tick" />;
}

function FlipClock4x2({ palette: _palette, now: _now }: { palette: NewStylePalette; now: Date }) {
  return <div data-clock-variant="flip" />;
}
```

The stubs carry the marker attributes only; visuals come in later tasks.

- [ ] **Step 2.4: Extend `renderStyle` switch to dispatch new styleIndex**

In `src/shell/Widgets/ClockWidget.tsx`, replace the body of `renderStyle` (lines 131–154) with:

```tsx
function renderStyle(size: WidgetSize, styleIndex: number, now: Date, p: ClockPalette) {
  if (size === '2x2') {
    switch (styleIndex) {
      case 0: return <AnalogSmall city={BEIJING} now={now} palette={p} />;
      case 1: return <DigitalSmall city={BEIJING} now={now} palette={p} />;
      case 2: return <MinimalSmall city={BEIJING} now={now} palette={p} />;
      case 3: case 4: case 5:
        return <TickBorder2x2 palette={NEW_PALETTES[styleIndex - 3]!} now={now} />;
    }
  }
  if (size === '4x2') {
    switch (styleIndex) {
      case 0: return <DigitalHeroLayout city={BEIJING} now={now} palette={p} />;
      case 1: return <DualCityLayout cities={DUAL_CITIES} now={now} palette={p} />;
      case 2: return <ClassicAnalogMedium city={BEIJING} now={now} palette={p} />;
      case 3: case 4: case 5:
        return <FlipClock4x2 palette={NEW_PALETTES[styleIndex - 3]!} now={now} />;
    }
  }
  if (size === '4x4') {
    switch (styleIndex) {
      case 0: return <QuadClockLayout cities={QUAD_CITIES} now={now} palette={p} />;
      case 1: return <ClassicWatchLayout city={BEIJING} now={now} palette={p} />;
      case 2: return <DigitalFullLayout city={BEIJING} now={now} palette={p} />;
    }
  }
  return null;
}
```

Note: 4×4 remains untouched.

- [ ] **Step 2.5: Run tests to verify pass**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "new styleIndex"`
Expected: 6 tests PASS.

- [ ] **Step 2.6: Run full widget test suite — no regression**

Run: `pnpm vitest run src/shell/Widgets src/shell/WidgetDrawer`
Expected: ALL pass.

- [ ] **Step 2.7: Commit**

```bash
git add src/shell/Widgets/ClockWidget.tsx src/shell/Widgets/__tests__/widgets.test.tsx
git commit -m "$(cat <<'EOF'
feat(widgets): wire new clock styleIndex 3-5 dispatch (stub components)

Introduce NEW_PALETTES table and stub TickBorder2x2 / FlipClock4x2 that
only emit a data-clock-variant marker. Dispatch goes to palette =
styleIndex - 3. Real visuals land in the next tasks.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: TickBorder2x2 — full visual

**Files:**
- Modify: `src/shell/Widgets/ClockWidget.tsx` (replace `TickBorder2x2` stub)
- Test: `src/shell/Widgets/__tests__/widgets.test.tsx`

Tick-Border is purely static (no animation). It draws an SVG rounded rect with dashed stroke as the "tick ring" plus three text rows.

- [ ] **Step 3.1: Write the failing test**

Append a new describe after the previous one in the test file:

```tsx
describe('TickBorder2x2 visual', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 14:32 local time → parts hour=14 minute=32 in Asia/Shanghai.
    vi.setSystemTime(new Date('2026-04-17T06:32:00Z'));
  });

  it.each([[3, 'mono'], [4, 'paper'], [5, 'navy']])(
    'styleIndex=%i renders city, HH:MM, and GMT label',
    (styleIndex) => {
      render(<ClockWidget size="2x2" styleIndex={styleIndex as number} />);
      expect(screen.getByText('北京')).toBeInTheDocument();
      expect(screen.getByText('14:32')).toBeInTheDocument();
      expect(screen.getByText('GMT+8')).toBeInTheDocument();
    },
  );

  it('renders an SVG tick ring with a dashed stroke', () => {
    const { container } = render(<ClockWidget size="2x2" styleIndex={3} />);
    const svg = container.querySelector('svg[data-clock-ticks]');
    expect(svg).not.toBeNull();
    const rect = svg!.querySelector('rect');
    expect(rect).not.toBeNull();
    expect(rect!.getAttribute('stroke-dasharray')).toBe('1 5');
  });
});
```

- [ ] **Step 3.2: Run test to verify failure**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "TickBorder2x2 visual"`
Expected: 4 tests FAIL (stub only emits a marker div).

- [ ] **Step 3.3: Replace the TickBorder2x2 stub with real component**

In `src/shell/Widgets/ClockWidget.tsx`, replace the stub body with:

```tsx
function TickBorder2x2({ palette, now }: { palette: NewStylePalette; now: Date }) {
  const parts = useTimeParts(now, BEIJING.timeZone);
  const hh = parts.hours.toString().padStart(2, '0');
  const mm = parts.minutes.toString().padStart(2, '0');
  return (
    <div
      data-clock-variant="tick"
      style={{
        position: 'absolute',
        inset: 0,
        background: palette.bg,
        color: palette.fg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 0 16px',
      }}
    >
      {/* Tick ring: a rounded rectangle stroke with dashed pattern.
          On a 170×170 cell, the rect inset leaves ~13px margin; a 10px
          wide dashed stroke (dasharray 1 5) produces 1×10px vertical
          ticks perpendicular to the path. */}
      <svg
        data-clock-ticks
        viewBox="0 0 170 170"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        aria-hidden
      >
        <rect
          x={13}
          y={13}
          width={144}
          height={144}
          rx={13}
          ry={13}
          fill="none"
          stroke={palette.accent}
          strokeWidth={10}
          strokeDasharray="1 5"
        />
      </svg>

      <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.75, letterSpacing: '0.04em' }}>
        {BEIJING.label}
      </span>
      <span
        style={{
          fontSize: 40,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {hh}:{mm}
      </span>
      <span style={{ fontSize: 12, fontWeight: 500, color: palette.muted, letterSpacing: '0.03em' }}>
        GMT+8
      </span>
    </div>
  );
}
```

Note: we use the existing `useTimeParts` hook (line 700) so the new code reuses the same tz-aware time path. `BEIJING` const is at line 18.

- [ ] **Step 3.4: Run test to verify pass**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "TickBorder2x2 visual"`
Expected: 4 tests PASS.

- [ ] **Step 3.5: Run full test suite + typecheck**

Run: `pnpm vitest run src/shell/Widgets && pnpm tsc --noEmit`
Expected: All tests pass, no TS errors.

- [ ] **Step 3.6: Commit**

```bash
git add src/shell/Widgets/ClockWidget.tsx src/shell/Widgets/__tests__/widgets.test.tsx
git commit -m "$(cat <<'EOF'
feat(widgets): implement TickBorder2x2 tick-ring watch face

SVG rounded-rect with stroke-dasharray tick ring around 北京 / HH:MM /
GMT+8. Three palette variants (mono / paper / navy) via styleIndex 3-5.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: FlipCard — static digit rendering (no animation)

**Files:**
- Modify: `src/shell/Widgets/ClockWidget.tsx`
- Test: `src/shell/Widgets/__tests__/widgets.test.tsx`

Before we touch animation we render a static flip card that shows a value across a top/bottom half with a hinge. This is testable independently of time ticking.

- [ ] **Step 4.1: Write the failing test**

Append to test file:

```tsx
describe('FlipCard static rendering', () => {
  // Flip card is exposed only through FlipClock4x2; we assert on the DOM
  // structure rendered for styleIndex=3 (flip-mono).
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-17T06:32:00Z'));
  });

  it('4x2 styleIndex=3 renders two flip cards (hh + mm)', () => {
    const { container } = render(<ClockWidget size="4x2" styleIndex={3} />);
    const cards = container.querySelectorAll('[data-flip-card]');
    expect(cards.length).toBe(2);
    expect(cards[0]!.getAttribute('data-role')).toBe('hh');
    expect(cards[1]!.getAttribute('data-role')).toBe('mm');
  });

  it('each flip card has a top half and bottom half showing the current digit', () => {
    const { container } = render(<ClockWidget size="4x2" styleIndex={3} />);
    const hhCard = container.querySelector('[data-flip-card][data-role="hh"]')!;
    const top = hhCard.querySelector('[data-flip-half="top"]');
    const bot = hhCard.querySelector('[data-flip-half="bottom"]');
    expect(top).not.toBeNull();
    expect(bot).not.toBeNull();
    // 14:32 → hh=14
    expect(top!.textContent).toBe('14');
    expect(bot!.textContent).toBe('14');
  });

  it('each flip card has a hinge element at 50% height', () => {
    const { container } = render(<ClockWidget size="4x2" styleIndex={3} />);
    const hinge = container.querySelector('[data-flip-card][data-role="hh"] [data-flip-hinge]');
    expect(hinge).not.toBeNull();
  });
});
```

- [ ] **Step 4.2: Run test to verify failure**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "FlipCard static rendering"`
Expected: 3 tests FAIL (stub only emits an empty marker div).

- [ ] **Step 4.3: Implement FlipCard + replace FlipClock4x2 stub**

In `src/shell/Widgets/ClockWidget.tsx`, replace the stub FlipClock4x2 body and add a FlipCard component:

```tsx
function FlipClock4x2({ palette, now }: { palette: NewStylePalette; now: Date }) {
  const parts = useTimeParts(now, BEIJING.timeZone);
  const hh = parts.hours.toString().padStart(2, '0');
  const mm = parts.minutes.toString().padStart(2, '0');
  return (
    <div
      data-clock-variant="flip"
      style={{
        position: 'absolute',
        inset: 0,
        background: palette.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      <FlipCard value={hh} role="hh" palette={palette} />
      <FlipCard value={mm} role="mm" palette={palette} />
    </div>
  );
}

/**
 * A single 132×132 flip card. Top half and bottom half are fixed DOM
 * nodes showing the current `value`; animation on value change is added
 * in Task 5 by mounting transient `fc-flap-*` nodes above them.
 */
function FlipCard({
  value,
  role,
  palette,
}: {
  value: string;
  role: 'hh' | 'mm';
  palette: NewStylePalette;
}) {
  const cardHeight = 132;
  const digitStyle = {
    fontSize: 104,
    fontWeight: 700,
    lineHeight: `${cardHeight}px`,
    height: cardHeight,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums' as const,
    color: palette.fg,
    display: 'block' as const,
  };
  const halfBase = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: '50%',
    overflow: 'hidden' as const,
    display: 'flex',
    justifyContent: 'center' as const,
  };
  return (
    <div
      data-flip-card
      data-role={role}
      style={{
        position: 'relative',
        width: cardHeight,
        height: cardHeight,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        perspective: 600,
      }}
    >
      <div
        data-flip-half="top"
        style={{
          ...halfBase,
          top: 0,
          background: `linear-gradient(180deg, ${palette.cardTop[0]} 0%, ${palette.cardTop[1]} 100%)`,
        }}
      >
        <span style={{ ...digitStyle, marginTop: 0 }}>{value}</span>
      </div>
      <div
        data-flip-half="bottom"
        style={{
          ...halfBase,
          bottom: 0,
          background: `linear-gradient(180deg, ${palette.cardBot[0]} 0%, ${palette.cardBot[1]} 100%)`,
        }}
      >
        <span style={{ ...digitStyle, marginTop: -(cardHeight / 2) }}>{value}</span>
      </div>
      <div
        data-flip-hinge
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          transform: 'translateY(-0.5px)',
          background: palette.accent,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
```

Key CSS trick: bottom half shows the same `value` string but with `margin-top: -66px` (half card height). Combined with `line-height: 132px` on the span and `overflow: hidden` on the half container, this makes the top half show the top half of the digit and the bottom half show the bottom half of the same digit.

- [ ] **Step 4.4: Run tests to verify pass**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "FlipCard static rendering"`
Expected: 3 tests PASS.

- [ ] **Step 4.5: Re-run TickBorder tests — flip replacement did not break them**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx`
Expected: ALL pass.

- [ ] **Step 4.6: Commit**

```bash
git add src/shell/Widgets/ClockWidget.tsx src/shell/Widgets/__tests__/widgets.test.tsx
git commit -m "$(cat <<'EOF'
feat(widgets): implement FlipClock4x2 static flip cards (HH + MM)

Two 132×132 cards, each split top/bottom via overflow-hidden halves +
line-height trick so one digit spans both halves without duplication
artifacts. No animation yet — added in next task.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FlipCard — two-phase flip animation on value change

**Files:**
- Modify: `src/shell/Widgets/ClockWidget.tsx` (FlipCard: add useEffect + flap nodes)
- Test: `src/shell/Widgets/__tests__/widgets.test.tsx`

On `value` change, mount two transient flap nodes (`data-flip-flap="top"` with the **old** value rotating from 0 to -90°, and `data-flip-flap="bottom"` with the **new** value rotating from 90° to 0°). Remove them after animation completes (360ms for top, 720ms for bottom). Also swap `data-flip-half="bottom"` content to the new value at t=720ms — this is the "landing moment" of the flap.

- [ ] **Step 5.1: Write the failing animation test**

Append:

```tsx
describe('FlipCard animation on value change', () => {
  // Use a minimal harness: render FlipClock4x2 twice across a minute boundary
  // and assert flap nodes appear + disappear on schedule.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('mounts flap nodes when hh/mm change, removes them after 720ms', () => {
    vi.setSystemTime(new Date('2026-04-17T06:32:00Z'));
    const { container, rerender } = render(
      <ClockWidget size="4x2" styleIndex={3} />,
    );

    // Initial render has no flap nodes yet.
    expect(container.querySelectorAll('[data-flip-flap]').length).toBe(0);

    // Advance to 14:33 so minute changes.
    vi.setSystemTime(new Date('2026-04-17T06:33:00Z'));
    rerender(<ClockWidget size="4x2" styleIndex={3} />);

    // After the rerender, useEffect schedules the animation — both flap
    // nodes are in the DOM during the animation window.
    const mmCard = container.querySelector('[data-flip-card][data-role="mm"]')!;
    expect(mmCard.querySelector('[data-flip-flap="top"]')).not.toBeNull();
    expect(mmCard.querySelector('[data-flip-flap="bottom"]')).not.toBeNull();

    // After 400ms the top flap has been removed (it finishes at 360ms).
    act(() => vi.advanceTimersByTime(400));
    expect(mmCard.querySelector('[data-flip-flap="top"]')).toBeNull();

    // After 800ms total, bottom flap is gone too.
    act(() => vi.advanceTimersByTime(400));
    expect(mmCard.querySelector('[data-flip-flap="bottom"]')).toBeNull();
  });

  it('hh card does not animate when only mm changes', () => {
    vi.setSystemTime(new Date('2026-04-17T06:32:00Z'));
    const { container, rerender } = render(
      <ClockWidget size="4x2" styleIndex={3} />,
    );
    vi.setSystemTime(new Date('2026-04-17T06:33:00Z'));
    rerender(<ClockWidget size="4x2" styleIndex={3} />);
    const hhCard = container.querySelector('[data-flip-card][data-role="hh"]')!;
    expect(hhCard.querySelector('[data-flip-flap]')).toBeNull();
  });
});
```

Add `act` to the existing testing-library import at the top of the test file if not already present:

```tsx
import { render, screen, fireEvent, within, act } from '@testing-library/react';
```

- [ ] **Step 5.2: Run test to verify failure**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "FlipCard animation"`
Expected: 2 tests FAIL. The static FlipCard from Task 4 has no flap nodes.

- [ ] **Step 5.3: Add animation to FlipCard**

In `src/shell/Widgets/ClockWidget.tsx`, replace the `FlipCard` function from Task 4 with this version that adds the flap effect. Keep all existing styling; the additions are (a) `useRef` for tracking previous value, (b) `useState` for the in-flight flap snapshot, (c) `useEffect` that schedules the animation.

```tsx
function FlipCard({
  value,
  role,
  palette,
}: {
  value: string;
  role: 'hh' | 'mm';
  palette: NewStylePalette;
}) {
  const cardHeight = 132;
  const prevValueRef = useRef<string>(value);
  // When value changes we capture the OLD value and the NEW value so the
  // two transient flap nodes can render them independently for 720ms.
  const [flap, setFlap] = useState<{ old: string; next: string } | null>(null);

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;
    if (prev === value) return;

    setFlap({ old: prev, next: value });
    // top flap finishes at 360ms; bottom flap + landing at 720ms.
    const cleanupTop = setTimeout(() => {
      // the top flap is removed via CSS animation completion; we only
      // need to make sure the state keeps the bottom flap mounted until
      // its own animation finishes — so we don't clear flap here.
    }, 360);
    const cleanupBot = setTimeout(() => {
      setFlap(null);
    }, 720);
    return () => {
      clearTimeout(cleanupTop);
      clearTimeout(cleanupBot);
    };
  }, [value]);

  const digitStyle = {
    fontSize: 104,
    fontWeight: 700,
    lineHeight: `${cardHeight}px`,
    height: cardHeight,
    letterSpacing: '-0.04em',
    fontVariantNumeric: 'tabular-nums' as const,
    color: palette.fg,
    display: 'block' as const,
  };
  const halfBase = {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    height: '50%',
    overflow: 'hidden' as const,
    display: 'flex',
    justifyContent: 'center' as const,
  };
  const topBg  = `linear-gradient(180deg, ${palette.cardTop[0]} 0%, ${palette.cardTop[1]} 100%)`;
  const botBg  = `linear-gradient(180deg, ${palette.cardBot[0]} 0%, ${palette.cardBot[1]} 100%)`;

  return (
    <div
      data-flip-card
      data-role={role}
      style={{
        position: 'relative',
        width: cardHeight,
        height: cardHeight,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
        perspective: 600,
      }}
    >
      {/* Static halves always show the current value. */}
      <div data-flip-half="top" style={{ ...halfBase, top: 0, background: topBg }}>
        <span style={{ ...digitStyle, marginTop: 0 }}>{value}</span>
      </div>
      <div data-flip-half="bottom" style={{ ...halfBase, bottom: 0, background: botBg }}>
        <span style={{ ...digitStyle, marginTop: -(cardHeight / 2) }}>{value}</span>
      </div>

      {/* Flaps — mounted only while animating. */}
      {flap && (
        <>
          <div
            data-flip-flap="top"
            style={{
              ...halfBase,
              top: 0,
              background: topBg,
              zIndex: 3,
              transformOrigin: 'bottom',
              animation: 'clock-flip-top 360ms ease-in forwards',
              backfaceVisibility: 'hidden',
            }}
          >
            <span style={{ ...digitStyle, marginTop: 0 }}>{flap.old}</span>
          </div>
          <div
            data-flip-flap="bottom"
            style={{
              ...halfBase,
              bottom: 0,
              background: botBg,
              zIndex: 3,
              transformOrigin: 'top',
              transform: 'rotateX(90deg)',
              animation: 'clock-flip-bottom 360ms 360ms ease-out forwards',
              backfaceVisibility: 'hidden',
            }}
          >
            <span style={{ ...digitStyle, marginTop: -(cardHeight / 2) }}>{flap.next}</span>
          </div>
        </>
      )}

      <div
        data-flip-hinge
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '50%',
          height: 1,
          transform: 'translateY(-0.5px)',
          background: palette.accent,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
```

Also add the imports if they aren't already in the ClockWidget file (they are — `useEffect, useState` at line 1; add `useRef`):

```tsx
import { useEffect, useState, useMemo, useRef } from 'react';
```

- [ ] **Step 5.4: Add `@keyframes` for the flip to the app global stylesheet**

The animation references `@keyframes clock-flip-top` and `clock-flip-bottom`. The project global stylesheet is `src/styles/global.css` (imported by `src/main.tsx:4`). Append to the bottom of `src/styles/global.css`:

```css
/* Clock widget — Flip Clock (4x2) mechanical animation.
   Two-phase: top flap falls forward (0-360ms), then bottom flap rises
   (360-720ms). Used by src/shell/Widgets/ClockWidget.tsx FlipCard. */
@keyframes clock-flip-top {
  0%   { transform: rotateX(0deg); }
  100% { transform: rotateX(-90deg); }
}
@keyframes clock-flip-bottom {
  0%   { transform: rotateX(90deg); }
  100% { transform: rotateX(0deg); }
}
```

- [ ] **Step 5.5: Run animation tests to verify pass**

Run: `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx -t "FlipCard animation"`
Expected: 2 tests PASS.

- [ ] **Step 5.6: Re-run full test suite**

Run: `pnpm vitest run`
Expected: ALL pass. No regression in other widgets, drawer, or store.

- [ ] **Step 5.7: Commit**

```bash
git add src/shell/Widgets/ClockWidget.tsx src/shell/Widgets/__tests__/widgets.test.tsx src/styles/global.css
git commit -m "$(cat <<'EOF'
feat(widgets): two-phase rotateX flip animation on minute/hour change

FlipCard mounts transient flap nodes on value change: top flap falls
0→-90° (0-360ms), bottom flap rises 90°→0° (360-720ms). Cleanup via
setTimeout; cleanup timers cleared on unmount to avoid stale setState.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Manual verification in browser

**Files:** (none modified)

- [ ] **Step 6.1: Run dev server**

Run: `pnpm dev`
Expected: Server starts on http://localhost:5173 (or next available port).

- [ ] **Step 6.2: Verify drawer shows 6 styles per size**

1. Open the iPhone shell in browser
2. Long-press empty space on Springboard → enters edit mode
3. Tap "+" to open widget drawer
4. Clock category (default) should show 6 cards for 2×2 (analog/digital/minimal/tick-mono/tick-paper/tick-navy) and 6 for 4×2 (digital-hero/dual-city/classic/flip-mono/flip-paper/flip-navy) and 3 for 4×4 (unchanged).

Expected: All 6 cards render per new size row without overflow; scroll strip works.

- [ ] **Step 6.3: Verify TickBorder2x2 looks right**

1. Tap "刻度·黑" card → tick-mono 2×2 clock added to current page
2. Leave edit mode
3. Observe: black background, 北京 / 14:32-like text / GMT+8, dashed tick ring around edge.
4. Add "刻度·白" and "刻度·蓝" too. Verify 3 distinct palettes render.

- [ ] **Step 6.4: Verify FlipClock4x2 animates on minute boundary**

1. Add "翻页·黑" 4×2 clock
2. Watch the current minute value — wait until the real system minute ticks forward
3. The MM card should flip: top half falls, bottom half rises.

If you don't want to wait a minute, temporarily edit `useLiveTime()` to poll every 2 seconds and manipulate demoMode for visual check. Remove change before commit.

- [ ] **Step 6.5: Verify WidgetShell preview scaling**

In drawer, each new style card should render at the correct preview dimensions (not overflowing its slot). The test suite covers this, but eyeball it too — the tick-border ring and flip-card digits should scale proportionally to the preview box.

No commit in this task (manual verification only).

---

## Task 7: Build + Cloudflare Pages deploy

**Files:** (none modified — deployment only)

Per project CLAUDE.md: `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md`.

- [ ] **Step 7.1: Production build**

Run: `pnpm build`
Expected: Build succeeds (`dist/` populated). Address any TS errors surfaced here.

- [ ] **Step 7.2: Deploy to Cloudflare Pages**

Run: `npx -y wrangler pages deploy dist --project-name mini-iphone --commit-dirty=true`
Expected: Upload succeeds; deployment URL printed.

- [ ] **Step 7.3: Verify live site**

Open https://mini-iphone.pages.dev/ in a browser.

Check:
- Widget drawer → clock → 2×2 has 6 cards, 4×2 has 6 cards, 4×4 has 3 cards.
- Add one of each new style; render is pixel-correct vs. dev server.
- Flip Clock animates on minute change on real deployment.

- [ ] **Step 7.4: Record deployment**

```bash
echo "Deployed clock widget redesign $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> docs/deploy-log.md 2>/dev/null || true
```

(If `docs/deploy-log.md` doesn't exist, skip — not a load-bearing file.)

No code commit in this task.

---

## Self-Review Notes

- **Spec coverage**:
  - §验收 1/2 (drawer 2×2→6 / 4×2→6) → Task 1
  - §验收 3 (4×4 unchanged) → Task 1 (asserted by `getStyleCount 4x4 === 3` test)
  - §验收 4 (tick visual) → Task 3
  - §验收 5 (flip animation) → Tasks 4 + 5
  - §验收 6 (zero regression) → Task 1.6 + Task 5.6 full-suite runs
  - §验收 7 (unit tests pass) → every task runs targeted suite + Task 5.6 full
  - §决策 1 (registry shape) → Task 1
  - §决策 2 (dispatch layer) → Task 2
  - §决策 3 (TickBorder specs) → Task 3
  - §决策 4 (FlipClock specs + animation) → Tasks 4 + 5
  - §决策 5 (useLiveTime reuse) → Tasks 3 + 4 both use existing `useTimeParts`/`useLiveTime`
  - §决策 6 (non-invasive) → Tasks 1–5 only append; `WidgetShell`, `springboardLayoutStore`, existing variants untouched
  - §风险 "drawer 15 个 style 布局" → Task 6.2 manual verify

- **No placeholders**: searched — no TBD / TODO / "implement later" / "similar to Task N". All code blocks are complete drop-ins.

- **Type consistency**:
  - `NewStylePalette` used identically in Tasks 2, 3, 4, 5 ✓
  - `FlipCard` props (`value, role, palette`) defined Task 4 and re-used Task 5 ✓
  - Attribute naming: `data-flip-card / data-flip-half / data-flip-hinge / data-flip-flap` consistent across Tasks 4 + 5 + tests ✓
  - `data-clock-variant="tick"|"flip"` used in Tasks 2, 3, 4 — matches Task 2 test assertions ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-17-clock-widget-tick-flip.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
