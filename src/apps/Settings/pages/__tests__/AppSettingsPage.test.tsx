import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppSettingsPage } from '../AppSettingsPage';
import { SettingsApp } from '../../SettingsApp';
import { useSettingsNavStore } from '../../settingsNavStore';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import {
  calculateAllAppStorageUsage,
  calculateAppStorageUsage,
} from '@/platform/storage/calculateAppStorageUsage';

vi.mock('@/platform/storage/calculateAppStorageUsage', () => ({
  calculateAllAppStorageUsage: vi.fn(),
  calculateAppStorageUsage: vi.fn(),
}));

const calculateAllAppStorageUsageMock = vi.mocked(calculateAllAppStorageUsage);
const calculateAppStorageUsageMock = vi.mocked(calculateAppStorageUsage);

function mockUsageFor(appId: string) {
  if (appId === 'safari') {
    return {
      appId,
      appBytes: 4096,
      dataBytes: 1024,
      totalBytes: 5120,
    };
  }

  return {
    appId,
    appBytes: appId === 'todo-app' ? 2048 : 0,
    dataBytes: 0,
    totalBytes: appId === 'todo-app' ? 2048 : 0,
  };
}

function renderSettingsAppAtAppDetail(appId: string) {
  useSettingsNavStore.getState().push('apps');
  useSettingsNavStore.getState().push({
    page: 'appDetail',
    params: { appId },
  });
  render(<SettingsApp />);
}

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
      Object.fromEntries(appIds.map((appId) => [appId, mockUsageFor(appId)])),
    );
    calculateAppStorageUsageMock.mockImplementation(async (appId) =>
      mockUsageFor(appId),
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

  it('opens the app detail page in SettingsApp instead of falling back home', async () => {
    render(<SettingsApp />);

    await userEvent.click(screen.getByTestId('list-row-App'));
    expect(await screen.findByTestId('app-settings-page')).toBeInTheDocument();
    await userEvent.click(await screen.findByTestId('app-settings-row-safari'));

    expect(await screen.findByTestId('app-detail-page')).toBeInTheDocument();
    const navBars = screen.getAllByTestId('nav-bar');
    expect(navBars[navBars.length - 1]).toHaveTextContent('Safari');
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

  it('edits the display name and restores the default profile', async () => {
    renderSettingsAppAtAppDetail('safari');

    const nameInput = await screen.findByTestId('app-detail-name-input');
    expect(nameInput).toHaveValue('Safari');

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, '网页');
    await userEvent.click(screen.getByTestId('app-detail-save-name'));

    await waitFor(() => {
      expect(screen.getByTestId('app-detail-name-input')).toHaveValue('网页');
    });
    expect(
      useAppProfileStore.getState().getProfile('safari')?.customName,
    ).toBe('网页');

    await userEvent.click(screen.getByTestId('app-detail-restore-default'));

    await waitFor(() => {
      expect(screen.getByTestId('app-detail-name-input')).toHaveValue('Safari');
    });
    expect(useAppProfileStore.getState().getProfile('safari')).toBeUndefined();
  });

  it('shows read-only storage rows without a clear action', async () => {
    renderSettingsAppAtAppDetail('safari');

    expect(await screen.findByText('App 大小')).toBeInTheDocument();
    expect(screen.getByText('文稿与数据')).toBeInTheDocument();
    expect(screen.getByText('总占用')).toBeInTheDocument();
    expect(await screen.findByText('4.0 KB')).toBeInTheDocument();
    expect(screen.getByText('1.0 KB')).toBeInTheDocument();
    expect(screen.getByText('5.0 KB')).toBeInTheDocument();
    expect(screen.queryByText(/清空/)).not.toBeInTheDocument();
  });

  it('shows an empty state when the app id is missing', async () => {
    useSettingsNavStore.getState().push({ page: 'appDetail' });
    render(<SettingsApp />);

    expect(await screen.findByTestId('app-detail-empty')).toHaveTextContent(
      'App 不存在',
    );
  });

  it('pushes the app icon editor route with the current app id', async () => {
    renderSettingsAppAtAppDetail('safari');

    await userEvent.click(await screen.findByTestId('app-detail-edit-icon'));

    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]).toEqual({
      page: 'appIconEditor',
      params: { appId: 'safari' },
    });
  });
});
