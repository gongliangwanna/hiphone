import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppStoreApp } from '../AppStoreApp';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

describe('AppStoreApp', () => {
  beforeEach(() => {
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('renders large-title NavBar', () => {
    render(<AppStoreApp />);
    expect(screen.getByText('App Store')).toBeInTheDocument();
  });

  it('renders EmptyState when no apps installed', () => {
    render(<AppStoreApp />);
    expect(screen.getByTestId('appstore-empty-state')).toBeInTheDocument();
  });

  it('renders InstalledList when apps exist', () => {
    useInstalledUserAppsStore.setState({
      apps: [
        {
          id: 'demo',
          name: 'Demo',
          iconDataUrl: null,
          page: 1,
          perspectiveAware: false,
          version: '1.0.0',
          installedAt: Date.now(),
          sizeBytes: 0,
        },
      ],
    });
    render(<AppStoreApp />);
    expect(screen.getByTestId('appstore-installed-list')).toBeInTheDocument();
  });

  it('opens upload sheet when "+" button clicked', () => {
    render(<AppStoreApp />);
    fireEvent.click(screen.getByTestId('appstore-plus-button'));
    expect(screen.getByTestId('appstore-upload-sheet')).toBeInTheDocument();
  });

  it('opens upload sheet via EmptyState CTA', () => {
    render(<AppStoreApp />);
    fireEvent.click(screen.getByRole('button', { name: /上传 zip/ }));
    expect(screen.getByTestId('appstore-upload-sheet')).toBeInTheDocument();
  });
});
