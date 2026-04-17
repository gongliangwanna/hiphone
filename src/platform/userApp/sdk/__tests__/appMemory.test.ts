import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { withUserAppContext } from '../context';
import { useAppMemory, _resetAppMemoryForApp } from '../appMemory';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

describe('useAppMemory', () => {
  beforeEach(() => {
    _resetAppMemoryForApp('my-todo');
    _resetAppMemoryForApp('a');
    _resetAppMemoryForApp('b');
    useAppRuntimeStore.setState({ appEvents: {} });
  });

  it('returns initial value when no prior stored value', () => {
    const { result } = renderHook(() =>
      withUserAppContext('my-todo', () => useAppMemory('count', 0)),
    );
    expect(result.current[0]).toBe(0);
  });

  it('set survives across re-renders (same app context)', () => {
    const { result, rerender } = renderHook(() =>
      withUserAppContext('my-todo', () => useAppMemory('count', 0)),
    );
    act(() => result.current[1](5));
    rerender();
    expect(result.current[0]).toBe(5);
  });

  it('resets on kill nonce bump', () => {
    const { result, rerender } = renderHook(() =>
      withUserAppContext('my-todo', () => useAppMemory('count', 0)),
    );
    act(() => result.current[1](42));
    rerender();
    expect(result.current[0]).toBe(42);

    act(() => {
      useAppRuntimeStore.setState((s) => ({
        appEvents: {
          ...s.appEvents,
          'my-todo': {
            launch: 0, resume: 0, background: 0,
            kill: (s.appEvents['my-todo']?.kill ?? 0) + 1,
          },
        },
      }));
    });
    rerender();

    expect(result.current[0]).toBe(0);
  });

  it('different apps have isolated memory', () => {
    const { result: rA } = renderHook(() =>
      withUserAppContext('a', () => useAppMemory('k', 0)),
    );
    const { result: rB } = renderHook(() =>
      withUserAppContext('b', () => useAppMemory('k', 100)),
    );
    act(() => rA.current[1](5));
    act(() => rB.current[1](200));

    expect(rA.current[0]).toBe(5);
    expect(rB.current[0]).toBe(200);
  });
});
