# AppHost Redirect Dismiss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When user swipes up during switcher entrance animation, redirect AppHost's spring animation to fly away instead of operating on SwitcherCard — eliminating the "two cards" visual glitch.

**Architecture:** Add `switcherDismissing` flag to store. SwitcherCard detects fast swipe during entrance → sets flag → AppHost reads flag and changes its `animate` target to fly off screen. Spring engine automatically blends from current position/velocity. After animation completes, `removeApp` is called.

**Tech Stack:** Zustand store, motion/react declarative `animate` prop, existing spring presets.

---

### Task 1: Add `switcherDismissing` state and actions to store

**Files:**
- Modify: `src/platform/stores/appRuntimeStore.ts`
- Modify: `src/platform/stores/__tests__/appRuntimeStore.test.ts`

- [ ] **Step 1: Add `switcherDismissing` to the interface**

In `src/platform/stores/appRuntimeStore.ts`, add the field and two actions to `AppRuntimeState` interface (after line 72):

```typescript
  /** True while the foreground → switcher shrink animation is in progress. */
  switcherEnterAnimating: boolean;
  /** True while AppHost is being redirected to fly away from the switcher.
   *  Set when user swipes up during entrance animation. */
  switcherDismissing: boolean;
```

And add the action signatures (after `finishSwitcherEnter` on line 90):

```typescript
  /** Signal that the foreground → switcher shrink animation has completed. */
  finishSwitcherEnter: () => void;
  /** Redirect AppHost to fly away during switcher entrance animation. */
  dismissActiveFromSwitcher: () => void;
  /** Called when AppHost fly-away animation completes — cleans up state and removes app. */
  finishSwitcherDismiss: () => void;
```

- [ ] **Step 2: Add initial value and action implementations**

Add initial value after `switcherEnterAnimating: false,` (line 138):

```typescript
  switcherEnterAnimating: false,
  switcherDismissing: false,
```

Add action implementations after `finishSwitcherEnter` (line 234):

```typescript
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
```

- [ ] **Step 3: Reset `switcherDismissing` in related actions**

Add `switcherDismissing: false` to these existing actions that transition away from switcher mode:

In `openApp` return object (around line 154):
```typescript
        dismissReason: null,
        switcherDismissing: false,
        ...resetCardDismissState(),
```

In `activateApp` return object (around line 173):
```typescript
        switcherEnterAnimating: false,
        switcherDismissing: false,
        dismissedAppId: null,
```

In `goHome` return object (around line 193):
```typescript
      switcherEnterAnimating: false,
      switcherDismissing: false,
      dismissedAppId: null,
```

In `exitAppToHome` set call (around line 210):
```typescript
      switcherEnterAnimating: false,
      switcherDismissing: false,
      switcherAppId: exitingId,
```

- [ ] **Step 4: Write failing tests**

Add to `src/platform/stores/__tests__/appRuntimeStore.test.ts`. First, add `switcherDismissing: false` to the `beforeEach` setState call (after `switcherEnterAnimating` if present, or alongside the other fields).

Then add these test cases:

```typescript
  // ---------- dismissActiveFromSwitcher ----------

  it('dismissActiveFromSwitcher sets switcherDismissing when entrance is animating', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openSwitcher();
    // openSwitcher sets switcherEnterAnimating = true
    expect(useAppRuntimeStore.getState().switcherEnterAnimating).toBe(true);

    useAppRuntimeStore.getState().dismissActiveFromSwitcher();

    expect(useAppRuntimeStore.getState().switcherDismissing).toBe(true);
  });

  it('dismissActiveFromSwitcher is a no-op when entrance animation is finished', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openSwitcher();
    useAppRuntimeStore.getState().finishSwitcherEnter();

    useAppRuntimeStore.getState().dismissActiveFromSwitcher();

    expect(useAppRuntimeStore.getState().switcherDismissing).toBe(false);
  });

  it('dismissActiveFromSwitcher is a no-op when no active app', () => {
    useAppRuntimeStore.setState({
      presentationMode: 'switcher',
      switcherEnterAnimating: true,
      activeAppId: null,
    });

    useAppRuntimeStore.getState().dismissActiveFromSwitcher();

    expect(useAppRuntimeStore.getState().switcherDismissing).toBe(false);
  });

  // ---------- finishSwitcherDismiss ----------

  it('finishSwitcherDismiss removes the active app and resets flags', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openApp('weather', { x: 60, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openSwitcher();
    useAppRuntimeStore.getState().dismissActiveFromSwitcher();

    useAppRuntimeStore.getState().finishSwitcherDismiss();

    const s = useAppRuntimeStore.getState();
    expect(s.switcherDismissing).toBe(false);
    expect(s.switcherEnterAnimating).toBe(false);
    // 'weather' was the active app (most recent), should be removed
    expect(s.recentApps.map((t) => t.id)).toEqual(['settings']);
  });

  it('finishSwitcherDismiss exits switcher when last app is removed', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openSwitcher();
    useAppRuntimeStore.getState().dismissActiveFromSwitcher();

    useAppRuntimeStore.getState().finishSwitcherDismiss();

    const s = useAppRuntimeStore.getState();
    expect(s.recentApps).toEqual([]);
    expect(s.presentationMode).toBe('foreground');
    expect(s.activeAppId).toBeNull();
  });

  it('goHome resets switcherDismissing', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openSwitcher();
    useAppRuntimeStore.getState().dismissActiveFromSwitcher();

    useAppRuntimeStore.getState().goHome();

    expect(useAppRuntimeStore.getState().switcherDismissing).toBe(false);
  });
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run src/platform/stores/__tests__/appRuntimeStore.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/platform/stores/appRuntimeStore.ts src/platform/stores/__tests__/appRuntimeStore.test.ts
git commit -m "feat(store): add switcherDismissing state for AppHost redirect dismiss"
```

---

### Task 2: Update AppHost to redirect animation when `switcherDismissing`

**Files:**
- Modify: `src/shell/AppHost/AppHost.tsx`

- [ ] **Step 1: Add store subscriptions**

After existing store reads (line 48-49), add:

```typescript
  const switcherEnterAnimating = useAppRuntimeStore((s) => s.switcherEnterAnimating);
  const switcherDismissing = useAppRuntimeStore((s) => s.switcherDismissing);
  const finishSwitcherEnter = useAppRuntimeStore((s) => s.finishSwitcherEnter);
  const finishSwitcherDismiss = useAppRuntimeStore((s) => s.finishSwitcherDismiss);
  const clearDismissedApp = useAppRuntimeStore((s) => s.clearDismissedApp);
```

(Replace the existing `switcherEnterAnimating`, `finishSwitcherEnter`, `clearDismissedApp` reads with this block that adds `switcherDismissing` and `finishSwitcherDismiss`.)

- [ ] **Step 2: Update enterTransition to use criticalDamped for dismissing**

Replace the existing `enterTransition` (lines 104-106):

```typescript
  const enterTransition = switcherDismissing
    ? { type: 'spring' as const, ...spring.criticalDamped }
    : inSwitcher
      ? { type: 'spring' as const, ...spring.criticalDamped }
      : { type: 'spring' as const, ...spring.appLaunch };
```

Note: both `switcherDismissing` and `inSwitcher` branches use `criticalDamped` today, so this is functionally equivalent but explicit about the three states.

- [ ] **Step 3: Update visibility logic**

Replace the visibility condition in the style prop (lines 136-140):

```typescript
            ...(inSwitcher && !switcherEnterAnimating && !switcherDismissing
              ? { visibility: 'hidden' as const, pointerEvents: 'none' as const }
              : inSwitcher
                ? { pointerEvents: 'none' as const }
                : {}),
```

This ensures AppHost stays visible during the fly-away animation.

- [ ] **Step 4: Update animate prop with three-way branch**

Replace the existing `animate` prop (lines 145-158):

```typescript
          animate={
            switcherDismissing
              ? {
                  opacity: 0,
                  scale: SWITCHER_SCALE,
                  x: 0,
                  y: -(vpHeight),
                }
              : inSwitcher
                ? {
                    opacity: 1,
                    scale: SWITCHER_SCALE,
                    x: 0,
                    y: switcherVerticalOffset,
                  }
                : {
                    opacity: 1,
                    scale: 1,
                    x: 0,
                    y: 0,
                  }
          }
```

- [ ] **Step 5: Update onAnimationComplete**

Replace the existing `onAnimationComplete` (lines 162-166):

```typescript
          onAnimationComplete={() => {
            if (switcherDismissing) {
              finishSwitcherDismiss();
            } else if (inSwitcher && switcherEnterAnimating) {
              finishSwitcherEnter();
            }
          }}
```

- [ ] **Step 6: Verify build**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/shell/AppHost/AppHost.tsx
git commit -m "feat(AppHost): redirect animation to fly away when switcherDismissing"
```

---

### Task 3: Update SwitcherCard to dispatch `dismissActiveFromSwitcher` and remove gesture buffering

**Files:**
- Modify: `src/shell/AppSwitcher/AppSwitcher.tsx`

- [ ] **Step 1: Remove `pendingDismissRef` declaration**

Delete line 280:
```typescript
  // Buffer a dismiss intent when the user swipes during entrance animation
  const pendingDismissRef = useRef(false);
```

- [ ] **Step 2: Remove the auto-execute effect**

Delete lines 330-353 (the entire `useEffect` block):
```typescript
  // Auto-execute buffered dismiss when entrance animation completes
  useEffect(() => {
    if (enterAnimating || !pendingDismissRef.current) return;
    pendingDismissRef.current = false;
    const cardEl = cardBodyRef.current;
    if (!cardEl) return;
    const rect = cardEl.getBoundingClientRect();
    const cardHeight = Math.max(rect.height, 200);
    // Set up store state for the dismiss decision
    startCardDismiss(appId, 0, cardHeight);
    updateCardDismiss(-cardHeight, -2); // strong upward swipe
    const result = finishCardDismiss();
    if (result.committed) {
      onDismissCommit(appId);
      const target = -(window.innerHeight || 900);
      animationRef.current = animate(dragY, target, {
        type: 'spring',
        ...spring.criticalDamped,
        velocity: -2000,
        restDelta: 100,
        restSpeed: 200,
      });
    }
  }, [enterAnimating, appId, dragY, startCardDismiss, updateCardDismiss, finishCardDismiss, onDismissCommit]);
```

- [ ] **Step 3: Replace the `handleTouchEnd` entrance-buffering branch**

Replace the block at lines 452-459:

```typescript
    // During entrance: buffer the dismiss intent for auto-execution later
    if (enterAnimating) {
      const deltaY = t.clientY - d.startY;
      if (deltaY < -30) {
        pendingDismissRef.current = true;
      }
      return;
    }
```

With:

```typescript
    // During entrance on active card: redirect AppHost to fly away.
    // On non-active cards: ignore (no AppHost covering them, but entrance
    // animation blocks normal dismiss anyway).
    const storeState = useAppRuntimeStore.getState();
    if (storeState.switcherEnterAnimating && isActiveCard) {
      const deltaY = t.clientY - d.startY;
      if (deltaY < -30) {
        storeState.dismissActiveFromSwitcher();
      }
      return;
    }
```

- [ ] **Step 4: Verify build**

Run: `pnpm build`
Expected: No type errors

- [ ] **Step 5: Run full test suite**

Run: `pnpm vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/shell/AppSwitcher/AppSwitcher.tsx
git commit -m "feat(AppSwitcher): dispatch AppHost redirect dismiss, remove gesture buffering"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start dev server**

Run: `pnpm dev`

- [ ] **Step 2: Test fast dismiss (primary scenario)**

Open any app → trigger switcher via AssistiveTouch → immediately swipe up before shrink animation finishes.

Expected: AppHost smoothly redirects its shrink animation into a fly-away. No "two cards" visible. App is removed from recents list.

- [ ] **Step 3: Test normal dismiss (regression check)**

Open any app → trigger switcher → wait ~1 second → swipe up on the card.

Expected: Card flies away as before (AppHost is already hidden). No change in behavior.

- [ ] **Step 4: Test single-app fast dismiss**

Open only one app → trigger switcher → immediately swipe up.

Expected: App flies away → returns to home screen (no remaining apps in switcher).

- [ ] **Step 5: Test insufficient swipe**

Open app → trigger switcher → immediately do a tiny upward flick (<30px).

Expected: Nothing happens. Switcher entrance completes normally.

- [ ] **Step 6: Test non-active card during entrance**

Open two apps → trigger switcher → immediately try to swipe a non-active card.

Expected: No effect during entrance animation (existing behavior preserved).

- [ ] **Step 7: Final build check**

Run: `pnpm build`
Expected: Clean build, zero errors
