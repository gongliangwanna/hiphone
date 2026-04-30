import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsPage } from '../AppSettingsPage';
import { SettingsApp } from '../../SettingsApp';
import { useSettingsNavStore } from '../../settingsNavStore';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { calculateAllAppStorageUsage } from '@/platform/storage/calculateAppStorageUsage';

vi.mock('@/platform/storage/calculateAppStorageUsage', () => ({
  calculateAllAppStorageUsage: vi.fn(),
}));

const calculateAllAppStorageUsageMock = vi.mocked(calculateAllAppStorageUsage);

describe('AppSettingsPage', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    useAppProfileStore.setState({ profiles: {} });
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      appOrigin: { x: 0, y: 0, width: 60, height: 60 },
    });
    calculateAllAppStorageUsageMock.mockImplementation(async (appIds) =>
      Object.fromEntries(
        appIds.map((appId) => [
          appId,
          {
            appId,
            appBytes: appId === 'todo-app' ? 2048 : 0,
            dataBytes: 0,
            totalBytes: appId === 'todo-app' ? 2048 : 0,
          },
        ]),
      ),
    );
  });

  it('groups system, preinstalled, and user installed apps', async () => {
    useInstalledUserAppsStore.getState().replaceAll([
      {
        id: 'todo-app',
        name: '待办',
        iconDataUrl: null,
        page: 1,
        perspectiveAware: false,
        version: '1.0.0',
        installedAt: 1,
        sizeBytes: 2048,
      },
    ]);

    render(<AppSettingsPage />);

    expect(await screen.findByText('系统 App')).toBeInTheDocument();
    expect(screen.getByText('预装 App')).toBeInTheDocument();
    expect(screen.getByText('用户安装 App')).toBeInTheDocument();
    expect(screen.getByText('设置')).toBeInTheDocument();
    expect(screen.getByText('五子棋')).toBeInTheDocument();
    expect(screen.getByText('待办')).toBeInTheDocument();
    expect(await screen.findByText('2.0 KB')).toBeInTheDocument();
  });

  it('searches by custom name, original name, and app id', async () => {
    useAppProfileStore.getState().setName('safari', '网页');
    render(<AppSettingsPage />);

    const search = screen.getByTestId('app-settings-search');
    await userEvent.type(search, '网页');
    expect(screen.getByText('网页')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'Safari');
    expect(screen.getByText('网页')).toBeInTheDocument();

    await userEvent.clear(search);
    await userEvent.type(search, 'gomoku');
    expect(screen.getByText('五子棋')).toBeInTheDocument();
  });

  it('opens the app detail route with the app id param', async () => {
    render(<AppSettingsPage />);

    await userEvent.click(screen.getByTestId('app-settings-row-safari'));

    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]).toEqual({
      page: 'appDetail',
      params: { appId: 'safari' },
    });
  });

  it('navigates from Settings home to the App list page', async () => {
    render(<SettingsApp />);

    await userEvent.click(screen.getByTestId('list-row-App'));

    expect(await screen.findByTestId('app-settings-page')).toBeInTheDocument();
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveTextContent('App');
    await waitFor(() => {
      expect(screen.getByText('系统 App')).toBeInTheDocument();
    });
  });
});
