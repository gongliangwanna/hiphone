import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WallpaperPage } from './WallpaperPage';
import { useSystemStore } from '@/platform/stores/systemStore';
import { wallpapers } from '@/shell/Springboard/apps.data';

describe('WallpaperPage', () => {
  beforeEach(() => {
    useSystemStore.setState({ wallpaperId: 'ios-26-stock-01' });
  });

  it('renders all 7 wallpaper thumbnails', () => {
    render(<WallpaperPage />);
    expect(screen.getByTestId('wallpaper-page')).toBeTruthy();
    for (const w of wallpapers) {
      expect(screen.getByTestId(`wallpaper-thumb-${w.id}`)).toBeTruthy();
    }
  });

  it('shows checkmark on current wallpaper', () => {
    useSystemStore.setState({ wallpaperId: 'ios-26-stock-03' });
    render(<WallpaperPage />);

    const check = screen.getByTestId('wallpaper-check');
    expect(check).toBeTruthy();

    // The check should be inside thumb-03
    const thumb03 = screen.getByTestId('wallpaper-thumb-ios-26-stock-03');
    expect(thumb03.contains(check)).toBe(true);
  });

  it('clicking a thumbnail updates wallpaperId in store', async () => {
    render(<WallpaperPage />);

    await userEvent.click(screen.getByTestId('wallpaper-thumb-ios-26-stock-05'));
    expect(useSystemStore.getState().wallpaperId).toBe('ios-26-stock-05');
  });

  it('checkmark moves to newly selected wallpaper', async () => {
    render(<WallpaperPage />);

    // Initially on stock-01
    expect(screen.getByTestId('wallpaper-check')).toBeTruthy();

    // Click stock-04
    await userEvent.click(screen.getByTestId('wallpaper-thumb-ios-26-stock-04'));

    // Check is now inside stock-04
    const check = screen.getByTestId('wallpaper-check');
    const thumb04 = screen.getByTestId('wallpaper-thumb-ios-26-stock-04');
    expect(thumb04.contains(check)).toBe(true);
  });
});
