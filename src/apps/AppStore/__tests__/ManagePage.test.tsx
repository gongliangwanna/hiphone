import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ManagePage } from '../ManagePage';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import * as installerMod from '@/platform/userApp/installer';

describe('ManagePage', () => {
  beforeEach(() => {
    useInstalledUserAppsStore.setState({ apps: [] });
    vi.restoreAllMocks();
  });

  it('renders empty state when no apps installed', () => {
    render(<ManagePage />);
    expect(screen.getByTestId('appstore-manage-page')).toBeInTheDocument();
    expect(screen.getByText(/尚未安装/)).toBeInTheDocument();
  });

  it('renders one row per installed user app', () => {
    useInstalledUserAppsStore.setState({
      apps: [
        { id: 'todo', name: '待办', iconDataUrl: null, page: 1, perspectiveAware: false },
        { id: 'shop', name: '商场', iconDataUrl: null, page: 1, perspectiveAware: false },
      ],
    });
    render(<ManagePage />);
    expect(screen.getByTestId('installed-app-row-todo')).toBeInTheDocument();
    expect(screen.getByTestId('installed-app-row-shop')).toBeInTheDocument();
    expect(screen.getByText('待办')).toBeInTheDocument();
    expect(screen.getByText('商场')).toBeInTheDocument();
  });

  it('opens UninstallConfirm when minus button is clicked', () => {
    useInstalledUserAppsStore.setState({
      apps: [{ id: 'todo', name: '待办', iconDataUrl: null, page: 1, perspectiveAware: false }],
    });
    render(<ManagePage />);
    fireEvent.click(screen.getByTestId('uninstall-button-todo'));
    expect(screen.getByTestId('uninstall-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText(/卸载 待办？/)).toBeInTheDocument();
  });

  it('cancel closes the dialog and does not call installer.uninstall', () => {
    const uninstallSpy = vi.spyOn(installerMod, 'uninstall').mockResolvedValue();
    useInstalledUserAppsStore.setState({
      apps: [{ id: 'todo', name: '待办', iconDataUrl: null, page: 1, perspectiveAware: false }],
    });
    render(<ManagePage />);
    fireEvent.click(screen.getByTestId('uninstall-button-todo'));
    fireEvent.click(screen.getByTestId('uninstall-cancel'));
    expect(screen.queryByTestId('uninstall-confirm-dialog')).not.toBeInTheDocument();
    expect(uninstallSpy).not.toHaveBeenCalled();
  });

  it('confirm calls installer.uninstall; row removed when store updates', async () => {
    const uninstallSpy = vi.spyOn(installerMod, 'uninstall').mockImplementation(async (id) => {
      // Simulate real installer's effect on the store
      useInstalledUserAppsStore.getState().remove(id);
    });

    useInstalledUserAppsStore.setState({
      apps: [
        { id: 'todo', name: '待办', iconDataUrl: null, page: 1, perspectiveAware: false },
        { id: 'shop', name: '商场', iconDataUrl: null, page: 1, perspectiveAware: false },
      ],
    });
    render(<ManagePage />);

    fireEvent.click(screen.getByTestId('uninstall-button-todo'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('uninstall-confirm'));
    });

    expect(uninstallSpy).toHaveBeenCalledWith('todo');
    await waitFor(() => {
      expect(screen.queryByTestId('installed-app-row-todo')).not.toBeInTheDocument();
    });
    // The other app should still be listed
    expect(screen.getByTestId('installed-app-row-shop')).toBeInTheDocument();
    // Dialog closes after action
    expect(screen.queryByTestId('uninstall-confirm-dialog')).not.toBeInTheDocument();
  });

  it('shows error toast-like surface when installer.uninstall rejects', async () => {
    vi.spyOn(installerMod, 'uninstall').mockRejectedValue(new Error('IDB failure'));
    useInstalledUserAppsStore.setState({
      apps: [{ id: 'todo', name: '待办', iconDataUrl: null, page: 1, perspectiveAware: false }],
    });
    render(<ManagePage />);
    fireEvent.click(screen.getByTestId('uninstall-button-todo'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('uninstall-confirm'));
    });
    await waitFor(() => {
      expect(screen.getByText(/卸载失败/)).toBeInTheDocument();
    });
    // Row remains since uninstall failed
    expect(screen.getByTestId('installed-app-row-todo')).toBeInTheDocument();
  });
});
