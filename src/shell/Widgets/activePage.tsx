import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Active-page coordination for the springboard.
 *
 * # Why this exists
 *
 * The springboard mounts every page concurrently — page virtualization is
 * deliberately avoided so cross-page Framer `layout` FLIP and drag previews
 * keep working. The cost is that high-frequency widget tick sources keep
 * running on offscreen pages and fight the swipe animation for the same
 * compositor / main thread.
 *
 * Hot offenders we want to silence offscreen:
 *   - `ClockWidget` 1 Hz interval that re-renders the SVG analog face
 *   - `MusicWidget`'s `ProgressBarLive` ~15 Hz subscription to the audio
 *     engine `progress` field
 *   - `PhotoWidget`'s 14 s Ken Burns CSS keyframe (60 Hz GPU)
 *
 * # The contract
 *
 * `Springboard` wraps its track in `<ActivePagesProvider currentPage={n} />`.
 * Each `IconGrid` re-publishes its own `pageIndex` via the inner
 * `<PageIndexProvider />`. Widgets call `useIsPageActive()` (no args) to
 * check whether their containing page is currently active. When false,
 * widget hooks short-circuit their tick / subscription logic but the
 * components stay mounted (so re-activation is instantaneous, no remount
 * flicker, no data refetch).
 *
 * # Active set policy
 *
 * "Active" = the visible page only. Adjacent pages are NOT active by
 * default — even though they may briefly be on-screen mid-swipe, the user
 * can't see widget tick deltas during that ~250ms window. Re-activating
 * after the swipe lands is one extra `setNow(new Date())` per widget,
 * which is essentially free.
 *
 * Drag operations widen the active set to all pages so widget previews
 * stay accurate while a user holds and inspects an icon — the
 * `forceAllActive` flag covers this.
 */

interface ActivePagesContextValue {
  /** The single page currently in focus. */
  currentPage: number;
  /** When true, every page reports active (used during drag). */
  forceAllActive: boolean;
}

const ActivePagesContext = createContext<ActivePagesContextValue>({
  currentPage: 0,
  forceAllActive: false,
});

/**
 * Local-to-this-grid value: which page index this widget subtree belongs
 * to. Set by `IconGrid` for each page it renders.
 */
const PageIndexContext = createContext<number | null>(null);

interface ActivePagesProviderProps {
  currentPage: number;
  forceAllActive?: boolean;
  children: ReactNode;
}

export function ActivePagesProvider({
  currentPage,
  forceAllActive = false,
  children,
}: ActivePagesProviderProps) {
  const value = useMemo<ActivePagesContextValue>(
    () => ({ currentPage, forceAllActive }),
    [currentPage, forceAllActive],
  );
  return (
    <ActivePagesContext.Provider value={value}>
      {children}
    </ActivePagesContext.Provider>
  );
}

interface PageIndexProviderProps {
  pageIndex: number;
  children: ReactNode;
}

export function PageIndexProvider({ pageIndex, children }: PageIndexProviderProps) {
  return (
    <PageIndexContext.Provider value={pageIndex}>
      {children}
    </PageIndexContext.Provider>
  );
}

/**
 * Returns true if the calling component's containing page is currently
 * active. When called outside any `<PageIndexProvider />` (e.g. drawer
 * preview), defaults to `true` so widgets render normally.
 */
export function useIsPageActive(): boolean {
  const ctx = useContext(ActivePagesContext);
  const pageIndex = useContext(PageIndexContext);
  if (pageIndex === null) return true; // outside the springboard, e.g. drawer
  if (ctx.forceAllActive) return true;
  return pageIndex === ctx.currentPage;
}
