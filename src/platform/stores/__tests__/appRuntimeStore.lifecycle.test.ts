import { beforeEach, describe, expect, it } from 'vitest';
import { useAppRuntimeStore, wasAppKilled, clearAppKilled } from '../appRuntimeStore';

function resetStore() {
  useAppRuntimeStore.setState({
    activeAppId: null,
    appOrigin: null,
    switcherCardOrigin: null,
    switcherCardViewport: null,
    recentApps: [],
    switcherAppId: null,
    transitionSource: 'icon',
    presentationMode: 'foreground',
    dismissedAppId: null,
    dismissReason: null,
    switcherDismissing: false,
    appEvents: {},
    cardDismiss: {
      appId: null, startY: 0, cardHeight: 1,
      deltaY: 0, progress: 0, velocityY: 0,
    },
  });
  clearAppKilled('settings');
  clearAppKilled('weather');
  clearAppKilled('xingyu');
}

describe('appRuntimeStore — lifecycle nonces', () => {
  beforeEach(() => resetStore());

  it('appEvents starts empty', () => {
    expect(useAppRuntimeStore.getState().appEvents).toEqual({});
  });

  it('openApp first-time emits launch (not resume)', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(1);
    expect(ev?.resume).toBe(0);
  });

  it('openApp on already-backgrounded app emits resume', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().goHome();
    useAppRuntimeStore.getState().openApp('settings', null);

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(1);
    expect(ev?.resume).toBe(1);
  });

  it('openApp after kill emits launch (not resume)', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().removeApp('settings');
    useAppRuntimeStore.getState().openApp('settings', null);

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(2);
    expect(ev?.resume).toBe(0);
  });

  it('openApp when already active emits nothing new', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    const before = useAppRuntimeStore.getState().appEvents.settings;
    useAppRuntimeStore.getState().openApp('settings', null);
    const after = useAppRuntimeStore.getState().appEvents.settings;
    expect(after?.launch).toBe(before?.launch);
    expect(after?.resume).toBe(before?.resume);
  });

  it('activateApp (from switcher) on backgrounded app emits resume', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().goHome();
    useAppRuntimeStore.getState().activateApp('settings');

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(1);
    expect(ev?.resume).toBe(1);
  });

  it('activateApp after kill emits launch', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().removeApp('settings');
    useAppRuntimeStore.getState().activateApp('settings');

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(2);
  });

  it('goHome emits background for the currently active app', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().goHome();
    expect(useAppRuntimeStore.getState().appEvents.settings?.background).toBe(1);
  });

  it('goHome with no active app emits nothing', () => {
    useAppRuntimeStore.getState().goHome();
    expect(useAppRuntimeStore.getState().appEvents).toEqual({});
  });

  it('exitAppToHome emits background for active app', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().exitAppToHome();
    expect(useAppRuntimeStore.getState().appEvents.settings?.background).toBe(1);
  });

  it('removeApp emits kill and also sets wasAppKilled', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().removeApp('settings');

    expect(useAppRuntimeStore.getState().appEvents.settings?.kill).toBe(1);
    expect(wasAppKilled('settings')).toBe(true);
  });

  it('removeApp on unknown id emits kill (best-effort)', () => {
    useAppRuntimeStore.getState().removeApp('never-opened');
    expect(useAppRuntimeStore.getState().appEvents['never-opened']?.kill).toBe(1);
  });

  it('full lifecycle: launch → background → resume → kill → launch', () => {
    const s = useAppRuntimeStore.getState;

    s().openApp('settings', null);
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 0, background: 0, kill: 0 });

    s().goHome();
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 0, background: 1, kill: 0 });

    s().openApp('settings', null);
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 1, background: 1, kill: 0 });

    s().removeApp('settings');
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 1, background: 1, kill: 1 });

    s().openApp('settings', null);
    expect(s().appEvents.settings).toEqual({ launch: 2, resume: 1, background: 1, kill: 1 });
  });
});
