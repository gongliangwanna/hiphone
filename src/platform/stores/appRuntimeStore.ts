import { create } from 'zustand';
import { project } from '@/platform/gesture/projection';

export interface AppOrigin {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RuntimeAppTask {
  id: string;
  origin: AppOrigin | null;
}

export type AppTransitionSource = 'icon' | 'switcher';
export type AppPresentationMode = 'foreground' | 'switcher';
/** Status bar text style: 'light' = white text (for dark backgrounds), 'dark' = system default */
export type StatusBarStyle = 'light' | 'dark';
/** Why an app is currently in "dismissed" state. Drives the exit animation
 *  shape in `AppHost`: 'card' flies out the top, 'home' drops down the bottom. */
export type DismissReason = 'home' | 'card' | null;

// Projection threshold for card dismiss: projected travel exceeds this
// fraction of the card height → commit. Single physics-based decision that
// replaces the old distance-OR-velocity double-threshold.
const CARD_DISMISS_PROJECTED_RATIO = 0.20;

interface CardDismissContext {
  appId: string | null;
  startY: number;
  cardHeight: number;
  /** Signed displacement from startY (negative = finger moved up). Stored
   *  raw (not clamped to card height) so projection can reason about
   *  flicks that carry past the card bounds. */
  deltaY: number;
  /** Normalized 0..1 upward progress relative to card height. UI-only;
   *  decision logic uses `deltaY` + `velocityY` via `project()`. */
  progress: number;
  velocityY: number;
}

/** Return value of `finishCardDismiss`. P0c — UI layer uses `velocity` to
 *  drive a velocity-aware fly-away, and `committed` to decide spring target. */
export interface FinishCardDismissResult {
  committed: boolean;
  /** px / ms, negative = upward, 0 when no gesture was in progress. */
  velocity: number;
  appId: string | null;
}

export interface AppEventNonces {
  /** New-launch count (fresh start or after kill). */
  launch: number;
  /** Resume count (foreground from background). */
  resume: number;
  /** Background count (foreground → background). */
  background: number;
  /** Kill count (swiped away). */
  kill: number;
}

export interface AppRuntimeState {
  activeAppId: string | null;
  appOrigin: AppOrigin | null;
  /** Rect of the switcher card the user tapped to activate, in device-root
   *  local coordinates. Set by `activateAppFromCard`, used by `AppHost` to
   *  morph from that location. */
  switcherCardOrigin: AppOrigin | null;
  /** Device-root dimensions captured at the time the switcher card was
   *  tapped. Paired with `switcherCardOrigin` so AppHost can compute the
   *  scale/translate for the morph without re-measuring the DOM. */
  switcherCardViewport: { width: number; height: number } | null;
  recentApps: RuntimeAppTask[];
  switcherAppId: string | null;
  transitionSource: AppTransitionSource;
  presentationMode: AppPresentationMode;
  dismissedAppId: string | null;
  /** Why the current dismissed app is being dismissed. Set by callers of
   *  `removeApp` (finishCardDismiss → 'card', exitAppToHome → 'home'). */
  dismissReason: DismissReason;
  /** True while the foreground → switcher shrink animation is in progress. */
  switcherEnterAnimating: boolean;
  /** True while AppHost is being redirected to fly away from the switcher.
   *  Set when user swipes up during entrance animation. */
  switcherDismissing: boolean;
  statusBarStyle: StatusBarStyle;
  /** Monotonically increasing lifecycle event nonces per app. Hooks
   *  subscribe via useEffect on the relevant nonce field. */
  appEvents: Record<string, AppEventNonces>;
  setStatusBarStyle: (style: StatusBarStyle) => void;
  openApp: (id: string, origin: AppOrigin | null) => void;
  activateApp: (id: string, source?: AppTransitionSource) => void;
  activateAppFromCard: (
    id: string,
    cardRect: AppOrigin,
    viewport: { width: number; height: number },
  ) => void;
  goHome: () => void;
  /** Exit the current app back to the springboard with a dismiss animation.
   *  Unlike `goHome()` which is an instant transition, this sets
   *  `dismissedAppId` + `dismissReason` so AppHost plays the drop-down exit. */
  exitAppToHome: () => void;
  /** Enter switcher mode directly (e.g. from AssistiveTouch menu). */
  openSwitcher: () => void;
  /** Signal that the foreground → switcher shrink animation has completed. */
  finishSwitcherEnter: () => void;
  /** Redirect AppHost to fly away during switcher entrance animation. */
  dismissActiveFromSwitcher: () => void;
  /** Called when AppHost fly-away animation completes — cleans up state and removes app. */
  finishSwitcherDismiss: () => void;
  removeApp: (id: string) => void;
  focusAppInSwitcher: (id: string | null) => void;
  startCardDismiss: (appId: string, startY: number, cardHeight: number) => void;
  updateCardDismiss: (currentY: number, velocityY: number) => void;
  finishCardDismiss: () => FinishCardDismissResult;
  clearDismissedApp: () => void;
  cardDismiss: CardDismissContext;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function moveTaskToFront(tasks: RuntimeAppTask[], task: RuntimeAppTask): RuntimeAppTask[] {
  return [task, ...tasks.filter((item) => item.id !== task.id)];
}

function resolveFallbackTask(tasks: RuntimeAppTask[], removedIndex: number): RuntimeAppTask | null {
  if (tasks.length === 0) return null;

  return tasks[Math.min(removedIndex, tasks.length - 1)] ?? tasks[0] ?? null;
}

function resetCardDismissState() {
  return {
    cardDismiss: {
      appId: null,
      startY: 0,
      cardHeight: 1,
      deltaY: 0,
      progress: 0,
      velocityY: 0,
    },
  };
}

// Internal helper used by openApp / activateApp / goHome / exitAppToHome /
// removeApp to maintain per-app lifecycle nonces. Exported for tests.
export function bumpEvent(
  events: Record<string, AppEventNonces>,
  id: string,
  kind: keyof AppEventNonces,
): Record<string, AppEventNonces> {
  const prev = events[id] ?? { launch: 0, resume: 0, background: 0, kill: 0 };
  return {
    ...events,
    [id]: { ...prev, [kind]: prev[kind] + 1 },
  };
}

export const useAppRuntimeStore = create<AppRuntimeState>()((set, get) => ({
  activeAppId: null,
  appOrigin: null,
  switcherCardOrigin: null,
  switcherCardViewport: null,
  recentApps: [],
  switcherAppId: null,
  transitionSource: 'icon',
  presentationMode: 'foreground',
  dismissedAppId: null,
  dismissReason: null,
  switcherEnterAnimating: false,
  switcherDismissing: false,
  statusBarStyle: 'dark',
  appEvents: {},
  setStatusBarStyle: (style) => set({ statusBarStyle: style }),
  cardDismiss: {
    appId: null,
    startY: 0,
    cardHeight: 1,
    deltaY: 0,
    progress: 0,
    velocityY: 0,
  },

  openApp: (id, origin) =>
    set((state) => {
      const alreadyActive = state.activeAppId === id;
      const wasKilled = wasAppKilled(id);
      const wasInRecent = state.recentApps.some((t) => t.id === id);

      let nextEvents = state.appEvents;
      if (!alreadyActive) {
        if (wasKilled) {
          clearAppKilled(id);
          nextEvents = bumpEvent(nextEvents, id, 'launch');
        } else if (wasInRecent) {
          nextEvents = bumpEvent(nextEvents, id, 'resume');
        } else {
          nextEvents = bumpEvent(nextEvents, id, 'launch');
        }
      }

      const task = { id, origin };

      return {
        activeAppId: id,
        appOrigin: origin,
        switcherCardOrigin: null,
        switcherCardViewport: null,
        recentApps: moveTaskToFront(state.recentApps, task),
        switcherAppId: id,
        transitionSource: 'icon',
        presentationMode: 'foreground',
        dismissedAppId: null,
        dismissReason: null,
        switcherDismissing: false,
        appEvents: nextEvents,
        ...resetCardDismissState(),
      };
    }),

  activateApp: (id, source = 'switcher') =>
    set((state) => {
      const alreadyActive = state.activeAppId === id;
      const wasKilled = wasAppKilled(id);

      let nextEvents = state.appEvents;
      if (!alreadyActive) {
        if (wasKilled) {
          clearAppKilled(id);
          nextEvents = bumpEvent(nextEvents, id, 'launch');
        } else {
          nextEvents = bumpEvent(nextEvents, id, 'resume');
        }
      }

      const task = state.recentApps.find((item) => item.id === id) ?? { id, origin: null };

      return {
        activeAppId: id,
        appOrigin: task.origin,
        recentApps: moveTaskToFront(state.recentApps, task),
        switcherAppId: id,
        transitionSource: source,
        presentationMode: 'foreground',
        switcherEnterAnimating: false,
        dismissedAppId: null,
        dismissReason: null,
        switcherDismissing: false,
        appEvents: nextEvents,
        ...resetCardDismissState(),
      };
    }),

  activateAppFromCard: (id, cardRect, viewport) => {
    set({ switcherCardOrigin: cardRect, switcherCardViewport: viewport });
    get().activateApp(id, 'switcher');
  },

  goHome: () =>
    set((state) => {
      const exitingId = state.activeAppId;
      const nextEvents = exitingId
        ? bumpEvent(state.appEvents, exitingId, 'background')
        : state.appEvents;

      return {
        activeAppId: null,
        appOrigin: null,
        switcherCardOrigin: null,
        switcherCardViewport: null,
        switcherAppId: exitingId ?? state.switcherAppId ?? state.recentApps[0]?.id ?? null,
        presentationMode: 'foreground',
        switcherEnterAnimating: false,
        dismissedAppId: null,
        dismissReason: null,
        switcherDismissing: false,
        appEvents: nextEvents,
        ...resetCardDismissState(),
      };
    }),

  exitAppToHome: () => {
    const state = get();
    if (!state.activeAppId) return;
    const exitingId = state.activeAppId;
    set({
      activeAppId: null,
      // Keep appOrigin so the exit animation can morph back to the icon
      switcherCardOrigin: null,
      switcherCardViewport: null,
      presentationMode: 'foreground',
      switcherEnterAnimating: false,
      switcherAppId: exitingId,
      dismissedAppId: exitingId,
      dismissReason: 'home',
      switcherDismissing: false,
      appEvents: bumpEvent(state.appEvents, exitingId, 'background'),
      ...resetCardDismissState(),
    });
  },

  openSwitcher: () =>
    set((state) => {
      if (!state.activeAppId || state.recentApps.length === 0) return {};
      return {
        presentationMode: 'switcher',
        switcherAppId: state.activeAppId,
        switcherEnterAnimating: true,
      };
    }),

  finishSwitcherEnter: () => set({ switcherEnterAnimating: false }),

  dismissActiveFromSwitcher: () => {
    const state = get();
    if (!state.switcherEnterAnimating || !state.activeAppId) return;
    set({ switcherDismissing: true });
  },

  finishSwitcherDismiss: () => {
    const state = get();
    const appId = state.activeAppId;
    if (!appId) return;
    set({ switcherDismissing: false, switcherEnterAnimating: false });
    get().removeApp(appId);
  },

  removeApp: (id) => {
    // Track that this app was killed (swiped away in switcher), so it
    // resets internal state on next open instead of resuming.
    _killedApps.add(id);
    set((state) => {
      const removedIndex = state.recentApps.findIndex((task) => task.id === id);
      const nextRecentApps = state.recentApps.filter((task) => task.id !== id);
      const fallbackTask = resolveFallbackTask(nextRecentApps, removedIndex);
      const nextActiveAppId =
        state.activeAppId === id ? fallbackTask?.id ?? null : state.activeAppId;
      const nextActiveTask =
        nextActiveAppId == null
          ? null
          : nextRecentApps.find((task) => task.id === nextActiveAppId) ?? null;
      const nextSwitcherAppId =
        state.switcherAppId === id ? fallbackTask?.id ?? null : state.switcherAppId;
      const shouldExitSwitcher = state.presentationMode === 'switcher' && nextRecentApps.length === 0;

      return {
        recentApps: nextRecentApps,
        activeAppId: shouldExitSwitcher ? null : nextActiveAppId,
        appOrigin: shouldExitSwitcher ? null : nextActiveTask?.origin ?? null,
        switcherAppId: shouldExitSwitcher ? null : nextSwitcherAppId,
        presentationMode: shouldExitSwitcher ? 'foreground' : state.presentationMode,
        // Don't set dismissedAppId here — it would cause AppHost to render
        // a spurious exit animation (the "ghost app" flash-back bug).
        dismissedAppId: null,
        dismissReason: null,
        appEvents: bumpEvent(state.appEvents, id, 'kill'),
      };
    });
  },

  focusAppInSwitcher: (id) =>
    set({
      switcherAppId: id,
    }),

  startCardDismiss: (appId, startY, cardHeight) =>
    set({
      dismissedAppId: appId,
      cardDismiss: {
        appId,
        startY,
        cardHeight: Math.max(cardHeight, 1),
        deltaY: 0,
        progress: 0,
        velocityY: 0,
      },
    }),

  updateCardDismiss: (currentY, velocityY) =>
    set((state) => {
      if (!state.cardDismiss.appId) return {};

      const deltaY = currentY - state.cardDismiss.startY;
      const progress = clamp(Math.abs(Math.min(deltaY, 0)) / state.cardDismiss.cardHeight, 0, 1);

      return {
        cardDismiss: {
          ...state.cardDismiss,
          deltaY,
          progress,
          velocityY,
        },
      };
    }),

  finishCardDismiss: () => {
    const state = get();
    const { appId, deltaY, cardHeight, velocityY } = state.cardDismiss;

    if (!appId) {
      set({
        dismissedAppId: null,
        ...resetCardDismissState(),
      });
      return { committed: false, velocity: 0, appId: null };
    }

    const projected = project(deltaY, velocityY);
    const committed = projected < -(cardHeight * CARD_DISMISS_PROJECTED_RATIO);

    if (!committed) {
      set({
        dismissedAppId: null,
        ...resetCardDismissState(),
      });
      return { committed: false, velocity: velocityY, appId };
    }

    // Don't removeApp here — the UI layer (AppSwitcher) will call removeApp
    // after the fly-away animation completes, so the card stays in the DOM
    // during the animation. Just reset the dismiss gesture state.
    set({
      dismissReason: 'card',
      ...resetCardDismissState(),
    });
    return { committed: true, velocity: velocityY, appId };
  },

  clearDismissedApp: () =>
    set({
      dismissedAppId: null,
      dismissReason: null,
      appOrigin: null,
    }),
}));

// ---------------------------------------------------------------------------
// Killed-app tracking (module-level, not in Zustand)
// ---------------------------------------------------------------------------
// When an app is swiped away in the app switcher, its ID is recorded here.
// Apps check this on mount to decide whether to reset internal state.
// This lives outside Zustand to avoid equality-check issues with Set.

const _killedApps = new Set<string>();

/** Was this app killed (swiped away) in the app switcher? */
export function wasAppKilled(id: string): boolean {
  return _killedApps.has(id);
}

/** Clear the killed flag after the app has reset itself. */
export function clearAppKilled(id: string): void {
  _killedApps.delete(id);
}

/**
 * Derived gesture intent — simplified after removing home gesture mode.
 * Now only distinguishes between idle and switcher-active.
 */
export type GestureIntent = 'idle' | 'switcher-active';

export function deriveGestureIntent(
  presentationMode: AppPresentationMode,
): GestureIntent {
  if (presentationMode === 'switcher') return 'switcher-active';
  return 'idle';
}

export function useGestureIntent(): GestureIntent {
  return useAppRuntimeStore((s) => deriveGestureIntent(s.presentationMode));
}
