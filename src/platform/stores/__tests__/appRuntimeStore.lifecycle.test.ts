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
});
