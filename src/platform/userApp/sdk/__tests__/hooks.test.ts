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

describe('@hiphone/hooks — useOpenParams (M2 stub)', () => {
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
