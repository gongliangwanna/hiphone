import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Device } from '../Device';
import { useSystemStore } from '@/platform/stores/systemStore';
import type { ViewportProfile } from '../viewportProfile';

const { viewportProfileRef } = vi.hoisted(() => ({
  viewportProfileRef: {
    current: {
      shellMode: 'simulator',
      sizeTier: 'large',
      width: 415,
      height: 900,
      isPortrait: true,
    } as ViewportProfile,
  },
}));

vi.mock('../useViewportProfile', () => ({
  useViewportProfile: () => viewportProfileRef.current,
}));

describe('Device', () => {
  beforeEach(() => {
    useSystemStore.setState({ isLocked: false });
    viewportProfileRef.current = {
      shellMode: 'simulator',
      sizeTier: 'large',
      width: 415,
      height: 900,
      isPortrait: true,
    };
  });

  it('renders wallpaper background', () => {
    render(<Device />);
    expect(screen.getByTestId('wallpaper')).toBeInTheDocument();
  });

  it('renders status bar', () => {
    render(<Device />);
    expect(screen.getByTestId('status-bar')).toBeInTheDocument();
  });

  it('renders springboard', () => {
    render(<Device />);
    expect(screen.getByTestId('springboard')).toBeInTheDocument();
  });

  it('renders lock screen with time when locked', () => {
    useSystemStore.setState({ isLocked: true });
    render(<Device />);
    expect(screen.getByTestId('lock-time')).toBeInTheDocument();
  });

  it('hides lock content when unlocked', () => {
    render(<Device />);
    expect(screen.queryByTestId('lock-time')).not.toBeInTheDocument();
  });

  it('renders a fullscreen shell without a rounded device frame', () => {
    viewportProfileRef.current = {
      shellMode: 'fullscreen',
      sizeTier: 'regular',
      width: 390,
      height: 844,
      isPortrait: true,
    };

    render(<Device />);
    const root = screen.getByTestId('device-root');

    expect(root).toHaveAttribute('data-shell-mode', 'fullscreen');
    expect(root.getAttribute('style')).toContain('width: 100vw');
    expect(root.getAttribute('style')).toContain('height: 100dvh');
    expect(root.getAttribute('style')).toContain('max-width: none');
    expect(root.getAttribute('style')).toContain('max-height: none');
    expect(root.style.borderRadius).toBe('0px');
  });

  it('renders a centered desktop shell without rounded corners', () => {
    render(<Device />);
    const root = screen.getByTestId('device-root');

    expect(root).toHaveAttribute('data-shell-mode', 'simulator');
    expect(root).toHaveAttribute('data-size-tier', 'large');
    expect(root.style.width).toBe('415px');
    expect(root.style.height).toBe('900px');
    expect(root.style.borderRadius).toBe('0px');
    expect(root.style.getPropertyValue('--safe-top')).toBe('env(safe-area-inset-top, 0px)');
    expect(root.style.getPropertyValue('--safe-bottom')).toBe('env(safe-area-inset-bottom, 0px)');
    expect(root.style.getPropertyValue('--shell-side-padding')).toBe('24px');
    expect(root.style.getPropertyValue('--springboard-top-padding')).toBe('18px');
  });
});
