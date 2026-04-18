import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AppStoreApp } from '../AppStoreApp';

describe('AppStoreApp', () => {
  it('renders the App Store NavBar title', () => {
    render(<AppStoreApp />);
    expect(screen.getByText('App Store')).toBeInTheDocument();
  });

  it('shows the upload tab by default', () => {
    render(<AppStoreApp />);
    // Upload tab surface: the file input or drop zone should be present
    expect(screen.getByTestId('appstore-upload-page')).toBeInTheDocument();
  });

  it('switches to manage tab when the 已装 tab is clicked', () => {
    render(<AppStoreApp />);
    const manageButton = screen.getByRole('button', { name: /已装/ });
    fireEvent.click(manageButton);
    expect(screen.getByTestId('appstore-manage-page')).toBeInTheDocument();
    expect(screen.queryByTestId('appstore-upload-page')).not.toBeInTheDocument();
  });

  it('switches back to upload tab', () => {
    render(<AppStoreApp />);
    fireEvent.click(screen.getByRole('button', { name: /已装/ }));
    fireEvent.click(screen.getByRole('button', { name: /上传/ }));
    expect(screen.getByTestId('appstore-upload-page')).toBeInTheDocument();
  });
});
