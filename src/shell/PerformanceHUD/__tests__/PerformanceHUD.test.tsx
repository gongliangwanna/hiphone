import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerformanceHUD } from '../PerformanceHUD';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';

const makeSnapshot = (fps = 58.4) => ({
  frames: {
    sampleCount: 60,
    fps,
    avgFrameMs: 17.1,
    worstFrameMs: 42.8,
    slowFrames24: 4,
    slowFrames40: 1,
  },
});

describe('PerformanceHUD', () => {
  beforeEach(() => {
    usePerfDebugStore.setState({ enabled: true });
  });

  it('renders the floating ball with current fps', () => {
    render(<PerformanceHUD snapshot={makeSnapshot()} />);

    expect(screen.getByTestId('perf-hud')).toBeInTheDocument();
    expect(screen.getByTestId('perf-ball')).toBeInTheDocument();
    expect(screen.getByText('58')).toBeInTheDocument();
    expect(screen.queryByTestId('perf-panel')).not.toBeInTheDocument();
  });

  it('expands panel on tap and shows frame stats', async () => {
    const user = userEvent.setup();
    render(<PerformanceHUD snapshot={makeSnapshot()} />);

    await user.click(screen.getByTestId('perf-ball'));

    expect(screen.getByTestId('perf-panel')).toBeInTheDocument();
    expect(screen.getByText('58.4')).toBeInTheDocument();
    expect(screen.getByText('17.1ms')).toBeInTheDocument();
    expect(screen.getByText('42.8ms')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('collapses panel on second tap', async () => {
    const user = userEvent.setup();
    render(<PerformanceHUD snapshot={makeSnapshot()} />);

    await user.click(screen.getByTestId('perf-ball'));
    expect(screen.getByTestId('perf-panel')).toBeInTheDocument();

    await user.click(screen.getByTestId('perf-ball'));
    expect(screen.queryByTestId('perf-panel')).not.toBeInTheDocument();
  });

  it('closes perf HUD entirely via close button', async () => {
    const user = userEvent.setup();
    render(<PerformanceHUD snapshot={makeSnapshot()} />);

    await user.click(screen.getByTestId('perf-ball'));
    await user.click(screen.getByTestId('perf-close'));

    expect(usePerfDebugStore.getState().enabled).toBe(false);
  });

  it('shows green color for high fps', () => {
    render(<PerformanceHUD snapshot={makeSnapshot(55)} />);
    const ball = screen.getByTestId('perf-ball');
    expect(ball.style.border).toContain('rgb(52, 199, 89)');
  });

  it('shows yellow color for medium fps', () => {
    render(<PerformanceHUD snapshot={makeSnapshot(35)} />);
    const ball = screen.getByTestId('perf-ball');
    expect(ball.style.border).toContain('rgb(255, 159, 10)');
  });

  it('shows red color for low fps', () => {
    render(<PerformanceHUD snapshot={makeSnapshot(20)} />);
    const ball = screen.getByTestId('perf-ball');
    expect(ball.style.border).toContain('rgb(255, 59, 48)');
  });

  it('supports drag to reposition', () => {
    render(<PerformanceHUD snapshot={makeSnapshot()} />);
    const ball = screen.getByTestId('perf-ball');

    fireEvent.pointerDown(ball, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(ball, { clientX: 150, clientY: 120 });
    fireEvent.pointerUp(ball, { clientX: 150, clientY: 120 });

    const hud = screen.getByTestId('perf-hud');
    expect(parseInt(hud.style.left)).toBeGreaterThan(8);
  });

  it('shows -- when fps is 0', () => {
    render(<PerformanceHUD snapshot={makeSnapshot(0)} />);
    expect(screen.getByText('--')).toBeInTheDocument();
  });
});
