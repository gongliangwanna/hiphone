import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppIcon } from './AppIcon';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';
import type { AppInfo } from './apps.data';

const settingsApp: AppInfo = {
  id: 'settings',
  name: '设置',
  icon: '/resource/icons/ios-system/settings.jpg',
  page: 0,
};

const otherApp: AppInfo = {
  id: 'wechat',
  name: '微信',
  icon: '/resource/icons/popular-cn/wechat.jpg',
  page: 1,
};

describe('AppIcon', () => {
  beforeEach(() => {
    useAppRuntimeStore.setState({
      activeAppId: null,
      appOrigin: null,
      recentApps: [],
      switcherAppId: null,
      transitionSource: 'icon',
    });
    usePerfDebugStore.setState({ hideIconImages: false });
  });

  it('renders icon image and label', () => {
    render(<AppIcon app={settingsApp} />);
    expect(screen.getByTestId('app-icon-settings')).toBeTruthy();
    expect(screen.getByAltText('设置')).toBeTruthy();
    expect(screen.getByText('设置')).toBeTruthy();
  });

  it('hides label when hideLabel is true', () => {
    render(<AppIcon app={settingsApp} hideLabel />);
    expect(screen.queryByText('设置')).toBeNull();
  });

  it('renders a solid placeholder instead of the image when icon isolation is enabled', () => {
    usePerfDebugStore.setState({ hideIconImages: true });
    render(<AppIcon app={settingsApp} />);

    expect(screen.getByTestId('app-icon-placeholder-settings')).toBeInTheDocument();
    expect(screen.queryByAltText('设置')).toBeNull();
  });

  it('opens settings app on click', async () => {
    render(<AppIcon app={settingsApp} />);
    await userEvent.click(screen.getByTestId('app-icon-settings'));

    const state = useAppRuntimeStore.getState();
    expect(state.activeAppId).toBe('settings');
    expect(state.appOrigin).not.toBeNull();
  });

  it('opens a demo app for non-settings icons', async () => {
    render(<AppIcon app={otherApp} />);
    await userEvent.click(screen.getByTestId('app-icon-wechat'));

    expect(useAppRuntimeStore.getState().activeAppId).toBe('wechat');
    expect(useAppRuntimeStore.getState().recentApps.map((task) => task.id)).toEqual(['wechat']);
  });
});
