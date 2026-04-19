import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstalledList } from '../InstalledList';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

function app(id: string, installedAt: number): InstalledUserApp {
  return {
    id,
    name: id.toUpperCase(),
    iconDataUrl: null,
    page: 1,
    perspectiveAware: false,
    version: '1.0.0',
    installedAt,
    sizeBytes: 1024,
  };
}

describe('InstalledList', () => {
  it('renders section header with app count', () => {
    const apps = [app('a', 2000), app('b', 1000)];
    render(<InstalledList apps={apps} onOpen={() => {}} onDelete={() => {}} onLongPress={() => {}} />);
    expect(screen.getByText(/已装 2 个/)).toBeInTheDocument();
  });

  it('sorts rows by installedAt descending', () => {
    const apps = [app('older', 1000), app('newer', 2000)];
    render(<InstalledList apps={apps} onOpen={() => {}} onDelete={() => {}} onLongPress={() => {}} />);
    const rows = screen.getAllByTestId(/^installed-app-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'installed-app-row-newer');
    expect(rows[1]).toHaveAttribute('data-testid', 'installed-app-row-older');
  });
});
