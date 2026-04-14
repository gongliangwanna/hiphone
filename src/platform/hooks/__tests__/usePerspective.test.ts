import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePerspective } from '../usePerspective';
import { usePhoneOwnerStore } from '../../stores/phoneOwnerStore';

describe('usePerspective', () => {
  beforeEach(() => {
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('returns player perspective by default', () => {
    const { result } = renderHook(() => usePerspective());
    expect(result.current.phoneOwnerId).toBeNull();
    expect(result.current.selfSenderId).toBe('me');
    expect(result.current.isViewingOther).toBe(false);
  });

  it('isSelf matches "me" on player phone', () => {
    const { result } = renderHook(() => usePerspective());
    expect(result.current.isSelf('me')).toBe(true);
    expect(result.current.isSelf('char-soren')).toBe(false);
  });

  it('switches to character perspective', () => {
    const { result } = renderHook(() => usePerspective());

    act(() => {
      usePhoneOwnerStore.getState().viewPhone('soren');
    });

    expect(result.current.phoneOwnerId).toBe('soren');
    expect(result.current.selfSenderId).toBe('char-soren');
    expect(result.current.isViewingOther).toBe(true);
  });

  it('isSelf matches character senderId on character phone', () => {
    act(() => {
      usePhoneOwnerStore.getState().viewPhone('soren');
    });

    const { result } = renderHook(() => usePerspective());
    expect(result.current.isSelf('char-soren')).toBe(true);
    expect(result.current.isSelf('me')).toBe(false);
    expect(result.current.isSelf('char-luna')).toBe(false);
  });

  it('returns to player perspective', () => {
    act(() => {
      usePhoneOwnerStore.getState().viewPhone('soren');
    });

    const { result } = renderHook(() => usePerspective());
    expect(result.current.isViewingOther).toBe(true);

    act(() => {
      usePhoneOwnerStore.getState().returnToMyPhone();
    });

    expect(result.current.selfSenderId).toBe('me');
    expect(result.current.isViewingOther).toBe(false);
  });
});
