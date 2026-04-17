import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCurrentOwner, getCurrentOwner } from '../perspective';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';

describe('@hiphone/perspective', () => {
  beforeEach(() => {
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('getCurrentOwner returns player view by default', () => {
    const owner = getCurrentOwner();
    expect(owner.ownerId).toBe('me');
    expect(owner.isViewingOther).toBe(false);
  });

  it('getCurrentOwner returns char-{bareId} when viewing other', () => {
    usePhoneOwnerStore.setState({ phoneOwnerId: '001' });
    const owner = getCurrentOwner();
    expect(owner.ownerId).toBe('char-001');
    expect(owner.isViewingOther).toBe(true);
  });

  it('useCurrentOwner updates when store changes', () => {
    const { result } = renderHook(() => useCurrentOwner());
    expect(result.current.isViewingOther).toBe(false);
    expect(result.current.ownerId).toBe('me');

    act(() => {
      usePhoneOwnerStore.setState({ phoneOwnerId: 'abc' });
    });
    expect(result.current.ownerId).toBe('char-abc');
    expect(result.current.isViewingOther).toBe(true);
  });
});
