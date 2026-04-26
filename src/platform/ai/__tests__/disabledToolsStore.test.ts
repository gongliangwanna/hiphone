import { describe, it, expect, beforeEach } from 'vitest';
import { useDisabledToolsStore } from '../disabledToolsStore';

describe('disabledToolsStore', () => {
  beforeEach(() => {
    useDisabledToolsStore.setState({ disabled: {} });
  });

  describe('initial state', () => {
    it('returns empty set for any appId before any setDisabled', () => {
      const result = useDisabledToolsStore.getState().getDisabled('heartbeat');
      expect(result.size).toBe(0);
    });

    it('isDisabled returns false for any tool when nothing is disabled', () => {
      expect(useDisabledToolsStore.getState().isDisabled('heartbeat', 'send_message')).toBe(false);
    });
  });

  describe('setDisabled', () => {
    it('adds a tool to the disabled set', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      const disabled = useDisabledToolsStore.getState().getDisabled('heartbeat');
      expect(disabled.has('post_moment')).toBe(true);
      expect(disabled.size).toBe(1);
    });

    it('removes a tool from the disabled set when disabled=false', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', false);
      expect(useDisabledToolsStore.getState().getDisabled('heartbeat').size).toBe(0);
    });

    it('disabling the same tool twice is idempotent', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      expect(useDisabledToolsStore.getState().getDisabled('heartbeat').size).toBe(1);
    });

    it('isolates apps — disabling in heartbeat does not affect xingyu', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'send_message', true);
      expect(useDisabledToolsStore.getState().isDisabled('xingyu', 'send_message')).toBe(false);
    });

    it('multiple tools per app coexist', () => {
      const s = useDisabledToolsStore.getState();
      s.setDisabled('heartbeat', 'post_moment', true);
      s.setDisabled('heartbeat', 'send_message', true);
      const disabled = s.getDisabled('heartbeat');
      expect(disabled.size).toBe(2);
      expect(disabled.has('post_moment')).toBe(true);
      expect(disabled.has('send_message')).toBe(true);
    });
  });

  describe('isDisabled', () => {
    it('returns true after setDisabled(appId, type, true)', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      expect(useDisabledToolsStore.getState().isDisabled('heartbeat', 'post_moment')).toBe(true);
    });

    it('returns false after re-enabling', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', false);
      expect(useDisabledToolsStore.getState().isDisabled('heartbeat', 'post_moment')).toBe(false);
    });
  });

  describe('clearApp', () => {
    it('removes all disabled tools for the given appId', () => {
      const s = useDisabledToolsStore.getState();
      s.setDisabled('heartbeat', 'post_moment', true);
      s.setDisabled('heartbeat', 'send_message', true);
      s.clearApp('heartbeat');
      expect(s.getDisabled('heartbeat').size).toBe(0);
    });

    it('does not affect other apps', () => {
      const s = useDisabledToolsStore.getState();
      s.setDisabled('heartbeat', 'post_moment', true);
      s.setDisabled('xingyu', 'sticker', true);
      s.clearApp('heartbeat');
      expect(s.getDisabled('xingyu').has('sticker')).toBe(true);
    });

    it('is a no-op for unknown appId', () => {
      expect(() => useDisabledToolsStore.getState().clearApp('never-disabled')).not.toThrow();
    });
  });

  describe('getDisabled', () => {
    it('returns the same Set instance contents on repeated calls (no spurious changes)', () => {
      useDisabledToolsStore.getState().setDisabled('heartbeat', 'post_moment', true);
      const s1 = useDisabledToolsStore.getState().getDisabled('heartbeat');
      const s2 = useDisabledToolsStore.getState().getDisabled('heartbeat');
      // Both Sets contain the same items
      expect([...s1].sort()).toEqual([...s2].sort());
    });
  });
});
