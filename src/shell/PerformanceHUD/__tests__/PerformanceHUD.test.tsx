import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformanceHUD } from '../PerformanceHUD';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

describe('PerformanceHUD', () => {
  beforeEach(() => {
    vi.useRealTimers();
    usePerfDebugStore.setState({
      enabled: true,
      disableWallpaper: false,
      disableDesktopFilter: false,
      reduceTransparency: false,
      hideIconImages: false,
    });
  });

  it('renders the current perf snapshot', () => {
    render(
      <PerformanceHUD
        snapshot={{
          frames: {
            sampleCount: 60,
            fps: 58.4,
            avgFrameMs: 17.1,
            worstFrameMs: 42.8,
            slowFrames24: 4,
            slowFrames40: 1,
          },
          recentFrameMs: [16.2, 16.8, 24.5, 18.1, 33.2, 16.4],
          longTaskCount: 2,
          longestLongTaskMs: 88.4,
          topResources: [
            {
              label: 'ios/ios-26-stock-03.png',
              initiatorType: 'img',
              sizeBytes: 4096,
              durationMs: 20.1,
            },
          ],
          activeLayers: [
            { name: 'wallpaper', count: 1 },
            { name: 'material:thick', count: 1 },
          ],
          activeBackdropCount: 1,
          viewportWidth: 390,
          viewportHeight: 844,
          dpr: 3,
          hardwareConcurrency: 6,
          deviceMemory: 8,
        }}
      />,
    );

    expect(screen.getByTestId('perf-hud')).toBeInTheDocument();
    expect(screen.getByText('fps: 58.4')).toBeInTheDocument();
    expect(screen.getByText('long tasks: 2')).toBeInTheDocument();
    expect(screen.getByText('ios/ios-26-stock-03.png')).toBeInTheDocument();
    expect(screen.getByText('wallpaper × 1')).toBeInTheDocument();
    expect(screen.getByTestId('perf-frame-chart')).toBeInTheDocument();
    expect(screen.getByTestId('perf-hud-header')).toBeInTheDocument();
    expect(screen.getByTestId('perf-hud-body')).toBeInTheDocument();
    expect(screen.getByTestId('perf-hud')).not.toHaveClass('overflow-auto');
    expect(screen.getByTestId('perf-hud-body')).toHaveClass('overflow-auto');
  });

  it('updates debug toggles and can close itself', async () => {
    const user = userEvent.setup();
    render(
      <PerformanceHUD
        snapshot={{
          frames: {
            sampleCount: 0,
            fps: 0,
            avgFrameMs: 0,
            worstFrameMs: 0,
            slowFrames24: 0,
            slowFrames40: 0,
          },
          recentFrameMs: [],
          longTaskCount: 0,
          longestLongTaskMs: 0,
          topResources: [],
          activeLayers: [],
          activeBackdropCount: 0,
          viewportWidth: 390,
          viewportHeight: 844,
          dpr: 3,
          hardwareConcurrency: null,
          deviceMemory: null,
        }}
      />,
    );

    await user.click(screen.getByLabelText('关闭壁纸'));
    await user.click(screen.getByLabelText('关闭桌面 blur'));
    await user.click(screen.getByLabelText('降级毛玻璃'));
    await user.click(screen.getByLabelText('隐藏图标图片'));

    expect(usePerfDebugStore.getState().disableWallpaper).toBe(true);
    expect(usePerfDebugStore.getState().disableDesktopFilter).toBe(true);
    expect(usePerfDebugStore.getState().reduceTransparency).toBe(true);
    expect(usePerfDebugStore.getState().hideIconImages).toBe(true);

    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(usePerfDebugStore.getState().enabled).toBe(false);
  });

  it('copies the current snapshot to clipboard and shows feedback', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText,
      },
    });

    render(
      <PerformanceHUD
        snapshot={{
          frames: {
            sampleCount: 60,
            fps: 58.4,
            avgFrameMs: 17.1,
            worstFrameMs: 42.8,
            slowFrames24: 4,
            slowFrames40: 1,
          },
          recentFrameMs: [16.2, 16.8, 24.5, 18.1, 33.2, 16.4],
          longTaskCount: 2,
          longestLongTaskMs: 88.4,
          topResources: [
            {
              label: 'ios/ios-26-stock-03.png',
              initiatorType: 'img',
              sizeBytes: 4096,
              durationMs: 20.1,
            },
          ],
          activeLayers: [
            { name: 'wallpaper', count: 1 },
          ],
          activeBackdropCount: 1,
          viewportWidth: 390,
          viewportHeight: 844,
          dpr: 3,
          hardwareConcurrency: 6,
          deviceMemory: 8,
        }}
      />,
    );

    await user.click(screen.getByTestId('perf-copy-button'));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0]?.[0]).toContain('hiPhone Performance Snapshot');
    expect(writeText.mock.calls[0]?.[0]).toContain('[TopResources]');
    expect(writeText.mock.calls[0]?.[0]).toContain('- hideIconImages=false');
    expect(screen.getByRole('button', { name: '已复制' })).toBeInTheDocument();
  });
});
