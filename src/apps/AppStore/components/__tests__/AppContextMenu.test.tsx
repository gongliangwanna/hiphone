import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppContextMenu } from '../AppContextMenu';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

const app: InstalledUserApp = {
  id: 'demo', name: 'Demo', iconDataUrl: null,
  page: 0, perspectiveAware: false,
  version: '1.2.0', installedAt: Date.now(), sizeBytes: 1024,
};

describe('AppContextMenu', () => {
  it('renders three actions with app preview', () => {
    render(<AppContextMenu app={app}
      onOpen={() => {}} onDetail={() => {}} onUninstall={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /打开/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看详情/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /卸载/ })).toBeInTheDocument();
  });

  it('fires callbacks', () => {
    const onOpen = vi.fn(), onDetail = vi.fn(), onUninstall = vi.fn();
    render(<AppContextMenu app={app}
      onOpen={onOpen} onDetail={onDetail} onUninstall={onUninstall} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /打开/ }));
    fireEvent.click(screen.getByRole('button', { name: /查看详情/ }));
    fireEvent.click(screen.getByRole('button', { name: /卸载/ }));
    expect(onOpen).toHaveBeenCalled();
    expect(onDetail).toHaveBeenCalled();
    expect(onUninstall).toHaveBeenCalled();
  });

  it('fires onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<AppContextMenu app={app}
      onOpen={() => {}} onDetail={() => {}} onUninstall={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('context-menu-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
