import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useOnLaunch,
  useOnResume,
  useOnBackground,
  useOnKill,
  useOpenParams,
  useAppState,
} from '../hooks';
import { withUserAppContext } from '../context';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

function bumpEvent(
  appId: string,
  event: 'launch' | 'resume' | 'background' | 'kill',
) {
  useAppRuntimeStore.setState((s) => {
    const prev = s.appEvents[appId] ?? { launch: 0, resume: 0, background: 0, kill: 0 };
    return {
      appEvents: {
        ...s.appEvents,
        [appId]: { ...prev, [event]: prev[event] + 1 },
      },
    };
  });
}

describe('@hiphone/hooks — lifecycle', () => {
  beforeEach(() => {
    useAppRuntimeStore.setState({
      appEvents: {},
      openParams: {},
      activeAppId: null,
      presentationMode: 'foreground',
    });
  });

  it('useOnLaunch fires on first mount', () => {
    let count = 0;
    renderHook(() =>
      withUserAppContext('todo', () => useOnLaunch(() => (count += 1))),
    );
    expect(count).toBe(1);
  });

  it('useOnLaunch fires again when kill → re-open (launch nonce bump)', () => {
    let count = 0;
    const { rerender } = renderHook(() =>
      withUserAppContext('todo', () => useOnLaunch(() => (count += 1))),
    );
    expect(count).toBe(1);

    act(() => bumpEvent('todo', 'launch'));
    rerender();
    expect(count).toBe(2);
  });

  it('useOnResume fires when resume nonce bumps', () => {
    let count = 0;
    const { rerender } = renderHook(() =>
      withUserAppContext('todo', () => useOnResume(() => (count += 1))),
    );
    expect(count).toBe(0); // did not fire on mount (initial)

    act(() => bumpEvent('todo', 'resume'));
    rerender();
    expect(count).toBe(1);
  });

  it('useOnBackground fires when background nonce bumps', () => {
    let count = 0;
    const { rerender } = renderHook(() =>
      withUserAppContext('todo', () => useOnBackground(() => (count += 1))),
    );
    act(() => bumpEvent('todo', 'background'));
    rerender();
    expect(count).toBe(1);
  });

  it('useOnKill fires when kill nonce bumps', () => {
    let count = 0;
    const { rerender } = renderHook(() =>
      withUserAppContext('todo', () => useOnKill(() => (count += 1))),
    );
    act(() => bumpEvent('todo', 'kill'));
    rerender();
    expect(count).toBe(1);
  });

  it('hooks isolate by appId', () => {
    let countA = 0;
    renderHook(() =>
      withUserAppContext('a', () => useOnResume(() => (countA += 1))),
    );
    // Bump B's resume — A should not fire
    act(() => bumpEvent('b', 'resume'));
    expect(countA).toBe(0);
  });
});

describe('@hiphone/hooks — useOpenParams (one-shot delivery)', () => {
  beforeEach(() => {
    useAppRuntimeStore.setState({ openParams: {} });
  });

  it('returns null when no params set', () => {
    const { result } = renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    expect(result.current).toBeNull();
  });

  it('returns params when appRuntimeStore.openParams has them', () => {
    useAppRuntimeStore.setState({
      openParams: { todo: { action: 'add', text: 'x' } },
    });
    const { result } = renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    expect(result.current).toEqual({ action: 'add', text: 'x' });
  });

  it('clears the store entry after the consumer has latched it', () => {
    useAppRuntimeStore.setState({
      openParams: { todo: { action: 'add', text: 'x' } },
    });
    renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    // After the effect runs, the store should no longer carry these params
    // so a fresh mount won't re-observe them.
    expect(useAppRuntimeStore.getState().openParams.todo).toBeUndefined();
  });

  it('returns null on a fresh mount after a previous mount consumed params', () => {
    useAppRuntimeStore.setState({
      openParams: { todo: { action: 'add', text: 'first' } },
    });
    // First mount consumes the params.
    const first = renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    expect(first.result.current).toEqual({ action: 'add', text: 'first' });
    first.unmount();

    // Second mount (user returned to the app from springboard without a
    // fresh nav.open) must see null — otherwise the old payload would
    // re-trigger side effects like a payment-confirm screen.
    const second = renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    expect(second.result.current).toBeNull();
  });

  it('picks up new params when nav.open writes to the store while mounted', () => {
    const { result, rerender } = renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    expect(result.current).toBeNull();

    act(() => {
      useAppRuntimeStore.setState((s) => ({
        openParams: { ...s.openParams, todo: { step: 'two' } },
      }));
    });
    rerender();

    expect(result.current).toEqual({ step: 'two' });
  });

  it('keeps the latched value stable across re-renders (does not flip to null after store clears)', () => {
    useAppRuntimeStore.setState({
      openParams: { todo: { value: 42 } },
    });
    const { result, rerender } = renderHook(() =>
      withUserAppContext('todo', () => useOpenParams()),
    );
    expect(result.current).toEqual({ value: 42 });

    // Mirror what happens in practice: the store entry is dropped by the
    // hook's own effect. A re-render must still return the latched value
    // so user-land `useEffect(..., [params])` doesn't spuriously refire
    // with null.
    rerender();
    expect(result.current).toEqual({ value: 42 });
    expect(useAppRuntimeStore.getState().openParams.todo).toBeUndefined();
  });
});

describe('@hiphone/hooks — useAppState', () => {
  beforeEach(() => {
    useAppRuntimeStore.setState({
      appEvents: {},
      activeAppId: 'todo',
      presentationMode: 'foreground',
    });
  });

  it('returns "active" when app is in foreground', () => {
    const { result } = renderHook(() =>
      withUserAppContext('todo', () => useAppState()),
    );
    expect(result.current).toBe('active');
  });
});
