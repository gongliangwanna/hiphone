import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LockScreen } from '../LockScreen';

const WALLPAPER = '/resource/wallpapers/ios/ios-26-stock-01.png';

describe('LockScreen', () => {
  const mockUnlock = vi.fn();

  beforeEach(() => {
    mockUnlock.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders lock time', () => {
    render(<LockScreen onUnlock={mockUnlock} visible wallpaper={WALLPAPER} />);
    expect(screen.getByTestId('lock-time')).toBeInTheDocument();
  });

  it('renders date', () => {
    render(<LockScreen onUnlock={mockUnlock} visible wallpaper={WALLPAPER} />);
    expect(screen.getByTestId('lock-date')).toBeInTheDocument();
  });

  it('uses directional touch-action for vertical unlock gesture handling', () => {
    render(<LockScreen onUnlock={mockUnlock} visible wallpaper={WALLPAPER} />);
    expect(screen.getByTestId('lock-screen')).toHaveStyle({ touchAction: 'pan-x' });
  });

  it('calls onUnlock on fast upward swipe', () => {
    render(<LockScreen onUnlock={mockUnlock} visible wallpaper={WALLPAPER} />);
    const container = screen.getByTestId('lock-screen');

    act(() => {
      fireEvent.pointerDown(container, { clientX: 100, clientY: 600, pointerId: 1 });
      fireEvent.pointerMove(container, { clientX: 100, clientY: 400, pointerId: 1 });
      fireEvent.pointerUp(container, { clientX: 100, clientY: 100, pointerId: 1 });
    });

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockUnlock).toHaveBeenCalled();
  });

  it('does not call onUnlock on small drag', () => {
    render(<LockScreen onUnlock={mockUnlock} visible wallpaper={WALLPAPER} />);
    const container = screen.getByTestId('lock-screen');

    act(() => {
      fireEvent.pointerDown(container, { clientX: 100, clientY: 400, pointerId: 1 });
      fireEvent.pointerMove(container, { clientX: 100, clientY: 420, pointerId: 1 });
      fireEvent.pointerUp(container, { clientX: 100, clientY: 420, pointerId: 1 });
    });

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockUnlock).not.toHaveBeenCalled();
  });

  it('renders flashlight and camera buttons', () => {
    render(<LockScreen onUnlock={mockUnlock} visible wallpaper={WALLPAPER} />);
    // Two circular buttons at bottom
    const buttons = screen.getByTestId('lock-screen').querySelectorAll('.rounded-full');
    expect(buttons.length).toBe(2);
  });
});
