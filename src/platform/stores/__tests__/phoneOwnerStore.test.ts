import { describe, it, expect, beforeEach } from 'vitest';
import { usePhoneOwnerStore } from '../phoneOwnerStore';

describe('phoneOwnerStore', () => {
  beforeEach(() => {
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('starts on player phone (null)', () => {
    expect(usePhoneOwnerStore.getState().phoneOwnerId).toBeNull();
  });

  it('viewPhone switches to character phone', () => {
    usePhoneOwnerStore.getState().viewPhone('soren');
    expect(usePhoneOwnerStore.getState().phoneOwnerId).toBe('soren');
  });

  it('returnToMyPhone switches back to player', () => {
    usePhoneOwnerStore.getState().viewPhone('soren');
    usePhoneOwnerStore.getState().returnToMyPhone();
    expect(usePhoneOwnerStore.getState().phoneOwnerId).toBeNull();
  });

  it('can switch between different characters', () => {
    usePhoneOwnerStore.getState().viewPhone('soren');
    expect(usePhoneOwnerStore.getState().phoneOwnerId).toBe('soren');

    usePhoneOwnerStore.getState().viewPhone('luna');
    expect(usePhoneOwnerStore.getState().phoneOwnerId).toBe('luna');
  });
});
