import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStateStore } from '../uiStateStore';

describe('uiStateStore', () => {
  beforeEach(() => {
    useUIStateStore.setState({ overlay: 'none' });
  });

  it('starts with no overlay', () => {
    expect(useUIStateStore.getState().overlay).toBe('none');
  });

  it('openOverlay sets the overlay', () => {
    useUIStateStore.getState().openOverlay('notifications');
    expect(useUIStateStore.getState().overlay).toBe('notifications');
  });

  it('openOverlay replaces current overlay', () => {
    useUIStateStore.getState().openOverlay('notifications');
    useUIStateStore.getState().openOverlay('control-center');
    expect(useUIStateStore.getState().overlay).toBe('control-center');
  });

  it('closeOverlay resets to none', () => {
    useUIStateStore.getState().openOverlay('control-center');
    useUIStateStore.getState().closeOverlay();
    expect(useUIStateStore.getState().overlay).toBe('none');
  });

  it('supports all overlay types', () => {
    const types = ['notifications', 'control-center', 'spotlight'] as const;
    for (const type of types) {
      useUIStateStore.getState().openOverlay(type);
      expect(useUIStateStore.getState().overlay).toBe(type);
    }
  });
});
