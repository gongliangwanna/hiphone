import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCurrentAppId,
  withUserAppContext,
  NoUserAppContextError,
  registerMountedApp,
} from '../context';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

describe('user app SDK context', () => {
  it('throws outside a runtime context', () => {
    expect(() => getCurrentAppId()).toThrow(NoUserAppContextError);
  });

  it('provides appId inside withUserAppContext callback', () => {
    const result = withUserAppContext('my-todo', () => {
      return getCurrentAppId();
    });
    expect(result).toBe('my-todo');
  });

  it('restores previous value on nested contexts', () => {
    withUserAppContext('outer', () => {
      expect(getCurrentAppId()).toBe('outer');
      withUserAppContext('inner', () => {
        expect(getCurrentAppId()).toBe('inner');
      });
      expect(getCurrentAppId()).toBe('outer');
    });
  });

  it('restores absence after context exit', () => {
    withUserAppContext('x', () => getCurrentAppId());
    expect(() => getCurrentAppId()).toThrow(NoUserAppContextError);
  });

  describe('multi-mount fallback (Deep Link transition / switcher previews)', () => {
    let unregisterA: (() => void) | null = null;
    let unregisterB: (() => void) | null = null;

    beforeEach(() => {
      useAppRuntimeStore.setState({ activeAppId: null });
    });

    afterEach(() => {
      unregisterA?.();
      unregisterB?.();
      unregisterA = null;
      unregisterB = null;
      useAppRuntimeStore.setState({ activeAppId: null });
    });

    it('returns the activeAppId when multiple apps are mounted simultaneously', () => {
      unregisterA = registerMountedApp('out-going');
      unregisterB = registerMountedApp('in-coming');
      useAppRuntimeStore.setState({ activeAppId: 'in-coming' });

      expect(getCurrentAppId()).toBe('in-coming');
    });

    it('throws when multiple apps are mounted but activeAppId is not among them', () => {
      unregisterA = registerMountedApp('card-a');
      unregisterB = registerMountedApp('card-b');
      // activeAppId set to something that is NOT mounted (pathological case)
      useAppRuntimeStore.setState({ activeAppId: 'not-mounted' });

      expect(() => getCurrentAppId()).toThrow(NoUserAppContextError);
    });

    it('throws when multiple apps are mounted and activeAppId is null', () => {
      unregisterA = registerMountedApp('card-a');
      unregisterB = registerMountedApp('card-b');
      // Switcher is open but user is at home — no foreground app.
      useAppRuntimeStore.setState({ activeAppId: null });

      expect(() => getCurrentAppId()).toThrow(NoUserAppContextError);
    });

    it('still prefers the single mounted app when only one is mounted, ignoring activeAppId', () => {
      unregisterA = registerMountedApp('solo');
      useAppRuntimeStore.setState({ activeAppId: 'something-else' });

      expect(getCurrentAppId()).toBe('solo');
    });
  });
});
