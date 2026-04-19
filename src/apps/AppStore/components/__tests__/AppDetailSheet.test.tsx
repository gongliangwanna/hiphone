import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppDetailSheet } from '../AppDetailSheet';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

const app: InstalledUserApp = {
  id: 'com.demo', name: 'Demo', iconDataUrl: null,
  page: 0, perspectiveAware: true,
  version: '1.2.0', installedAt: 1700000000000, sizeBytes: 2621440, // 2.5 MB
};

describe('AppDetailSheet', () => {
  it('shows basic metadata', () => {
    render(<AppDetailSheet app={app} onClose={() => {}} onUninstall={() => {}} />);
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText(/1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText('com.demo')).toBeInTheDocument();
    expect(screen.getByText('2.5 MB')).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
  });

  it('uninstall button triggers callback then close', () => {
    const onUninstall = vi.fn(), onClose = vi.fn();
    render(<AppDetailSheet app={app} onClose={onClose} onUninstall={onUninstall} />);
    fireEvent.click(screen.getByRole('button', { name: '卸载 App' }));
    expect(onUninstall).toHaveBeenCalled();
  });
});
