import { beforeEach, describe, expect, it } from 'vitest';
import { useAppRuntimeStore, deriveGestureIntent } from '../appRuntimeStore';

describe('appRuntimeStore', () => {
  beforeEach(() => {
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
      cardDismiss: {
        appId: null,
        startY: 0,
        cardHeight: 1,
        deltaY: 0,
        progress: 0,
        velocityY: 0,
      },
    });
  });

  it('starts with no active app', () => {
    expect(useAppRuntimeStore.getState().activeAppId).toBeNull();
    expect(useAppRuntimeStore.getState().recentApps).toEqual([]);
  });

  it('openApp sets active app, recent order, and foreground presentation', () => {
    const origin = { x: 10, y: 20, width: 60, height: 60 };
    useAppRuntimeStore.getState().openApp('settings', origin);

    expect(useAppRuntimeStore.getState().activeAppId).toBe('settings');
    expect(useAppRuntimeStore.getState().appOrigin).toEqual(origin);
    expect(useAppRuntimeStore.getState().recentApps).toEqual([{ id: 'settings', origin }]);
    expect(useAppRuntimeStore.getState().presentationMode).toBe('foreground');
  });

  it('activateApp reorders an existing task and marks switcher transition', () => {
    const origin1 = { x: 10, y: 20, width: 60, height: 60 };
    const origin2 = { x: 100, y: 200, width: 60, height: 60 };
    useAppRuntimeStore.getState().openApp('settings', origin1);
    useAppRuntimeStore.getState().openApp('weather', origin2);
    useAppRuntimeStore.getState().activateApp('settings');

    expect(useAppRuntimeStore.getState().activeAppId).toBe('settings');
    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual([
      'settings',
      'weather',
    ]);
    expect(useAppRuntimeStore.getState().transitionSource).toBe('switcher');
  });

  it('removeApp falls back to the next recent app', () => {
    const origin1 = { x: 10, y: 20, width: 60, height: 60 };
    const origin2 = { x: 100, y: 200, width: 60, height: 60 };
    useAppRuntimeStore.getState().openApp('settings', origin1);
    useAppRuntimeStore.getState().openApp('weather', origin2);
    useAppRuntimeStore.getState().removeApp('weather');

    expect(useAppRuntimeStore.getState().activeAppId).toBe('settings');
    expect(useAppRuntimeStore.getState().switcherAppId).toBe('settings');
  });

  // ---------- exitAppToHome ----------

  it('exitAppToHome sets dismissedAppId and dismissReason="home" for exit animation', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().exitAppToHome();

    const s = useAppRuntimeStore.getState();
    expect(s.activeAppId).toBeNull();
    expect(s.dismissedAppId).toBe('settings');
    expect(s.dismissReason).toBe('home');
    expect(s.presentationMode).toBe('foreground');
    expect(s.switcherAppId).toBe('settings');
  });

  it('exitAppToHome is a no-op when no app is active', () => {
    useAppRuntimeStore.getState().exitAppToHome();
    expect(useAppRuntimeStore.getState().dismissedAppId).toBeNull();
  });

  // ---------- openSwitcher ----------

  it('openSwitcher enters switcher mode', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openSwitcher();

    const s = useAppRuntimeStore.getState();
    expect(s.presentationMode).toBe('switcher');
    expect(s.switcherAppId).toBe('settings');
  });

  it('openSwitcher is a no-op when no app is active', () => {
    useAppRuntimeStore.getState().openSwitcher();
    expect(useAppRuntimeStore.getState().presentationMode).toBe('foreground');
  });

  it('openSwitcher is a no-op when recentApps is empty', () => {
    useAppRuntimeStore.setState({ activeAppId: 'settings', recentApps: [] });
    useAppRuntimeStore.getState().openSwitcher();
    expect(useAppRuntimeStore.getState().presentationMode).toBe('foreground');
  });

  // ---------- card dismiss ----------

  it('card dismiss commits but does not remove app (UI calls removeApp after animation)', () => {
    const origin1 = { x: 10, y: 20, width: 60, height: 60 };
    const origin2 = { x: 100, y: 200, width: 60, height: 60 };
    useAppRuntimeStore.getState().openApp('settings', origin1);
    useAppRuntimeStore.getState().openApp('alipay', origin2);
    useAppRuntimeStore.setState({
      presentationMode: 'switcher',
      switcherAppId: 'alipay',
    });

    useAppRuntimeStore.getState().startCardDismiss('alipay', 400, 600);
    useAppRuntimeStore.getState().updateCardDismiss(240, -1.2);
    const result = useAppRuntimeStore.getState().finishCardDismiss();

    expect(result.committed).toBe(true);
    // App is NOT yet removed — UI will call removeApp after fly-away animation
    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual(['alipay', 'settings']);
    expect(useAppRuntimeStore.getState().dismissReason).toBe('card');

    // Simulate UI calling removeApp after animation completes
    useAppRuntimeStore.getState().removeApp('alipay');
    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual(['settings']);
    expect(useAppRuntimeStore.getState().switcherAppId).toBe('settings');
  });

  it('finishCardDismiss returns committed, velocity, appId and sets dismissReason="card"', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openApp('alipay', { x: 60, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.setState({ presentationMode: 'switcher', switcherAppId: 'alipay' });
    useAppRuntimeStore.getState().startCardDismiss('alipay', 400, 600);
    useAppRuntimeStore.getState().updateCardDismiss(240, -1.2);

    const result = useAppRuntimeStore.getState().finishCardDismiss();

    expect(result).toEqual({ committed: true, velocity: -1.2, appId: 'alipay' });
    expect(useAppRuntimeStore.getState().dismissReason).toBe('card');
  });

  it('finishCardDismiss returns committed:false when threshold unmet', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.setState({ presentationMode: 'switcher', switcherAppId: 'settings' });
    useAppRuntimeStore.getState().startCardDismiss('settings', 400, 600);
    useAppRuntimeStore.getState().updateCardDismiss(380, -0.1);

    const result = useAppRuntimeStore.getState().finishCardDismiss();

    expect(result.committed).toBe(false);
    expect(result.appId).toBe('settings');
    expect(useAppRuntimeStore.getState().recentApps).toHaveLength(1);
    expect(useAppRuntimeStore.getState().dismissReason).toBeNull();
  });

  // ---------- P2a: activateAppFromCard ----------

  it('activateAppFromCard stores card rect + viewport and activates the app', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.getState().openApp('alipay', { x: 60, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.setState({ presentationMode: 'switcher', switcherAppId: 'alipay' });

    const cardRect = { x: 40, y: 120, width: 300, height: 640 };
    const viewport = { width: 390, height: 844 };
    useAppRuntimeStore.getState().activateAppFromCard('alipay', cardRect, viewport);

    const s = useAppRuntimeStore.getState();
    expect(s.activeAppId).toBe('alipay');
    expect(s.switcherCardOrigin).toEqual(cardRect);
    expect(s.switcherCardViewport).toEqual(viewport);
    expect(s.transitionSource).toBe('switcher');
  });

  // ---------- clearDismissedApp ----------

  it('clearDismissedApp resets dismissReason', () => {
    useAppRuntimeStore.setState({
      dismissedAppId: 'settings',
      dismissReason: 'card',
    });

    useAppRuntimeStore.getState().clearDismissedApp();

    expect(useAppRuntimeStore.getState().dismissedAppId).toBeNull();
    expect(useAppRuntimeStore.getState().dismissReason).toBeNull();
  });

  // ---------- P5: projection-based card dismiss ----------

  it('finishCardDismiss commits when projected travel passes 20% of card height', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.setState({ presentationMode: 'switcher', switcherAppId: 'settings' });
    useAppRuntimeStore.getState().startCardDismiss('settings', 400, 600);
    // deltaY = -80, velocity = -0.8. projected = -80 + (-0.8*499) ≈ -479.
    // threshold = -600*0.20 = -120. Committed.
    useAppRuntimeStore.getState().updateCardDismiss(320, -0.8);

    const result = useAppRuntimeStore.getState().finishCardDismiss();

    expect(result.committed).toBe(true);
  });

  it('finishCardDismiss does not commit when projected travel stays within 20% of card height', () => {
    useAppRuntimeStore.getState().openApp('settings', { x: 0, y: 0, width: 60, height: 60 });
    useAppRuntimeStore.setState({ presentationMode: 'switcher', switcherAppId: 'settings' });
    useAppRuntimeStore.getState().startCardDismiss('settings', 400, 600);
    // deltaY = -10, velocity = -0.05. projected = -10 + (-0.05*499) ≈ -34.95.
    // threshold = -600*0.20 = -120. Not committed.
    useAppRuntimeStore.getState().updateCardDismiss(390, -0.05);

    const result = useAppRuntimeStore.getState().finishCardDismiss();

    expect(result.committed).toBe(false);
  });

  // ---------- deriveGestureIntent ----------

  it('deriveGestureIntent maps presentationMode to intent', () => {
    expect(deriveGestureIntent('foreground')).toBe('idle');
    expect(deriveGestureIntent('switcher')).toBe('switcher-active');
  });
});
