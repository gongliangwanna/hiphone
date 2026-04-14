import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WallpaperPage } from './WallpaperPage';
import { useSystemStore } from '@/platform/stores/systemStore';
import { wallpapers } from '@/shell/Springboard/apps.data';

describe('WallpaperPage', () => {
  beforeEach(() => {
    useSystemStore.setState({ wallpaperId: 'ios-26-stock-01', customWallpapers: [] });
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

  it('renders upload button', () => {
    render(<WallpaperPage />);
    expect(screen.getByTestId('wallpaper-upload-btn')).toBeTruthy();
  });

  it('renders custom wallpapers from store', () => {
    useSystemStore.setState({
      customWallpapers: [
        { id: 'custom-1', src: 'data:image/jpeg;base64,abc' },
        { id: 'custom-2', src: 'data:image/jpeg;base64,def' },
      ],
    });
    render(<WallpaperPage />);

    expect(screen.getByTestId('wallpaper-thumb-custom-1')).toBeTruthy();
    expect(screen.getByTestId('wallpaper-thumb-custom-2')).toBeTruthy();
  });

  it('clicking a custom wallpaper selects it', async () => {
    useSystemStore.setState({
      customWallpapers: [{ id: 'custom-1', src: 'data:image/jpeg;base64,abc' }],
    });
    render(<WallpaperPage />);

    await userEvent.click(screen.getByTestId('wallpaper-thumb-custom-1'));
    expect(useSystemStore.getState().wallpaperId).toBe('custom-1');
  });

  it('shows checkmark on selected custom wallpaper', () => {
    useSystemStore.setState({
      wallpaperId: 'custom-1',
      customWallpapers: [{ id: 'custom-1', src: 'data:image/jpeg;base64,abc' }],
    });
    render(<WallpaperPage />);

    const check = screen.getByTestId('wallpaper-check');
    const thumb = screen.getByTestId('wallpaper-thumb-custom-1');
    expect(thumb.contains(check)).toBe(true);
  });

  it('delete button removes custom wallpaper', async () => {
    useSystemStore.setState({
      customWallpapers: [{ id: 'custom-1', src: 'data:image/jpeg;base64,abc' }],
    });
    render(<WallpaperPage />);

    await userEvent.click(screen.getByTestId('wallpaper-delete-custom-1'));
    expect(useSystemStore.getState().customWallpapers).toHaveLength(0);
  });

  it('renders current wallpaper preview section', () => {
    render(<WallpaperPage />);
    const preview = screen.getByTestId('wallpaper-preview');
    expect(preview).toBeTruthy();
    expect(preview.style.backgroundImage).toContain('ios-26-stock-01');
  });

  it('preview updates when wallpaper changes', () => {
    useSystemStore.setState({ wallpaperId: 'ios-26-stock-03' });
    render(<WallpaperPage />);
    const preview = screen.getByTestId('wallpaper-preview');
    expect(preview.style.backgroundImage).toContain('ios-26-stock-03');
  });

  it('preview shows custom wallpaper when selected', () => {
    useSystemStore.setState({
      wallpaperId: 'custom-1',
      customWallpapers: [{ id: 'custom-1', src: 'data:image/jpeg;base64,abc' }],
    });
    render(<WallpaperPage />);
    const preview = screen.getByTestId('wallpaper-preview');
    expect(preview.style.backgroundImage).toContain('data:image/jpeg;base64,abc');
  });

  it('deleting active custom wallpaper resets to default', async () => {
    useSystemStore.setState({
      wallpaperId: 'custom-1',
      customWallpapers: [{ id: 'custom-1', src: 'data:image/jpeg;base64,abc' }],
    });
    render(<WallpaperPage />);

    await userEvent.click(screen.getByTestId('wallpaper-delete-custom-1'));
    expect(useSystemStore.getState().wallpaperId).toBe('ios-26-stock-01');
  });

  it('selected wallpaper has outline style', () => {
    useSystemStore.setState({ wallpaperId: 'ios-26-stock-02' });
    render(<WallpaperPage />);

    const selectedThumb = screen.getByTestId('wallpaper-thumb-ios-26-stock-02');
    expect(selectedThumb.style.outline).toContain('var(--color-systemBlue)');
  });

  it('system wallpapers do not show delete button', () => {
    render(<WallpaperPage />);
    for (const w of wallpapers) {
      expect(screen.queryByTestId(`wallpaper-delete-${w.id}`)).toBeNull();
    }
  });
});
