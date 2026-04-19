import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstalledAppRow } from '../InstalledAppRow';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

const sample: InstalledUserApp = {
  id: 'demo',
  name: 'Demo',
  iconDataUrl: null,
  page: 1,
  perspectiveAware: false,
  version: '1.2.3',
  installedAt: Date.now() - 2 * 24 * 3_600_000,
  sizeBytes: 2 * 1024 * 1024,
};

describe('InstalledAppRow', () => {
  it('renders name, version, formatted size, relative time', () => {
    render(
      <InstalledAppRow app={sample} onOpen={() => {}} onLongPress={() => {}} onDetail={() => {}} />,
    );
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/2 天前/)).toBeInTheDocument();
  });

  it('shows default icon placeholder when no iconDataUrl', () => {
    render(
      <InstalledAppRow app={sample} onOpen={() => {}} onLongPress={() => {}} onDetail={() => {}} />,
    );
    expect(screen.getByTestId(`installed-app-icon-${sample.id}`)).toBeInTheDocument();
  });

  it('calls onOpen when "打开" button clicked', () => {
    const onOpen = vi.fn();
    render(
      <InstalledAppRow app={sample} onOpen={onOpen} onLongPress={() => {}} onDetail={() => {}} />,
    );
    fireEvent.click(screen.getByTestId(`open-button-${sample.id}`));
    expect(onOpen).toHaveBeenCalledWith(sample.id);
  });

  it('calls onDetail when row is tapped', () => {
    const onDetail = vi.fn();
    render(
      <InstalledAppRow app={sample} onOpen={() => {}} onLongPress={() => {}} onDetail={onDetail} />,
    );
    fireEvent.click(screen.getByTestId(`installed-app-row-${sample.id}`));
    expect(onDetail).toHaveBeenCalledWith(sample.id);
  });

  it('formats "—" size for legacy (sizeBytes: 0)', () => {
    render(
      <InstalledAppRow
        app={{ ...sample, sizeBytes: 0 }}
        onOpen={() => {}}
        onLongPress={() => {}}
        onDetail={() => {}}
      />,
    );
    expect(screen.getByTestId(`installed-app-meta-${sample.id}`).textContent).toContain('—');
  });
});
