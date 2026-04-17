import { beforeEach, describe, expect, it } from 'vitest';
import { useAppRuntimeStore, clearAppKilled } from '../appRuntimeStore';

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
});
