import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { open, goHome } from '../nav';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useToastStore } from '@/system';
import { appRegistry } from '@/platform/appRegistry';

describe('@hiphone/nav', () => {
  beforeEach(() => {
    useAppRuntimeStore.setState({
      activeAppId: null,
      openParams: {},
      recentApps: [],
      appEvents: {},
    });
    useToastStore.setState({ message: null, visible: false });
  });

  afterEach(() => {
    // Clean up any test-registered apps
    if (appRegistry.has('__test-target__')) {
      appRegistry.unregister('__test-target__');
    }
  });

  describe('open', () => {
    it('writes params to openParams and activates the target app', () => {
      appRegistry.register({
        id: '__test-target__',
        type: 'user',
        component: () => null,
        perspectiveAware: false,
        globalData: false,
      });

      open('__test-target__', { amount: 100, action: 'pay' });

      const state = useAppRuntimeStore.getState();
      expect(state.openParams['__test-target__']).toEqual({ amount: 100, action: 'pay' });
      expect(state.activeAppId).toBe('__test-target__');
    });

    it('defaults params to an empty object when not provided', () => {
      appRegistry.register({
        id: '__test-target__',
        type: 'user',
        component: () => null,
        perspectiveAware: false,
        globalData: false,
      });
      open('__test-target__');
      expect(useAppRuntimeStore.getState().openParams['__test-target__']).toEqual({});
    });

    it('does not switch and shows a toast when appId is not registered', () => {
      expect(appRegistry.has('does-not-exist')).toBe(false);

      open('does-not-exist', { foo: 'bar' });

      const runtime = useAppRuntimeStore.getState();
      expect(runtime.activeAppId).toBe(null);
      expect(runtime.openParams['does-not-exist']).toBeUndefined();

      const toast = useToastStore.getState();
      expect(toast.message).toContain('does-not-exist');
    });

    it('subsequent open() on the same app replaces the previous params', () => {
      appRegistry.register({
        id: '__test-target__',
        type: 'user',
        component: () => null,
        perspectiveAware: false,
        globalData: false,
      });
      open('__test-target__', { first: true });
      open('__test-target__', { second: true });
      expect(useAppRuntimeStore.getState().openParams['__test-target__']).toEqual({ second: true });
    });

    it('works for builtin apps too', () => {
      appRegistry.register({
        id: '__test-target__',
        type: 'builtin',
        component: () => null,
        perspectiveAware: false,
        globalData: true,
      });
      open('__test-target__', { hi: 1 });
      expect(useAppRuntimeStore.getState().activeAppId).toBe('__test-target__');
    });
  });

  describe('goHome', () => {
    it('resets activeAppId to null', () => {
      useAppRuntimeStore.setState({ activeAppId: 'todo' });
      goHome();
      expect(useAppRuntimeStore.getState().activeAppId).toBe(null);
    });

    it('is a no-op when no app is active', () => {
      useAppRuntimeStore.setState({ activeAppId: null });
      expect(() => goHome()).not.toThrow();
      expect(useAppRuntimeStore.getState().activeAppId).toBe(null);
    });
  });
});
