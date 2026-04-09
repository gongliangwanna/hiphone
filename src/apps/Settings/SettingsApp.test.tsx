import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsApp } from './SettingsApp';
import { useSettingsNavStore } from './settingsNavStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

describe('SettingsApp', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    useAppRuntimeStore.setState({ activeAppId: 'settings', appOrigin: { x: 0, y: 0, width: 60, height: 60 } });
  });

  it('renders settings home page with large title', () => {
    render(<SettingsApp />);
    expect(screen.getByTestId('settings-app')).toBeTruthy();
    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByTestId('nav-bar')).toHaveAttribute('data-variant', 'largeTitle');
    expect(screen.getByTestId('app-screen-content').getAttribute('style')).toContain(
      'padding-top: var(--app-safe-top)',
    );
  });

  it('renders search bar', () => {
    render(<SettingsApp />);
    expect(screen.getByTestId('settings-search')).toBeTruthy();
  });

  it('renders connectivity and general groups', () => {
    render(<SettingsApp />);
    expect(screen.getByTestId('settings-row-无线局域网')).toBeTruthy();
    expect(screen.getByTestId('settings-row-蓝牙')).toBeTruthy();
    expect(screen.getByTestId('settings-row-通用')).toBeTruthy();
    expect(screen.getByTestId('settings-row-壁纸')).toBeTruthy();
    expect(screen.getByTestId('settings-row-关于本机')).toBeTruthy();
  });

  it('does not show back button on home page', () => {
    render(<SettingsApp />);
    expect(screen.queryByTestId('nav-back')).toBeNull();
  });

  it('navigates to about page on click', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('settings-row-关于本机'));

    await waitFor(() => {
      expect(screen.getByTestId('about-page')).toBeTruthy();
    });
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveAttribute('data-variant', 'inline');
    expect(screen.getByTestId('nav-back')).toBeTruthy();
  });

  it('shows about page with device info', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('settings-row-关于本机'));

    await waitFor(() => {
      expect(screen.getByTestId('settings-row-名称')).toBeTruthy();
    }, { timeout: 2000 });
    expect(screen.getByTestId('about-row-iOS 版本')).toBeTruthy();
    expect(screen.getByTestId('about-row-构建版本')).toBeTruthy();
  });

  it('goes back to home from about page', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('settings-row-关于本机'));
    await waitFor(() => {
      expect(screen.getByTestId('about-page')).toBeTruthy();
    });

    await userEvent.click(screen.getByTestId('nav-back'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-home')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('nav-back')).toBeNull();
    });
  });

  it('navigates to wallpaper page on click', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('settings-row-壁纸'));

    await waitFor(() => {
      expect(screen.getByTestId('wallpaper-page')).toBeTruthy();
    }, { timeout: 2000 });
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveAttribute('data-variant', 'inline');
    expect(screen.getByTestId('nav-back')).toBeTruthy();
  });

  it('goes back to home from wallpaper page', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('settings-row-壁纸'));
    await waitFor(() => {
      expect(screen.getByTestId('wallpaper-page')).toBeTruthy();
    }, { timeout: 2000 });

    await userEvent.click(screen.getByTestId('nav-back'));
    await waitFor(() => {
      expect(screen.getByTestId('settings-home')).toBeTruthy();
    });
  });
});
