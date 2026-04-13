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

  it('renders persona card and main groups', () => {
    render(<SettingsApp />);
    expect(screen.getByTestId('settings-persona-card')).toBeTruthy();
    expect(screen.getByTestId('list-row-角色')).toBeTruthy();
    expect(screen.getByTestId('list-row-AI 设置')).toBeTruthy();
    expect(screen.getByTestId('list-row-壁纸')).toBeTruthy();
    expect(screen.getByTestId('list-row-关于本机')).toBeTruthy();
  });

  it('does not show back button on home page', () => {
    render(<SettingsApp />);
    expect(screen.queryByTestId('nav-back')).toBeNull();
  });

  it('navigates to about page on click', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-关于本机'));

    await waitFor(() => {
      expect(screen.getByTestId('about-page')).toBeTruthy();
    });
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveAttribute('data-variant', 'inline');
    expect(screen.getByTestId('nav-back')).toBeTruthy();
  });

  it('shows about page with device info', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-关于本机'));

    await waitFor(() => {
      expect(screen.getByTestId('list-row-名称')).toBeTruthy();
    }, { timeout: 2000 });
    expect(screen.getByTestId('list-row-iOS 版本')).toBeTruthy();
    expect(screen.getByTestId('list-row-构建版本')).toBeTruthy();
  });

  it('goes back to home from about page', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-关于本机'));
    await waitFor(() => {
      expect(screen.getByTestId('about-page')).toBeTruthy();
    });

    await userEvent.click(screen.getByTestId('nav-back'));
    await waitFor(() => {
      expect(screen.getByTestId('list')).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByTestId('nav-back')).toBeNull();
    });
  });

  it('navigates to wallpaper page on click', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-壁纸'));

    await waitFor(() => {
      expect(screen.getByTestId('wallpaper-page')).toBeTruthy();
    }, { timeout: 2000 });
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveAttribute('data-variant', 'inline');
    expect(screen.getByTestId('nav-back')).toBeTruthy();
  });

  it('goes back to home from wallpaper page', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-壁纸'));
    await waitFor(() => {
      expect(screen.getByTestId('wallpaper-page')).toBeTruthy();
    }, { timeout: 2000 });

    await userEvent.click(screen.getByTestId('nav-back'));
    await waitFor(() => {
      expect(screen.getByTestId('list')).toBeTruthy();
    });
  });
});
