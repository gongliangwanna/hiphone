import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from './Toast';
import { useToastStore } from './toastStore';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ message: null, visible: false });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render when not visible', () => {
    render(<Toast />);
    expect(screen.queryByTestId('toast')).toBeNull();
  });

  it('renders message when visible', () => {
    useToastStore.getState().show('测试消息');
    render(<Toast />);
    expect(screen.getByTestId('toast')).toBeTruthy();
    expect(screen.getByText('测试消息')).toBeTruthy();
  });

  it('auto-hides after 2 seconds', () => {
    render(<Toast />);
    act(() => {
      useToastStore.getState().show('即将消失');
    });
    expect(screen.getByTestId('toast')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // After timer fires, store visible=false (AnimatePresence exit animation
    // keeps the DOM element briefly, so we check store state instead)
    expect(useToastStore.getState().visible).toBe(false);
  });
});
